import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

export type FingertipDetection = { x: number; y: number; confidence: number } | null;

const MODEL_ASSET = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const HAND_TRACKING_WASM_ASSET = "/mediapipe/wasm";

let detectorPromise: Promise<HandLandmarker> | null = null;

async function createDetector(delegate: "GPU" | "CPU") {
  const vision = await FilesetResolver.forVisionTasks(HAND_TRACKING_WASM_ASSET);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_ASSET, delegate },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
  });
}

export function normalizeHandTrackingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/aborted|abort\(\)|wasm|memory|gpu/i.test(message)) {
    return "The hand-tracking model could not start on this device. Reload once, allow camera access, and try again; BrailleHelp uses a local CPU-compatible runtime for maximum browser compatibility.";
  }
  return "The hand-tracking model could not start. Check the network connection and reload the reading session.";
}

export function getHandLandmarker() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        // CPU-first avoids the GPU/WASM abort seen on some phone browsers.
        return await createDetector("CPU");
      } catch (cpuError) {
        // GPU is retained only as a last-resort fallback for capable browsers.
        try {
          return await createDetector("GPU");
        } catch {
          throw cpuError;
        }
      }
    })().catch((error) => {
      detectorPromise = null;
      throw new Error(normalizeHandTrackingError(error));
    });
  }
  return detectorPromise;
}

export function pickIndexFingertip(result: HandLandmarkerResult): FingertipDetection {
  const hand = result.landmarks?.[0];
  const fingertip = hand?.[8];
  if (!fingertip) return null;
  const handedness = result.handedness?.[0]?.[0];
  const confidence = typeof handedness?.score === "number" ? handedness.score : 0.7;
  return { x: Math.max(0, Math.min(1, fingertip.x)), y: Math.max(0, Math.min(1, fingertip.y)), confidence: Math.max(0, Math.min(1, confidence)) };
}
