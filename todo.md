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
- [x] Run final build after all local-runtime changes; browser smoke verification is complete and checkpoint/push are the remaining delivery actions.
