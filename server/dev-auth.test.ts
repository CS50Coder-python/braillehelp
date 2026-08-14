import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

describe("development authentication", () => {
  it("uses a browser-accepted lax cookie for plain-http localhost", () => {
    const options = getSessionCookieOptions({ protocol: "http", headers: {}, hostname: "127.0.0.1" } as any);
    expect(options).toMatchObject({ secure: false, sameSite: "lax", httpOnly: true, path: "/" });
  });

  it("keeps none/secure cookies for HTTPS previews and production", () => {
    const options = getSessionCookieOptions({ protocol: "https", headers: {}, hostname: "preview.example" } as any);
    expect(options).toMatchObject({ secure: true, sameSite: "none", httpOnly: true, path: "/" });
  });
});
