import { describe, expect, it, vi } from "vitest";
import { analyzeWithLocalAi } from "./routers";

describe("local Braille AI bridge", () => {
  it("returns analyzed text and metrics from the /scan contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ text: "A tactile page", confidence: 0.91, brailleStandard: "UEB_UNCONTRACTED", warnings: [], cellCount: 14, lineCount: 2 }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(analyzeWithLocalAi(Buffer.from("image"), "image/png", "http://local-ai.test")).resolves.toMatchObject({ text: "A tactile page", confidence: 0.91, cellCount: 14, lineCount: 2 });
    expect(fetchMock).toHaveBeenCalledWith("http://local-ai.test/scan", expect.objectContaining({ method: "POST" }));
    fetchMock.mockRestore();
  });

  it("surfaces a clear upstream error when the local service is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("offline", { status: 503 }));
    await expect(analyzeWithLocalAi(Buffer.from("image"), "image/png", "http://local-ai.test")).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    vi.restoreAllMocks();
  });
});
