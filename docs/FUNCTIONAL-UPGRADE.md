# Braille Read Functional Upgrade

## What is implemented

Braille Read now has a server-side full-stack path rather than a visual-only demo. The browser can request camera permission, create a reading session, sample low-resolution frame differences without uploading video, and send timestamped movement events to the server. A completed session persists elapsed time, reading speed, pauses, inferred rereads, inferred skipped regions, and motion coverage.

A teacher can also upload a PNG, JPEG, or WebP image of a Braille page. The server stores the image through the project storage helper, calls the configured vision-capable model through the server-only LLM helper, validates a structured response, and persists the detected text, confidence, Braille standard, line count, cell count, and warnings. The next reading session loads the saved passage record and uses its analyzed word count rather than a demo constant.

## Environment and secrets

The managed project expects the platform-injected values already present in the full-stack scaffold: `DATABASE_URL` for the managed SQL database, `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` for server-side AI and storage helpers, and the existing Manus OAuth variables for optional teacher sign-in. No AI key is exposed to the browser. If the team runs the exported app outside Manus, replace the storage, authentication, database, and LLM adapters with deployment-specific equivalents before using production data.

The current managed database adapter is Drizzle over the scaffold's MySQL/TiDB-compatible connection. The original repository's PostgreSQL `RestAPI` remains preserved in the GitHub branch for reference, but it is not the active adapter for the managed web application.

## AI and camera limitations

The AI pipeline is intentionally conservative: it is asked to read only visible cells and return warnings when the image is unclear. It should not be treated as an authoritative translation, clinical assessment, or automated grading system. Contracted Braille, unusual layouts, glare, cropping, and low-resolution images may reduce accuracy. A teacher must review the detected passage before it is used for instruction.

The current browser tracking layer is a working telemetry foundation, not a validated finger-segmentation model. It uses low-resolution frame-to-frame motion sampling and derives region transitions from elapsed reading time. A reread is inferred when a tracked region is revisited; a skip is inferred when a region index is jumped over. These are stored as events so the algorithm can later be replaced with a trained finger/keypoint tracker without changing the session data contract.

## Privacy and data handling

Video is rendered in the browser and is not uploaded by the camera session. The camera session sends only derived event telemetry and not raw frames. Uploaded Braille images are stored in project storage because the vision analysis needs an image input; the database stores the storage key and analysis metadata rather than image bytes. Student records should be created only with the minimum information required for classroom support, and the project should add retention controls, consent workflows, access rules, and an audit trail before real student data is used.

## Next integration steps

The highest-value next step is replacing motion sampling with a validated on-device or server-side finger tracker that returns a normalized finger path and confidence for each frame. The existing `trackingEvents` contract supports this replacement. The team should then add evidence-reviewed grade ranges, passage-level line and region geometry from the Braille analysis response, and a speech-to-text comparison path for oral reading accuracy. Finally, student access controls and an explicit PostgreSQL deployment adapter should be added if the team deploys the preserved repository services rather than the managed full-stack app.

## Production hardening additions

The live session now persists a calibration version, estimated phone height, calibration confidence, and explicit camera/audio consent flags. Camera coordinates are transformed using the selected phone-height estimate before region transitions are classified, so calibration is part of the tracking path rather than unused metadata.

The oral-reading flow requests microphone permission only when consent is enabled, records audio in the browser through `MediaRecorder`, uploads the short recording to project storage, transcribes it through the server-side Whisper helper, and compares normalized spoken words against the analyzed passage. The result stores the transcript, expected text, percentage match, and word-level mismatch list in the `oralReadings` table.

Classroom, passage, session, tracking, and oral-reading procedures are now authenticated and owner-scoped. Anonymous users can still see the public shell, but they cannot create or read classroom data. Before real student deployment, add role-based teacher invitations, consent withdrawal, and an audited storage-object deletion flow. The current owner-facing privacy screen already supports per-student retention windows, expiry metadata, purge-expired actions, and deletion of linked database records.
