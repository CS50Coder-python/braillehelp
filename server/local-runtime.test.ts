import { describe, expect, it } from "vitest";
import { addTrackingEvents, createPassage, createReadingSession, getPassage, getSessionWithEvents, updatePassageText } from "./db";

describe("local development runtime store", () => {
  it("keeps an analyzed passage and camera session usable without an external database", async () => {
    const passageId = await createPassage({ ownerUserId: 0, title: "Local Braille page", sourceFileKey: "local://page", sourceMimeType: "image/png" } as any);
    await updatePassageText(passageId, "A student reads a page", 5);
    const passage = await getPassage(passageId, 0);
    expect(passage?.detectedText).toBe("A student reads a page");
    expect(passage?.expectedWordCount).toBe(5);

    const sessionId = await createReadingSession({ ownerUserId: 0, passageId, status: "running" } as any);
    await addTrackingEvents([{ sessionId, ownerUserId: 0, eventType: "finger_move", timestampMs: 500, lineIndex: 0, regionIndex: 1, x: 0.2, y: 0.4, confidence: 0.8 } as any]);
    const detail = await getSessionWithEvents(sessionId, 0);
    expect(detail?.session?.passageId).toBe(passageId);
    expect(detail?.events).toHaveLength(1);
    expect(detail?.events[0]?.y).toBe(0.4);
  });
});
