import asyncio
import base64
import logging
import os

from google import genai
from google.genai import types
from pydantic import BaseModel

from . import observability as obs

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
IMAGE_MODEL = "gemini-2.5-flash-image"

# Vertex image models run on shared capacity; 429s are common and transient.
IMAGE_MAX_ATTEMPTS = 5
IMAGE_RETRY_BASE_DELAY = 3.0  # seconds, doubled each attempt
# Parallel image calls, capped. Measured against this project's shared capacity:
# 1 -> 134s all-pass, 2 -> 48s all-pass, 4 -> 77s with a failure. Two is the
# sweet spot; the retry above absorbs the occasional 429 it still causes.
# Note that /api/backgrounds now issues one call per unique aspect ratio rather
# than one per format, so the usual batch is 3 calls, not 4.
IMAGE_CONCURRENCY = 2

SAMSUNG_BRAND_VOICE = """You are the in-house creative copywriter for Samsung marketing campaigns,
working inside an internal tool called Cheil Studio Lite. Write in Samsung's global brand voice:

- Confident and premium, never hype-y. No exclamation points, no words like
  "revolutionary", "game-changing", or "unleash".
- Human and benefit-led: describe what the technology does for the person, not just specs.
- Clear, concise, modern. Sentence case for headlines, not Title Case. No emoji.
- Warm but precise — Samsung sounds smart, not salesy.

For French copy, write natural Canadian French (fr-CA) for a Canadian Samsung audience —
a genuine native rewrite that preserves the same meaning and tone, not a literal translation.

HARD GUARDRAILS — these are non-negotiable:
- Never invent specifications, prices, discounts, dates, or availability that were not
  supplied in the brief. If the brief gives no number, do not state one.
- Never make superlative or comparative claims about competitors ("better than",
  "the best phone", "beats X").
- Never make medical, health-outcome, or safety claims.
- No exclamation marks. No ALL-CAPS words. No emoji. No hashtags.
- Banned words: revolutionary, game-changing, unleash, insane, mind-blowing, magical,
  cutting-edge, disruptive, must-have.
- Never use the words "Cheil" or reference this tool in customer-facing copy.
- Keep Samsung product names exactly as given — do not abbreviate or restyle them.

Follow the requested output format and item counts exactly. Return items in the same
order as the inputs listed in the prompt."""

# The reviewer is auditing copy, not writing it. Sending it the full copywriter
# brief above both wastes input tokens on every check and primes it to think
# like an author rather than a critic.
REVIEWER_VOICE = """You are a strict brand-compliance reviewer for Samsung marketing copy.
Judge only what you are shown. Do not rewrite or improve the copy.
Follow the requested output format and item counts exactly, in the order listed."""

_client = None


def get_client():
    """Build a Gemini client.

    Two auth modes are supported:
      1. Vertex AI (service account) — used when GOOGLE_GENAI_USE_VERTEXAI=true.
         Credentials come from GOOGLE_APPLICATION_CREDENTIALS (service-account
         JSON) or ambient ADC. Required for org accounts that block API keys.
      2. AI Studio API key — used when GEMINI_API_KEY is set.
    """
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
    name: str = "generate",
    system: str = SAMSUNG_BRAND_VOICE,
):
    """One structured-output LLM call, traced with token usage and cost.

    `system` is overridable so reviewer-style calls don't pay for the full
    copywriter brief they have no use for.
    """
    client = get_client()
    with obs.generation(
        name,
        model=MODEL,
        input={"system": system, "prompt": prompt},
        model_parameters={"temperature": temperature, "schema": schema.__name__},
    ) as rec:
        try:
            response = await client.aio.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=temperature,
                ),
            )
        except Exception as e:
            rec.fail(e)
            raise
        rec.finish(response, output=response.text)
        return response.parsed


# --- Schemas (plain ordered lists — the caller zips them with its own input
# order, so the model never has to echo back an exact key string) ---
class IdeaItem(BaseModel):
    en: str
    fr: str
    headline_en: str
    headline_fr: str
    body_en: str
    body_fr: str


class IdeasList(BaseModel):
    ideas: list[IdeaItem]


class QualityCheckItem(BaseModel):
    criterion: str
    status: str  # "pass" | "warn" | "fail"
    note: str


class QualityReport(BaseModel):
    overall: str  # "pass" | "warn" | "fail"
    checks: list[QualityCheckItem]


# Short, user-facing labels for the 5 review criteria, in prompt order.
CHECK_LABELS = [
    "Brand tone",
    "Guardrail compliance",
    "English grammar",
    "French translation",
    "Length & fit",
]

