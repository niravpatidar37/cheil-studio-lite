from dotenv import load_dotenv

load_dotenv()

import asyncio
import base64
import logging

from fastapi import FastAPI, HTTPException, Response, Header, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document as DocxDocument

from . import mock_data
from . import gemini as gemini_service
from . import observability as obs
from . import store

logger = logging.getLogger(__name__)

def is_demo_mode(x_demo_mode: str | None) -> bool:
    if x_demo_mode == "true": return True
    import os
    if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_GENAI_USE_VERTEXAI"): return True
    return False

app = FastAPI(title="Cheil Studio Lite API")

# Detached job tasks. asyncio only holds a weak reference to a running task, so
# without this a job can be garbage collected mid-flight.
_JOBS: set[asyncio.Task] = set()


@app.on_event("startup")
def _init_storage():
    store.init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- PRODUCT CATALOG ---
PRODUCTS = {
    "Galaxy S26": {
        "category": "Smartphone",
        "benefits": ["AI-powered camera", "Premium design", "All-day battery"],
        "image_url": "/galaxy-s26.png",
    },
    "Galaxy Watch 6": {
        "category": "Wearable",
        "benefits": ["Health & sleep tracking", "Seamless ecosystem", "Classic design"],
        "image_url": "/galaxy-watch-6.png",
    },
    "Neo QLED 8K TV": {
        "category": "Television",
        "benefits": ["Cinematic 8K clarity", "Immersive sound", "Infinity One design"],
        "image_url": "/neo-qled-8k-tv.png",
    },
    "Bespoke AI Jet Ultra": {
        "category": "Vacuum",
        "benefits": ["Powerful suction", "AI floor detection", "Clean station included"],
        "image_url": "/bespoke-ai-jet-ultra.png",
    },
    "Bespoke Refrigerator": {
        "category": "Appliance",
        "benefits": ["Customizable panels", "Family Hub integrated", "Energy efficient"],
        "image_url": "/bespoke-refrigerator.png",
    },
}


@app.get("/api/products")
def get_products():
    return PRODUCTS


# --- GEMINI-BACKED GENERATION ---
class IdeaModel(BaseModel):
    en: str
    fr: str


class IdeaGenRequest(BaseModel):
    product: str
    brief: str
    background: str
    formats: list[str]
    audiences: list[str]
    products: list[str] = []

class IdeaTranslateRequest(BaseModel):
    ideas: list[dict]


class LogoPlacement(BaseModel):
    format: str
    lang: str
    y_pct: float
    show: bool = True


class QualityCheckRequest(BaseModel):
    product: str
    products: list[str] = []
    campaign_type: str
    formats: list[str]
    assets: dict
    brief: str = ""
    logo_placements: list[LogoPlacement] = []


class AssetsRequest(BaseModel):
    campaign_type: str  # "image" | "video" | "email"
    product: str
    products: list[str] = []
    idea: IdeaModel
    formats: list[str]
    audiences: list[str]
    secondary: str = ""  # Platform (video) / Tone (email)
    # The approved direction is only the angle; the offer, dates and named
    # features stay in the brief, so copy generation needs it too.
    brief: str = ""


class ReviseRequest(BaseModel):
    """Apply a quality report's findings back onto the copy."""

    campaign_type: str
    product: str
    products: list[str] = []
    formats: list[str]
    assets: dict
    checks: list[dict] = []
    brief: str = ""


class ImageJobRequest(BaseModel):
    """One image-generation job. Covers both the initial batch and a single
    regenerate from the editor — the latter is just a one-element list."""

    product: str
    products: list[str] = []
    idea_en: str
    style: str
    banner_sizes: list[str]
    audiences: list[str] = []
    # PNG data URL of the catalog shot the user selected, used to ground the
    # device so the model reproduces it instead of imagining one. A bundle sends
    # `product_images` instead — one per name, in the same order.
    product_image: str = ""
    product_images: list[str] = []
    campaign_id: str | None = None
    brief: str = ""


class CampaignSaveRequest(BaseModel):
    id: str | None = None
    name: str
    campaign_type: str
    status: str = "draft"
    state: dict


