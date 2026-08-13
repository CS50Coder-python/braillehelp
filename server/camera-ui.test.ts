import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CameraTrackingOverlay } from "../client/src/components/CameraTrackingOverlay";

describe("camera tracking overlay", () => {
  it("renders observable live tracking state", () => {
    const html = renderToStaticMarkup(createElement(CameraTrackingOverlay, {
      active: true,
      point: { x: 0.42, y: 0.5, region: 3, confidence: 0.88 },
      trail: [{ x: 0.2, y: 0.5, region: 1, confidence: 0.7 }, { x: 0.42, y: 0.5, region: 3, confidence: 0.88 }],
    }));
    expect(html).toContain("Finger tracking live");
    expect(html).toContain("Finger region 4");
    expect(html).toContain("88%");
    expect((html.match(/tracking-trail-dot/g) ?? []).length).toBe(2);
  });
});
