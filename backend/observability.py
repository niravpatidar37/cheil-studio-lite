"""Langfuse tracing for every LLM call, with token and cost accounting.

Tracing is entirely optional: if LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are
not set, every helper here degrades to a no-op context manager so the app runs
unchanged. Nothing in the request path should fail because tracing is down.
"""

import logging
import os
from contextlib import contextmanager, nullcontext

logger = logging.getLogger(__name__)

_client = None
_enabled: bool | None = None

# USD per 1M tokens. Update if Google changes pricing — these drive the cost
# figures shown in Langfuse, so a stale number here means a wrong dashboard.
PRICING = {
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50},
    "gemini-2.5-flash-image": {"input": 0.30, "output": 2.50, "per_image": 0.039},
}


def is_enabled() -> bool:
    global _enabled
    if _enabled is None:
        _enabled = bool(
            os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY")
        )
        if not _enabled:
            logger.info("Langfuse not configured — tracing disabled")
    return _enabled


def get_client():
    global _client
    if not is_enabled():
        return None
    if _client is None:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
            secret_key=os.environ["LANGFUSE_SECRET_KEY"],
            host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        )
    return _client


def extract_usage(response) -> dict[str, int]:
    """Pull token counts off a Gemini response into Langfuse's usage schema."""
    meta = getattr(response, "usage_metadata", None)
    if meta is None:
        return {}

    def val(*names):
        for n in names:
            v = getattr(meta, n, None)
            if isinstance(v, int):
                return v
        return 0

    usage = {
        "input": val("prompt_token_count"),
        "output": val("candidates_token_count"),
        "total": val("total_token_count"),
    }
    # Thinking models bill reasoning tokens separately; surface them so the
    # dashboard doesn't silently under-report spend.
    thoughts = val("thoughts_token_count")
    if thoughts:
        usage["output_reasoning"] = thoughts
    cached = val("cached_content_token_count")
    if cached:
        usage["input_cached"] = cached
    return {k: v for k, v in usage.items() if v}


def estimate_cost(model: str, usage: dict[str, int], images: int = 0) -> dict[str, float]:
    rates = PRICING.get(model)
    if not rates:
        return {}
    inp = usage.get("input", 0) + usage.get("input_cached", 0)
    out = usage.get("output", 0) + usage.get("output_reasoning", 0)
    cost = {
        "input": inp / 1_000_000 * rates["input"],
        "output": out / 1_000_000 * rates["output"],
    }
    if images and "per_image" in rates:
        cost["output"] += images * rates["per_image"]
    cost["total"] = cost["input"] + cost["output"]
    return {k: round(v, 8) for k, v in cost.items() if v}


@contextmanager
def trace(name: str, *, run_type: str = "chain", input=None, metadata=None):
    """Open a root observation for one user-facing operation."""
    client = get_client()
    if client is None:
        yield None
        return
    try:
        with client.start_as_current_observation(
            name=name, as_type=run_type, input=input, metadata=metadata
        ) as span:
            yield span
    except Exception:
        logger.exception("Langfuse trace failed — continuing untraced")
        raise


@contextmanager
def generation(name: str, *, model: str, input=None, model_parameters=None):
    """Open a generation (LLM call) observation.

    Yields a recorder; call `.finish(response, output=..., images=...)` to
    attach token usage and cost once the call returns.
    """
    client = get_client()
    if client is None:
        yield _NullRecorder()
        return
    try:
        with client.start_as_current_observation(
            name=name,
            as_type="generation",
            model=model,
            input=input,
            model_parameters=model_parameters or {},
        ) as gen:
            yield _Recorder(gen, model)
    except Exception:
        logger.exception("Langfuse generation failed — continuing untraced")
        raise


class _NullRecorder:
    def finish(self, *args, **kwargs):
        pass

    def fail(self, *args, **kwargs):
        pass


class _Recorder:
    def __init__(self, gen, model):
        self._gen = gen
        self._model = model

    def finish(self, response=None, *, output=None, images: int = 0):
        try:
            usage = extract_usage(response) if response is not None else {}
            self._gen.update(
                output=output,
                usage_details=usage or None,
                cost_details=estimate_cost(self._model, usage, images) or None,
            )
        except Exception:
            logger.exception("Failed to record generation usage")

    def fail(self, error: Exception):
        try:
            self._gen.update(level="ERROR", status_message=str(error)[:500])
        except Exception:
            logger.exception("Failed to record generation error")


def score(name: str, value, *, comment: str | None = None, data_type: str | None = None):
    """Attach a feedback score to the current trace."""
    client = get_client()
    if client is None:
        return
    try:
        client.score_current_trace(
            name=name, value=value, comment=comment, data_type=data_type
        )
    except Exception:
        logger.exception("Failed to record score %s", name)


def flush():
    client = get_client()
    if client is not None:
        try:
            client.flush()
        except Exception:
            logger.exception("Langfuse flush failed")