def _gemini_error(e: Exception) -> HTTPException:
    """Log the full error server-side, surface a short actionable reason to the UI."""
    text = str(e)
    logger.exception("Gemini generation failed")

    if "GEMINI_API_KEY is not set" in text:
        reason = "no API key configured"
    elif "prepayment credits are depleted" in text or "billing" in text.lower():
        reason = "the Google Cloud project has no billing credits left"
    elif "RESOURCE_EXHAUSTED" in text or "429" in text:
        # Vertex shared-capacity throttling — transient, not a hard quota.
        reason = "the model is temporarily rate-limited, please try again in a moment"
    elif "SERVICE_DISABLED" in text:
        reason = "the Gemini API is not enabled for this Google Cloud project"
    elif "API_KEY_SERVICE_BLOCKED" in text:
        reason = "this API key is restricted and does not allow the Gemini API"
    elif "PERMISSION_DENIED" in text or "API_KEY_INVALID" in text or "401" in text or "403" in text:
        reason = "API key rejected"
    elif "DEADLINE_EXCEEDED" in text or "timeout" in text.lower():
        reason = "the request timed out"
    elif "Prompt blocked by" in text:
        reason = text
    else:
        reason = "an unexpected API error"

    return HTTPException(status_code=502, detail=reason)


@app.post("/api/extract-text")
async def api_extract_text(file: UploadFile = File(...)):
    filename = (file.filename or "").lower()
    text = ""
    try:
        if filename.endswith(".pdf"):
            reader = PdfReader(file.file)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif filename.endswith(".docx"):
            doc = DocxDocument(file.file)
            for para in doc.paragraphs:
                if para.text.strip():
                    text += para.text.strip() + "\n"
        elif filename.endswith(".txt") or filename.endswith(".md"):
            content = await file.read()
            text = content.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    except Exception as e:
        logger.exception("Document extraction failed")
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"text": text.strip()}