# Brand rule: the Samsung logo may only sit in the top or bottom band of a
# banner. Kept in sync with frontend/src/lib/logoZones.js.
LOGO_TOP_MAX_PCT = 15.0
LOGO_BOTTOM_MIN_PCT = 75.0


def check_logo_placement(placements: list[dict]) -> dict:
    """Validate logo positions geometrically.

    This is a deterministic fact about coordinates, so it is computed rather
    than sent to the model — an LLM would be both slower and less reliable at
    it, and would cost tokens on every review.
    """
    if not placements:
        return {
            "criterion": "Logo placement",
            "status": "warn",
            "note": "No logo placement data was supplied for review.",
        }

    offending = []
    for p in placements:
        if not p.get("show", True):
            continue
        y = float(p.get("y_pct", 0))
        if not (y <= LOGO_TOP_MAX_PCT or y >= LOGO_BOTTOM_MIN_PCT):
            label = f"{p.get('format', '?')} {str(p.get('lang', '')).upper()}".strip()
            offending.append(f"{label} ({y:.0f}% from top)")

    if offending:
        return {
            "criterion": "Logo placement",
            "status": "fail",
            "note": (
                "The Samsung logo must sit in the top or bottom band. "
                f"Outside it on: {', '.join(offending)}."
            ),
        }
    return {
        "criterion": "Logo placement",
        "status": "pass",
        "note": "The Samsung logo is within the top or bottom band on every asset.",
    }


# Phrases that name the reader's inactivity. A re-engagement email containing
# one has already broken its strategy, and detecting it is exact string
# matching rather than a judgement call — so it is checked in code, like the
# logo geometry, instead of being paid for in model tokens on every review.
INACTIVITY_PHRASES = [
    # English
    "miss you", "missed you", "been a while", "long time", "haven't seen",
    "havent seen", "we noticed you", "no longer", "inactive", "come back",
    "still there", "still interested", "where have you been", "win you back",
    "lost touch", "reconnect with you",
    # fr-CA
    "vous nous manquez", "depuis un moment", "cela fait longtemps",
    "ça fait longtemps", "inactif", "inactive", "revenez", "toujours intéressé",
    "nous avons remarqué", "perdu de vue",
]


def check_reengagement(assets: dict, formats: list[str]) -> dict | None:
    """Verify a re-engagement email hands over control instead of naming absence.

    Returns None when no re-engagement format was selected, so the check only
    appears on campaigns it applies to.
    """
    targets = [f for f in formats if "re-engagement" in f.lower() or "reengagement" in f.lower()]
    if not targets:
        return None

    named_absence: list[str] = []
    no_controls: list[str] = []
    for fmt in targets:
        asset = assets.get(fmt) or {}
        for lang in ("en", "fr"):
            block = asset.get(lang) or {}
            prose = " ".join(v for k, v in block.items() if isinstance(v, str)).lower()
            hits = sorted({p for p in INACTIVITY_PHRASES if p in prose})
            if hits:
                named_absence.append(f'{fmt} {lang.upper()} ("{hits[0]}")')
            if not (block.get("preference_options") or []):
                no_controls.append(f"{fmt} {lang.upper()}")

    if named_absence:
        return {
            "criterion": "Re-engagement strategy",
            "status": "fail",
            "note": (
                "Re-engagement copy must not point at inactivity — it assigns blame and "
                f"adds friction. Found on: {', '.join(named_absence)}."
            ),
        }
    if no_controls:
        return {
            "criterion": "Re-engagement strategy",
            "status": "warn",
            "note": (
                "No preference choices offered on "
                f"{', '.join(no_controls)} — without them the email re-engages by asking, "
                "not by letting the reader tailor what they receive."
            ),
        }
    return {
        "criterion": "Re-engagement strategy",
        "status": "pass",
        "note": "Offers preference controls and avoids referencing inactivity.",
    }


class ImageCopy(BaseModel):
    headline: str
    body: str


class ImageAssetItem(BaseModel):
    en: ImageCopy
    fr: ImageCopy


class ImageAssetsList(BaseModel):
    assets: list[ImageAssetItem]


class VideoCopy(BaseModel):
    hook: str
    scenes: list[str]
    cta: str


class VideoAssetItem(BaseModel):
    en: VideoCopy
    fr: VideoCopy


class VideoAssetsList(BaseModel):
    assets: list[VideoAssetItem]


