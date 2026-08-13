import { useEffect, useRef } from 'react';
import { countPassageWords } from '../ai/readingAnalyzer';
import { READING_REGION, useReadingTracker } from '../hooks/useReadingTracker';

interface CameraTrackerProps {
  passageText: string;
  onSessionStateChange?: (state: 'idle' | 'capturing' | 'processing' | 'ready') => void;
}

export default function CameraTracker({
  passageText,
  onSessionStateChange
}: CameraTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const passageWordCount = countPassageWords(passageText);
  const tracker = useReadingTracker(videoRef, passageWordCount);

  useEffect(() => {
    if (tracker.uploadStatus === 'uploading') onSessionStateChange?.('processing');
    else if (tracker.analysis) onSessionStateChange?.('ready');
    else if (tracker.isReading || tracker.cameraStatus === 'ready') {
      onSessionStateChange?.('capturing');
    } else {
      onSessionStateChange?.('idle');
    }
  }, [
    onSessionStateChange,
    tracker.analysis,
    tracker.cameraStatus,
    tracker.isReading,
    tracker.uploadStatus
  ]);

  const cameraStatusText = {
    idle: 'Camera stopped',
    starting: 'Requesting camera access…',
    'loading-model': 'Loading hand-tracking model…',
    ready: 'Camera and hand tracker ready',
    error: 'Camera unavailable'
  }[tracker.cameraStatus];

  return (
    <div className="camera-tracker">
      <div className="camera-feed">
        <video ref={videoRef} className="camera-video" playsInline muted aria-label="Live camera preview" />
        <div
          className="reading-region"
          style={{
            left: `${READING_REGION.left * 100}%`,
            top: `${READING_REGION.top * 100}%`,
            width: `${READING_REGION.width * 100}%`,
            height: `${READING_REGION.height * 100}%`
          }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3].map((line) => <span key={line} className="reading-line" />)}
        </div>
        {tracker.marker && (
          <span
            className="fingertip-marker"
            style={{
              left: `${tracker.marker.x * 100}%`,
              top: `${tracker.marker.y * 100}%`
            }}
            aria-hidden="true"
          />
        )}
        {tracker.cameraStatus === 'idle' && (
          <div className="camera-empty">Start the camera to begin hand tracking.</div>
        )}
      </div>

      <div className="tracker-controls">
        {tracker.cameraStatus === 'idle' || tracker.cameraStatus === 'error' ? (
          <button type="button" className="primary-action" onClick={tracker.startCamera}>
            Start camera
          </button>
        ) : (
          <button type="button" className="secondary-action" onClick={tracker.stopCamera}>
            Stop camera
          </button>
        )}
        {!tracker.isReading ? (
          <button
            type="button"
            className="primary-action"
            onClick={tracker.startReading}
            disabled={tracker.cameraStatus !== 'ready' || passageWordCount === 0}
            title={passageWordCount === 0 ? 'Scan a Braille passage before reading.' : undefined}
          >
            Start reading session
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={tracker.endReading}>
            End reading session
          </button>
        )}
      </div>

      <div className="tracker-status" aria-live="polite">
        <span>{cameraStatusText}</span>
        <span>{tracker.handDetected ? 'Hand detected' : 'Hand not detected'}</span>
        <span>Passage: {passageWordCount} words</span>
        <span>Session: {tracker.elapsedSeconds.toFixed(1)} seconds</span>
        <span>Points: {tracker.pointCount}</span>
      </div>

      {tracker.cameraError && <p className="tracker-error" role="alert">{tracker.cameraError}</p>}

      {tracker.analysis && (
        <div className="analysis-grid" aria-label="Reading session analysis">
          <div><span>Reading speed</span><strong>{tracker.analysis.readingSpeedWpm} WPM</strong></div>
          <div><span>Possible rereads</span><strong>{tracker.analysis.rereadCount}</strong></div>
          <div><span>Possible skipped regions</span><strong>{tracker.analysis.skippedRegionCount}</strong></div>
          <div><span>Pauses</span><strong>{tracker.analysis.pauseCount}</strong></div>
        </div>
      )}

      {tracker.uploadMessage && (
        <p
          className={tracker.uploadStatus === 'error' ? 'tracker-error' : 'upload-status'}
          role={tracker.uploadStatus === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {tracker.uploadMessage}
        </p>
      )}
      <p className="indicator-note">
        Possible rereads, skipped regions, and pauses are approximate instructional indicators,
        not medical or educational diagnoses.
      </p>
    </div>
  );
}
