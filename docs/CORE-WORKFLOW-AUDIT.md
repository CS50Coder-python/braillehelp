# Core Workflow Audit and Benchmark Evidence

## Audit findings

The active application does provide an analyze-to-reading flow, a live `<video>` preview, a camera-tracking overlay with a crosshair/trail/position label, consent checkboxes, session persistence, and live telemetry for speed, pauses, rereads, skipped regions, and coverage. The rendered UI therefore meets the visibility requirement at the interface level.

The current tracker is not yet a validated fingertip detector. `client/src/lib/tracking.ts` estimates a 2D motion centroid from frame-to-frame pixel differences at low resolution. It can visibly show movement and classify inferred region transitions, but a teacher should not treat the position as anatomically verified finger location until a validated keypoint/finger model is integrated. The current height control is a single phone-height estimate persisted as calibration metadata, not a short multi-step calibration sequence across multiple heights. The current start button is labeled “Give start cue & begin,” but the start flow does not yet emit an audible cue before starting the timed session.

## Evidence used for benchmark design

The National Center on Intensive Intervention states that oral reading fluency norms can help educators make decisions about which students might need intervention and monitor progress, and describes the 2017 compiled norms for grades 1–6 using DIBELS, DIBELS Next, and easyCBM data. Source: [NCII, An Update to Compiled ORF Norms](https://intensiveintervention.org/resource/update-compiled-orf-norms).

Reading Rockets reproduces the 2017 Hasbrouck–Tindal grade-by-season percentile table. The table reports fall, winter, and spring words-correct-per-minute values for grades 1–6, including 10th, 25th, 50th, 75th, and 90th percentiles. Examples include grade 3: fall 83 WCPM at the 50th percentile, winter 97, spring 112; grade 4: fall 94, winter 120, spring 133. Source: [Reading Rockets, Fluency Norms Chart (2017 Update)](https://www.readingrockets.org/topics/fluency/articles/fluency-norms-chart-2017-update).

The application should use these values as an instructional reference, not a diagnosis or a universal standard for Braille reading. The comparison should be labeled as an approximate oral-reading-fluency reference, should require a grade and season, and should encourage teacher review alongside accuracy, comprehension, language, disability accommodations, passage difficulty, and repeated-session trends. For implementation, “below” means below the 25th-percentile reference, “within” means at or above the 25th and below the 75th percentile, and “above” means at or above the 75th percentile. This is an app interpretation rule, not a claim that the source defines those exact labels.

## References

[1]: https://intensiveintervention.org/resource/update-compiled-orf-norms "National Center on Intensive Intervention — An Update to Compiled ORF Norms"
[2]: https://www.readingrockets.org/topics/fluency/articles/fluency-norms-chart-2017-update "Reading Rockets — Fluency Norms Chart (2017 Update)"

## Browser smoke verification

The managed preview rendered the signed-in Overview with the workflow CTA, recent session data, and clear Analyze Braille / Reading session navigation. Opening Reading session without a selected analyzed passage displayed the intended “Analyze the page before the read” recovery guard. Opening Analyze Braille displayed the upload, passage-name, optional student, AI-return summary, and Analyze this page controls. The sandbox did not provide a physical camera or a valid uploaded Braille image, so the actual permission/calibration/audio/live-overlay sequence remains a device-side validation step.