class EmailCopy(BaseModel):
    subject: str
    preheader: str  # the grey line clients show next to the subject
    headline: str
    body: str
    cta_label: str
    # Only populated for types whose strategy calls for it (see
    # EMAIL_TYPE_GUIDANCE); empty for everything else.
    preference_options: list[str]


class EmailAssetItem(BaseModel):
    en: EmailCopy
    fr: EmailCopy


class EmailAssetsList(BaseModel):
    assets: list[EmailAssetItem]


# What each email type is actually *for*. The model writes markedly better copy
# when told the strategy than when left to infer it from a label — given only
# the word "Re-engagement" it reliably produces "we miss you", which is the one
# thing that type must not say.
EMAIL_TYPE_GUIDANCE = {
    "Re-engagement": (
        "Do NOT mention inactivity, absence, silence, 'we miss you', 'it's been a while', "
        "or anything implying the reader did something wrong. Declining engagement "
        "usually means the content was mismatched, not that interest is gone — naming it "
        "assigns blame and adds friction. Frame this positively as improving their "
        "experience and cutting inbox clutter, and hand over control: the reader chooses "
        "what they hear about and how often. preference_options must list 3-4 concrete, "
        "mutually distinct choices (topics and/or frequency). The call to action sets "
        "preferences; it does not sell."
    ),
    "Product & Feature Update": (
        "Announce what is new or improved on a product the reader already owns. Tie every "
        "update to something they actually do with the device — an update matters because "
        "of what it now lets them do, not because it exists. Lead with the outcome, never "
        "the feature name or a spec on its own. Aim at adoption: make the next step small "
        "and specific. This is not a launch email; do not sell the product itself."
    ),
    "Abandoned Cart": (
        "Assume the reader chose to wait, not that they forgot. Be useful and low "
        "pressure: restate what the item does for them and make returning to it easy. "
        "No countdown urgency and no guilt."
    ),
    "New Product Launch": (
        "Lead with what is genuinely new and what it changes for the reader. Confident, "
        "not breathless."
    ),
    "Promotional Blast": (
        "State the offer plainly and only as the brief describes it. Never invent a "
        "discount, deadline, or price."
    ),
    "Newsletter": (
        "Editorial rather than salesy: a useful read that happens to come from Samsung."
    ),
    "Loyalty Offer": (
        "Acknowledge an existing relationship warmly and without flattery. Make the "
        "benefit concrete."
    ),
}


# --- Generation functions ---
def _product_lines(product: str, products: list[str] | None) -> list[str]:
    """Describe the campaign's product(s) for a prompt.

    A campaign can cover several products at once — a handset plus the earbuds
    bundled with it, say. They share one set of assets rather than getting one
    each, so the model has to be told it is writing for a bundle; given a bare
    comma-separated list it tends to write about the first item and ignore the
    rest.
    """
    names = [p for p in (products or []) if p] or ([product] if product else [])
    if not names:
        return []
    if len(names) == 1:
        return [f"Product: {names[0]}"]
    return [
        f"Products (one campaign covering all {len(names)} together): "
        + ", ".join(names),
        f"This is a bundle. Treat all {len(names)} as equal subjects — none is the "
        f"hero and none is an accessory to another. Give them comparable weight and "
        f"prominence. Do not write about only one of them, do not lead on one and "
        f"relegate the rest, and do not write separate copy per product.",
    ]


async def generate_ideas(
    brief: str,
    product: str = "",
    background: str = "",
    formats: list[str] | None = None,
    audiences: list[str] | None = None,
    products: list[str] | None = None,
) -> list[dict]:
    """Creative directions + banner copy, generated with the full campaign setup as context."""
    context = [f'Campaign brief: "{brief}"']
    context.extend(_product_lines(product, products))
    if audiences:
        context.append(f"Target audience: {', '.join(audiences)}")
    if formats:
        context.append(f"Formats to be produced: {', '.join(formats)}")
    if background:
        context.append(f"Visual background style: {background}")

    prompt = f"""{chr(10).join(context)}

Propose exactly 3 distinct creative directions for this campaign. Each must take a
genuinely different angle (for example: one lifestyle/emotional, one feature/design-led,
one offer/urgency-led — choose whichever 3 angles best fit this specific brief), and each
must speak directly to the stated target audience.

The brief is the source of truth, not a mood-setter. Carry its concrete specifics
through into the directions and the copy: any offer, discount, price, date, deadline,
launch window, named feature, campaign objective or mandatory message it states must
survive into what you write, stated exactly as the brief states it. Do not round,
rephrase or drop a number. Do not invent specifics the brief does not contain.

For each direction provide:
- en: the creative direction in 1-2 sentences (English)
- fr: the same direction rewritten naturally in Canadian French
- headline_en: the banner headline, maximum 8 words, sentence case
- headline_fr: that headline rewritten naturally in Canadian French
- body_en: the supporting body copy, maximum 25 words
- body_fr: that body copy rewritten naturally in Canadian French

Return exactly 3 items."""
    parsed: IdeasList = await _generate(prompt, IdeasList, temperature=0.9, name="ideas-and-copy")
    return [
        {"id": i + 1, **item.model_dump()} for i, item in enumerate(parsed.ideas)
    ]


