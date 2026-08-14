import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("development bearer authentication", () => {
  it("accepts a development session token forwarded in the Authorization header", async () => {
    const token = await sdk.createSessionToken("dev_local_admin", { name: "Local Teacher" });
    const user = await sdk.authenticateRequest({
      headers: { authorization: `Bearer ${token}` },
    } as any);

    expect(user).toMatchObject({
      id: 0,
      openId: "dev_local_admin",
      loginMethod: "development",
      role: "admin",
    });
  });
});
