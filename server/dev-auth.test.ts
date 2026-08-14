import { describe, expect, it, vi } from "vitest";
import { registerOAuthRoutes } from "./_core/oauth";

describe("development authentication", () => {
  it("creates a session cookie and redirects to the requested local path", async () => {
    const routes = new Map<string, (req: any, res: any) => Promise<void>>();
    registerOAuthRoutes({ get: (path: string, handler: any) => routes.set(path, handler) } as any);
    const cookie = vi.fn();
    const redirect = vi.fn();
    const handler = routes.get("/api/dev-login");
    expect(handler).toBeDefined();
    await handler!({ query: { returnTo: "/read" }, protocol: "http", headers: {} }, { cookie, redirect, status: vi.fn().mockReturnThis(), json: vi.fn() });
    expect(cookie).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(redirect).toHaveBeenCalledWith(302, "/read");
  });
});