def _render_assets(assets: dict, formats: list[str]) -> list[str]:
    """Flatten the asset tree into one labelled line per format and language."""
    lines = []
    for fmt in formats:
        asset = assets.get(fmt)
        if not asset:
            continue
        for lang in ("en", "fr"):
            block = asset.get(lang, {})
            rendered = " | ".join(
                f"{k}: {' / '.join(v) if isinstance(v, list) else v}" for k, v in block.items()
            )
            lines.append(f"[{fmt} — {lang.upper()}] {rendered}")
    return lines


async def run_quality_check(
    product: str,
    campaign_type: str,
    assets: dict,
    formats: list[str],
    brief: str = "",
    logo_placements: list[dict] | None = None,
    products: list[str] | None = None,
) -> dict:
    """Have Gemini audit the generated copy against the Samsung brand guardrails."""
    lines = _render_assets(assets, formats)

    # Without the full list a bundle campaign gets marked down for "mentioning a
    # product that isn't the campaign's product" — the reviewer has to know all
    # of them are in scope.
    prompt = f"""You are a brand-compliance reviewer for Samsung marketing copy.
{chr(10).join(_product_lines(product, products))}
Campaign type: {campaign_type}.
Approved campaign brief: "{brief or '(none supplied)'}"

Review this generated copy:
{chr(10).join(lines)}

Audit it against exactly these 5 criteria, in this order:
1. Brand tone — confident and premium, not hype-y or salesy
2. Guardrail compliance — no banned words, no competitor comparisons, no exclamation
   marks, no ALL-CAPS, no emoji, and no offers/specs/prices that are NOT supported by the
   approved brief above. Anything the brief does state (including any discount or offer it
   mentions) is approved — do not flag it, and do not flag a general, non-numeric
   restatement of an offer the brief already contains.
3. English grammar and clarity
4. French translation quality — reads as native Canadian French, not literal translation
5. Length and fit — copy suits the stated formats without truncation risk

Use "fail" only for a genuine brand or legal risk. Use "warn" for stylistic nits.
For each criterion return status "pass", "warn", or "fail", plus a one-sentence note
citing the specific copy if there is an issue. Then set overall to the worst status found.
Return exactly 5 checks in the order listed."""

    parsed: QualityReport = await _generate(prompt, QualityReport, temperature=0.2, name="quality-check", system=REVIEWER_VOICE)

    # The model tends to echo the full criterion wording back, which is far too
    # verbose for the UI. The schema is an ordered list, so pin short labels by
    # position and keep only the model's status and note.
    checks = [
        {
            "criterion": CHECK_LABELS[i] if i < len(CHECK_LABELS) else c.criterion,
            "status": c.status,
            "note": c.note,
        }
        for i, c in enumerate(parsed.checks)
    ]

    # Rules that are decidable from the text itself are computed, not judged.
    if campaign_type == "image":
        checks.append(check_logo_placement(logo_placements or []))
    elif campaign_type == "email":
        reengagement = check_reengagement(assets, formats)
        if reengagement:
            checks.append(reengagement)

    # Overall is the worst status across every check, including the layout ones
    # the model never saw.
    rank = {"pass": 0, "warn": 1, "fail": 2}
    worst = max(
        (rank.get(str(c["status"]).lower(), 1) for c in checks),
        default=rank.get(str(parsed.overall).lower(), 0),
    )
    overall = {0: "pass", 1: "warn", 2: "fail"}[worst]

    return {"overall": overall, "checks": checks}


# Schema per campaign type, so a revision comes back in exactly the shape the
# original generation produced.
_ASSET_SCHEMAS = {
    "video": ("VideoAssetsList", "hook, scenes (exactly 4), cta"),
    "email": (
        "EmailAssetsList",
        "subject, preheader, headline, body, cta_label, preference_options",
    ),
    "image": ("ImageAssetsList", "headline, body"),
}


