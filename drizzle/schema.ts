import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId"),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  gradeLevel: varchar("gradeLevel", { length: 40 }),
  retentionDays: int("retentionDays").default(365).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const passages = mysqlTable("passages", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const brailleAnalyses = mysqlTable("brailleAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  passageId: int("passageId").notNull(),
  ownerUserId: int("ownerUserId"),
  detectedText: text("detectedText").notNull(),
  confidence: float("confidence").notNull(),
  brailleStandard: varchar("brailleStandard", { length: 120 }).notNull(),
  warnings: text("warnings"),
  cellCount: int("cellCount").notNull(),
  lineCount: int("lineCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oralReadings = mysqlTable("oralReadings", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const readingSessions = mysqlTable("readingSessions", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trackingEvents = mysqlTable("trackingEvents", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type Passage = typeof passages.$inferSelect;
export type ReadingSession = typeof readingSessions.$inferSelect;
export type OralReading = typeof oralReadings.$inferSelect;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
