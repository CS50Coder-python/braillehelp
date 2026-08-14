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

import { appRouter } from "./routers";
import { ENV } from "./_core/env";

describe("Braille analysis failure handling", () => {
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
    const previousLocalAiUrl = ENV.localAiUrl;
    const previousForgeUrl = ENV.forgeApiUrl;
    const previousForgeKey = ENV.forgeApiKey;
    ENV.localAiUrl = "";
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "test-key";
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
    ENV.localAiUrl = previousLocalAiUrl;
    ENV.forgeApiUrl = previousForgeUrl;
    ENV.forgeApiKey = previousForgeKey;
  });
});