async def revise_assets(
    campaign_type: str,
    product: str,
    assets: dict,
    formats: list[str],
    checks: list[dict],
    brief: str = "",
    products: list[str] | None = None,
) -> dict:
    """Apply a quality report's findings to the copy and return the corrected set.

    The reviewer already says exactly what is wrong and quotes the phrase, so
    there is no reason to make someone walk back to the Edit step and retype it.
    This is a targeted rewrite, not a regeneration: anything the report did not
    flag has to come back unchanged, or re-running checks would churn copy the
    user had already approved.
    """
    # Logo placement is a geometry finding about where the mark sits on the
    # canvas. Rewriting copy cannot move it, so feeding it in here would only
    # invite the model to churn text that was never the problem.
    flagged = [
        c
        for c in (checks or [])
        if str(c.get("status", "")).lower() in ("warn", "fail")
        and c.get("criterion") != "Logo placement"
    ]
    if not flagged:
        return assets

    findings = "\n".join(
        f"- [{c.get('status', '').upper()}] {c.get('criterion', '')}: {c.get('note', '')}"
        for c in flagged
    )
    schema_name, fields = _ASSET_SCHEMAS.get(campaign_type, _ASSET_SCHEMAS["image"])
    schema = {
        "VideoAssetsList": VideoAssetsList,
        "EmailAssetsList": EmailAssetsList,
        "ImageAssetsList": ImageAssetsList,
    }[schema_name]

    prompt = f"""You are revising already-approved Samsung marketing copy to clear
the findings from a brand-compliance review.
{chr(10).join(_product_lines(product, products))}
Campaign type: {campaign_type}.
Approved campaign brief: "{brief or '(none supplied)'}"

Current copy:
{chr(10).join(_render_assets(assets, formats))}

Review findings to resolve:
{findings}

Rewrite the copy so every finding above is resolved. Rules:
- Change only what the findings require. Any wording they did not flag must come
  back exactly as it is now, character for character.
- Where a finding names a better phrasing, use it.
- French must read as natural Canadian French written by a native speaker, never
  as a literal word-for-word rendering of the English.
- Keep every fact from the brief — offers, prices, dates, named features — intact
  and worded as the brief words them.
- Respect the original length limits for each field.

Return one item per format, in this exact order, each with {fields}, in both
English and Canadian French:
{chr(10).join(f"{i + 1}. {f}" for i, f in enumerate(formats))}

Return exactly {len(formats)} items, in the order listed."""

    parsed = await _generate(prompt, schema, temperature=0.3, name="assets-revise")
    revised = {}
    for f, item in zip(formats, parsed.assets):
        if campaign_type == "video":
            revised[f] = {
                "en": {"hook": item.en.hook, "scenes": item.en.scenes[:4], "cta": item.en.cta},
                "fr": {"hook": item.fr.hook, "scenes": item.fr.scenes[:4], "cta": item.fr.cta},
            }
        else:
            revised[f] = {"en": item.en.model_dump(), "fr": item.fr.model_dump()}
    # Formats the model dropped keep whatever they had — a partial reply must
    # never blank out copy that was already fine.
    return {**assets, **revised}


