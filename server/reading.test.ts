import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reading contracts", () => {
  it("rejects negative elapsed time before touching persistence", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.reading.complete({
      sessionId: 1,
      elapsedMs: -1,
      readingSpeedWpm: 20,
      rereads: 0,
      skippedRegions: 0,
      pauseCount: 0,
      trackingCoverage: 80,
    })).rejects.toThrow();
  });

  it("rejects unsupported Braille image MIME types", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.braille.analyzeImage({
      title: "Test page",
      fileName: "page.gif",
      mimeType: "image/gif" as "image/png",
      dataUrl: "data:image/gif;base64,ZmFrZQ==",
    })).rejects.toThrow();
  });
});
