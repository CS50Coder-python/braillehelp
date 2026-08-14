// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId"),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  gradeLevel: varchar("gradeLevel", { length: 40 }),
  retentionDays: int("retentionDays").default(365).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var passages = mysqlTable("passages", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId"),
  studentId: int("studentId"),
  title: varchar("title", { length: 255 }).notNull(),
  sourceFileKey: varchar("sourceFileKey", { length: 512 }),
  sourceMimeType: varchar("sourceMimeType", { length: 80 }),
  detectedText: text("detectedText"),
  expectedWordCount: int("expectedWordCount"),
  retentionDays: int("retentionDays").default(365).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var brailleAnalyses = mysqlTable("brailleAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  passageId: int("passageId").notNull(),
  ownerUserId: int("ownerUserId"),
  detectedText: text("detectedText").notNull(),
  confidence: float("confidence").notNull(),
  brailleStandard: varchar("brailleStandard", { length: 120 }).notNull(),
  warnings: text("warnings"),
  cellCount: int("cellCount").notNull(),
  lineCount: int("lineCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var oralReadings = mysqlTable("oralReadings", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  ownerUserId: int("ownerUserId"),
  audioFileKey: varchar("audioFileKey", { length: 512 }),
  audioMimeType: varchar("audioMimeType", { length: 80 }),
  transcript: text("transcript").notNull(),
  expectedText: text("expectedText").notNull(),
  matchScore: float("matchScore").notNull(),
  mismatches: text("mismatches"),
  language: varchar("language", { length: 16 }),
  retentionDays: int("retentionDays").default(365).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var readingSessions = mysqlTable("readingSessions", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId"),
  studentId: int("studentId"),
  passageId: int("passageId"),
  status: mysqlEnum("status", ["ready", "running", "completed", "cancelled"]).default("ready").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  elapsedMs: int("elapsedMs").default(0).notNull(),
  readingSpeedWpm: float("readingSpeedWpm").default(0).notNull(),
  rereads: int("rereads").default(0).notNull(),
  skippedRegions: int("skippedRegions").default(0).notNull(),
  pauseCount: int("pauseCount").default(0).notNull(),
  trackingCoverage: float("trackingCoverage").default(0).notNull(),
  calibrationVersion: varchar("calibrationVersion", { length: 40 }),
  calibrationHeight: float("calibrationHeight"),
  calibrationConfidence: float("calibrationConfidence"),
  consentCamera: int("consentCamera").default(0).notNull(),
  consentAudio: int("consentAudio").default(0).notNull(),
  retentionDays: int("retentionDays").default(365).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var trackingEvents = mysqlTable("trackingEvents", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  eventType: mysqlEnum("eventType", ["finger_move", "pause", "reread", "skip", "line_change"]).notNull(),
  timestampMs: int("timestampMs").notNull(),
  lineIndex: int("lineIndex").default(0).notNull(),
  regionIndex: int("regionIndex").default(0).notNull(),
  x: float("x"),
  y: float("y"),
  confidence: float("confidence"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
function resolveLocalAiUrl(environment = process.env) {
  if (environment.LOCAL_AI_URL) return environment.LOCAL_AI_URL;
  const hasForge = Boolean(environment.BUILT_IN_FORGE_API_URL && environment.BUILT_IN_FORGE_API_KEY);
  return !hasForge && environment.NODE_ENV !== "production" ? "http://127.0.0.1:8000" : "";
}
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  // Keep a fresh local checkout usable; production still requires JWT_SECRET.
  cookieSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "braille-read-local-development-secret"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  localAiUrl: resolveLocalAiUrl(),
  devAuthEnabled: process.env.DEV_AUTH_ENABLED !== "false",
  devAuthOpenId: process.env.DEV_AUTH_OPEN_ID ?? "dev_local_admin"
};

// server/db.ts
var _db = null;
var _dbUnavailable = false;
var memory = { users: [], students: [], passages: [], analyses: [], oralReadings: [], sessions: [], events: [], nextStudentId: 1, nextPassageId: 1, nextSessionId: 1, nextOralId: 1, nextEventId: 1 };
var useMemoryStore = () => !ENV.isProduction && (!ENV.databaseUrl || _dbUnavailable);
async function getDb() {
  if (_dbUnavailable) return null;
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _dbUnavailable = true;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  const values = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date() };
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const existing = memory.users.find((item) => item.openId === user.openId);
    const row = { id: existing?.id ?? memory.users.length + 1, openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"), createdAt: existing?.createdAt ?? /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date(), lastSignedIn: values.lastSignedIn };
    if (existing) Object.assign(existing, row);
    else memory.users.push(row);
    return;
  }
  const updateSet = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = values[field];
    }
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  try {
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    if (ENV.isProduction) throw error;
    console.warn("[Database] Development database unavailable; using the local runtime store.", error);
    _dbUnavailable = true;
    const existing = memory.users.find((item) => item.openId === user.openId);
    const row = { id: existing?.id ?? memory.users.length + 1, openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, role: user.role ?? "user", createdAt: existing?.createdAt ?? /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date(), lastSignedIn: values.lastSignedIn };
    if (existing) Object.assign(existing, row);
    else memory.users.push(row);
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return useMemoryStore() ? memory.users.find((user) => user.openId === openId) : void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function createStudent(input) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const row = { ...input, id: memory.nextStudentId++, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
    memory.students.push(row);
    return row.id;
  }
  const result = await db.insert(students).values(input);
  return Number(result[0].insertId);
}
async function getStudents(ownerUserId, limit = 50) {
  const db = await getDb();
  if (!db) return useMemoryStore() ? memory.students.filter((student) => student.ownerUserId === ownerUserId).slice(0, limit) : [];
  return db.select().from(students).where(eq(students.ownerUserId, ownerUserId)).orderBy(desc(students.createdAt)).limit(limit);
}
async function getPassage(id, ownerUserId) {
  const db = await getDb();
  if (!db) return useMemoryStore() ? memory.passages.find((passage) => passage.id === id && (ownerUserId === void 0 || passage.ownerUserId === ownerUserId)) ?? null : null;
  const rows = await db.select().from(passages).where(ownerUserId ? and(eq(passages.id, id), eq(passages.ownerUserId, ownerUserId)) : eq(passages.id, id)).limit(1);
  return rows[0] ?? null;
}
async function createPassage(input) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const row = { ...input, id: memory.nextPassageId++, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
    memory.passages.push(row);
    return row.id;
  }
  const result = await db.insert(passages).values(input);
  return Number(result[0].insertId);
}
async function updatePassageText(id, detectedText, expectedWordCount) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) return;
    const passage = memory.passages.find((item) => item.id === id);
    if (passage) Object.assign(passage, { detectedText, expectedWordCount, updatedAt: /* @__PURE__ */ new Date() });
    return;
  }
  await db.update(passages).set({ detectedText, expectedWordCount }).where(eq(passages.id, id));
}
async function saveBrailleAnalysis(input) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    memory.analyses.push({ ...input, id: memory.analyses.length + 1, createdAt: /* @__PURE__ */ new Date() });
    return;
  }
  await db.insert(brailleAnalyses).values(input);
}
async function saveOralReading(input) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const row = { ...input, id: memory.nextOralId++, createdAt: /* @__PURE__ */ new Date() };
    memory.oralReadings.push(row);
    return row.id;
  }
  const result = await db.insert(oralReadings).values(input);
  return Number(result[0].insertId);
}
async function getOralReading(sessionId, ownerUserId) {
  const db = await getDb();
  if (!db) return useMemoryStore() ? memory.oralReadings.filter((reading) => reading.sessionId === sessionId && reading.ownerUserId === ownerUserId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null : null;
  const rows = await db.select().from(oralReadings).where(and(eq(oralReadings.sessionId, sessionId), eq(oralReadings.ownerUserId, ownerUserId))).orderBy(desc(oralReadings.createdAt)).limit(1);
  return rows[0] ?? null;
}
async function createReadingSession(input) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const row = { ...input, id: memory.nextSessionId++, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
    memory.sessions.push(row);
    return row.id;
  }
  const result = await db.insert(readingSessions).values(input);
  return Number(result[0].insertId);
}
async function updateReadingSession(id, input) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const row = memory.sessions.find((session) => session.id === id);
    if (row) Object.assign(row, input, { updatedAt: /* @__PURE__ */ new Date() });
    return;
  }
  await db.update(readingSessions).set(input).where(eq(readingSessions.id, id));
}
async function addTrackingEvents(events) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) return;
    memory.events.push(...events.map((event) => ({ ...event, id: memory.nextEventId++, createdAt: /* @__PURE__ */ new Date() })));
    return;
  }
  if (events.length === 0) return;
  const sessionIds = Array.from(new Set(events.map((event) => event.sessionId)));
  const sessions = await db.select({ id: readingSessions.id, expiresAt: readingSessions.expiresAt }).from(readingSessions).where(sql`${readingSessions.id} in (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`);
  const expiryBySession = new Map(sessions.map((session) => [session.id, session.expiresAt]));
  await db.insert(trackingEvents).values(events.map((event) => ({ ...event, expiresAt: event.expiresAt ?? expiryBySession.get(event.sessionId) ?? null })));
}
async function getRecentSessions(ownerUserId, limit = 10) {
  const db = await getDb();
  if (!db) return useMemoryStore() ? memory.sessions.filter((session) => session.ownerUserId === ownerUserId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit) : [];
  return db.select().from(readingSessions).where(eq(readingSessions.ownerUserId, ownerUserId)).orderBy(desc(readingSessions.createdAt)).limit(limit);
}
async function getSessionWithEvents(id, ownerUserId) {
  const db = await getDb();
  if (!db) {
    const session2 = useMemoryStore() ? memory.sessions.find((item) => item.id === id && item.ownerUserId === ownerUserId) : null;
    if (!session2) return null;
    return { session: session2, events: memory.events.filter((event) => event.sessionId === id), oralReading: await getOralReading(id, ownerUserId) };
  }
  const session = await db.select().from(readingSessions).where(and(eq(readingSessions.id, id), eq(readingSessions.ownerUserId, ownerUserId))).limit(1);
  if (!session[0]) return null;
  const events = await db.select().from(trackingEvents).where(eq(trackingEvents.sessionId, id)).orderBy(trackingEvents.timestampMs);
  const oralReading = await getOralReading(id, ownerUserId);
  return { session: session[0], events, oralReading };
}
function buildSessionDeletionPlan(sessionId, ownerUserId) {
  return [
    { table: "trackingEvents", where: { sessionId } },
    { table: "oralReadings", where: { sessionId, ownerUserId } },
    { table: "readingSessions", where: { sessionId } }
  ];
}
function buildStudentDeletionPlan(studentId) {
  return ["trackingEvents", "oralReadings", "sessions", "analyses", "passages", "student"];
}
async function executeStudentDeletionPlan(plan, input) {
  for (const step of plan) {
    if (step === "trackingEvents") for (const sessionId of input.sessionIds) await input.deleteTracking(sessionId);
    if (step === "oralReadings") for (const sessionId of input.sessionIds) await input.deleteOralReadings(sessionId);
    if (step === "sessions") await input.deleteSessions();
    if (step === "analyses") for (const passageId of input.passageIds) await input.deleteAnalyses(passageId);
    if (step === "passages") await input.deletePassages();
    if (step === "student") await input.deleteStudent();
  }
}
async function deleteSessionData(sessionId, ownerUserId) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const session2 = memory.sessions.find((item) => item.id === sessionId && item.ownerUserId === ownerUserId);
    if (!session2) return false;
    memory.events = memory.events.filter((event) => event.sessionId !== sessionId);
    memory.oralReadings = memory.oralReadings.filter((reading) => !(reading.sessionId === sessionId && reading.ownerUserId === ownerUserId));
    memory.sessions = memory.sessions.filter((item) => item.id !== sessionId);
    return true;
  }
  const session = await db.select().from(readingSessions).where(and(eq(readingSessions.id, sessionId), eq(readingSessions.ownerUserId, ownerUserId))).limit(1);
  if (!session[0]) return false;
  for (const step of buildSessionDeletionPlan(sessionId, ownerUserId)) {
    if (step.table === "trackingEvents") await db.delete(trackingEvents).where(eq(trackingEvents.sessionId, sessionId));
    if (step.table === "oralReadings") await db.delete(oralReadings).where(and(eq(oralReadings.sessionId, sessionId), eq(oralReadings.ownerUserId, ownerUserId)));
    if (step.table === "readingSessions") await db.delete(readingSessions).where(eq(readingSessions.id, sessionId));
  }
  return true;
}
async function deleteStudentData(studentId, ownerUserId) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const student2 = memory.students.find((item) => item.id === studentId && item.ownerUserId === ownerUserId);
    if (!student2) return false;
    const sessionIds = memory.sessions.filter((item) => item.studentId === studentId && item.ownerUserId === ownerUserId).map((item) => item.id);
    const passageIds = memory.passages.filter((item) => item.studentId === studentId && item.ownerUserId === ownerUserId).map((item) => item.id);
    memory.events = memory.events.filter((event) => !sessionIds.includes(event.sessionId));
    memory.oralReadings = memory.oralReadings.filter((reading) => !(sessionIds.includes(reading.sessionId) && reading.ownerUserId === ownerUserId));
    memory.sessions = memory.sessions.filter((item) => !sessionIds.includes(item.id));
    memory.analyses = memory.analyses.filter((analysis) => !(passageIds.includes(analysis.passageId) && analysis.ownerUserId === ownerUserId));
    memory.passages = memory.passages.filter((item) => !passageIds.includes(item.id));
    memory.students = memory.students.filter((item) => item.id !== studentId);
    return true;
  }
  const student = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.ownerUserId, ownerUserId))).limit(1);
  if (!student[0]) return false;
  const sessions = await db.select({ id: readingSessions.id }).from(readingSessions).where(and(eq(readingSessions.studentId, studentId), eq(readingSessions.ownerUserId, ownerUserId)));
  const studentPassages = await db.select({ id: passages.id }).from(passages).where(and(eq(passages.studentId, studentId), eq(passages.ownerUserId, ownerUserId)));
  await executeStudentDeletionPlan(buildStudentDeletionPlan(studentId), {
    sessionIds: sessions.map((session) => session.id),
    passageIds: studentPassages.map((passage) => passage.id),
    deleteTracking: async (sessionId) => {
      await db.delete(trackingEvents).where(eq(trackingEvents.sessionId, sessionId));
    },
    deleteOralReadings: async (sessionId) => {
      await db.delete(oralReadings).where(and(eq(oralReadings.sessionId, sessionId), eq(oralReadings.ownerUserId, ownerUserId)));
    },
    deleteSessions: async () => {
      for (const session of sessions) await db.delete(readingSessions).where(eq(readingSessions.id, session.id));
    },
    deleteAnalyses: async (passageId) => {
      await db.delete(brailleAnalyses).where(and(eq(brailleAnalyses.passageId, passageId), eq(brailleAnalyses.ownerUserId, ownerUserId)));
    },
    deletePassages: async () => {
      await db.delete(passages).where(and(eq(passages.studentId, studentId), eq(passages.ownerUserId, ownerUserId)));
    },
    deleteStudent: async () => {
      await db.delete(students).where(eq(students.id, studentId));
    }
  });
  return true;
}
async function setStudentRetention(studentId, ownerUserId, retentionDays) {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + retentionDays * 864e5);
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const sessionIds = memory.sessions.filter((item) => item.studentId === studentId && item.ownerUserId === ownerUserId).map((item) => item.id);
    for (const student of memory.students) if (student.id === studentId && student.ownerUserId === ownerUserId) Object.assign(student, { retentionDays, expiresAt });
    for (const passage of memory.passages) if (passage.studentId === studentId && passage.ownerUserId === ownerUserId) Object.assign(passage, { retentionDays, expiresAt });
    for (const session of memory.sessions) if (sessionIds.includes(session.id)) Object.assign(session, { retentionDays, expiresAt });
    for (const reading of memory.oralReadings) if (sessionIds.includes(reading.sessionId) && reading.ownerUserId === ownerUserId) Object.assign(reading, { retentionDays, expiresAt });
    for (const event of memory.events) if (sessionIds.includes(event.sessionId)) Object.assign(event, { retentionDays, expiresAt });
    return expiresAt;
  }
  await db.update(students).set({ retentionDays, expiresAt }).where(and(eq(students.id, studentId), eq(students.ownerUserId, ownerUserId)));
  await db.update(passages).set({ retentionDays, expiresAt }).where(and(eq(passages.studentId, studentId), eq(passages.ownerUserId, ownerUserId)));
  await db.update(readingSessions).set({ retentionDays, expiresAt }).where(and(eq(readingSessions.studentId, studentId), eq(readingSessions.ownerUserId, ownerUserId)));
  await db.update(oralReadings).set({ retentionDays, expiresAt }).where(eq(oralReadings.ownerUserId, ownerUserId));
  return expiresAt;
}
async function purgeExpiredData(ownerUserId) {
  const db = await getDb();
  if (!db) {
    if (!useMemoryStore()) throw new Error("Database is not configured");
    const now = /* @__PURE__ */ new Date();
    const expiredSessionIds = memory.sessions.filter((item) => item.ownerUserId === ownerUserId && item.expiresAt && item.expiresAt <= now).map((item) => item.id);
    for (const sessionId of expiredSessionIds) await deleteSessionData(sessionId, ownerUserId);
    const expiredStudentIds = memory.students.filter((item) => item.ownerUserId === ownerUserId && item.expiresAt && item.expiresAt <= now).map((item) => item.id);
    for (const studentId of expiredStudentIds) await deleteStudentData(studentId, ownerUserId);
    return { sessions: expiredSessionIds.length, students: expiredStudentIds.length };
  }
  const expiredSessions = await db.select({ id: readingSessions.id }).from(readingSessions).where(and(eq(readingSessions.ownerUserId, ownerUserId), lte(readingSessions.expiresAt, /* @__PURE__ */ new Date())));
  for (const session of expiredSessions) await deleteSessionData(session.id, ownerUserId);
  await db.delete(trackingEvents).where(lte(trackingEvents.expiresAt, /* @__PURE__ */ new Date()));
  const expiredStudents = await db.select({ id: students.id }).from(students).where(and(eq(students.ownerUserId, ownerUserId), lte(students.expiresAt, /* @__PURE__ */ new Date())));
  for (const student of expiredStudents) await deleteStudentData(student.id, ownerUserId);
  return { sessions: expiredSessions.length, students: expiredStudents.length };
}
async function getClassroomSummary(ownerUserId) {
  const db = await getDb();
  if (!db) {
    const completed = useMemoryStore() ? memory.sessions.filter((session) => session.ownerUserId === ownerUserId && session.status === "completed") : [];
    return { activeReaders: completed.length, averageSpeed: completed.length ? Math.round(completed.reduce((sum, session) => sum + Number(session.readingSpeedWpm ?? 0), 0) / completed.length) : 0, averageCoverage: completed.length ? Math.round(completed.reduce((sum, session) => sum + Number(session.trackingCoverage ?? 0), 0) / completed.length) : 0, minutesPracticed: Math.round(completed.reduce((sum, session) => sum + Number(session.elapsedMs ?? 0), 0) / 6e4) };
  }
  const rows = await db.select({
    count: sql`count(*)`,
    averageSpeed: sql`coalesce(avg(${readingSessions.readingSpeedWpm}), 0)`,
    averageCoverage: sql`coalesce(avg(${readingSessions.trackingCoverage}), 0)`,
    minutesPracticed: sql`coalesce(sum(${readingSessions.elapsedMs}) / 60000, 0)`
  }).from(readingSessions).where(and(eq(readingSessions.status, "completed"), eq(readingSessions.ownerUserId, ownerUserId)));
  const row = rows[0] ?? { count: 0, averageSpeed: 0, averageCoverage: 0, minutesPracticed: 0 };
  return { activeReaders: Number(row.count), averageSpeed: Math.round(Number(row.averageSpeed)), averageCoverage: Math.round(Number(row.averageCoverage)), minutesPracticed: Math.round(Number(row.minutesPracticed)) };
}

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname?.toLowerCase() ?? "";
  const localRequest = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  const secure = isSecureRequest(req) || !localRequest;
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None is rejected by browsers unless Secure is also set. Use
    // Lax only for plain-http localhost development.
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
function getOAuthConfigLogLevel(config) {
  if (config.oAuthServerUrl) return null;
  return config.isProduction || !config.devAuthEnabled ? "error" : "warn";
}
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      const message = "[OAuth] OAUTH_SERVER_URL is not configured; local development login is active. Set OAUTH_SERVER_URL to enable Manus OAuth.";
      if (getOAuthConfigLogLevel(ENV) === "error") console.error(message);
      else console.warn(message);
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        // A local checkout may not have VITE_APP_ID. The verifier requires a
        // non-empty appId, so use a development-only namespace for local tokens.
        appId: ENV.appId || (ENV.isProduction ? "" : "local-development"),
        name: options.name || "Local User"
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      const isLocalDevelopmentSession = !ENV.isProduction && openId === ENV.devAuthOpenId;
      const normalizedAppId = isNonEmptyString(appId) ? appId : isLocalDevelopmentSession ? "local-development" : null;
      const normalizedName = isNonEmptyString(name) ? name : isLocalDevelopmentSession ? "Local Teacher" : null;
      if (!isNonEmptyString(openId) || !normalizedAppId || !normalizedName) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId: normalizedAppId,
        name: normalizedName
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    if (!ENV.isProduction && ENV.devAuthEnabled && sessionUserId === ENV.devAuthOpenId) {
      const now = /* @__PURE__ */ new Date();
      return {
        id: 0,
        openId: ENV.devAuthOpenId,
        name: session.name || "Local Teacher",
        email: "teacher@localhost",
        loginMethod: "development",
        role: "admin",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now
      };
    }
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/dev-login", async (req, res) => {
    if (ENV.isProduction || !ENV.devAuthEnabled) {
      res.status(404).json({ error: "Development login is disabled." });
      return;
    }
    try {
      const openId = ENV.devAuthOpenId;
      await upsertUser({ openId, name: "Local Teacher", email: "teacher@localhost", loginMethod: "development", role: "admin", lastSignedIn: /* @__PURE__ */ new Date() });
      const sessionToken = await sdk.createSessionToken(openId, { name: "Local Teacher", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/") ? req.query.returnTo : "/";
      const separator = returnTo.includes("#") ? "&" : "#";
      res.redirect(302, `${returnTo}${separator}dev-session=${encodeURIComponent(sessionToken)}`);
    } catch (error) {
      console.error("[Dev Auth] Login failed", error);
      res.status(500).json({ error: "Development login failed. Check DATABASE_URL and JWT_SECRET." });
    }
  });
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  if (model) {
    payload.model = model;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/_core/voiceTranscription.ts
async function transcribeAudio(options) {
  try {
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set"
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set"
      };
    }
    let audioBuffer;
    let mimeType;
    try {
      const response2 = await fetch(options.audioUrl);
      if (!response2.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response2.status}: ${response2.statusText}`
        };
      }
      audioBuffer = Buffer.from(await response2.arrayBuffer());
      mimeType = response2.headers.get("content-type") || "audio/mpeg";
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
    const formData = new FormData();
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    const prompt = options.prompt || (options.language ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}` : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);
    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL(
      "v1/audio/transcriptions",
      baseUrl
    ).toString();
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity"
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
      };
    }
    const whisperResponse = await response.json();
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format"
      };
    }
    return whisperResponse;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
