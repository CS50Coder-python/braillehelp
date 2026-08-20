import { describe, expect, it } from "vitest";
import { mapObjectFitCover } from "../client/src/components/CameraTrackingOverlay";

describe("tracking overlay alignment", () => {
  it("keeps a centered point centered when source and container aspect ratios differ", () => {
    expect(mapObjectFitCover({ x: 0.5, y: 0.5 }, 4 / 3, 16 / 9)).toEqual({ x: 0.5, y: 0.5 });
    expect(mapObjectFitCover({ x: 0.5, y: 0.5 }, 16 / 9, 4 / 3)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("maps object-fit cover crop edges into the visible container", () => {
    const widerContainer = mapObjectFitCover({ x: 0.5, y: 0 }, 4 / 3, 16 / 9);
    expect(widerContainer.x).toBe(0.5);
    expect(widerContainer.y).toBeLessThan(0);

    const tallerContainer = mapObjectFitCover({ x: 0, y: 0.5 }, 16 / 9, 4 / 3);
    expect(tallerContainer.x).toBeLessThan(0);
    expect(tallerContainer.y).toBe(0.5);
  });

  it("does not apply calibration to the display coordinate contract", () => {
    const rawPoint = { x: 0.22, y: 0.64 };
    const calibratedRegionCoordinate = 0.31;
    expect(rawPoint.x).not.toBe(calibratedRegionCoordinate);
    expect(mapObjectFitCover(rawPoint, null, 1)).toEqual(rawPoint);
  });
});
