import React from "react";

type TrackingPoint = { x: number; y: number; region: number; confidence: number };

export function CameraTrackingOverlay({ point, trail, active }: { point: TrackingPoint | null; trail: TrackingPoint[]; active: boolean }) {
  return <div className="tracking-overlay" aria-live="polite">
    {trail.map((item, index) => <span key={`${item.region}-${index}`} className="tracking-trail-dot" style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, opacity: 0.16 + (index / Math.max(1, trail.length)) * 0.4 }} />)}
    {point && <><span className="tracking-crosshair" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} /><span className="tracking-label" style={{ left: `${Math.min(78, Math.max(2, point.x * 100))}%`, top: `${Math.min(82, Math.max(4, point.y * 100))}%` }}>Finger position {Math.round(point.x * 100)}% × {Math.round(point.y * 100)}% · region {point.region + 1} · {Math.round(point.confidence * 100)}%</span></>}
    <div className={`tracking-live-pill ${active ? "is-active" : ""}`}><span className="tracking-live-dot" /> {active ? "Finger tracking live" : "Tracking starts with camera"}</div>
  </div>;
}
