# Braille Read Functional Upgrade

- [x] Inspect current scaffold, package configuration, project config, and existing frontend structure.
- [x] Confirm whether PostgreSQL/database capabilities and backend routes are already enabled.
- [x] Upgrade project capabilities to full-stack database/user support if required.
- [x] Define persistent models for students, passages, reading sessions, tracking events, and analysis results.
- [x] Implement backend routes for session lifecycle, camera metrics, passage upload, and analysis results.
- [x] Implement real browser camera permission flow and live tracking telemetry collection.
- [x] Implement client-side metrics for elapsed time, reading speed, pauses, rereads, and skipped regions.
- [x] Implement Braille image upload and AI analysis integration with explicit uncertainty handling.
- [x] Connect dashboard and session UI to persisted data rather than hard-coded demo values.
- [x] Run type checks, build, and end-to-end interaction verification.
- [x] Document required secrets, model limitations, privacy considerations, and next integration steps.
- [x] Push the functional full-stack upgrade to the selected GitHub repository without overwriting the existing team services.
- [x] Add a dedicated students table/model and wire sessions/passages to student records.
- [x] Replace manual reread/skip controls and hardcoded passage length with passage-backed and camera-derived metrics.
- [x] Bind the reading session UI to persisted passage records and display analyzed text and word count.
- [x] Create concrete project documentation covering environment/secrets, AI limitations, privacy/data handling, and integration next steps.
- [x] Derive reread and skipped regions from actual camera-estimated horizontal position instead of elapsed-time buckets.
- [x] Display persisted analyzed word count and linked passage metadata in the reading session.
- [x] Add tests for passage-backed session metadata and position-based reread/skip detection.
- [x] Add a test that verifies persisted passage metadata is surfaced for the reading session, including title, detected text, word count, and student link.
- [x] Add explicit reading-session UI binding coverage for persisted title, detected text, analyzed word count, and linked student name.
- [x] Replace the source-string assertion with a runtime-rendered passage metadata component test.

# Production Hardening

- [x] Inspect current saved application and identify remaining tracking, audio, permissions, and privacy gaps.
- [x] Add calibration state and camera-based finger-position tracking contract.
- [x] Add oral reading speech-to-text capture and comparison result persistence.
- [x] Add teacher/student ownership and permission checks to persisted data procedures.
- [x] Add privacy controls for camera/audio consent and data retention.
- [x] Add tests for calibration, speech comparison, and authorization boundaries.
- [x] Run full verification, save a checkpoint, and synchronize the finished upgrade to GitHub.
- [x] Add retention metadata and owner-controlled deletion for student, passage, session, tracking, and oral-reading records.
- [x] Add retention/deletion tests and a visible privacy-control entry point.
- [x] Make tracking-event retention explicitly inherit and enforce the parent session retention policy.
- [x] Add focused deletion and purge behavior tests for sessions, students, and linked tracking/oral-reading records.
- [x] Add runtime privacy-screen rendering coverage for the owner retention controls and entry point.
- [x] Add explicit tests for privacy.deleteSession, privacy.deleteStudent, and privacy.purgeExpired, including linked tracking/oral-reading cleanup assertions.
- [x] Add direct runtime coverage for the visible privacy entry point and privacy-screen routing.
- [x] Make linked deletion order explicit in the real persistence helpers and test that tracking/oral-reading cleanup precedes parent deletion.
- [x] Add a renderable privacy screen surface that combines the privacy entry point contract with retention controls and test it directly.
- [x] Wire buildStudentDeletionPlan into the real deleteStudentData routine and test that path explicitly.
- [x] Add an execution-based student purge plan test that verifies child cleanup runs before passage and student deletion.

# Bug Fix — Oral Comparison Requires Analysis

