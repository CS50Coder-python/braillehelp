import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

function request(protocol: "http" | "https", hostname: string, headers: Record<string, string> = {}) {
  return { protocol, hostname, headers } as any;
}

describe("session cookie options", () => {
  it("uses a same-origin Lax cookie for plain localhost development", () => {
    expect(getSessionCookieOptions(request("http", "localhost"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("uses a Secure cross-site-compatible cookie for proxied preview domains", () => {
    expect(getSessionCookieOptions(request("http", "preview.example.test"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });
});
