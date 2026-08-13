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

The root app is the source of truth for the current product. It includes the live self-camera preview, a page-camera toggle, a real-time 2D motion overlay with movement trail and confidence, Braille image analysis, oral-reading comparison, session metrics, database persistence, and privacy/retention controls.

## Environment

Do not commit `.env` files or secrets. In the managed environment, database, authentication, storage, and built-in AI variables are injected by the platform. For local development, copy the relevant example variables from the service documentation and provide a PostgreSQL-compatible `DATABASE_URL` plus the required authentication and AI/storage variables.

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
