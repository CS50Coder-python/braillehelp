# Braille Read Quality Audit Report

**Audit date:** August 14, 2026  
**Scope:** The complete submitted repository, with targeted fixes in the original `frontend/ → backend/ → RestAPI/` delivery path. The managed `manus-app/` and `webapp/` variants were preserved and revalidated without speculative changes.

## Executive summary

The repository contains three distinct runnable paths: the original React/Vite frontend, Express scan/metrics bridge, and PostgreSQL/SSE metrics service; a local FastAPI recognition service; and two managed full-stack application variants. The audit preserved all existing applications and focused code changes only on confirmed defects in the original end-to-end metrics flow and its security boundary.

The repaired legacy route now carries complete session metrics from the browser through the Express bridge to the PostgreSQL service. Mutable metrics-service routes are protected when a write key is configured, the daily-question write route now follows the same protection, and CORS no longer exposes a configured origin to requests from an untrusted origin. The original frontend’s visual design was retained; responsive rendering was reviewed at desktop, tablet, and mobile widths without finding a defect that justified CSS changes.

| Result | Status |
|---|---|
| Existing project structures and routes preserved | Passed |
| Original frontend build and tests | Passed: 2 files, 10 tests |
| Express backend test suite | Passed: 14 tests |
| PostgreSQL/SSE service test suite | Passed: 3 tests |
| Local FastAPI service test suite | Passed: 13 tests |
| `manus-app` type check, tests, and build | Passed: 6 files, 11 tests |
| `webapp` type check, tests, and build | Passed: 11 files, 23 tests |
| Desktop, tablet, and mobile visual smoke checks | Passed within reviewed viewport regions |

## Architecture identified

| Layer | Directory | Technology and responsibility |
|---|---|---|
| Original user interface | `frontend/` | React 18, Vite, MediaPipe hand tracking, session visualization, Braille-image upload, and live metrics dashboard. |
| Original scan/API bridge | `backend/` | Express 5, multipart image validation, local or OpenAI-backed Braille recognition, and server-side metrics forwarding. |
| Metrics persistence and live updates | `RestAPI/` | Node HTTP server, PostgreSQL via `pg`, Server-Sent Events, daily teacher prompt, and metrics history. |
| Local recognition service | `local-ai/` | FastAPI, YOLO/OpenCV detection and local translation model integration. |
| Managed application variant | `manus-app/` | React, Express, tRPC, Drizzle/MySQL-compatible persistence, Manus OAuth, storage, and server-side AI helpers. |
| Managed application variant with additional safeguards | `webapp/` | Similar managed stack with added reading-guard, privacy, selection, and hardening coverage. |

The original browser flow is `frontend → /api/metrics on backend → /update on RestAPI → PostgreSQL and SSE`. The Braille scan flow is `frontend → /api/braille/scan on backend → local-ai or configured OpenAI provider`. The managed variants are separate applications and were not merged or deleted.

## Confirmed bugs found and fixed

| ID | Confirmed root cause | Conservative fix | Validation |
|---|---|---|---|
| QA-01 | `RestAPI` declared a test command that intentionally exited with “no test specified.” | Added a native Node integration test and changed the script to `node --test`. | `npm test` passes with 3 tests. |
| QA-02 | `POST /daily-question` mutated server state without checking `API_WRITE_KEY`; `POST /update` was the only guarded write route. | Added one shared `authorizeWrite()` gate for both mutable routes. In production, a missing write key produces a configuration error rather than silently allowing writes. | Integration test verifies 401 without the configured key and 201 with it. |
| QA-03 | The metrics service unconditionally emitted the configured `Access-Control-Allow-Origin` header, including when an untrusted Origin sent a request. | Added origin-aware CORS handling, an origin `Vary` header, and a denied cross-origin preflight path. | Integration test verifies no allow-origin header for an untrusted origin. |
| QA-04 | `RestAPI` accepted negative numeric telemetry, even though the Express bridge rejected it; direct callers could receive a database failure rather than a client validation error. | Required nonnegative numeric metrics and nonnegative integer word count before database access; constrained `MM:SS` seconds to 00–59. | Integration test verifies negative input receives 400 before database access. |
| QA-05 | The original frontend uploaded only reading speed, mistakes, and rereads, while `RestAPI` persistence requires word count, mistake ratio, and duration. The backend bridge also stripped those fields. | Extended the frontend payload, preserved the full contract through the Express bridge, and added validation for every persisted field. | Frontend payload test and backend forwarding test pass. |
| QA-06 | The parent frontend screen advanced its session state through timed “processing” and “ready” states even if no real camera or analysis event had occurred. | Removed the simulated timer; the existing camera tracker is now the sole driver of capture, processing, ready, and error states. | Frontend rebuild and tests pass; browser recheck shows an idle session before camera activation. |
| QA-07 | The legacy interface claimed age-band or age-based speed classification despite the project’s evidence boundary requiring teacher-reviewed interpretation. | Replaced those claims with teacher-reviewed reference wording without changing the dashboard layout or telemetry logic. | Browser recheck confirms revised wording. |

