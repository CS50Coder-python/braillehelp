# BrailleHelp

BrailleHelp is an accessible reading-support application for visually impaired students. The active application uses a React frontend, an Express/tRPC server, Drizzle database models, browser camera tracking, Braille passage analysis, oral-reading transcription, owner-scoped privacy controls, and PostgreSQL-compatible persistence through the managed project environment.

## Active application

The runnable application is at the repository root. The primary commands are:

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Open the local URL printed by the development server. Camera access requires HTTPS or localhost, and the browser will request camera and microphone consent when a reading session starts.

### How to run a live reading session

1. Click **Analyze Braille AI** in the left navigation, choose a clear PNG, JPEG, or WebP photo of the Braille page, enter a passage name, and click **Analyze this page**. A successful analysis automatically selects the passage and opens **Reading session**.
2. If you are already on the dashboard, click **Start camera session** after analysis. If no passage has been analyzed, the app intentionally shows **Analyze the page before the read** instead of opening an unmeasurable session.
3. On the session screen, confirm the analyzed passage text, check **I consent to camera-derived movement telemetry**, optionally check microphone consent for oral comparison, and set the phone-height estimate. Press **Open camera & calibrate**, then physically place the phone at three heights and confirm each step. The app stores the three samples, averages the calibrated height, announces **“Ready. Begin reading now.”**, and only then starts the timed reading session. The browser shows the live video and overlays the estimated finger point, movement trail, region, and confidence.
4. While the student reads, the **LIVE METRICS** panel shows motion signal, coverage, elapsed time, pauses, rereads, and skipped regions. It also shows an approximate grade/age oral-fluency reference using the selected season and an editable age fallback when no grade is linked. Press **Finish & save session** to calculate reading speed from analyzed word count and elapsed time and persist the event trail.

The tracker is a browser-side motion-centroid prototype, not a validated finger-tip detector. Test it on a localhost or HTTPS device with a physical camera before using results for instructional decisions. The grade/age comparison is an approximate oral-reading-fluency reference based on Hasbrouck–Tindal 2017 norms for grades 1–6; it is not a diagnosis or a Braille-specific standard. Teachers should interpret it alongside accuracy, comprehension, passage difficulty, accommodations, and repeated-session trends.

For local authentication, copy `.env.example` to `.env`, set `JWT_SECRET`, and leave `DEV_AUTH_ENABLED=true`. When the managed OAuth variables are absent, the Sign in button uses the development-only `/api/dev-login` route and creates a local teacher session. This route is disabled automatically when `NODE_ENV=production`. When `VITE_OAUTH_PORTAL_URL` and `VITE_APP_ID` are configured, the same button uses the managed OAuth flow instead.

The root app is the source of truth for the current product. It includes the live self-camera preview, a page-camera toggle, a real-time 2D motion overlay with movement trail and confidence, Braille image analysis, oral-reading comparison, session metrics, database persistence, and privacy/retention controls. Persisted analysis and reading sessions require `DATABASE_URL`.

For standalone image analysis, start the included local service in another terminal:

```bash
cd legacy/local-ai
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Then set `LOCAL_AI_URL=http://127.0.0.1:8000` in `.env`. The active server uploads the image to `/scan`, stores the returned analyzed text and confidence, and uses that passage as the expected text for camera and oral-reading metrics. The local model weights must be supplied separately under `legacy/local-ai/models`; otherwise remove `LOCAL_AI_URL` and use the managed Forge AI variables. If the local service is unreachable, the app now reports an actionable provider message instead of a generic browser fetch error; in development, an optional Forge storage-upload failure no longer blocks the AI analysis request.

## Environment

Do not commit `.env` files or secrets. This repository does not include a committed `.env.example`; create a local `.env` file yourself or export the variables in your shell. In the managed environment, database, authentication, storage, and built-in AI variables are injected by the platform. For standalone development, use `DEV_AUTH_ENABLED=true`, `JWT_SECRET` (or the development fallback), and either the managed Forge variables `BUILT_IN_FORGE_API_URL` plus `BUILT_IN_FORGE_API_KEY`, or start `legacy/local-ai` on port 8000. Set `LOCAL_AI_URL=http://127.0.0.1:8000` only when that service is running. Set `OAUTH_SERVER_URL`, `VITE_APP_ID`, and `VITE_OAUTH_PORTAL_URL` only when enabling real Manus OAuth; local development login does not require them.

After schema changes, generate and apply the Drizzle migration using the project’s database workflow. Do not run destructive database commands against production data without a reviewed migration.

## Repository layout

| Path | Purpose |
|---|---|
| `client/` | Active React application and accessible reading-session interface. |
| `server/` | Active Express/tRPC backend, database helpers, AI/storage integration, and tests. |
| `drizzle/` | Active database schema and migrations. |
| `docs/` | Product, privacy, and integration documentation. |
| `legacy/frontend/` | Original team frontend retained for reference or future migration. |
| `legacy/backend/` | Original team backend retained for reference or future service extraction. |
| `legacy/local-ai/` | Original local-AI experiments retained for future model integration. |
| `legacy/RestAPI/` | Original REST API service retained for reference. |

The `legacy/` services are not automatically started by the root application. Keep them available until the team confirms that their functionality has been migrated. Do not run a legacy backend and the active backend on the same port without an explicit integration plan.

Generated folders such as `.vite`, `dist`, `node_modules`, logs, and TypeScript build metadata are intentionally excluded from version control. They are regenerated locally.

## Current camera limitation

The camera overlay currently estimates a 2D motion centroid from frame-to-frame pixel changes. It is useful for demonstrating observable movement and session telemetry, but it is not a validated anatomical finger-tip detector. Replace or supplement it with a validated hand-landmark model before using measurements for instructional or clinical decisions.

## Privacy

Camera movement telemetry, oral-reading recordings, transcriptions, and student-linked session data are consent-gated and owner-scoped. Use the in-app privacy controls to set retention windows, purge expired data, or delete student records. Review the project documentation before collecting real student data.