async def generate_assets(
    campaign_type: str,
    product: str,
    idea: dict,
    formats: list[str],
    audiences: list[str],
    secondary: str = "",
    brief: str = "",
    products: list[str] | None = None,
) -> dict:
    """Per-format copy. `secondary` is the campaign-type-specific setting the
    wizard collected (Platform for video, Tone for email)."""
    # Every selected segment is passed, not just the first — the wizard lets the
    # user pick several and dropping the rest silently ignored their choice.
    audience_label = ", ".join(audiences) if audiences else "everyone"
    # The brief has to travel with the direction. A direction is 1-2 sentences of
    # angle; the offer, dates and named features live in the brief, and copy
    # written from the direction alone silently dropped every one of them. The
    # quality check already grades against the brief, so without this the
    # generator was being marked on facts it was never shown.
    header = "\n".join(
        [
            *_product_lines(product, products),
            f'Campaign brief: "{brief or "(none supplied)"}"',
            f"Creative direction — EN: \"{idea['en']}\"  /  FR: \"{idea['fr']}\"",
            f"Target audience: {audience_label}",
        ]
    )
    if secondary:
        # Email now carries the same background presets as image generation, so
        # the label has to match what the value actually is.
        label = {"video": "Platform", "email": "Visual background style"}.get(
            campaign_type, "Tone"
        )
        header += f"\n{label}: {secondary}"

    # Stated last, after the per-format strategies, because those are specific
    # and this is general — put it up with the header and a strategy like
    # "emphasise benefits over features" quietly wins, dropping the offer from a
    # feature-update email even though the brief is an offer.
    binding = (
        (
            "\n\nAbove all: the brief is binding, and it outranks the per-format "
            "strategy above. Every offer, discount, price, date, deadline, named "
            "feature and mandatory message the brief states must appear in the copy "
            "for every format, worded as the brief words it — do not round or soften "
            "a number, and do not drop one because it does not suit the format. "
            "Never state an offer, saving or date the brief does not contain."
        )
        if brief
        else ""
    )

    if campaign_type == "video":
        prompt = f"""{header}

For each of the following {len(formats)} video formats, in this exact order, write:
- hook: an opening line (max 12 words)
- scenes: exactly 4 short scene descriptions (script beats, not full sentences)
- cta: a closing call to action (max 10 words)
Provide both English and Canadian French versions for each.
{chr(10).join(f"{i + 1}. {f}" for i, f in enumerate(formats))}

Return exactly {len(formats)} items, in the order listed."""
        parsed: VideoAssetsList = await _generate(prompt, VideoAssetsList, temperature=0.85, name="assets-video")
        return {
            f: {
                "en": {"hook": item.en.hook, "scenes": item.en.scenes[:4], "cta": item.en.cta},
                "fr": {"hook": item.fr.hook, "scenes": item.fr.scenes[:4], "cta": item.fr.cta},
            }
            for f, item in zip(formats, parsed.assets)
        }

    if campaign_type == "email":
        # Each type carries its own strategy, so the model is briefed per item
        # rather than writing six variations of the same generic email.
        listed = "\n".join(
            f"{i + 1}. {f}" + (f"\n   Strategy: {EMAIL_TYPE_GUIDANCE[f]}" if f in EMAIL_TYPE_GUIDANCE else "")
            for i, f in enumerate(formats)
        )
        prompt = f"""{header}

For each of the following {len(formats)} email types, in this exact order, write:
- subject: a subject line (max 9 words)
- preheader: the preview line shown beside the subject (max 12 words), and it must
  add to the subject rather than repeat it
- headline: the headline inside the email (max 8 words)
- body: 50-80 words, no greeting and no sign-off — the layout supplies those
- cta_label: the button label (max 4 words)
- preference_options: 3-4 short choices ONLY where the strategy below asks for them;
  otherwise return an empty list
Provide both English and Canadian French versions for each.

{listed}

Return exactly {len(formats)} items, in the order listed."""
        parsed_e: EmailAssetsList = await _generate(prompt, EmailAssetsList, temperature=0.8, name="assets-email")
        return {
            f: {"en": item.en.model_dump(), "fr": item.fr.model_dump()}
            for f, item in zip(formats, parsed_e.assets)
        }

    prompt = f"""{header}

For each of the following {len(formats)} banner sizes, in this exact order, write:
- headline: max 8 words
- body: max 25 words
Provide both English and Canadian French versions for each.
{chr(10).join(f"{i + 1}. {f}" for i, f in enumerate(formats))}

Return exactly {len(formats)} items, in the order listed."""
    parsed_i: ImageAssetsList = await _generate(prompt, ImageAssetsList, temperature=0.8, name="assets-image")
    return {
        f: {"en": item.en.model_dump(), "fr": item.fr.model_dump()}
        for f, item in zip(formats, parsed_i.assets)
    }


# --- Background image generation ---
# The model renders the SCENE ONLY. Headline/body text and the Samsung logo are
# composited on top as editable layers in the UI, because (a) image models render
# text unreliably and (b) baked-in text could not be moved, resized, or recoloured.
#
# Ratios are the closest the model supports to each format's true dimensions.
# Hoarding is 1920x480 (4:1); the API rejects "4:1" with 400 INVALID_ARGUMENT,
# and 21:9 (verified: 1536x672) crops far less badly than 16:9 did.
ASPECT_RATIOS = {
    "Website": "16:9",  # 1600x900
    "Desktop": "16:9",  # 1920x1080
    "Mobile": "9:16",  # 1080x1920
    "Hoarding": "21:9",  # 1920x480 — nearest supported
}


# True output dimensions, mirroring frontend/src/lib/bannerSpecs.js.
BANNER_DIMS = {
    "Website": (1600, 900),
    "Desktop": (1920, 1080),
    "Mobile": (1080, 1920),
    "Hoarding": (1920, 480),
}