- [x] Reproduce the comparison error and trace the passage-analysis/session state flow.
- [x] Ensure an analyzed passage remains available when starting a reading session and recording oral audio.
- [x] Add a clear UI guard and recovery path when comparison is attempted without analysis.
- [x] Add regression coverage for the comparison precondition and run check, tests, and build.
- [x] Persist the selected analyzed passage across analyze-to-read navigation and browser reloads.
- [x] Prevent overview camera entry without a selected passage and provide an analyze/choose-passage CTA.
- [x] Add an execution/UI regression test for the valid overview-to-reading-session passage path.
- [x] Add a runtime-rendered reading-entry CTA component test for both missing and persisted analyzed passages.

# Feature — Observable Camera Tracking

- [x] Inspect the current video preview, canvas, and tracking state flow.
- [x] Make the camera feed visibly observable in the reading session with clear permission and live states.
- [x] Add a real-time tracking overlay showing estimated finger position, movement trail, region, and confidence.
- [x] Add runtime UI/regression coverage for the observable camera and tracking state.
- [x] Run check, tests, build, screenshot verification, checkpoint, and GitHub push.
- [x] Estimate vertical position from changed camera pixels so the overlay represents a true 2D motion point.
- [x] Save a new managed checkpoint after the final overlay changes.
- [x] Push the post-overlay changes to the GitHub upgrade branch and verify the resulting branch state.

# Delivery — braillehelp repository

- [x] Inspect the current active app, legacy folders, and target GitHub repository state.
- [x] Assemble a clean runnable repository with active app source, necessary configuration, legacy code organized safely, and generated artifacts excluded.
- [x] Add root README and environment/run instructions for local development.
- [x] Create the new `braillehelp` GitHub repository and push the assembled code.
- [x] Verify the remote branch, repository tree, and runnable project commands.

# End-to-End Repair — braillehelp

- [x] Inspect braillehelp authentication configuration, API endpoints, database availability, and camera session flow.
- [x] Fix login redirect/session handling and provide a clear authenticated local-development path.
- [x] Ensure Braille upload/analysis API and passage persistence return usable session data.
- [x] Ensure camera permission, visible video preview, 2D finger-motion telemetry, speed, reread, and skipped-region metrics work in a real browser session.
- [x] Add focused regression and integration coverage for login guards, analysis, camera metrics, and API contracts.
- [x] Run check, tests, build, and browser verification; save a checkpoint and push to braillehelp.

# Final Verification Gaps

- [x] Restore managed-workspace dependencies and clear the interrupted dev-server TypeScript errors.
- [x] Add an automated test for `/api/dev-login` session creation and the client fallback login decision.
- [x] Add a mocked local-AI bridge/API contract test proving analyzed text is returned and persisted for reading sessions.
- [x] Run browser verification for sign-in and document camera permission/runtime limitations if the sandbox cannot grant a physical camera.
- [x] Run final check, tests, build, checkpoint, and push to braillehelp.

# Bug Fix — Development Login and Live Reading Session

- [x] Make database-less development login create and read a local session safely in development.
- [x] Make the analyzed-passage flow clearly open the camera reading session with visible tracking controls.
- [x] Verify rereads, skipped regions, reading speed, and live tracking status are observable during a session; physical camera capture remains device-validation work.
- [x] Add regression tests for development login and analyzed-passage-to-camera session entry.
- [x] Run final checks, tests, build, browser smoke verification, save a checkpoint, and push the fix.
- [x] Add a regression test that simulates successful Braille analysis selection and asserts the app transitions into the reading-session surface with camera/tracking controls visible.
- [x] Complete analyze-to-selected-passage browser verification or document the sandbox upload blocker precisely: authenticated analysis and passage-required screens were verified, but the sandbox upload helper could not target the hidden file input and the browser has no physical camera.
- [x] Add an integration-style regression that exercises successful passage analysis selection and verifies the reading-session surface renders camera/tracking controls.
- [x] Save a fresh checkpoint after these fixes and push the updated standalone repository state.

# Bug Fix — Incomplete Session Payload During Camera Session

