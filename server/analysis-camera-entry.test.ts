import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { mockTrpc } = vi.hoisted(() => {
  const mockMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return { mockTrpc: {
    reading: {
      passage: { useQuery: () => ({ data: { id: 42, title: "Test passage", detectedText: "A tactile reading passage", expectedWordCount: 4, studentId: null } }) },
      create: { useMutation: mockMutation },
      calibrate: { useMutation: mockMutation },
      start: { useMutation: mockMutation },
      appendEvents: { useMutation: mockMutation },
      complete: { useMutation: mockMutation },
      transcribe: { useMutation: mockMutation },
    },
    classroom: { students: { useQuery: () => ({ data: [] }) } },
  } };
});
vi.mock("../client/src/lib/trpc", () => ({ trpc: mockTrpc }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

import { handleAnalyzedPassageSelection, ReadingSession } from "../client/src/pages/Home";
import { CameraTrackingOverlay } from "../client/src/components/CameraTrackingOverlay";

describe("analyzed passage camera entry", () => {
  it("persists successful analysis selection and enters the reading surface", () => {
    let selectedPassage: number | undefined;
    let nextView = "overview";
    const stored: Record<string, string> = {};
    handleAnalyzedPassageSelection(42, (id) => { selectedPassage = id; }, (view) => { nextView = view; }, { setItem: (key, value) => { stored[key] = value; }, removeItem: () => {} });
    expect(selectedPassage).toBe(42);
    expect(stored["braille-read-selected-passage"]).toBe("42");
    expect(nextView).toBe("read");
  });

  it("renders the actual session camera and live metric controls after passage selection", () => {
    const html = renderToStaticMarkup(createElement(ReadingSession, { passageId: 42, onExit: () => {}, onAnalyze: () => {} }));
    expect(html).toContain("Live camera preview");
    expect(html).toContain("I consent to camera-derived movement telemetry");
    expect(html).toContain("Give start cue &amp; begin");
    expect(html).toContain("Motion signal");
    expect(html).toContain("Coverage");
    expect(html).toContain("Elapsed");
    expect(html).toContain("Pauses");
    expect(html).toContain("Rereads");
    expect(html).toContain("Skipped regions");
    expect(html).toContain("A tactile reading passage");

    const overlay = renderToStaticMarkup(createElement(CameraTrackingOverlay, { point: { x: 0.42, y: 0.61, region: 3, confidence: 0.87 }, trail: [{ x: 0.2, y: 0.5, region: 1, confidence: 0.8 }], active: true }));
    expect(overlay).toContain("Finger position 42% × 61% · region 4 · 87%");
    expect(overlay).toContain("Finger tracking live");
    expect(overlay).toContain("tracking-trail-dot");
  });
});
