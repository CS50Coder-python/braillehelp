import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../client/src/pages/Home";
import { PrivacyScreen } from "../client/src/components/PrivacyScreen";
import { buildSessionDeletionPlan, buildStudentDeletionPlan, executeStudentDeletionPlan } from "./db";
import type { TrpcContext } from "./_core/context";

const { deleteSessionData, deleteStudentData, purgeExpiredData } = vi.hoisted(() => ({ deleteSessionData: vi.fn(), deleteStudentData: vi.fn(), purgeExpiredData: vi.fn() }));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, deleteSessionData, deleteStudentData, purgeExpiredData };
});

const { appRouter } = await import("./routers");

function ownerContext(): TrpcContext {
  const now = new Date();
  return { user: { id: 42, openId: "owner", name: "Teacher", email: "teacher@example.com", loginMethod: "test", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("privacy procedures and entry point", () => {
  beforeEach(() => { deleteSessionData.mockReset().mockResolvedValue(true); deleteStudentData.mockReset().mockResolvedValue(true); purgeExpiredData.mockReset().mockResolvedValue({ students: 2, sessions: 3 }); });

  it("delegates session, student, and expired-data deletion to owner-scoped persistence", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(caller.privacy.deleteSession({ sessionId: 11 })).resolves.toBe(true);
    await expect(caller.privacy.deleteStudent({ studentId: 7 })).resolves.toBe(true);
    await expect(caller.privacy.purgeExpired()).resolves.toEqual({ students: 2, sessions: 3 });
    expect(deleteSessionData).toHaveBeenCalledWith(11, 42);
    expect(deleteStudentData).toHaveBeenCalledWith(7, 42);
    expect(purgeExpiredData).toHaveBeenCalledWith(42);
  });

  it("executes linked student cleanup before parent deletion", async () => {
    const order: string[] = [];
    await executeStudentDeletionPlan(buildStudentDeletionPlan(7), { sessionIds: [11], passageIds: [21], deleteTracking: async () => { order.push("tracking"); }, deleteOralReadings: async () => { order.push("oral"); }, deleteSessions: async () => { order.push("sessions"); }, deleteAnalyses: async () => { order.push("analyses"); }, deletePassages: async () => { order.push("passages"); }, deleteStudent: async () => { order.push("student"); } });
    expect(order).toEqual(["tracking", "oral", "sessions", "analyses", "passages", "student"]);
  });

  it("keeps linked cleanup ahead of parent deletion in the real persistence plan", () => {
    expect(buildSessionDeletionPlan(11, 42).map((step) => step.table)).toEqual(["trackingEvents", "oralReadings", "readingSessions"]);
    expect(buildStudentDeletionPlan(7)).toEqual(["trackingEvents", "oralReadings", "sessions", "analyses", "passages", "student"]);
  });

  it("renders the real sidebar entry point and the privacy screen surface", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { view: "privacy", onView: () => undefined }));
    expect(html).toContain("Help &amp; privacy");
    expect(html).toContain('nav-item selected');
    const screen = renderToStaticMarkup(createElement(PrivacyScreen, { students: [{ id: 7, displayName: "Ava Morgan", gradeLevel: "Grade 4", retentionDays: 365 }], retentionDays: 365, onRetentionDaysChange: () => undefined, onSaveRetention: () => undefined, onDeleteStudent: () => undefined, onPurgeExpired: () => undefined }));
    expect(screen).toContain("Keep student data");
    expect(screen).toContain("Retention days");
  });
});
