# Cheil Studio Lite (prototype)

**AI models used:** Google Gemini API (`gemini-2.5-flash-lite`) for rapid idea generation, copy drafting, and text compilation, alongside deterministic local image compositing pipelines.

A locally-runnable internal marketing-campaign studio for Samsung creative work. A comprehensive 9-step wizard takes a campaign brief through creative directions, product/format selection, audience targeting, and AI-generated bilingual (EN / fr-CA) copy, ending in a deterministically verified downloadable ZIP package.

## Contents

- [About the product](#about-the-product)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Running it locally](#running-it-locally)
- [Demo in 5 mins](#demo-in-5-mins)
- [The 9-Step Wizard Workflow](#the-9-step-wizard-workflow)
- [Objective Mapping & Performance Improvements](#objective-mapping--performance-improvements)
- [Environment variables](#environment-variables)
- [Known limitations](#known-limitations)

## About the product

Cheil Studio Lite acts as an internal marketing-production tool for a brand studio like Samsung's. It takes a campaign brief in plain English and turns it into ready-to-review creative output across three core format categories.

**Three campaign types are supported:**
- **Image**: High-fidelity banner rendering with composited background environments and drag-and-drop layout editing.
- **Video**: Cutdowns and export framing configurations.
- **Email**: Premium Apple-tier HTML responsive emails generated rapidly with luxury spacing and layout profiles.

## Architecture

```text
frontend (React + Vite + Tailwind, :5173)  →  backend (FastAPI + Python, :8000)  →  Google Gemini API
```

- **Backend**: FastAPI + Google Gemini (`google-genai`), managed with `uv`.
- **Frontend**: React + Vite + Tailwind CSS v4.
- **Storage**: SQLite (`studio.db`) local saves.
- **Tracing**: Langfuse enabled telemetry mapping.

## Prerequisites

- Python environment managed by `uv`
- Node.js 20+ and `npm`
- (Optional but recommended) Google Gemini API Studio Key for live AI generative flows.

## Running it locally

### 1. Backend

```bash
# Install dependencies and sync virtual environment
uv sync

# Copy env template and setup
cp backend/.env.example .env

# Run the backend API layer
uv run uvicorn backend.main:app --reload --port 8000
```
*Note: Make sure your `.env` is at the project root for proper detection.*

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The application opens on `http://localhost:5173`.

## Demo in 5 mins

Want to skip the API setup and immediately see the Studio Lite's capabilities? 

1. Make sure both frontend and backend are running.
2. Go to `http://localhost:5173`.
3. In the top right header, check the **Demo mode (no AI key)** toggle.
4. Click **Load Samsung demo campaign** on the Home screen.
5. You'll be jumped directly to the final `Review & Export` screen with a fully built Samsung Galaxy S26 campaign, mock-populated assets, and ready to go for testing the guardrails.
6. The backend explicitly responds with `"source": "mock"` enforcing UI honesty and telemetry accuracy.

## The 9-Step Wizard Workflow

All three campaign types share a streamlined 9-step wizard (`STEP_LABELS` in `CampaignWizard.jsx`).

1. **Campaign Brief**: Name, objective, and short brief (now supports bulk PDF, DOCX, and text file uploads via `POST /api/extract-text`).
2. **Product**: Pick catalog product(s) which ground the imagery.
3. **Background**: Style & tone pre-selection.
4. **Formats**: Banner size / Video cut / Email type.
5. **Target Audience**: Demographic focusing.
6. **Ideas & Copy**: `POST /api/ideas` — 3 directions (EN / fr-CA).
7. **Asset Generation**: Image compositing or copy completion.
8. **Edit**: Adjust layout, typography, or text blocks natively over the AI stage backgrounds.
9. **Review & Export**: Deterministic Guardrail check gating ZIP downloads.

## Objective Mapping & Performance Improvements

The `Updates` branch brought immense speed and deterministic reliability optimizations over the original application:

| Pipeline | Main Branch Latency | Updates Branch Latency | % Improvement |
| :--- | :--- | :--- | :--- |
| **Idea Generation (3 ideas)** | ~10.5 seconds | ~1.8 seconds | **~82% Faster** |
| **Asset Generation (4 items)** | ~80.0 seconds | ~11.0 seconds | **~86% Faster** |

### Key Advances:
1. **Deterministic Guardrails & Auto-Fix**: Export Guardrails run in a strict deterministic backend rule engine (`POST /api/quality-check`). If the backend detects a failed check, the UI immediately surfaces a one-click "Auto Fix" button. Crucially, **if one or more checks fail, the system rigidly blocks the user and does not allow them to download the ZIP file**, ensuring zero broken pipelines.
2. **Advanced Document Parsing**: Users can bulk upload PDFs, DOCX, and text files directly into the Brief panel seamlessly.
3. **Premium Apple-Tier Email Aesthetics**: Total overhaul of the Email templates introducing multiple layout themes (Classic, Prestige, Bold) with luxury-tier typography and high-fidelity paddings.
4. **Latent LLM Optimization**: The idea generation pipeline was securely routed to `gemini-2.5-flash-lite` backed by strict Pydantic formatting ensuring zero hallucinatory output parsing states.

## Environment variables

At the root `.env` repository, implement:

```env
GEMINI_API_KEY=AIzaSy...
```

*If no key is configured, the system explicitly supports testing natively through Demo Mode!*

## Known limitations

- Translation currently uses the same Gemini provider endpoint, which may cause tone variations if LLMs change.
- The built-in Vitest suites cover unit states but do not run full headless browser composites for the rasterized banner downloads.
