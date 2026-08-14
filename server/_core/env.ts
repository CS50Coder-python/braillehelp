export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  // Keep a fresh local checkout usable; production still requires JWT_SECRET.
  cookieSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "braille-read-local-development-secret"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  localAiUrl: process.env.LOCAL_AI_URL ?? "",
  devAuthEnabled: process.env.DEV_AUTH_ENABLED !== "false", 
  devAuthOpenId: process.env.DEV_AUTH_OPEN_ID ?? "dev_local_admin",
};
