# Cheil Studio Lite

Internal marketing-campaign studio for Samsung creative work. A 9-step wizard takes a
campaign brief through creative directions, product/format selection, audience targeting,
and AI-generated bilingual (EN / fr-CA) copy, ending in a downloadable ZIP package.

Three campaign types are supported: **Image**, **Video**, and **Email**.

## Stack

- **Backend** — FastAPI + Google Gemini (`google-genai`), managed with `uv`
- **Frontend** — React + Vite + Tailwind CSS v4
- **Storage** — SQLite (`studio.db`, created on first run, gitignored)
- **Tracing** — Langfuse, optional and no-op when unconfigured

## Setup

### 1. Backend dependencies

```bash
uv sync
```

### 2. Credentials

Copy `backend/.env.example` to `.env` **at the project root** and fill in one of the two
auth modes. The root `.env` is gitignored.

**Mode A — Vertex AI with a service account** (required if your org blocks API keys):

```
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=F:/cheil-studio-lite/backend/service-account.json
```

The service account needs the **Vertex AI User** (`roles/aiplatform.user`) role, and the
**Vertex AI API** must be enabled on the project.

**Mode B — AI Studio API key** (simpler):

```
GEMINI_API_KEY=AIzaSy...
```

> Service-account JSON files are gitignored. Never commit real credentials, and never put
> a real key in `.env.example` — that file is committed.

### 3. Frontend dependencies

```bash
cd frontend && npm install
```

## Running

Two processes, in separate terminals:

```bash
# Terminal 1 — API on :8000
uv run uvicorn backend.main:app --reload --port 8000

# Terminal 2 — UI on :5173 (proxies /api to the backend)
cd frontend && npm run dev
```

Open http://localhost:5173.

> `--reload` only watches `.py` files. After editing `.env`, restart the backend manually.

**Without credentials the app still runs.** If Gemini is unavailable — no credentials,
quota exhausted, API disabled — each step falls back to local example content from
`frontend/src/lib/mockAgents.js` and shows an amber banner explaining why. The wizard
stays fully usable, which makes it possible to work on the UI without burning quota.

## Wizard flow

All three campaign types share one wizard engine (`STEP_LABELS` in
`frontend/src/wizard/CampaignWizard.jsx`); the per-type pages supply the configuration
that differs.

| # | Step | What happens |
| --- | --- | --- |
| 1 | Campaign Brief | Name, objective, and free-text brief |
| 2 | Product | Pick a catalog product — the shot also grounds image generation |
| 3 | Background | Scene style / platform / tone preset |
| 4 | Formats | Banner sizes, video cuts, or email types |
| 5 | Target Audience | One or more audience segments |
| 6 | Ideas & Copy | `POST /api/ideas` — 3 directions with EN + fr-CA copy |
| 7 | Asset Generation | Backgrounds and per-format assets, prefetched from step 6 |
| 8 | Edit | Banner editor / email preview — layout, logo, copy placement |
| 9 | Export | Quality check, then ZIP download |

Progress is saved automatically, so a campaign can be closed and resumed from the home
page at any step.

## API

| Endpoint | Wizard step | Produces |
| --- | --- | --- |
| `POST /api/ideas` | 6 | 3 creative directions + headline/body copy, EN + FR |
| `POST /api/backgrounds` | 7 | One background scene per unique aspect ratio |
| `POST /api/background` | 8 | A single regenerated background, from the editor |
| `POST /api/assets` | 7 | Per-format copy for video / email campaigns, EN + FR |
| `POST /api/quality-check` | 9 | Guardrail review that gates the ZIP download |

Image generation runs as a job rather than a request: `POST /api/jobs/images` returns an
id immediately and `GET /api/jobs/{id}` reports progress. Campaigns are CRUD under
`/api/campaigns`, and generated images are served from `/api/images/{id}`.

## Project layout

```
backend/
  main.py             FastAPI app, product catalog, /api routes
  gemini_service.py   Gemini client, Samsung brand-voice prompt, generation logic
  store.py            SQLite: campaigns, jobs, image blobs
  observability.py    Langfuse tracing (no-op without keys)
frontend/
  src/wizard/         Shared 9-step wizard engine + step components
  src/pages/          Per-campaign-type config (Image / Video / Email)
  src/components/     Header, cards, campaign list
  src/lib/            API client, fallback content, presets, ZIP export
  public/             Catalog product shots + brand marks (served, and used as
                      image-generation references)
assets/               Original source artwork the catalog was cut from
docs/ARCHITECTURE.md  Why the code is shaped the way it is
pyproject.toml        Backend dependencies (uv)
.env.example          Credential template — copy to .env at the project root
```

Untracked by design: `.env`, `backend/service-account.json`, `studio.db`, `.venv/`,
`frontend/node_modules/`, and `frontend/dist/`. See [.gitignore](.gitignore).

## Design decisions

The non-obvious choices — durable campaigns and job-based image generation, product
grounding with a reference image, the banner layout rules that keep a 4:1 hoarding and a
9:16 mobile canvas both correct, the email strategy briefs, and what Langfuse captures —
are written up in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

Read it before changing the banner exporter or the generation prompts. Several of those
rules exist because the obvious alternative was tried first and failed.
