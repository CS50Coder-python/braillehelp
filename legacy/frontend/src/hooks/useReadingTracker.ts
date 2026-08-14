import { useCallback, useEffect, useRef, useState } from 'react';
import { createHandTracker, type HandTracker } from '../ai/handTracker';
import { analyzeReading } from '../ai/readingAnalyzer';
import type { FingerPoint, ReadingAnalysis, TrackingPoint } from '../ai/types';
import { uploadReadingMetrics } from '../services/metricsApi';

const DETECTION_INTERVAL_MS = 80;
const SMOOTHING_FACTOR = 0.35;
const EXPECTED_LINE_COUNT = 4;

export const READING_REGION = {
  left: 0.08,
  top: 0.2,
  width: 0.84,
  height: 0.58
} as const;

type CameraStatus = 'idle' | 'starting' | 'loading-model' | 'ready' | 'error';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
    }
    if (error.name === 'NotFoundError') {
      return 'No camera is available on this device.';
    }
    if (error.name === 'NotReadableError') {
      return 'The camera is already in use or could not be started.';
    }
  }
  return 'The camera or hand-tracking model could not be started.';
}

export function useReadingTracker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  passageWordCount: number
) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [marker, setMarker] = useState<TrackingPoint | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysis, setAnalysis] = useState<ReadingAnalysis | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastDetectionRef = useRef(0);
  const smoothedRef = useRef<TrackingPoint | null>(null);
  const pointsRef = useRef<FingerPoint[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const readingRef = useRef(false);
  const cameraGenerationRef = useRef(0);

  const cancelLoop = useCallback(() => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const stopResources = useCallback(() => {
    cancelLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackerRef.current?.close();
    trackerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [cancelLoop, videoRef]);

  const stopCamera = useCallback(() => {
    cameraGenerationRef.current += 1;
    readingRef.current = false;
    setIsReading(false);
    stopResources();
    setCameraStatus('idle');
    setHandDetected(false);
    setMarker(null);
    smoothedRef.current = null;
  }, [stopResources]);

  const detectionLoop = useCallback((timestampMs: number) => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!video || !tracker || !streamRef.current) return;

    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      timestampMs - lastDetectionRef.current >= DETECTION_INTERVAL_MS
    ) {
      lastDetectionRef.current = timestampMs;
      const detected = tracker.detect(video, timestampMs);
      setHandDetected(Boolean(detected));

      if (detected) {
        const previous = smoothedRef.current;
        const smoothed = previous
          ? {
              x: previous.x + SMOOTHING_FACTOR * (detected.x - previous.x),
              y: previous.y + SMOOTHING_FACTOR * (detected.y - previous.y),
              confidence: detected.confidence
            }
          : detected;
        smoothedRef.current = smoothed;
        setMarker(smoothed);

        const inside =
          smoothed.x >= READING_REGION.left &&
          smoothed.x <= READING_REGION.left + READING_REGION.width &&
          smoothed.y >= READING_REGION.top &&
          smoothed.y <= READING_REGION.top + READING_REGION.height;

        if (readingRef.current && inside) {
          const x = (smoothed.x - READING_REGION.left) / READING_REGION.width;
          const y = (smoothed.y - READING_REGION.top) / READING_REGION.height;
          pointsRef.current.push({
            timestampMs: performance.now(),
            x,
            y,
            confidence: smoothed.confidence,
            lineIndex: Math.min(EXPECTED_LINE_COUNT - 1, Math.floor(y * EXPECTED_LINE_COUNT))
          });
          setPointCount(pointsRef.current.length);
        }
      } else {
        setMarker(null);
        smoothedRef.current = null;
      }
    }

    animationRef.current = window.requestAnimationFrame(detectionLoop);
  }, [videoRef]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Camera access is not supported by this browser.');
      return;
    }

    stopResources();
    const generation = cameraGenerationRef.current + 1;
    cameraGenerationRef.current = generation;
    setCameraError(null);
    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      if (cameraGenerationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Camera preview is unavailable.');
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraStatus('loading-model');
      const tracker = await createHandTracker();
      if (cameraGenerationRef.current !== generation) {
        tracker.close();
        return;
      }
      trackerRef.current = tracker;
      setCameraStatus('ready');
      animationRef.current = window.requestAnimationFrame(detectionLoop);
    } catch (error) {
      stopResources();
      setCameraStatus('error');
      setCameraError(cameraErrorMessage(error));
    }
  }, [detectionLoop, stopResources, videoRef]);

  const startReading = useCallback(() => {
    if (cameraStatus !== 'ready' || passageWordCount === 0) return;
    pointsRef.current = [];
    setPointCount(0);
    setAnalysis(null);
    setUploadStatus('idle');
    setUploadMessage('');
    sessionStartRef.current = performance.now();
    readingRef.current = true;
    setIsReading(true);
    setElapsedSeconds(0);
  }, [cameraStatus, passageWordCount]);

  const endReading = useCallback(async () => {
    const start = sessionStartRef.current;
    if (!readingRef.current || start === null) return;

    const end = performance.now();
    readingRef.current = false;
    setIsReading(false);
    const result = analyzeReading(
      pointsRef.current,
      passageWordCount,
      start,
      end,
      EXPECTED_LINE_COUNT
    );
    setAnalysis(result);
    setUploadStatus('uploading');
    setUploadMessage('Uploading session metrics…');

    try {
      await uploadReadingMetrics(result, passageWordCount);
      setUploadStatus('success');
      setUploadMessage('Session metrics uploaded successfully.');
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Metrics upload failed.');
    }
  }, [passageWordCount]);

  useEffect(() => {
    if (!isReading) return;
    const interval = window.setInterval(() => {
      const start = sessionStartRef.current;
      if (start !== null) setElapsedSeconds((performance.now() - start) / 1000);
    }, 250);
    return () => window.clearInterval(interval);
  }, [isReading]);

  useEffect(() => () => {
    cameraGenerationRef.current += 1;
    stopResources();
  }, [stopResources]);

  return {
    cameraStatus,
    cameraError,
    handDetected,
    marker,
    isReading,
    pointCount,
    elapsedSeconds,
    analysis,
    uploadStatus,
    uploadMessage,
    startCamera,
    stopCamera,
    startReading,
    endReading
  };
}