- [x] Trace the incomplete session payload from camera-session API calls through cookie/session verification.
- [x] Repair session handling so authenticated local development and OAuth sessions can open camera sessions without repeated auth errors.
- [x] Add regression coverage for camera-session authentication and incomplete-payload handling.
- [x] Run checks, tests, build, browser verification, save a checkpoint, and push the fix to GitHub.
- [x] Add a protected reading-session request regression using a local development session token, including a legacy malformed-token request-context path.
- [x] Save a fresh checkpoint for the incomplete-session-payload repair and record its version: ea044ca4.
- [x] Push the latest session-payload repair to braillehelp main and verify the remote HEAD: 580408a.
- [x] Run a browser smoke test that opens Reading session with the repaired auth state, or document the physical-camera sandbox blocker precisely: Reading session opened and showed the passage-required guard; physical camera and hidden-file upload remain unavailable in this sandbox.

# Bug Fix — Braille Analysis Failed to Fetch

- [x] Trace the upload form, tRPC request, and server AI/storage configuration for the failed analysis request.
- [x] Repair the analysis request or provide a clear local fallback so valid Braille uploads do not surface only a generic fetch error.
- [x] Add regression coverage for analysis success and failure handling.
- [x] Run checks, tests, build, browser verification, save a checkpoint, and push the fix to GitHub.
- [x] Add a regression for an unreachable local AI or Forge analysis provider and assert an actionable error instead of generic fetch failure.
- [x] Run or document the browser Analyze Braille smoke-test boundary for the sandbox: the authenticated Analyze Braille surface was verified, but the sandbox upload helper could not target its hidden file input, so a real image analysis request could not be submitted here.
- [x] Save a fresh analysis-repair checkpoint: 184924fc; verified changes are pushed to braillehelp main at e1a2513.

# Bug Fix — Missing AI and OAuth Runtime Configuration

- [x] Inspect environment loading, `.env.example`, and provider detection for standalone local development.
- [x] Make local development configuration runnable for Braille analysis and OAuth without weakening production requirements.
- [x] Add regression coverage for AI-provider detection and missing OAuth configuration behavior.
- [x] Run checks, tests, build, verify local startup, save a checkpoint, and push the configuration repair to GitHub; braillehelp main is at e973db3.
- [x] Document that `.env.example` is absent and add explicit standalone environment setup guidance with provider selection.
- [x] Verify the no-provider development startup and dev-login path with dotenv loading; this checkout does not include a runnable legacy local AI service, so actual analysis requires Forge credentials or a separately started local service.
- [x] Verify development login end to end in the no-OAuth configuration before the final checkpoint: `/api/dev-login` issued a valid local session cookie on port 3116.
- [x] Add runtime tests that execute provider selection and development OAuth warning behavior rather than only checking source text.
- [x] Verify a protected endpoint succeeds with the no-OAuth development-login cookie: `/api/trpc/auth.me` returned HTTP 200 after `/api/dev-login` issued the cookie.
- [x] Add a regression for the actual SDK missing-OAUTH warning severity in development versus production/OAuth-only mode.
- [x] Verify the no-OAuth development cookie against the protected `reading.create` procedure and assert a successful authenticated response body through the real request context.
- [x] Save a fresh managed checkpoint for the missing AI/OAuth runtime-configuration repair and record its version: 1d85c2f4.

# Bug Fix — Local AI Fallback and Clean Finger Tracking

- [x] Fall back from an unavailable LOCAL_AI_URL to Forge vision analysis when Forge is configured.
- [x] Keep the camera reading session clean and expose visible finger position, confidence, trail, speed, rereads, skipped regions, and coverage metrics.
- [x] Add regression coverage for provider fallback and camera-session metric visibility.
- [x] Run checks, tests, build, browser verification, save a checkpoint, and push the repair to braillehelp main; braillehelp main is at 4d0c5fc.
- [x] Add or strengthen a runtime camera-session regression that directly verifies finger position, confidence, trail, speed, rereads, skipped regions, and coverage labels.
- [x] Add a runtime camera-session assertion for the visible reading-speed label/value.
- [x] Expose and test an explicit finger-position label/value, or revise the tracked requirement to the verified region/confidence/trail contract.
- [x] Save a fresh managed checkpoint for the local-AI fallback and clean finger-tracking repair: 1738ed66.
- [x] Run a focused browser smoke test for Analyze/Reading session after this change, or document the sandbox upload/camera blocker precisely: both surfaces opened; the passage-required guard rendered; hidden-file upload and physical camera access are unavailable in this sandbox.

