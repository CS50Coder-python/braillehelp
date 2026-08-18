export type CalibrationSample = { heightMeters: number; capturedAtMs: number };

export function buildCalibrationProfile(samples: CalibrationSample[]) {
  if (samples.length < 3) throw new Error("Three calibration samples are required.");
  const averageHeight = samples.reduce((sum, sample) => sum + sample.heightMeters, 0) / samples.length;
  const encodedSamples = samples.map((sample) => sample.heightMeters.toFixed(1)).join("-");
  return {
    calibrationHeight: Number(averageHeight.toFixed(2)),
    calibrationVersion: `centroid-v2-${encodedSamples}`.slice(0, 40),
    calibrationConfidence: Math.min(0.98, 0.72 + samples.length * 0.06),
  };
}

export function announceStartCue(synthesis: Pick<SpeechSynthesis, "cancel" | "speak"> | null | undefined, Utterance = globalThis.SpeechSynthesisUtterance) {
  if (!synthesis || !Utterance) return false;
  synthesis.cancel();
  const utterance = new Utterance("Ready. Begin reading now.");
  utterance.rate = 0.9;
  utterance.pitch = 1;
  synthesis.speak(utterance);
  return true;
}

type Utterance = new (text: string) => SpeechSynthesisUtterance;