@app.post("/api/ideas")
async def api_generate_ideas(req: IdeaGenRequest, owner_id: str = Header(None, alias="X-Owner-Id"), x_demo_mode: str | None = Header(None, alias="X-Demo-Mode")):
    if is_demo_mode(x_demo_mode):
        return {"ideas": mock_data.generate_ideas(req.brief), "source": "mock"}
        
    with obs.trace("api-generate-ideas"):
        try:
            ideas = await gemini_service.generate_ideas(
                brief=req.brief,
                product=req.product,
                background=req.background,
                formats=req.formats,
                audiences=req.audiences,
                products=req.products,
            )
            return {"ideas": ideas, "source": "ai"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

class IdeaTranslateRequest(BaseModel):
    ideas: list[dict]

@app.post("/api/ideas/translate")
async def api_translate_ideas(req: IdeaTranslateRequest, x_demo_mode: str | None = Header(None, alias="X-Demo-Mode")):
    if is_demo_mode(x_demo_mode):
        return {"ideas": req.ideas, "source": "mock"}

    print("====== [TRANSLATION INIT] ======")
    print(f"Received Request: {len(req.ideas)} ideas.")
    try:
        translated = await gemini_service.translate_ideas(req.ideas)
        print(f"====== [TRANSLATION SUCCESS] ======\nReturning payload: {translated}\n")
        return {"ideas": translated, "source": "ai"}
    except Exception as e:
        print(f"====== [TRANSLATION CRASH] ======\n{str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/quality-check")
async def api_quality_check(req: QualityCheckRequest, x_demo_mode: str | None = Header(None, alias="X-Demo-Mode")):
    # Quality check is now deterministic and independent of demo mode, but we can pass it through.
    with obs.trace(
        "quality-check",
        run_type="guardrail",
        input={"product": req.product, "formats": req.formats, "brief": req.brief},
    ):
        try:
            report = await gemini_service.run_quality_check(
                req.product,
                req.campaign_type,
                req.assets,
                req.formats,
                req.brief,
                [p.model_dump() for p in req.logo_placements],
                req.products,
            )
            # Record the verdict as feedback scores so pass rates are trackable
            # over time, not just visible in one trace.
            verdict = str(report.get("overall", "")).lower()
            obs.score(
                "guardrail_verdict",
                verdict or "unknown",
                data_type="CATEGORICAL",
            )
            obs.score(
                "guardrail_pass",
                1.0 if verdict == "pass" else 0.0,
                data_type="NUMERIC",
                comment=f"{sum(1 for c in report.get('checks', []) if c.get('status') == 'pass')}"
                f"/{len(report.get('checks', []))} checks passed",
            )
            return report
        except Exception as e:
            raise _gemini_error(e)


@app.post("/api/assets")
async def api_generate_assets(req: AssetsRequest, x_demo_mode: str | None = Header(None, alias="X-Demo-Mode")):
    if is_demo_mode(x_demo_mode):
        if req.campaign_type == "image":
            mock_a = mock_data.generate_image_assets(req.product, req.idea.model_dump(), req.formats, req.audiences)
        elif req.campaign_type == "email":
            mock_a = mock_data.generate_email_assets(req.product, req.idea.model_dump(), req.formats, req.audiences)
        elif req.campaign_type == "video":
            mock_a = mock_data.generate_video_assets(req.product, req.idea.model_dump(), req.formats, req.audiences)
        else:
            mock_a = {}
        return {"assets": mock_a, "source": "mock"}

    with obs.trace(
        "assets",
        run_type="chain",
        input={"campaign_type": req.campaign_type, "product": req.product, "formats": req.formats},
    ):
        try:
            assets = await gemini_service.generate_assets(
                req.campaign_type,
                req.product,
                req.idea.model_dump(),
                req.formats,
                req.audiences,
                req.secondary,
                req.brief,
                req.products,
            )
            return {"assets": assets, "source": "ai"}
        except Exception as e:
            raise _gemini_error(e)


@app.post("/api/assets/revise")
async def api_revise_assets(req: ReviseRequest, x_demo_mode: str | None = Header(None, alias="X-Demo-Mode")):
    if is_demo_mode(x_demo_mode):
        return {"assets": req.assets, "source": "mock"}

    with obs.trace(
        "assets-revise",
        run_type="chain",
        input={"campaign_type": req.campaign_type, "formats": req.formats},
        metadata={"findings": len(req.checks)},
    ):
        try:
            assets = await gemini_service.revise_assets(
                req.campaign_type,
                req.product,
                req.assets,
                req.formats,
                req.checks,
                req.brief,
                req.products,
            )
            return {"assets": assets, "source": "ai"}
        except Exception as e:
            raise _gemini_error(e)


async def _generate_images(req: "ImageJobRequest") -> dict:
    """Generate one background per requested banner size, concurrently.

    Sizes that share an aspect ratio are generated once and shared: the image
    prompt contains no banner-size term, so Website and Desktop (both 16:9)
    were previously issuing two byte-identical requests.

    Returns image *ids*, not data URIs. The bytes go to the image table and are
    served from /api/images/{id}; a 1.5 MB base64 string per format has no
    business travelling through JSON on every poll.
    """
    groups: dict[str, list[str]] = {}
    for size in req.banner_sizes:
        groups.setdefault(gemini_service.aspect_for(size), []).append(size)

    with obs.trace(
        "images-job",
        run_type="chain",
        input={"banner_sizes": req.banner_sizes, "style": req.style},
        metadata={
            "concurrency": gemini_service.IMAGE_CONCURRENCY,
            "unique_aspects": len(groups),
            "calls_saved": len(req.banner_sizes) - len(groups),
        },
    ):
        # Cap parallelism — firing every format at once is what trips Vertex's
        # shared-capacity limit and makes all of them fail together.
        sem = asyncio.Semaphore(gemini_service.IMAGE_CONCURRENCY)

        async def one(size: str):
            async with sem:
                return await gemini_service.generate_background(
                    req.product,
                    req.idea_en,
                    req.style,
                    size,
                    req.audiences,
                    req.product_image,
                    req.products,
                    req.product_images,
                    req.brief,
                )

        reps = [sizes[0] for sizes in groups.values()]
        results = await asyncio.gather(*[one(r) for r in reps], return_exceptions=True)

        by_aspect: dict[str, str] = {}
        images: dict[str, str] = {}
        failed: list[str] = []
        for aspect, sizes in zip(groups.keys(), groups.values()):
            result = results[reps.index(sizes[0])]
            if isinstance(result, Exception):
                logger.exception(
                    "Background generation failed for %s", ", ".join(sizes), exc_info=result
                )
                failed.extend(sizes)
            else:
                by_aspect[aspect] = result
                for size in sizes:
                    images[size] = result

        if not images:
            # Re-raise the real cause rather than a generic error: throttling is
            # by far the most common reason everything fails, and _gemini_error
            # can only tell the user "try again in a moment" if it can still see
            # the 429.
            cause = next((r for r in results if isinstance(r, Exception)), None)
            raise cause or RuntimeError("all image generations failed")

        # A format whose own call was throttled out reuses the nearest aspect
        # that did succeed. A real scene, cropped, beats a flat preset gradient.
        degraded: list[str] = []
        for size in list(failed):
            want = gemini_service.ratio_of(gemini_service.aspect_for(size))
            nearest = min(by_aspect, key=lambda a: abs(gemini_service.ratio_of(a) - want))
            images[size] = by_aspect[nearest]
            degraded.append(size)
        failed = []

        obs.score(
            "image_success_rate",
            len(by_aspect) / max(len(reps), 1),
            data_type="NUMERIC",
            comment=f"{len(by_aspect)}/{len(reps)} image call(s) succeeded, "
            f"covering {len(req.banner_sizes)} format(s); degraded: {degraded or 'none'}",
        )

        # Persist each distinct image once, then map every format to its id.
        ids_by_uri: dict[str, str] = {}
        image_ids: dict[str, str] = {}
        for size, data_uri in images.items():
            if data_uri not in ids_by_uri:
                header, _, payload = data_uri.partition(",")
                mime = header[5:].split(";", 1)[0] if header.startswith("data:") else "image/png"
                ids_by_uri[data_uri] = store.put_image(
                    req.campaign_id, size, mime, base64.b64decode(payload)
                )
            image_ids[size] = ids_by_uri[data_uri]

        return {"images": image_ids, "failed": failed, "degraded": degraded}


async def _run_image_job(job_id: str, req: "ImageJobRequest") -> None:
    """Own the work for one job and record its outcome.

    Runs detached from the request that created it, so a client that navigates
    away, refreshes, or drops the connection does not abandon a generation that
    is already being billed.
    """
    store.update_job(job_id, status="running")
    try:
        result = await _generate_images(req)
        store.update_job(job_id, status="done", result=result)
    except Exception as e:  # noqa: BLE001 — recorded on the job, not raised
        logger.exception("Image job %s failed", job_id)
        store.update_job(job_id, status="error", error=_gemini_error(e).detail)


@app.post("/api/jobs/images")
async def api_enqueue_images(req: ImageJobRequest, x_owner_id: str | None = Header(None), x_demo_mode: str | None = Header(None, alias="X-Demo-Mode")):
    summary = req.model_dump(exclude={"product_image"})
    summary["grounded"] = bool(req.product_image)
    job_id = store.create_job("images", req.campaign_id, x_owner_id, summary)
    
    if is_demo_mode(x_demo_mode):
        # Resolve it immediately
        mock_res = {"images": {}, "failed": [], "degraded": []}
        store.update_job(job_id, status="done", result=mock_res)
        return {"job_id": job_id, "status": "done", "source": "mock"}

    task = asyncio.create_task(_run_image_job(job_id, req))
    _JOBS.add(task)  # hold a reference; a bare task can be garbage collected
    task.add_done_callback(_JOBS.discard)
    return {"job_id": job_id, "status": "queued", "source": "ai"}


@app.get("/api/jobs/{job_id}")
def api_get_job(job_id: str, response: Response, x_owner_id: str | None = Header(None)):
    job = store.get_job(job_id, x_owner_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return job


@app.get("/api/images/{image_id}")
def api_get_image(image_id: str):
    found = store.get_image(image_id)
    if not found:
        raise HTTPException(status_code=404, detail="image not found")
    mime, data = found
    # Content-addressed by a random id and never mutated, so it can be cached
    # hard. This is what makes serving by URL cheaper than inlining base64.
    return Response(
        content=data,
        media_type=mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# --- Campaigns -------------------------------------------------------------
@app.post("/api/campaigns")
def api_save_campaign(req: CampaignSaveRequest, x_owner_id: str | None = Header(None)):
    campaign_id = store.save_campaign(
        req.id, x_owner_id, req.name, req.campaign_type, req.state, req.status
    )
    return {"id": campaign_id}


@app.get("/api/campaigns")
def api_list_campaigns(x_owner_id: str | None = Header(None)):
    return {"campaigns": store.list_campaigns(x_owner_id)}


@app.get("/api/campaigns/{campaign_id}")
def api_get_campaign(campaign_id: str, x_owner_id: str | None = Header(None)):
    campaign = store.get_campaign(campaign_id, x_owner_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="campaign not found")
    return campaign


@app.delete("/api/campaigns/{campaign_id}")
def api_delete_campaign(campaign_id: str, x_owner_id: str | None = Header(None)):
    if not store.delete_campaign(campaign_id, x_owner_id):
        raise HTTPException(status_code=404, detail="campaign not found")
    return {"deleted": campaign_id}


@app.on_event("shutdown")
def _flush_traces():
    obs.flush()