# Bug Fix — Malformed Braille AI JSON Response

- [x] Reproduce and trace the `Unterminated string in JSON` failure through Forge/local-AI response parsing.
- [x] Harden analysis parsing for fenced, wrapped, truncated, or otherwise malformed provider JSON and return an actionable error when recovery is impossible.
- [x] Add regression coverage for malformed and recoverable AI responses.
- [x] Run full checks, tests, build, and browser analysis smoke verification; 42 tests pass and the browser reached the Analyze Braille surface, while the sandbox could not submit its hidden file input.
- [x] Save a fresh checkpoint and push the complete repair to braillehelp main: checkpoint 8fef4410; GitHub main aca3e50.
- [x] Apply the shared Braille parser to local-AI responses and add a regression for fenced or explanatory local-AI JSON.

# Delivery — Open Source License

- [x] Add a complete MIT License file to the linked braillehelp repository.
- [x] Commit, push, and verify GitHub detects the license on main: commit 8dbcc0f; GitHub metadata reports SPDX license MIT.

# Core Workflow Audit — Student Braille Reading

- [x] Audit passage analysis, camera preview, calibration, audio start cue, visible finger tracking, rereads, skips, speed, and teacher-facing interpretation against the stated core workflow.
- [x] Ensure the live camera view visibly overlays the tracked finger position across the Braille reading surface, not only a numeric telemetry panel.
- [x] Ensure calibration and start-cue states are explicit and usable before live tracking begins.
- [x] Add evidence-based age/grade speed bands with clear non-diagnostic interpretation and teacher review language.
- [x] Add regression coverage for the core workflow and visible tracking behavior.
- [x] Run full checks, build, browser verification, save a checkpoint, and push all necessary changes to braillehelp main.

# Core Workflow Gap Repairs

- [x] Replace timer-only calibration with explicit user-confirmed multi-height steps and persist calibration samples.
- [x] Extend teacher benchmark interpretation with an age-based path or a clearly documented grade-to-age mapping.
- [x] Add regression tests for calibration progression and audio start-cue invocation.
- [x] Save a new checkpoint and push the latest core-workflow changes to braillehelp main, then verify the remote commit.

# Bug Fix — Incomplete Braille AI JSON Retry

- [x] Trace the current provider response parser and client error mapping for incomplete JSON.
- [x] Add bounded retry/fallback behavior for truncated or recoverable Braille AI output.
- [x] Improve the analysis UI error and retry guidance for image-quality/provider failures.
- [x] Add regression tests for truncated, fenced, recoverable, and retry-exhausted responses.
- [x] Run checks/build, save a checkpoint, and synchronize the repair to braillehelp main; GitHub main is now 356a288.

# Bug Fix — Negative Skipped Regions on Session Completion

- [x] Trace the skippedRegions calculation and reading.complete payload path.
- [x] Clamp skippedRegions at the tracker source and server completion boundary.
- [x] Add regression coverage for negative skippedRegions and completion validation.
- [x] Run checks/build, save a checkpoint, and synchronize the repair to braillehelp main; GitHub main is now e0994a8.

# Feature — Camera-First Live Reading Workspace

