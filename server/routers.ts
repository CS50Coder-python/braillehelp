import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storageGetSignedUrl, storagePut } from "./storage";
import { ENV } from "./_core/env";
import {
  addTrackingEvents, createPassage, createReadingSession, createStudent, deleteSessionData, deleteStudentData, getClassroomSummary, getOralReading, getPassage,
  getRecentSessions, getSessionWithEvents, getStudents, purgeExpiredData, saveBrailleAnalysis, saveOralReading, setStudentRetention, updatePassageText, updateReadingSession,
} from "./db";

const analysisSchema = { type: "object", properties: { text: { type: "string" }, confidence: { type: "number" }, brailleStandard: { type: "string" }, warnings: { type: "array", items: { type: "string" } }, cellCount: { type: "integer" }, lineCount: { type: "integer" } }, required: ["text", "confidence", "brailleStandard", "warnings", "cellCount", "lineCount"], additionalProperties: false } as const;
function extractText(content: unknown) { if (typeof content === "string") return content; if (Array.isArray(content)) return content.map((part) => typeof part === "string" ? part : (part as { text?: string }).text ?? "").join(""); return ""; }
function normalizeText(value: string) { return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
export function compareTexts(expected: string, transcript: string) { const expectedWords = normalizeText(expected).split(" ").filter(Boolean); const spokenWords = normalizeText(transcript).split(" ").filter(Boolean); const mismatches: string[] = []; const total = Math.max(expectedWords.length, spokenWords.length); for (let index = 0; index < total; index += 1) if (expectedWords[index] !== spokenWords[index]) mismatches.push(`word ${index + 1}: expected “${expectedWords[index] ?? "<missing>"}”, heard “${spokenWords[index] ?? "<missing>"}”`); return { matchScore: total ? Math.max(0, Math.round(((total - mismatches.length) / total) * 100)) : 0, mismatches }; }
async function requireOwnedSession(sessionId: number, ownerUserId: number) { const detail = await getSessionWithEvents(sessionId, ownerUserId); if (!detail?.session) throw new TRPCError({ code: "NOT_FOUND", message: "Reading session not found." }); return detail; }
async function analyzeWithLocalAi(data: Buffer, mimeType: string) {
  if (!ENV.localAiUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Set LOCAL_AI_URL or the managed Forge AI variables before analyzing Braille images." });
  try {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(data)], { type: mimeType }), "braille-page");
    const response = await fetch(`${ENV.localAiUrl.replace(/\/$/, "")}/scan`, { method: "POST", body: form });
    if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: `Local Braille AI returned HTTP ${response.status}. Start the service from legacy/local-ai before uploading.` });
    const payload = await response.json() as { text?: string; confidence?: number; brailleStandard?: string; warnings?: string[]; lines?: unknown[]; cellCount?: number; lineCount?: number };
    return { text: payload.text ?? "", confidence: payload.confidence ?? 0, brailleStandard: payload.brailleStandard ?? "UEB_UNCONTRACTED", warnings: payload.warnings ?? [], cellCount: payload.cellCount ?? 0, lineCount: payload.lineCount ?? payload.lines?.length ?? 0 };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_GATEWAY", message: "The local Braille AI service could not be reached. Start legacy/local-ai on port 8000 or remove LOCAL_AI_URL to use Forge AI." });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  classroom: router({
    summary: protectedProcedure.query(({ ctx }) => getClassroomSummary(ctx.user.id)),
    recentSessions: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional()).query(({ input, ctx }) => getRecentSessions(ctx.user.id, input?.limit ?? 10)),
    students: protectedProcedure.query(({ ctx }) => getStudents(ctx.user.id)),
    createStudent: protectedProcedure.input(z.object({ displayName: z.string().trim().min(1).max(160), gradeLevel: z.string().trim().max(40).optional() })).mutation(({ input, ctx }) => createStudent({ ownerUserId: ctx.user.id, displayName: input.displayName, gradeLevel: input.gradeLevel ?? null })),
  }),
  privacy: router({
    setStudentRetention: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), retentionDays: z.number().int().min(1).max(3650) })).mutation(({ input, ctx }) => setStudentRetention(input.studentId, ctx.user.id, input.retentionDays)),
    deleteStudent: protectedProcedure.input(z.object({ studentId: z.number().int().positive() })).mutation(({ input, ctx }) => deleteStudentData(input.studentId, ctx.user.id)),
    deleteSession: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(({ input, ctx }) => deleteSessionData(input.sessionId, ctx.user.id)),
    purgeExpired: protectedProcedure.mutation(({ ctx }) => purgeExpiredData(ctx.user.id)),
  }),
  braille: router({
    analyzeImage: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(255), studentId: z.number().int().positive().optional(), fileName: z.string().trim().min(1).max(255), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), dataUrl: z.string().startsWith("data:image/").max(20_000_000) })).mutation(async ({ input, ctx }) => {
      const base64 = input.dataUrl.split(",")[1]; if (!base64) throw new Error("The uploaded image did not contain image data.");
      const buffer = Buffer.from(base64, "base64"); const fileKey = `braille-passages/${ctx.user.id}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      let stored: { key: string; url: string };
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          stored = await storagePut(fileKey, buffer, input.mimeType);
        } catch (error) {
          console.warn("[Braille Analysis] Optional image storage upload failed", error);
          if (ENV.isProduction) throw new TRPCError({ code: "BAD_GATEWAY", message: "Braille image storage is unavailable. Check Forge storage configuration and try again." });
          stored = { key: `local://${fileKey}`, url: "" };
        }
      } else {
        stored = { key: `local://${fileKey}`, url: "" };
      }
      const passageId = await createPassage({ ownerUserId: ctx.user.id, studentId: input.studentId ?? null, title: input.title, sourceFileKey: stored.key, sourceMimeType: input.mimeType });
      const result = ENV.localAiUrl ? await analyzeWithLocalAi(buffer, input.mimeType) : await (async () => { if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Braille analysis is not configured. Set LOCAL_AI_URL for the local service or the managed Forge AI variables." }); const response = await invokeLLM({ model: "gemini-3-flash-preview", messages: [{ role: "system", content: "You are a cautious Braille image analysis service. Read only clearly visible Braille cells. Do not invent missing cells. This is an assistive prototype, not a clinical or educational assessment. Return the requested JSON only." }, { role: "user", content: [{ type: "text", text: "Analyze this uploaded Braille page. Identify visible uncontracted or contracted Braille only when the image supports it. Report uncertainty in warnings. Count visible cells and lines." }, { type: "image_url", image_url: { url: input.dataUrl, detail: "high" } }] }], response_format: { type: "json_schema", json_schema: { name: "braille_analysis", strict: true, schema: analysisSchema } } }); const raw = extractText(response.choices[0]?.message?.content); return JSON.parse(raw) as { text: string; confidence: number; brailleStandard: string; warnings: string[]; cellCount: number; lineCount: number }; })(); const expectedWordCount = result.text.trim() ? result.text.trim().split(/\s+/).length : 0;
      await saveBrailleAnalysis({ passageId, ownerUserId: ctx.user.id, detectedText: result.text, confidence: result.confidence, brailleStandard: result.brailleStandard, warnings: JSON.stringify(result.warnings), cellCount: result.cellCount, lineCount: result.lineCount }); await updatePassageText(passageId, result.text, expectedWordCount); return { passageId, imageUrl: stored.url, ...result, expectedWordCount };
    }),
  }),
  reading: router({
    passage: protectedProcedure.input(z.object({ passageId: z.number().int().positive() })).query(({ input, ctx }) => getPassage(input.passageId, ctx.user.id)),
    create: protectedProcedure.input(z.object({ passageId: z.number().int().positive().optional(), studentId: z.number().int().positive().optional() })).mutation(async ({ input, ctx }) => { const passage = input.passageId ? await getPassage(input.passageId, ctx.user.id) : null; if (input.passageId && !passage) throw new TRPCError({ code: "NOT_FOUND", message: "Passage not found." }); return createReadingSession({ ownerUserId: ctx.user.id, passageId: input.passageId ?? null, studentId: input.studentId ?? passage?.studentId ?? null, status: "ready" }); }),
    calibrate: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), calibrationVersion: z.string().max(40), calibrationHeight: z.number().min(0).max(10), calibrationConfidence: z.number().min(0).max(1), consentCamera: z.boolean(), consentAudio: z.boolean() })).mutation(async ({ input, ctx }) => { await requireOwnedSession(input.sessionId, ctx.user.id); await updateReadingSession(input.sessionId, { calibrationVersion: input.calibrationVersion, calibrationHeight: input.calibrationHeight, calibrationConfidence: input.calibrationConfidence, consentCamera: input.consentCamera ? 1 : 0, consentAudio: input.consentAudio ? 1 : 0 }); return { success: true } as const; }),
    start: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const detail = await requireOwnedSession(input.sessionId, ctx.user.id); if (!detail.session.consentCamera) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete camera consent and calibration first." }); await updateReadingSession(input.sessionId, { status: "running", startedAt: new Date() }); return { success: true } as const; }),
    appendEvents: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), events: z.array(z.object({ eventType: z.enum(["finger_move", "pause", "reread", "skip", "line_change"]), timestampMs: z.number().int().nonnegative(), lineIndex: z.number().int().nonnegative().default(0), regionIndex: z.number().int().nonnegative().default(0), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), confidence: z.number().min(0).max(1).optional() })).max(500) })).mutation(async ({ input, ctx }) => { await requireOwnedSession(input.sessionId, ctx.user.id); return addTrackingEvents(input.events.map((event) => ({ ...event, sessionId: input.sessionId }))); }),
    transcribe: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), fileName: z.string().trim().min(1).max(255), mimeType: z.enum(["audio/webm", "audio/mp4", "audio/wav", "audio/ogg", "audio/mpeg"]), dataUrl: z.string().startsWith("data:audio/").max(22_000_000) })).mutation(async ({ input, ctx }) => {
      const detail = await requireOwnedSession(input.sessionId, ctx.user.id); if (!detail.session?.consentAudio) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Audio consent is required before transcription." }); const passage = detail.session.passageId ? await getPassage(detail.session.passageId, ctx.user.id) : null; if (!passage?.detectedText) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Analyze a Braille passage before comparing oral reading." });
      const base64 = input.dataUrl.split(",")[1]; if (!base64) throw new Error("The uploaded audio did not contain data."); const stored = await storagePut(`oral-reading/${ctx.user.id}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`, Buffer.from(base64, "base64"), input.mimeType); const signedUrl = await storageGetSignedUrl(stored.key); const transcription = await transcribeAudio({ audioUrl: signedUrl, language: "en", prompt: "Transcribe the student's oral reading of the provided passage." }); if ("error" in transcription) throw new TRPCError({ code: "BAD_GATEWAY", message: transcription.error }); const comparison = compareTexts(passage.detectedText, transcription.text); await saveOralReading({ sessionId: input.sessionId, ownerUserId: ctx.user.id, audioFileKey: stored.key, audioMimeType: input.mimeType, transcript: transcription.text, expectedText: passage.detectedText, matchScore: comparison.matchScore, mismatches: JSON.stringify(comparison.mismatches), language: transcription.language ?? "en" }); return { transcript: transcription.text, expectedText: passage.detectedText, ...comparison };
    }),
    complete: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), elapsedMs: z.number().int().nonnegative(), readingSpeedWpm: z.number().nonnegative(), rereads: z.number().int().nonnegative(), skippedRegions: z.number().int().nonnegative(), pauseCount: z.number().int().nonnegative(), trackingCoverage: z.number().min(0).max(100) })).mutation(async ({ input, ctx }) => { await requireOwnedSession(input.sessionId, ctx.user.id); await updateReadingSession(input.sessionId, { ...input, status: "completed", completedAt: new Date() }); return getSessionWithEvents(input.sessionId, ctx.user.id); }),
    detail: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(({ input, ctx }) => getSessionWithEvents(input.sessionId, ctx.user.id)),
    oralReading: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(({ input, ctx }) => getOralReading(input.sessionId, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
