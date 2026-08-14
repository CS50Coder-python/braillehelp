import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addTrackingEvents,
  createReadingSession,
  createStudent,
  getOralReading,
  getSessionWithEvents,
  purgeExpiredData,
  saveOralReading,
  setStudentRetention,
} from "./db";

describe("local privacy retention", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires only the selected owner's student, session, audio, and tracking data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const firstStudentId = await createStudent({
      ownerUserId: 101,
      displayName: "First learner",
    });
    const secondStudentId = await createStudent({
      ownerUserId: 202,
      displayName: "Second learner",
    });
    const firstSessionId = await createReadingSession({
      ownerUserId: 101,
      studentId: firstStudentId,
      status: "completed",
    });
    const secondSessionId = await createReadingSession({
      ownerUserId: 202,
      studentId: secondStudentId,
      status: "completed",
    });

    await addTrackingEvents([
      { sessionId: firstSessionId, eventType: "finger_move", timestampMs: 100, lineIndex: 0, regionIndex: 1 },
      { sessionId: secondSessionId, eventType: "finger_move", timestampMs: 100, lineIndex: 0, regionIndex: 1 },
    ]);
    await saveOralReading({
      sessionId: firstSessionId,
      ownerUserId: 101,
      audioFileKey: "first.webm",
      audioMimeType: "audio/webm",
      transcript: "first",
      expectedText: "first",
      matchScore: 100,
      mismatches: "[]",
      language: "en",
    });
    await saveOralReading({
      sessionId: secondSessionId,
      ownerUserId: 202,
      audioFileKey: "second.webm",
      audioMimeType: "audio/webm",
      transcript: "second",
      expectedText: "second",
      matchScore: 100,
      mismatches: "[]",
      language: "en",
    });

    await setStudentRetention(firstStudentId, 101, 1);
    await setStudentRetention(secondStudentId, 202, 1);
    vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));

    await expect(purgeExpiredData(101)).resolves.toEqual({ sessions: 1, students: 1 });
    await expect(getSessionWithEvents(firstSessionId, 101)).resolves.toBeNull();
    await expect(getOralReading(firstSessionId, 101)).resolves.toBeNull();

    const remainingSession = await getSessionWithEvents(secondSessionId, 202);
    expect(remainingSession?.session.id).toBe(secondSessionId);
    expect(remainingSession?.events).toHaveLength(1);
    await expect(getOralReading(secondSessionId, 202)).resolves.toMatchObject({ transcript: "second" });
  });
});