- [x] Audit the current reading-session camera composition and overlay against the reference camera-first experience.
- [x] Make the camera preview the primary workspace with a visible tracking frame, fingertip marker/trail, and stable live status.
- [x] Add prominent real-time metrics for hand/finger detection, passage progress, elapsed time, reading speed, rereads, skips, coverage, and calibration state.
- [x] Add regression coverage for the camera-first workspace and visible tracking labels.
- [x] Run checks/build/browser verification, save a checkpoint, and synchronize the UI upgrade to braillehelp main; GitHub main is now a4d803f.

# Feature — Actual Fingertip Tracking

- [x] Audit the current motion-centroid tracker and browser hand-landmark dependency options.
- [x] Replace pixel-motion position estimates with actual index-fingertip landmark coordinates and honest no-detection fallback.
- [x] Keep reread/skip metrics based on the detected fingertip path and update visible confidence/status labels.
- [x] Add regression coverage for fingertip landmark selection and no-hand behavior.
- [x] Run checks/build/browser validation, save a checkpoint, and synchronize the fix to braillehelp main; GitHub main is now 621a65b.

# Hackathon Competition Readiness

- [x] Audit each stated rule against the active repository, live project state, license, AI workflow, and submission assets.
- [x] Add a professional judging-facing README section explaining originality, meaningful AI use, architecture, privacy, limitations, and demo flow.
- [x] Add low-risk product polish that improves first-run clarity and judge comprehension without changing the verified tracking pipeline.
- [x] Prepare a submission checklist and approximately three-minute demo script.
- [x] Run full verification, save a checkpoint, and synchronize competition-readiness changes to braillehelp main; GitHub main is now b586735.

# Bug Fix — Hand Tracking Aborted Initialization

- [x] Trace the MediaPipe WASM/model asset and GPU initialization path causing `Aborted()`.
- [x] Add package-local asset resolution and GPU-to-CPU detector fallback.
- [x] Replace raw initialization errors with clear retry/recovery state in the session UI.
- [x] Add regression coverage for detector configuration/fallback behavior.
- [x] Run checks/build/browser validation, save a checkpoint, and synchronize the repair to braillehelp main; GitHub main is now 21e39ad.

# Bug Fix — Recurring Uncaught MediaPipe WASM Abort

- [x] Trace the uncaught WASM abort and current CDN/local asset serving path.
- [x] Serve stable local MediaPipe WASM assets and harden detector initialization.
- [x] Contain runtime aborts so they do not surface as uncaught console failures.
- [x] Add regression coverage for local asset configuration and abort recovery.
- [x] Run checks/build/browser validation, save a checkpoint, and synchronize the repair to braillehelp main; GitHub main is now 0351ee1.

# Bug Fix — CPU WASM Abort and XNNPACK Log Noise

- [x] Trace the CPU WASM abort and debug-collector treatment of XNNPACK informational output.
- [x] Implement safer detector startup and contain backend console noise without hiding real application errors.
- [x] Add regression coverage for abort normalization and benign XNNPACK log handling.
- [x] Run checks/build/browser validation, save a checkpoint, and synchronize the repair to braillehelp main; GitHub main is now 27d28af.

# Bug Fix — Restore Previously Working Hand Tracking

- [x] Compare the current hand-tracking runtime against the last known-good checkpoint from yesterday.
- [x] Restore the safest working detector path, reverting only the regression-causing WASM/runtime changes.
- [x] Run focused camera/session tests, TypeScript, and production build.
- [x] Save a checkpoint and push the restored repair to braillehelp main; GitHub main is now 75c07f1.

# Feature — Non-Blocking Camera Tracking Recovery

- [x] Audit the failing model startup and the live session’s current tracking/error state flow.
- [x] Allow a camera session to continue when MediaPipe fails, using a reliable browser-safe fallback and honest detection labeling.
- [x] Preserve three-step calibration, audio start cue, fingertip overlay, speed, rereads, skipped regions, coverage, and teacher benchmark metrics in fallback mode.
- [x] Add regression coverage for model failure fallback and live session continuity.
- [ ] Run full checks/build/browser validation, save a checkpoint, and push the repair to braillehelp main.
