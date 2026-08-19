# BrailleHelp

BrailleHelp is an accessible reading-support application for visually impaired students and the teachers who support them. It combines **Braille vision analysis**, **browser-based index-fingertip tracking**, **oral-reading comparison**, and **teacher-facing reading insights** in one consent-gated workflow.

> **The core question:** not only whether a student finished a Braille passage, but where their reading pattern becomes difficult.

## Why this is meaningfully AI-powered

AI is central to the product rather than decorative. A Braille image is analyzed by a vision model to produce the expected passage text, visible cell/line information, confidence, and uncertainty warnings. That AI-derived passage becomes the reference for the rest of the experience: the app uses it to calculate reading speed and to compare optional oral-reading transcription against the analyzed text. The browser then uses a hand-landmark model to follow the student’s index fingertip in real time while the server persists consent-scoped session events for teacher review.

The product uses AI in two complementary places:

| AI capability | Product purpose | Honest limitation |
|---|---|---|
| Braille image vision analysis | Converts an uploaded Braille page into a machine-readable reference passage and warns when the image is uncertain. | Teachers must review the result; poor lighting, blur, glare, or unusual layouts can reduce accuracy. |
| Browser hand landmarks | Follows the index fingertip landmark over the live camera feed and emits movement, pause, reread, and skip events. | This is a prototype measurement aid, not a clinical or instructional diagnosis. |
| Optional oral-reading transcription | Compares spoken reading with the analyzed passage and surfaces mismatches for review. | Speech recognition can vary with microphone quality, speech patterns, language, and background noise. |

## Competition-ready product flow

1. A teacher or student uploads a clear Braille image and runs **Analyze Braille AI**.
2. The vision result is reviewed as the expected passage, with confidence and uncertainty messaging.
3. The student opens **Reading session**, grants camera consent, and completes three explicit phone-height calibration samples.
4. The app announces **“Ready. Begin reading now.”** and starts timing only after calibration.
5. The live workspace shows the camera feed, capture frame, index-fingertip marker, movement trail, hand-detection state, confidence, passage progress, elapsed time, speed, pauses, rereads, skipped regions, and coverage.
6. The teacher reviews the session alongside cautious grade/age oral-fluency references, accuracy/oral comparison when enabled, passage difficulty, accommodations, and repeated-session trends.

## Run locally

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Open the local URL printed by the development server. Camera access requires HTTPS or localhost. On a physical phone, grant camera permission, use even lighting, keep the Braille page and fingertip in frame, and complete all three calibration steps. The hand-landmark runtime downloads its model assets in the browser, so the device needs network access during first use.

For local authentication, copy `.env.example` to `.env` when available, set `JWT_SECRET`, and leave `DEV_AUTH_ENABLED=true`. When managed OAuth variables are absent, the development-only `/api/dev-login` route creates a local teacher session. That route is disabled automatically when `NODE_ENV=production`. Persisted analysis and reading sessions require `DATABASE_URL`.

## AI provider options

The managed application uses the configured Forge AI variables. The legacy local service remains available for standalone experiments:

```bash
cd legacy/local-ai
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Then set `LOCAL_AI_URL=http://127.0.0.1:8000`. If the local service is unavailable, the active server returns an actionable provider message and can fall back to Forge vision when configured. Malformed or incomplete AI JSON is parsed defensively; readable partial text is marked uncertain, while unrecoverable responses remain retryable.

## Evidence and interpretation guardrails

The teacher reference card uses approximate fall/winter/spring oral-reading-fluency ranges derived from Hasbrouck–Tindal 2017 norms for grades 1–6, with an age-to-grade reference path when no grade is linked. These are **not Braille-specific norms, diagnoses, placement recommendations, or pass/fail thresholds**. Teachers should interpret speed with accuracy, comprehension, passage difficulty, disability accommodations, language background, and longitudinal trends.

## Privacy and safety

Camera movement telemetry, oral-reading recordings, transcriptions, and student-linked sessions are consent-gated and owner-scoped. The interface exposes retention and deletion controls. Do not use prototype metrics as the sole basis for educational, clinical, or disciplinary decisions, and do not upload identifiable student data to an unapproved environment.

## Architecture

| Layer | Responsibility |
|---|---|
| React 19 + Tailwind | Accessible dashboard, AI analysis workflow, calibration, camera workspace, live overlays, metrics, and teacher review surfaces. |
| MediaPipe Tasks Vision | Browser-side hand landmarks and index-fingertip coordinate extraction. |
| Express + tRPC | Typed analysis, session lifecycle, tracking-event, transcription, privacy, and classroom procedures. |
| Drizzle ORM | PostgreSQL-compatible schema for passages, students, reading sessions, and tracking events. |
| Forge AI / local AI bridge | Braille vision analysis and optional voice/transcription integrations. |
| Vitest | Regression coverage for auth, analysis recovery, tracking, calibration, benchmarks, privacy, and UI contracts. |

## Repository layout

| Path | Purpose |
|---|---|
| `client/` | Active React application and accessible reading-session interface. |
| `server/` | Active Express/tRPC backend, database helpers, AI/storage integration, and tests. |
| `drizzle/` | Active database schema and migrations. |
| `docs/` | Product, privacy, benchmark, and competition documentation. |
| `legacy/` | Earlier team frontend/backend/REST/local-AI experiments retained for reference. |

The root application is the source of truth for the current demo. Generated folders such as `.vite`, `dist`, `node_modules`, logs, and TypeScript build metadata are excluded from version control.

## Open-source and originality statement

BrailleHelp is released under the MIT License. The project uses standard open-source libraries and managed platform integrations, while the product workflow, calibration model, privacy controls, analysis-to-session contract, tracking metrics, teacher interpretation surface, and recovery behavior represent the team’s application work. Existing tools and starter infrastructure are documented rather than presented as original invention.

## Hackathon submission checklist

The competition submission should include the public repository, the hosted project URL, a short demo video, and a completed Devpost entry. A suggested approximately three-minute narrative is included in `docs/HACKATHON-SUBMISSION.md`.
