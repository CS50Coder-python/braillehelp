import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult
} from '@mediapipe/tasks-vision';
import type { TrackingPoint } from './types';

const WASM_ROOT =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const INDEX_FINGERTIP_LANDMARK = 8;

export interface HandTracker {
  detect(video: HTMLVideoElement, timestampMs: number): TrackingPoint | null;
  close(): void;
}

export async function createHandTracker(): Promise<HandTracker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_URL,
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  return {
    detect(video, timestampMs) {
      const result: HandLandmarkerResult = landmarker.detectForVideo(video, timestampMs);
      const fingertip = result.landmarks[0]?.[INDEX_FINGERTIP_LANDMARK];
      if (!fingertip) return null;

      return {
        x: fingertip.x,
        y: fingertip.y,
        confidence: result.handedness[0]?.[0]?.score ?? 0
      };
    },
    close() {
      landmarker.close();
    }
  };
}
