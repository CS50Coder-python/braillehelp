# Hackathon Submission Pack

## Rule-by-rule readiness

| Requirement | Current status | Evidence or remaining action |
|---|---|---|
| Built during the hackathon | **Needs team confirmation** | The repository contains substantial application commits, but only the team can truthfully confirm that the relevant work began during the permitted event window. Preserve the commit history and do not claim a date that cannot be supported. |
| Meaningful AI integration | **Satisfied in the product** | Braille vision analysis produces the expected passage, confidence, warnings, and downstream reading reference. Optional transcription compares oral reading. Browser hand landmarks follow the index fingertip. Explain that these capabilities drive the workflow rather than decorate it. |
| Open source | **Satisfied** | Repository: `https://github.com/CS50Coder-python/braillehelp`. It is public and contains `LICENSE` with MIT terms. |
| Individual/team limit | **Needs team confirmation** | Enter the real team members only. Do not list contributors who did not meaningfully participate. |
| Respectful and appropriate | **Designed for educational accessibility** | Explain consent, privacy controls, owner-scoped data, retention/deletion controls, and the non-diagnostic interpretation guardrail. |
| No plagiarism | **Needs team declaration** | State which libraries, models, templates, and platform services were used, and describe the team’s original integration work. Do not imply that open-source dependencies were written by the team. |
| Existing projects allowed with substantial new work | **Documented** | The root README identifies the active application, legacy experiments, managed framework, and original product workflow. Keep the meaningful feature commits visible. |
| Hosted/live project URL | **Still required** | Publish the managed project from the WebDev Management UI and paste the resulting stable URL into Devpost. The sandbox preview URL is useful for development but should not be treated as the final public submission URL unless the event explicitly accepts it. |
| Public repository | **Satisfied** | Use the GitHub URL above. Verify the repository is still public immediately before submitting. |
| Valid license | **Satisfied** | MIT License is present in the repository root and detectable on GitHub. |
| Demo video | **Still required** | Record the script below at approximately three minutes. Use a physical HTTPS phone for camera permissions and actual fingertip movement. |
| Devpost submission | **Still required** | Complete the form, attach the hosted URL, repository URL, demo video, team information, AI explanation, and limitations. |

## Three-minute demo script

### 0:00–0:20 — The problem

“Braille reading difficulty is often invisible in the final score. A teacher may know that a student struggled, but not where the student paused, reread, or skipped. BrailleHelp turns that hidden process into reviewable reading evidence while keeping the student in control of camera and audio consent.”

### 0:20–0:50 — AI understands the page

“First, I upload a clear Braille page. The vision analysis identifies the expected passage, visible structure, confidence, and uncertainty warnings. This is important because the passage is not hardcoded: the analyzed result becomes the reference used by the live reading session and optional oral-reading comparison.”

### 0:50–1:25 — The student starts safely

“I open a reading session, review the passage, give camera consent, and complete three phone-height calibration steps. The app does not start timing until calibration is complete. It then gives the student an audible start cue: ‘Ready. Begin reading now.’”

### 1:25–2:10 — The differentiating live experience

“This is the core demo. The camera stays visible, and the browser hand-landmark model follows the index fingertip rather than guessing from generic motion. The marker and trail move over the live video. The interface reports whether a hand is detected, fingertip confidence, passage region, movement, elapsed time, reading speed, pauses, rereads, skipped regions, and coverage. When no hand is visible, the app says so instead of pretending that tracking is working.”

### 2:10–2:35 — Teacher insight

“After the session, the teacher sees the reading pattern, not just a single score. The speed reference is a cautious grade/age oral-fluency comparison based on published norms, clearly labeled as approximate and not Braille-specific or diagnostic. Teachers are expected to interpret it with accuracy, comprehension, passage difficulty, accommodations, and repeated sessions.”

### 2:35–2:55 — Responsible AI and privacy

“The app uses consent-gated camera and optional microphone access, owner-scoped records, retention controls, and deletion workflows. AI failures are surfaced as uncertainty or retryable errors; they are not silently presented as facts.”

### 2:55–3:00 — Close

“BrailleHelp helps educators see where reading gets harder so support can become more specific, while keeping the student’s privacy and dignity at the center.”

## Recording checklist

Use a real phone over HTTPS, a clean Braille page with even lighting, and a short passage that can be read within the recording. Capture the AI analysis result, the three calibration confirmations, the audible cue, the fingertip marker moving across the page, at least one live metric change, and the teacher interpretation panel. Avoid recording real student names, faces, voices, or identifying data; use a consenting demonstrator and synthetic/demo passage.

## Claims to avoid

Do not claim clinical accuracy, automatic diagnosis, Braille-specific normative validity, perfect hand tracking, or that speed alone determines reading ability. Describe the project as a research/demo prototype that supports teacher review and requires validation on representative devices and users.
