# Cheil Studio Lite

## What it does
Internal marketing-campaign studio for Samsung creative work. A 9-step wizard takes a campaign brief through creative directions, product/format selection, audience targeting, and AI-generated bilingual (EN / fr-CA) copy, ending in a deterministically verified downloadable ZIP package.

Three campaign types are supported: **Image**, **Video**, and **Email**.

## Run locally

### 1. Prerequisites & Installation
```bash
# Backend
uv sync

# Frontend
cd frontend && npm install
```

### 2. Credentials
Copy `backend/.env.example` to `.env` **at the project root**.
To use Live AI functionality, you need either Vertex AI service accounts or a Gemini API Studio Key:
```
GEMINI_API_KEY=AIzaSy...
```
*(If no key is configured, you can simply use Demo Mode!)*

### 3. Startup
Terminal 1 (Backend):
```bash
uv run uvicorn backend.main:app --reload --port 8000
```
Terminal 2 (Frontend):
```bash
cd frontend && npm run dev
```
Open `http://localhost:5173`.

## Demo in 5 mins
Want to skip the API setup and immediately see the Studio Lite's capabilities? 
1. Make sure both frontend and backend are running.
2. Go to `http://localhost:5173`.
3. In the top right header, check the **Demo mode (no AI key)** toggle.
4. Click **Load Samsung demo campaign** on the Home screen.
5. You'll be jumped directly to the final `Review & Export` screen with a fully built Samsung Galaxy S26 campaign, mock-populated assets, and ready to go for testing the guardrails.
6. Check `docs/demo` for examples of what these demo exports look like.

## Workflow
All three campaign types share a 9-step wizard (`STEP_LABELS` in `CampaignWizard.jsx`).

1. **Campaign Brief**: Name, objective, and short brief.
2. **Product**: Pick catalog product(s) which ground the imagery.
3. **Background**: Style & tone pre-selection.
4. **Formats**: Banner size / Video cut / Email type.
5. **Target Audience**: Demographic focusing.
6. **Ideas & Copy**: `POST /api/ideas` — 3 directions (EN / fr-CA).
7. **Asset Generation**: Image compositing or copy completion.
8. **Edit**: Adjust layout, typography, or text blocks.
9. **Review & Export**: Deterministic Guardrail check gating ZIP downloads.

## % Improvements from main branch

We've achieved massive performance gains by overriding background generation latency blockers and transitioning idea architecture to `gemini-2.5-flash-lite`:

| Pipeline | Main Branch Latency | Updates Branch Latency | % Improvement |
| :--- | :--- | :--- | :--- |
| **Idea Generation (3 ideas)** | ~10.5 seconds | ~1.8 seconds | **~82% Faster** |
| **Asset Generation (4 items)** | ~80.0 seconds | ~11.0 seconds | **~86% Faster** |

## Objective mapping
This update specifically tackles:
1. **Deterministic Guardrails & Auto-Fix**: Moving the "Export Guardrails" out of an LLM prompt and into a strict deterministic backend rule engine (`POST /api/quality-check`). If the backend detects a failed check (e.g., missing French copy or insufficient contrast), the UI immediately surfaces a one-click "Auto Fix" button that securely injects the missing parameters and automatically re-runs the checks. Crucially, **if one or more checks fail, the system rigidly blocks the user and does not allow them to download the ZIP file**, ensuring zero broken pipelines.
2. **Mock Mode Honesty**: Explicitly building the Demo Mode rather than hiding mock callbacks in UI try/catches. Metadata in the built `manifest.json` tracks the AI vs Mock `source`.
3. **Product Fidelity**: The original source catalog image configuration is maintained, exposed in the preview, and serialized into the output manifest.
4. **Export Completeness**: Zips include exact html/png components as well as a JSON manifest.
5. **Advanced Document Parsing**: Users can bulk upload PDFs, DOCX, and text files directly into the Brief panel. The `POST /api/extract-text` endpoint extracts their full contextual data natively for instant ingestion.
6. **Premium Apple-Tier Email Aesthetics**: Total overhaul of the Email templates (`emailTemplate.js`). We introduced multiple layout themes (Classic, Prestige, Bold) with luxury-tier typography, high-fidelity paddings (48px), floating wrappers with 24px radii, and dynamic accent styling.
7. **Latent LLM Optimization**: The idea generation pipeline was securely routed to `gemini-2.5-flash-lite` while backed by strict Pydantic formatting. This reduced idea generation time by **~81%** (from ~10s to ~1.8s).
8. **Dynamic Asset Generation Accel**: The image generation models were upgraded with mathematically calculated layout spacing bounds and strict negative prompts, dropping TTFT failures and reducing 4-image parallel rendering times by **~86%** (from ~80s down to ~11.0s).

## AI fallback honestly
In earlier iterations, the UI would "silently" switch to a dummy mock script if Gemini timed out or had missing keys. This led to misrepresentative testing. 
The system now expects explicit requests to `X-Demo-Mode: true`. The backend explicitly responds with `"source": "mock"`, allowing the UI to present accurate telemetry, load real static demo datasets, and accurately reflect whether it is being demoed offline or online. 

## Architecture

- **Backend** — FastAPI + Google Gemini (`google-genai`), managed with `uv`
- **Frontend** — React + Vite + Tailwind CSS v4
- **Storage** — SQLite (`studio.db`) local saves
- **Tracing** — Langfuse

See `docs/ARCHITECTURE.md` for historical insights into how banner layout generation is configured to span everything from 9:16 mobile to 4:1 desktop hoardings.

## Known limitations
- Translation currently uses the same Gemini provider endpoint, which may cause tone variations if LLMs change.
- The built-in Vitest suites cover unit states but do not run full headless browser composites for the rasterized banner downloads.
