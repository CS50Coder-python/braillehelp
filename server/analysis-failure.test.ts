import { describe, expect, it, vi } from "vitest";

const { storagePutMock, invokeLLMMock } = vi.hoisted(() => ({
  storagePutMock: vi.fn(),
  invokeLLMMock: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: storagePutMock,
  storageGetSignedUrl: vi.fn(),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: invokeLLMMock }));

import { appRouter, parseBrailleAnalysis } from "./routers";
import { ENV } from "./_core/env";

describe("Braille analysis response parsing", () => {
  it("recovers JSON wrapped in markdown fences or explanatory text", () => {
    const result = parseBrailleAnalysis('The model found this page:\n```json\n{"text":"hello world","confidence":0.91,"warnings":[],"cellCount":8,"lineCount":1}\n```');
    expect(result.text).toBe("hello world");
    expect(result.confidence).toBe(0.91);
    expect(result.cellCount).toBe(8);
  });

  it("converts truncated JSON into an actionable gateway error", () => {
    expect(() => parseBrailleAnalysis('{"text":"The student read a long sentence that was cut off')).toThrow("returned incomplete JSON");
  });
});

describe("Braille analysis failure handling", () => {
  it("accepts fenced and explanatory JSON from the local AI service", async () => {
    const previousLocalAiUrl = ENV.localAiUrl;
    const previousForgeUrl = ENV.forgeApiUrl;
    const previousForgeKey = ENV.forgeApiKey;
    ENV.localAiUrl = "http://127.0.0.1:8000";
    ENV.forgeApiUrl = "";
    ENV.forgeApiKey = "";
    storagePutMock.mockResolvedValueOnce({ key: "local://fenced.png", url: "" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => 'Result:\n```json\n{"text":"local works","confidence":0.84,"warnings":[],"cellCount":5,"lineCount":1}\n```' }));
    const result = await appRouter.createCaller({ user: { id: 0, role: "admin" } as any, req: {} as any, res: {} as any }).braille.analyzeImage({ title: "Local fenced test", fileName: "page.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" });
    expect(result.text).toBe("local works");
    ENV.localAiUrl = previousLocalAiUrl;
    ENV.forgeApiUrl = previousForgeUrl;
    ENV.forgeApiKey = previousForgeKey;
    vi.unstubAllGlobals();
  });

  it("returns an actionable error when the configured local AI service is unreachable", async () => {
    const previousLocalAiUrl = ENV.localAiUrl;
    const previousForgeUrl = ENV.forgeApiUrl;
    const previousForgeKey = ENV.forgeApiKey;
    ENV.localAiUrl = "http://127.0.0.1:9";
    ENV.forgeApiUrl = "";
    ENV.forgeApiKey = "";
    storagePutMock.mockResolvedValueOnce({ key: "local://page.png", url: "" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(appRouter.createCaller({ user: { id: 0, role: "admin" } as any, req: {} as any, res: {} as any }).braille.analyzeImage({ title: "AI failure test", fileName: "page.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" })).rejects.toThrow("The local Braille AI service could not be reached");
    ENV.localAiUrl = previousLocalAiUrl;
    ENV.forgeApiUrl = previousForgeUrl;
    ENV.forgeApiKey = previousForgeKey;
    vi.unstubAllGlobals();
  });

  it("falls back to Forge vision when local AI is unreachable", async () => {
    const previousLocalAiUrl = ENV.localAiUrl;
    const previousForgeUrl = ENV.forgeApiUrl;
    const previousForgeKey = ENV.forgeApiKey;
    ENV.localAiUrl = "http://127.0.0.1:9";
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "test-key";
    storagePutMock.mockResolvedValueOnce({ key: "local://fallback.png", url: "" });
    invokeLLMMock.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ text: "fallback works", confidence: 0.88, brailleStandard: "UEB_UNCONTRACTED", warnings: [], cellCount: 7, lineCount: 1 }) } }] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const result = await appRouter.createCaller({ user: { id: 0, role: "admin" } as any, req: {} as any, res: {} as any }).braille.analyzeImage({ title: "Fallback test", fileName: "fallback.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" });
    expect(result.text).toBe("fallback works");
    ENV.localAiUrl = previousLocalAiUrl;
    ENV.forgeApiUrl = previousForgeUrl;
    ENV.forgeApiKey = previousForgeKey;
    vi.unstubAllGlobals();
  });

  it("continues development analysis when optional image storage is unreachable", async () => {
    storagePutMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ text: "hello", confidence: 0.92, brailleStandard: "UEB_UNCONTRACTED", warnings: [], cellCount: 5, lineCount: 1 }) } }],
    });

    const result = await appRouter.createCaller({
      user: { id: 0, role: "admin", openId: "dev_local_admin", name: "Local Teacher" } as any,
      req: {} as any,
      res: {} as any,
    }).braille.analyzeImage({
      title: "Storage failure test",
      fileName: "page.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,aGVsbG8=",
    });

    expect(result.passageId).toBeGreaterThan(0);
    expect(result.text).toBe("hello");
    expect(result.expectedWordCount).toBe(1);
  });
});
