import { describe, expect, it } from "vitest";
import { getLoginDestination } from "./const";

describe("login destination", () => {
  it("uses the local development login when OAuth configuration is absent", () => {
    expect(getLoginDestination({}, { origin: "http://localhost:3012", pathname: "/reading", search: "?demo=1" })).toBe("/api/dev-login?returnTo=%2Freading%3Fdemo%3D1");
  });

  it("builds the OAuth portal destination when configured", () => {
    const destination = new URL(getLoginDestination({ oauthPortalUrl: "https://manus.im", appId: "app-123" }, { origin: "https://braillehelp.example", pathname: "/", search: "" }));
    expect(destination.pathname).toBe("/app-auth");
    expect(destination.searchParams.get("appId")).toBe("app-123");
    expect(destination.searchParams.get("redirectUri")).toBe("https://braillehelp.example/api/oauth/callback");
  });
});
