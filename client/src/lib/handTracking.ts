import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

export type FingertipDetection = { x: number; y: number; confidence: number } | null;

const MODEL_ASSET = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_ASSET = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

let detectorPromise: Promise<HandLandmarker> | null = null;

export function getHandLandmarker() {
  if (!detectorPromise) {
    detectorPromise = FilesetResolver.forVisionTasks(WASM_ASSET).then((vision) => HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_ASSET, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    })).catch((error) => {
      detectorPromise = null;
      throw error;
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
