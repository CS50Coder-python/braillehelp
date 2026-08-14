import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";

describe("local development authentication", () => {
  it("authenticates a cookie through the real context for reading.create", async () => {
    const token = await sdk.createSessionToken("dev_local_admin", { name: "Local Teacher", expiresInMs: 60_000 });
    const context = await createContext({
      req: { headers: { cookie: `app_session_id=${token}` } } as any,
      res: {} as any,
    });

    expect(context.user?.openId).toBe("dev_local_admin");
    const sessionId = await appRouter.createCaller(context).reading.create({});
    expect(sessionId).toEqual(expect.any(Number));
    expect(sessionId).toBeGreaterThan(0);
  });
});
