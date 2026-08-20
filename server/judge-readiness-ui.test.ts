import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

describe("judge-readiness camera UI contract", () => {
  it("exposes a reproducible demo guide without simulating measurement results", () => {
    expect(homeSource).toContain("Judge demo guide");
    expect(homeSource).toContain("complete all three height confirmations");
    expect(homeSource).toContain("Metrics stay blank until the app acquires a stable multi-point path");
    expect(homeSource).toContain("prototype measurement aid, not a clinical diagnosis");
  });

  it("shows evidence provenance and visited-region evidence", () => {
    expect(homeSource).toContain("VISITED REGIONS");
    expect(homeSource).toContain("Evidence:");
    expect(homeSource).toContain("stabilized points across");
    expect(homeSource).toContain('pathEvidence ? value : "—"');
    expect(homeSource).toContain("RECENT COMPLETED READS");
    expect(homeSource).toContain('session.status === "completed"');
    expect(homeSource).toContain("TEACHER TAKEAWAY · REVIEW WITH CONTEXT");
    expect(homeSource).toContain("WHY THIS IS DIFFERENT");
    expect(homeSource).toContain("AI passage reference");
    expect(homeSource).toContain("Camera path evidence");
    expect(homeSource).toContain("Speed context paired with accuracy and comprehension caveats.");
  });
});
