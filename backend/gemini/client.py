import os
import logging
from google import genai
from google.genai import types
from pydantic import BaseModel

from .. import observability as obs
from .prompts import SAMSUNG_BRAND_VOICE

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
IMAGE_MODEL = "gemini-2.5-flash-image"
IMAGE_MAX_ATTEMPTS = 2
IMAGE_RETRY_BASE_DELAY = 3.0
IMAGE_CONCURRENCY = 4

_client = None

def get_client():
    global _client
    if _client is not None:
        return _client

    use_vertex = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true", "yes")

    if use_vertex:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        if not project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is not set (required for Vertex AI mode)")
        _client = genai.Client(vertexai=True, project=project, location=location)
        return _client

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    _client = genai.Client(api_key=api_key)
    return _client

async def _generate(
    prompt: str,
    schema: type[BaseModel],
    temperature: float = 0.8,
    *,
    guardrails: list = None,
    name: str = "generate",
    system: str = SAMSUNG_BRAND_VOICE,
    model_name: str = MODEL,
):
    client = get_client()

    with obs.generation(
        name,
        model=model_name,
        input={"system": system, "prompt": prompt},
        model_parameters={"temperature": temperature, "schema": schema.__name__},
    ) as rec:
        import asyncio
        from pydantic_ai import Agent
        from pydantic_ai.models.google import GoogleModel

        g_model = GoogleModel(
            model_name,
            provider=(
                __import__('pydantic_ai.providers.google_cloud').providers.google_cloud.GoogleCloudProvider(client=client)
                if os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true", "yes")
                else __import__('pydantic_ai.providers.google').providers.google.GoogleProvider(client=client)
            )
        )
        agent = Agent(
            g_model,
            system_prompt=system,
            output_type=schema,
            capabilities=guardrails if guardrails else [],
        )

        try:
            response = await asyncio.wait_for(
                agent.run(prompt, model_settings={"temperature": temperature}),
                timeout=45.0
            )
        except Exception as e:
            rec.fail(e)
            raise
        
        # Log string representation of the parsed output
        rec.finish(response, output=str(response.output))
        return response.output