## UI, responsive, and accessibility review

The original visual identity—dark panels, clear hierarchy, prominent session controls, and dashboard cards—was preserved. The desktop document measured 1,265 px wide within a 1,280 px viewport, so there was no horizontal overflow. At 390 × 844 px, navigation wrapped intentionally, CTAs remained full-width and legible, and the upload panel remained in bounds. At 768 × 1024 px, the intermediate layout retained readable titles, visible actions, and an in-bounds upload control.

No CSS change was made merely for stylistic preference. Existing focus styles, button styling, responsive media rules, cards, and loading/error messaging were retained because the reviewed views were already usable and visually consistent.

## Security and reliability findings

The repaired metrics service uses parameterized PostgreSQL queries and maintains its existing request-size limit, rate limiter, database retry behavior, SSE cleanup, and graceful shutdown path. The backend continues to keep the write key server-side; the frontend never receives it. The original scan route retains file-type and size validation, and tests confirm that local-service failures are mapped to safe status codes without exposing connection details.

The production dependency audit for the original `frontend/` and `backend/` found zero production-package advisories. Development-only audit output had previously reported a high-severity advisory, so dependency updates should still be reviewed as part of normal maintenance rather than applied blindly during this preservation-focused audit.

## Validation performed

| Area | Commands and manual checks |
|---|---|
| Original frontend | `npm run build`, `npm test`; browser overview and dashboard navigation; desktop, tablet, and mobile screenshots. |
| Original backend | `npm test`; started server; verified `GET /api/health` and missing-upload validation. |
| Metrics service | `npm test`; started server; verified root health; exercised authorization and input validation via integration test. |
| Local AI | `python3 -m unittest discover -s local-ai/tests -v`; all model-free tests passed after installing its declared runtime packages in the audit environment. |
| Managed variants | `pnpm check`, `pnpm test`, and `pnpm build` for both `manus-app/` and `webapp/`. |
| Dependency review | `npm audit --omit=dev --json` for original frontend and backend. |

## Files modified

| File | Reason |
|---|---|
| `RestAPI/server.js` | Added shared write authorization, origin-aware CORS, and stricter telemetry validation. |
| `RestAPI/package.json` | Replaced placeholder test command with the native Node test runner. |
| `RestAPI/test/server.integration.test.js` | Added integration coverage for health/CORS, write authorization, and invalid telemetry. |
| `backend/src/routes/metricsRoutes.js` | Validates and forwards the complete persisted metrics contract. |
| `backend/tests/app.test.js` | Extends existing tests for the full metrics payload while retaining prior validation coverage. |
| `frontend/src/services/metricsApi.ts` | Sends derived word count, mistake ratio, and duration alongside existing metrics. |
| `frontend/src/services/metricsApi.test.ts` | Adds client payload and API-error coverage. |
| `frontend/src/hooks/useReadingTracker.ts` | Supplies the existing passage word count to the upload helper. |
| `frontend/src/App.tsx` | Removes simulated session progression and revises unsupported benchmark wording. |
| `QUALITY-AUDIT-REPORT.md` | Records this audit and remaining validation boundaries. |

## Remaining issues and next validation steps

The repository is now buildable and tested in the available environment, but the following checks require deployment-specific configuration and should not be faked.

| Remaining item | Why it remains |
|---|---|
| Live PostgreSQL insert and SSE broadcast | No project `DATABASE_URL` was supplied for a real database. The contract was validated through bridge and service integration tests up to the database boundary. |
| Physical camera and fingertip tracking accuracy | Requires user camera permission, a real device, Braille page, lighting conditions, and an appropriate consented evaluation. |
| Real local-model inference | Local model weights are intentionally not bundled or downloaded at runtime. The model-free FastAPI tests passed. |
| Production configuration | Production deployment must set `API_WRITE_KEY`, `ALLOWED_ORIGIN`, `DATABASE_URL`, and the relevant backend/local-AI endpoints. Missing write-key configuration now fails closed for writes in production. |
| Multiple runnable applications | The repository intentionally retains original and managed variants. Before deployment, designate one supported production path and document which service configuration applies to it. |
| Build warnings in managed variants | Placeholder analytics variables remain undefined in the uploaded configuration, and `manus-app` has a large generated client chunk. Neither blocked the build, but they should be resolved in the deployment environment. |

## Preservation statement

No existing app, route, database schema, authentication implementation, external integration, UI page, or component was deleted. The changes strengthen confirmed weak points in the original metrics pathway and leave the managed application variants intact. The result is a more reliable, more securely configured, and better-tested project without a framework migration or speculative rewrite.
