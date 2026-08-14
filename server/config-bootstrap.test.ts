import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveLocalAiUrl, shouldRequireOAuth } from "./_core/env";
import { getOAuthConfigLogLevel } from "./_core/sdk";

describe("standalone runtime configuration", () => {
  it("selects the local AI fallback only when Forge is unavailable", () => {
    expect(resolveLocalAiUrl({ NODE_ENV: "development" })).toBe("http://127.0.0.1:8000");
    expect(resolveLocalAiUrl({ NODE_ENV: "development", BUILT_IN_FORGE_API_URL: "https://forge.example", BUILT_IN_FORGE_API_KEY: "key" })).toBe("");
    expect(resolveLocalAiUrl({ NODE_ENV: "production" })).toBe("");
  });

  it("allows development authentication without an OAuth server", () => {
    expect(shouldRequireOAuth({ NODE_ENV: "development", DEV_AUTH_ENABLED: "true" })).toBe(false);
    expect(shouldRequireOAuth({ NODE_ENV: "development", DEV_AUTH_ENABLED: "false" })).toBe(true);
    expect(shouldRequireOAuth({ NODE_ENV: "production", DEV_AUTH_ENABLED: "true" })).toBe(true);
  });

  it("classifies missing OAuth configuration as a warning only for local dev auth", () => {
    expect(getOAuthConfigLogLevel({ oAuthServerUrl: "", isProduction: false, devAuthEnabled: true })).toBe("warn");
    expect(getOAuthConfigLogLevel({ oAuthServerUrl: "", isProduction: false, devAuthEnabled: false })).toBe("error");
    expect(getOAuthConfigLogLevel({ oAuthServerUrl: "", isProduction: true, devAuthEnabled: true })).toBe("error");
    expect(getOAuthConfigLogLevel({ oAuthServerUrl: "https://oauth.example", isProduction: true, devAuthEnabled: false })).toBeNull();
  });

  it("loads dotenv before importing the server modules", () => {
    const root = process.cwd();
    const source = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
    const envSource = readFileSync(resolve(root, "server/_core/env.ts"), "utf8");
    const sdkSource = readFileSync(resolve(root, "server/_core/sdk.ts"), "utf8");
    expect(source.indexOf('import "dotenv/config";')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('import express from "express";')).toBeGreaterThan(source.indexOf('import "dotenv/config";'));
    expect(envSource).toContain('http://127.0.0.1:8000');
    expect(sdkSource).toContain('local development login is active');
  });
});