function getFileExtension(mimeType) {
  const mimeToExt = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a"
  };
  return mimeToExt[mimeType] || "audio";
}
function getLanguageName(langCode) {
  const langMap = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish"
  };
  return langMap[langCode] || langCode;
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/routers.ts
var analysisSchema = { type: "object", properties: { text: { type: "string" }, confidence: { type: "number" }, brailleStandard: { type: "string" }, warnings: { type: "array", items: { type: "string" } }, cellCount: { type: "integer" }, lineCount: { type: "integer" } }, required: ["text", "confidence", "brailleStandard", "warnings", "cellCount", "lineCount"], additionalProperties: false };
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => typeof part === "string" ? part : part.text ?? "").join("");
  return "";
}
function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function compareTexts(expected, transcript) {
  const expectedWords = normalizeText(expected).split(" ").filter(Boolean);
  const spokenWords = normalizeText(transcript).split(" ").filter(Boolean);
  const mismatches = [];
  const total = Math.max(expectedWords.length, spokenWords.length);
  for (let index = 0; index < total; index += 1) if (expectedWords[index] !== spokenWords[index]) mismatches.push(`word ${index + 1}: expected \u201C${expectedWords[index] ?? "<missing>"}\u201D, heard \u201C${spokenWords[index] ?? "<missing>"}\u201D`);
  return { matchScore: total ? Math.max(0, Math.round((total - mismatches.length) / total * 100)) : 0, mismatches };
}
async function requireOwnedSession(sessionId, ownerUserId) {
  const detail = await getSessionWithEvents(sessionId, ownerUserId);
  if (!detail?.session) throw new TRPCError3({ code: "NOT_FOUND", message: "Reading session not found." });
  return detail;
}
async function analyzeWithLocalAi(data, mimeType, baseUrl = ENV.localAiUrl) {
  if (!baseUrl) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Set LOCAL_AI_URL or the managed Forge AI variables before analyzing Braille images." });
  try {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(data)], { type: mimeType }), "braille-page");
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/scan`, { method: "POST", body: form });
    if (!response.ok) throw new TRPCError3({ code: "BAD_GATEWAY", message: `Local Braille AI returned HTTP ${response.status}. Start the service from legacy/local-ai before uploading.` });
    const payload = await response.json();
    return { text: payload.text ?? "", confidence: payload.confidence ?? 0, brailleStandard: payload.brailleStandard ?? "UEB_UNCONTRACTED", warnings: payload.warnings ?? [], cellCount: payload.cellCount ?? 0, lineCount: payload.lineCount ?? payload.lines?.length ?? 0 };
  } catch (error) {
    if (error instanceof TRPCError3) throw error;
    throw new TRPCError3({ code: "BAD_GATEWAY", message: "The local Braille AI service could not be reached. Start legacy/local-ai on port 8000 or remove LOCAL_AI_URL to use Forge AI." });
  }
}
async function analyzeWithForge(dataUrl) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Braille analysis is not configured. Start a local Braille AI service on port 8000 or configure the managed Forge AI variables." });
  const response = await invokeLLM({ model: "gemini-3-flash-preview", messages: [{ role: "system", content: "You are a cautious Braille image analysis service. Read only clearly visible Braille cells. Do not invent missing cells. This is an assistive prototype, not a clinical or educational assessment. Return the requested JSON only." }, { role: "user", content: [{ type: "text", text: "Analyze this uploaded Braille page. Identify visible uncontracted or contracted Braille only when the image supports it. Report uncertainty in warnings. Count visible cells and lines." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] }], response_format: { type: "json_schema", json_schema: { name: "braille_analysis", strict: true, schema: analysisSchema } } });
  const raw = extractText(response.choices[0]?.message?.content);
  return JSON.parse(raw);
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  classroom: router({
    summary: protectedProcedure.query(({ ctx }) => getClassroomSummary(ctx.user.id)),
    recentSessions: protectedProcedure.input(z2.object({ limit: z2.number().int().min(1).max(50).default(10) }).optional()).query(({ input, ctx }) => getRecentSessions(ctx.user.id, input?.limit ?? 10)),
    students: protectedProcedure.query(({ ctx }) => getStudents(ctx.user.id)),
    createStudent: protectedProcedure.input(z2.object({ displayName: z2.string().trim().min(1).max(160), gradeLevel: z2.string().trim().max(40).optional() })).mutation(({ input, ctx }) => createStudent({ ownerUserId: ctx.user.id, displayName: input.displayName, gradeLevel: input.gradeLevel ?? null }))
  }),
  privacy: router({
    setStudentRetention: protectedProcedure.input(z2.object({ studentId: z2.number().int().positive(), retentionDays: z2.number().int().min(1).max(3650) })).mutation(({ input, ctx }) => setStudentRetention(input.studentId, ctx.user.id, input.retentionDays)),
    deleteStudent: protectedProcedure.input(z2.object({ studentId: z2.number().int().positive() })).mutation(({ input, ctx }) => deleteStudentData(input.studentId, ctx.user.id)),
    deleteSession: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive() })).mutation(({ input, ctx }) => deleteSessionData(input.sessionId, ctx.user.id)),
    purgeExpired: protectedProcedure.mutation(({ ctx }) => purgeExpiredData(ctx.user.id))
  }),
  braille: router({
    analyzeImage: protectedProcedure.input(z2.object({ title: z2.string().trim().min(1).max(255), studentId: z2.number().int().positive().optional(), fileName: z2.string().trim().min(1).max(255), mimeType: z2.enum(["image/png", "image/jpeg", "image/webp"]), dataUrl: z2.string().startsWith("data:image/").max(2e7) })).mutation(async ({ input, ctx }) => {
      const base64 = input.dataUrl.split(",")[1];
      if (!base64) throw new Error("The uploaded image did not contain image data.");
      const buffer = Buffer.from(base64, "base64");
      const fileKey = `braille-passages/${ctx.user.id}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      let stored;
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          stored = await storagePut(fileKey, buffer, input.mimeType);
        } catch (error) {
          console.warn("[Braille Analysis] Optional image storage upload failed", error);
          if (ENV.isProduction) throw new TRPCError3({ code: "BAD_GATEWAY", message: "Braille image storage is unavailable. Check Forge storage configuration and try again." });
          stored = { key: `local://${fileKey}`, url: "" };
        }
      } else {
        stored = { key: `local://${fileKey}`, url: "" };
      }
      const passageId = await createPassage({ ownerUserId: ctx.user.id, studentId: input.studentId ?? null, title: input.title, sourceFileKey: stored.key, sourceMimeType: input.mimeType });
      let result;
      if (ENV.localAiUrl) {
        try {
          result = await analyzeWithLocalAi(buffer, input.mimeType);
        } catch (error) {
          if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw error;
          console.warn("[Braille Analysis] Local AI unavailable; falling back to Forge vision analysis");
          result = await analyzeWithForge(input.dataUrl);
        }
      } else {
        result = await analyzeWithForge(input.dataUrl);
      }
      const expectedWordCount = result.text.trim() ? result.text.trim().split(/\s+/).length : 0;
      await saveBrailleAnalysis({ passageId, ownerUserId: ctx.user.id, detectedText: result.text, confidence: result.confidence, brailleStandard: result.brailleStandard, warnings: JSON.stringify(result.warnings), cellCount: result.cellCount, lineCount: result.lineCount });
      await updatePassageText(passageId, result.text, expectedWordCount);
      return { passageId, imageUrl: stored.url, ...result, expectedWordCount };
    })
  }),
  reading: router({
    passage: protectedProcedure.input(z2.object({ passageId: z2.number().int().positive() })).query(({ input, ctx }) => getPassage(input.passageId, ctx.user.id)),
    create: protectedProcedure.input(z2.object({ passageId: z2.number().int().positive().optional(), studentId: z2.number().int().positive().optional() })).mutation(async ({ input, ctx }) => {
      const passage = input.passageId ? await getPassage(input.passageId, ctx.user.id) : null;
      if (input.passageId && !passage) throw new TRPCError3({ code: "NOT_FOUND", message: "Passage not found." });
      return createReadingSession({ ownerUserId: ctx.user.id, passageId: input.passageId ?? null, studentId: input.studentId ?? passage?.studentId ?? null, status: "ready" });
    }),
    calibrate: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive(), calibrationVersion: z2.string().max(40), calibrationHeight: z2.number().min(0).max(10), calibrationConfidence: z2.number().min(0).max(1), consentCamera: z2.boolean(), consentAudio: z2.boolean() })).mutation(async ({ input, ctx }) => {
      await requireOwnedSession(input.sessionId, ctx.user.id);
      await updateReadingSession(input.sessionId, { calibrationVersion: input.calibrationVersion, calibrationHeight: input.calibrationHeight, calibrationConfidence: input.calibrationConfidence, consentCamera: input.consentCamera ? 1 : 0, consentAudio: input.consentAudio ? 1 : 0 });
      return { success: true };
    }),
    start: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const detail = await requireOwnedSession(input.sessionId, ctx.user.id);
      if (!detail.session.consentCamera) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Complete camera consent and calibration first." });
      await updateReadingSession(input.sessionId, { status: "running", startedAt: /* @__PURE__ */ new Date() });
      return { success: true };
    }),
    appendEvents: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive(), events: z2.array(z2.object({ eventType: z2.enum(["finger_move", "pause", "reread", "skip", "line_change"]), timestampMs: z2.number().int().nonnegative(), lineIndex: z2.number().int().nonnegative().default(0), regionIndex: z2.number().int().nonnegative().default(0), x: z2.number().min(0).max(1).optional(), y: z2.number().min(0).max(1).optional(), confidence: z2.number().min(0).max(1).optional() })).max(500) })).mutation(async ({ input, ctx }) => {
      await requireOwnedSession(input.sessionId, ctx.user.id);
      return addTrackingEvents(input.events.map((event) => ({ ...event, sessionId: input.sessionId })));
    }),
    transcribe: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive(), fileName: z2.string().trim().min(1).max(255), mimeType: z2.enum(["audio/webm", "audio/mp4", "audio/wav", "audio/ogg", "audio/mpeg"]), dataUrl: z2.string().startsWith("data:audio/").max(22e6) })).mutation(async ({ input, ctx }) => {
      const detail = await requireOwnedSession(input.sessionId, ctx.user.id);
      if (!detail.session?.consentAudio) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Audio consent is required before transcription." });
      const passage = detail.session.passageId ? await getPassage(detail.session.passageId, ctx.user.id) : null;
      if (!passage?.detectedText) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Analyze a Braille passage before comparing oral reading." });
      const base64 = input.dataUrl.split(",")[1];
      if (!base64) throw new Error("The uploaded audio did not contain data.");
      const stored = await storagePut(`oral-reading/${ctx.user.id}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`, Buffer.from(base64, "base64"), input.mimeType);
      const signedUrl = await storageGetSignedUrl(stored.key);
      const transcription = await transcribeAudio({ audioUrl: signedUrl, language: "en", prompt: "Transcribe the student's oral reading of the provided passage." });
      if ("error" in transcription) throw new TRPCError3({ code: "BAD_GATEWAY", message: transcription.error });
      const comparison = compareTexts(passage.detectedText, transcription.text);
      await saveOralReading({ sessionId: input.sessionId, ownerUserId: ctx.user.id, audioFileKey: stored.key, audioMimeType: input.mimeType, transcript: transcription.text, expectedText: passage.detectedText, matchScore: comparison.matchScore, mismatches: JSON.stringify(comparison.mismatches), language: transcription.language ?? "en" });
      return { transcript: transcription.text, expectedText: passage.detectedText, ...comparison };
    }),
    complete: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive(), elapsedMs: z2.number().int().nonnegative(), readingSpeedWpm: z2.number().nonnegative(), rereads: z2.number().int().nonnegative(), skippedRegions: z2.number().int().nonnegative(), pauseCount: z2.number().int().nonnegative(), trackingCoverage: z2.number().min(0).max(100) })).mutation(async ({ input, ctx }) => {
      await requireOwnedSession(input.sessionId, ctx.user.id);
      await updateReadingSession(input.sessionId, { ...input, status: "completed", completedAt: /* @__PURE__ */ new Date() });
      return getSessionWithEvents(input.sessionId, ctx.user.id);
    }),
    detail: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive() })).query(({ input, ctx }) => getSessionWithEvents(input.sessionId, ctx.user.id)),
    oralReading: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive() })).query(({ input, ctx }) => getOralReading(input.sessionId, ctx.user.id))
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/_core/vercelHandler.ts
var vercelHandler_default = createApp();
export {
  vercelHandler_default as default
};
