import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createPassage, saveBrailleAnalysis, updatePassageText } from "./db";
import type { TrpcContext } from "./_core/context";

function contextFor(userId: number): TrpcContext {
  return {
    user: { id: userId, openId: `integration-${userId}`, name: "Integration Teacher", email: null, loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("analyze to reading session persistence", () => {
  it("keeps analyzed passage text available to a created reading session", async () => {
    const ownerUserId = 7401;
    const passageId = await createPassage({ ownerUserId, title: "Integration page", sourceFileKey: "local://integration.png", sourceMimeType: "image/png" });
    const detectedText = "A tactile reading passage";
    await saveBrailleAnalysis({ passageId, ownerUserId, detectedText, confidence: 0.95, brailleStandard: "UEB_UNCONTRACTED", warnings: "[]", cellCount: 24, lineCount: 2 });
    await updatePassageText(passageId, detectedText, 4);

    const caller = appRouter.createCaller(contextFor(ownerUserId));
    const passage = await caller.reading.passage({ passageId });
    const sessionId = await caller.reading.create({ passageId });
    const session = await caller.reading.detail({ sessionId });

    expect(passage?.detectedText).toBe(detectedText);
    expect(passage?.expectedWordCount).toBe(4);
    expect(session.session.passageId).toBe(passageId);
    expect((await caller.reading.passage({ passageId }))?.detectedText).toBe(session.session.passageId === passageId ? detectedText : "");
  });
});
