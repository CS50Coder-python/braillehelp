import { describe, expect, it } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "@shared/const";

describe("session payload contract", () => {
  it("normalizes an older local token with missing appId and name", async () => {
    const legacyToken = await new SignJWT({ openId: "dev_local_admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(ENV.cookieSecret));
    await expect(sdk.verifySession(legacyToken)).resolves.toMatchObject({ openId: "dev_local_admin", appId: "local-development", name: "Local Teacher" });
  });

  it("authenticates a protected reading-session request with a legacy local token", async () => {
    const legacyToken = await new SignJWT({ openId: "dev_local_admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(ENV.cookieSecret));
    const context = await createContext({
      req: { headers: { cookie: `${COOKIE_NAME}=${legacyToken}` } } as any,
      res: {} as any,
      info: {} as any,
    });
    const session = await appRouter.createCaller(context).reading.create({});
    expect(typeof session).toBe("number");
    expect(session).toBeGreaterThan(0);
  });

  it("keeps local development tokens valid when VITE_APP_ID is absent", async () => {
    const token = await sdk.createSessionToken("dev_local_admin", { name: "" });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), { algorithms: ["HS256"] });
    expect(typeof payload.openId).toBe("string");
    expect(String(payload.openId)).toBe("dev_local_admin");
    expect(typeof payload.appId).toBe("string");
    expect(String(payload.appId).length).toBeGreaterThan(0);
    expect(typeof payload.name).toBe("string");
    expect(String(payload.name).length).toBeGreaterThan(0);
  });
});