def aspect_for(banner_size: str) -> str:
    return ASPECT_RATIOS.get(banner_size, "16:9")


def ratio_of(aspect: str) -> float:
    w, h = aspect.split(":")
    return float(w) / float(h)


def visible_fraction(banner_size: str) -> tuple[float, float]:
    """How much of the generated frame survives the centre-crop to the format's
    true dimensions, as (width_fraction, height_fraction).

    The generated aspect ratio rarely matches the banner exactly, and the UI
    covers the canvas, so the overflow is cropped away. For most formats this
    is ~2% and irrelevant; for Hoarding (4:1 output from a 21:9 frame) it is
    43% of the height, which is enough to decapitate the subject.
    """
    if banner_size not in BANNER_DIMS:
        return 1.0, 1.0
    w, h = BANNER_DIMS[banner_size]
    target = w / h
    generated = ratio_of(aspect_for(banner_size))
    if generated < target:
        return 1.0, generated / target  # width binds, height is cropped
    return target / generated, 1.0  # height binds, width is cropped


def _decode_reference(data_url: str):
    """Turn a data URL from the browser into an image Part, or None.

    A malformed reference must never take down generation — the banner is
    simply produced without grounding.
    """
    if not data_url:
        return None
    try:
        header, _, payload = data_url.partition(",")
        mime = "image/png"
        if header.startswith("data:") and ";" in header:
            mime = header[5:].split(";", 1)[0] or mime
        return types.Part.from_bytes(data=base64.b64decode(payload or header), mime_type=mime)
    except Exception:
        logger.warning("Ignoring unreadable product reference image", exc_info=True)
        return None


