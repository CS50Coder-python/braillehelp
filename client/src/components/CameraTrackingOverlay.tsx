import React, { useEffect, useRef, useState } from "react";

type TrackingPoint = { x: number; y: number; region: number; confidence: number };

export function mapObjectFitCover(point: { x: number; y: number }, sourceAspect: number | null, containerAspect: number) {
  if (!sourceAspect || !containerAspect || !Number.isFinite(sourceAspect)) return point;
  if (containerAspect > sourceAspect) {
    const scale = containerAspect / sourceAspect;
    return { x: point.x, y: point.y * scale - (scale - 1) / 2 };
  }
  const scale = sourceAspect / containerAspect;
  return { x: point.x * scale - (scale - 1) / 2, y: point.y };
}

export function CameraTrackingOverlay({ point, trail, active, sourceAspect = null }: { point: TrackingPoint | null; trail: TrackingPoint[]; active: boolean; sourceAspect?: number | null }) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [containerAspect, setContainerAspect] = useState(1);
  useEffect(() => {
    const element = overlayRef.current;
    if (!element) return;
    const update = () => setContainerAspect(element.clientWidth / Math.max(1, element.clientHeight));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const displayPoint = point ? mapObjectFitCover(point, sourceAspect, containerAspect) : null;
  const displayTrail = trail.map((item) => ({ item, point: mapObjectFitCover(item, sourceAspect, containerAspect) }));
  return <div ref={overlayRef} className="tracking-overlay" aria-live="polite">
    <div className="tracking-capture-frame"><span className="capture-corner capture-tl" /><span className="capture-corner capture-tr" /><span className="capture-corner capture-bl" /><span className="capture-corner capture-br" /><span className="capture-frame-label">TRACKING AREA</span></div>
    {displayTrail.map(({ item, point: mapped }, index) => <span key={`${item.region}-${index}`} className="tracking-trail-dot" style={{ left: `${mapped.x * 100}%`, top: `${mapped.y * 100}%`, opacity: 0.16 + (index / Math.max(1, trail.length)) * 0.4 }} />)}
    {point && displayPoint && <><span className="tracking-crosshair" style={{ left: `${displayPoint.x * 100}%`, top: `${displayPoint.y * 100}%` }} /><span className="tracking-label" style={{ left: `${Math.min(78, Math.max(2, displayPoint.x * 100))}%`, top: `${Math.min(82, Math.max(4, displayPoint.y * 100))}%` }}>FINGER {Math.round(point.x * 100)}% × {Math.round(point.y * 100)}% · REGION {point.region + 1} · {Math.round(point.confidence * 100)}%</span></>}
    <div className={`tracking-live-pill ${active ? "is-active" : ""}`}><span className="tracking-live-dot" /> {active ? "Finger tracking live" : "Tracking starts with camera"}</div>
    <div className="tracking-detection-pill"><span className={point ? "detection-dot detected" : "detection-dot"} /> {point ? "Hand/finger detected" : "Waiting for movement"}</div>
  </div>;
}
