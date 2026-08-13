import { and, desc, eq, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, students, passages, brailleAnalyses, oralReadings, readingSessions, trackingEvents } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = values[field]; }
  }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createStudent(input: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(students).values(input);
  return Number(result[0].insertId);
}

export async function getStudents(ownerUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(students).where(eq(students.ownerUserId, ownerUserId)).orderBy(desc(students.createdAt)).limit(limit);
}

export async function getPassage(id: number, ownerUserId?: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(passages).where(ownerUserId ? and(eq(passages.id, id), eq(passages.ownerUserId, ownerUserId)) : eq(passages.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPassage(input: typeof passages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(passages).values(input);
  return Number(result[0].insertId);
}

export async function saveBrailleAnalysis(input: typeof brailleAnalyses.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(brailleAnalyses).values(input);
}

export async function saveOralReading(input: typeof oralReadings.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(oralReadings).values(input);
  return Number(result[0].insertId);
}

export async function getOralReading(sessionId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(oralReadings).where(and(eq(oralReadings.sessionId, sessionId), eq(oralReadings.ownerUserId, ownerUserId))).orderBy(desc(oralReadings.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function createReadingSession(input: typeof readingSessions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(readingSessions).values(input);
  return Number(result[0].insertId);
}

export async function updateReadingSession(id: number, input: Partial<typeof readingSessions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(readingSessions).set(input).where(eq(readingSessions.id, id));
}

export async function addTrackingEvents(events: Array<typeof trackingEvents.$inferInsert>) {
  const db = await getDb();
  if (!db || events.length === 0) return;
  const sessionIds = Array.from(new Set(events.map((event) => event.sessionId)));
  const sessions = await db.select({ id: readingSessions.id, expiresAt: readingSessions.expiresAt }).from(readingSessions).where(sql`${readingSessions.id} in (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`);
  const expiryBySession = new Map(sessions.map((session) => [session.id, session.expiresAt]));
  await db.insert(trackingEvents).values(events.map((event) => ({ ...event, expiresAt: event.expiresAt ?? expiryBySession.get(event.sessionId) ?? null })));
}

export async function getRecentSessions(ownerUserId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(readingSessions).where(eq(readingSessions.ownerUserId, ownerUserId)).orderBy(desc(readingSessions.createdAt)).limit(limit);
}

export async function getSessionWithEvents(id: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const session = await db.select().from(readingSessions).where(and(eq(readingSessions.id, id), eq(readingSessions.ownerUserId, ownerUserId))).limit(1);
  if (!session[0]) return null;
  const events = await db.select().from(trackingEvents).where(eq(trackingEvents.sessionId, id)).orderBy(trackingEvents.timestampMs);
  const oralReading = await getOralReading(id, ownerUserId);
  return { session: session[0], events, oralReading };
}

export function buildSessionDeletionPlan(sessionId: number, ownerUserId: number) {
  return [
    { table: "trackingEvents", where: { sessionId } },
    { table: "oralReadings", where: { sessionId, ownerUserId } },
    { table: "readingSessions", where: { sessionId } },
  ] as const;
}

export function buildStudentDeletionPlan(studentId: number) {
  return ["trackingEvents", "oralReadings", "sessions", "analyses", "passages", "student"] as const;
}

export async function executeStudentDeletionPlan(plan: readonly string[], input: { sessionIds: number[]; passageIds: number[]; deleteSessions: () => Promise<void>; deleteTracking: (sessionId: number) => Promise<void>; deleteOralReadings: (sessionId: number) => Promise<void>; deleteAnalyses: (passageId: number) => Promise<void>; deletePassages: () => Promise<void>; deleteStudent: () => Promise<void> }) {
  for (const step of plan) {
    if (step === "trackingEvents") for (const sessionId of input.sessionIds) await input.deleteTracking(sessionId);
    if (step === "oralReadings") for (const sessionId of input.sessionIds) await input.deleteOralReadings(sessionId);
    if (step === "sessions") await input.deleteSessions();
    if (step === "analyses") for (const passageId of input.passageIds) await input.deleteAnalyses(passageId);
    if (step === "passages") await input.deletePassages();
    if (step === "student") await input.deleteStudent();
  }
}

export async function deleteSessionData(sessionId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const session = await db.select().from(readingSessions).where(and(eq(readingSessions.id, sessionId), eq(readingSessions.ownerUserId, ownerUserId))).limit(1);
  if (!session[0]) return false;
  for (const step of buildSessionDeletionPlan(sessionId, ownerUserId)) {
    if (step.table === "trackingEvents") await db.delete(trackingEvents).where(eq(trackingEvents.sessionId, sessionId));
    if (step.table === "oralReadings") await db.delete(oralReadings).where(and(eq(oralReadings.sessionId, sessionId), eq(oralReadings.ownerUserId, ownerUserId)));
    if (step.table === "readingSessions") await db.delete(readingSessions).where(eq(readingSessions.id, sessionId));
  }
  return true;
}

export async function deleteStudentData(studentId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const student = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.ownerUserId, ownerUserId))).limit(1);
  if (!student[0]) return false;
  const sessions = await db.select({ id: readingSessions.id }).from(readingSessions).where(and(eq(readingSessions.studentId, studentId), eq(readingSessions.ownerUserId, ownerUserId)));
  const studentPassages = await db.select({ id: passages.id }).from(passages).where(and(eq(passages.studentId, studentId), eq(passages.ownerUserId, ownerUserId)));
  await executeStudentDeletionPlan(buildStudentDeletionPlan(studentId), {
    sessionIds: sessions.map((session) => session.id),
    passageIds: studentPassages.map((passage) => passage.id),
    deleteTracking: async (sessionId) => { await db.delete(trackingEvents).where(eq(trackingEvents.sessionId, sessionId)); },
    deleteOralReadings: async (sessionId) => { await db.delete(oralReadings).where(and(eq(oralReadings.sessionId, sessionId), eq(oralReadings.ownerUserId, ownerUserId))); },
    deleteSessions: async () => { for (const session of sessions) await db.delete(readingSessions).where(eq(readingSessions.id, session.id)); },
    deleteAnalyses: async (passageId) => { await db.delete(brailleAnalyses).where(and(eq(brailleAnalyses.passageId, passageId), eq(brailleAnalyses.ownerUserId, ownerUserId))); },
    deletePassages: async () => { await db.delete(passages).where(and(eq(passages.studentId, studentId), eq(passages.ownerUserId, ownerUserId))); },
    deleteStudent: async () => { await db.delete(students).where(eq(students.id, studentId)); },
  });
  return true;
}

export async function setStudentRetention(studentId: number, ownerUserId: number, retentionDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const expiresAt = new Date(Date.now() + retentionDays * 86400000);
  await db.update(students).set({ retentionDays, expiresAt }).where(and(eq(students.id, studentId), eq(students.ownerUserId, ownerUserId)));
  await db.update(passages).set({ retentionDays, expiresAt }).where(and(eq(passages.studentId, studentId), eq(passages.ownerUserId, ownerUserId)));
  await db.update(readingSessions).set({ retentionDays, expiresAt }).where(and(eq(readingSessions.studentId, studentId), eq(readingSessions.ownerUserId, ownerUserId)));
  await db.update(oralReadings).set({ retentionDays, expiresAt }).where(eq(oralReadings.ownerUserId, ownerUserId));
  return expiresAt;
}

export async function purgeExpiredData(ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const expiredSessions = await db.select({ id: readingSessions.id }).from(readingSessions).where(and(eq(readingSessions.ownerUserId, ownerUserId), lte(readingSessions.expiresAt, new Date())));
  for (const session of expiredSessions) await deleteSessionData(session.id, ownerUserId);
  await db.delete(trackingEvents).where(lte(trackingEvents.expiresAt, new Date()));
  const expiredStudents = await db.select({ id: students.id }).from(students).where(and(eq(students.ownerUserId, ownerUserId), lte(students.expiresAt, new Date())));
  for (const student of expiredStudents) await deleteStudentData(student.id, ownerUserId);
  return { sessions: expiredSessions.length, students: expiredStudents.length };
}

export async function getClassroomSummary(ownerUserId: number) {
  const db = await getDb();
  if (!db) return { activeReaders: 0, averageSpeed: 0, averageCoverage: 0, minutesPracticed: 0 };
  const rows = await db.select({
    count: sql<number>`count(*)`,
    averageSpeed: sql<number>`coalesce(avg(${readingSessions.readingSpeedWpm}), 0)`,
    averageCoverage: sql<number>`coalesce(avg(${readingSessions.trackingCoverage}), 0)`,
    minutesPracticed: sql<number>`coalesce(sum(${readingSessions.elapsedMs}) / 60000, 0)`,
  }).from(readingSessions).where(and(eq(readingSessions.status, "completed"), eq(readingSessions.ownerUserId, ownerUserId)));
  const row = rows[0] ?? { count: 0, averageSpeed: 0, averageCoverage: 0, minutesPracticed: 0 };
  return { activeReaders: Number(row.count), averageSpeed: Math.round(Number(row.averageSpeed)), averageCoverage: Math.round(Number(row.averageCoverage)), minutesPracticed: Math.round(Number(row.minutesPracticed)) };
}