async def generate_background(
    product: str,
    idea_en: str,
    style: str,
    banner_size: str,
    audiences: list[str] | None = None,
    product_image: str = "",
    products: list[str] | None = None,
    product_images: list[str] | None = None,
) -> str:
    """Generate a scene and return it as a data URI.

    `product_image` is the catalog shot the user selected, as a PNG data URL.
    When present it is sent as a reference part and the device is reproduced
    from it, so the banner shows the actual product rather than whatever the
    model imagines a "Galaxy S26" looks like.
    """
    client = get_client()
    aspect = aspect_for(banner_size)

    # The scene should suit the people the campaign targets, not just the
    # product — a background for Seniors should not look like one for Students.
    audience_line = (
        f"Intended audience: {', '.join(audiences)}. " if audiences else ""
    )

    # Where the copy goes has to match the shape of the banner, and on cropped
    # formats it also has to agree with the framing rule below. Asking for
    # "empty space in the lower half" on a 4:1 strip is what pushed the product
    # up into the band the crop discards.
    vw, vh = visible_fraction(banner_size)
    if vh < 0.9:
        # Ultra-wide strip. The UI fits this frame whole into the right-hand
        # side of the banner rather than cropping it, so nothing is lost and the
        # model only has to produce a self-contained scene. Asking it to keep
        # the subject inside a "safe band" instead was tried and did not hold —
        # it repeatedly composed off the top edge.
        composition = (
            "This image is placed whole into the right-hand side of an ultra-wide banner, "
            "with the headline set on plain background to its left. Show the complete "
            "product, unclipped, with generous empty space around it so nothing touches "
            "the outer edges. The scene must bleed edge to edge as a full-bleed "
            "photograph: do not draw a border, outline, frame, panel, card or inset "
            "rectangle of any kind. "
        )
    else:
        composition = (
            "Leave generous empty negative space in the lower half for text to be added later. "
        )

    # With a reference attached the device is copied, not invented. Without one
    # the model guesses at the hardware, which is how earlier runs produced
    # abstract crystals and generic handsets instead of the catalog product.
    #
    # A bundle campaign attaches one reference per product, in the same order as
    # the names, and the prompt numbers them so the model can tell which
    # attachment is which — unlabelled, it blends two devices into one invented
    # hybrid.
    names = [p for p in (products or []) if p] or ([product] if product else [])
    sources = [s for s in (product_images or []) if s] or (
        [product_image] if product_image else []
    )
    reference_parts = [p for p in (_decode_reference(s) for s in sources) if p is not None]

    if len(reference_parts) > 1:
        # Only name as many as we actually attached; a name whose image failed to
        # decode must not be numbered, or the numbering silently shifts.
        listed = "; ".join(
            f"image {i + 1} is the {n}"
            for i, n in enumerate(names[: len(reference_parts)])
        )
        grounding = (
            f"{len(reference_parts)} product images are attached, in order: {listed}. "
            f"This banner features all of them together in one scene as equal subjects: "
            f"none is the hero and none is an accessory to another, so give them "
            f"comparable visual weight and prominence rather than centring one and "
            f"arranging the rest around it. Reproduce each device faithfully from its "
            f"own attached image: same model, same colour and finish, same proportions, "
            f"same camera layout and details. Keep them as separate physical objects — "
            f"do not merge two products into one, do not copy details from one onto "
            f"another, and do not invent hardware that is not in the references. Use "
            f"only the attached images as the source for the products' appearance. Do "
            f"not copy their plain backgrounds, cropping or framing — place the devices "
            f"into the new scene described here, relit and scaled consistently so they "
            f"look photographed together. "
        )
    elif reference_parts:
        grounding = (
            "The attached image is the exact product this banner is for. Reproduce that "
            "device faithfully: same model, same colour and finish, same proportions, same "
            "camera layout and details, including any accessory shown with it. Do not "
            "substitute a different phone or device, do not restyle it, and do not invent "
            "hardware that is not in the reference. Use only the attached image as the "
            "source for the product's appearance. Do not copy the attached image's plain "
            "background, cropping or framing — place the device into the new scene "
            "described here, relit to match it. "
        )
    else:
        grounding = ""

    # "A with B" reads as B being an accessory to A; "A and B" keeps them level.
    subject = " and ".join(names) if len(names) > 1 else (names[0] if names else product)

    prompt = (
        f"A premium Samsung advertising image for the {subject}. "
        f"Creative direction: {idea_en}. "
        f"{audience_line}"
        f"Visual style: {style}. "
        f"{grounding}"
        f"Cinematic studio lighting, minimal and uncluttered, high-end commercial photography. "
        f"{composition}"
        # "Cinematic" invites the model to add letterbox bars, and it did: a
        # measured export carried 115 dead rows across the top and 304 across
        # the bottom. The Samsung logo sits in that top band, which is what
        # made it look detached from the artwork rather than part of it.
        f"Fill the entire frame edge to edge. No black bars, no letterboxing, no "
        f"cinematic bands, no vignette edges, no border, no rounded corners — the "
        f"photograph must reach all four edges. "
        f"Absolutely no text, no words, no letters, no logos, no watermarks anywhere in the image."
    )
    # References first, in the order the prompt numbers them, then the prompt.
    contents = [*reference_parts, prompt] if reference_parts else prompt

    # Vertex serves image models from shared capacity, so a 429 here is usually
    # transient throttling rather than a hard quota. Retry with backoff before
    # giving up and falling back to a preset background in the UI.
    last_error: Exception | None = None
    for attempt in range(IMAGE_MAX_ATTEMPTS):
        # Each attempt is its own generation observation so retries are visible
        # in the trace rather than hidden inside one long span.
        with obs.generation(
            f"background-{banner_size.lower()}",
            model=IMAGE_MODEL,
            input=prompt,
            model_parameters={
                "aspect_ratio": aspect,
                "attempt": attempt + 1,
                # Flag how many references went in, without logging their bytes.
                "product_references": len(reference_parts),
            },
        ) as rec:
            try:
                response = await client.aio.models.generate_content(
                    model=IMAGE_MODEL,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(aspect_ratio=aspect),
                    ),
                )

                for part in response.candidates[0].content.parts:
                    inline = getattr(part, "inline_data", None)
                    if inline and inline.data:
                        mime = inline.mime_type or "image/png"
                        data = inline.data
                        if isinstance(data, bytes):
                            data = base64.b64encode(data).decode()
                        # Log the size, never the base64 payload — it would
                        # bloat every trace by ~1.5MB for no diagnostic value.
                        rec.finish(response, output=f"<image {len(data)} b64 chars>", images=1)
                        return f"data:{mime};base64,{data}"

                raise RuntimeError("Image model returned no image data")

            except Exception as e:  # noqa: BLE001 — inspected below, re-raised if fatal
                last_error = e
                rec.fail(e)
                transient = (
                    "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e) or "503" in str(e)
                )
                if not transient or attempt == IMAGE_MAX_ATTEMPTS - 1:
                    raise
                delay = IMAGE_RETRY_BASE_DELAY * (2**attempt)
                logger.warning(
                    "Image generation throttled (attempt %d/%d), retrying in %.1fs",
                    attempt + 1,
                    IMAGE_MAX_ATTEMPTS,
                    delay,
                )

        await asyncio.sleep(delay)

    raise last_error or RuntimeError("Image generation failed")
