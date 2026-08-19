import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

export type FingertipDetection = { x: number; y: number; confidence: number } | null;

const MODEL_ASSET = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  "https://unpkg.com/@mediapipe/tasks-vision@1.0.1/wasm",
];

let detectorPromise: Promise<HandLandmarker> | null = null;

async function createDetector(wasmAsset: string, delegate: "GPU" | "CPU") {
  const vision = await FilesetResolver.forVisionTasks(wasmAsset);
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
    return "The hand-tracking model could not start on this device. Reload once, allow camera access, and try again; the app will use CPU tracking when GPU tracking is unavailable.";
  }
  return "The hand-tracking model could not start. Check the network connection and reload the reading session.";
}

export function getHandLandmarker() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      let lastError: unknown;
      for (const wasmAsset of WASM_ASSETS) {
        try {
          try {
            return await createDetector(wasmAsset, "GPU");
          } catch (gpuError) {
            lastError = gpuError;
            return await createDetector(wasmAsset, "CPU");
          }
        } catch (assetError) {
          lastError = assetError;
        }
      }
      throw lastError ?? new Error("Hand-tracking assets could not be loaded.");
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
