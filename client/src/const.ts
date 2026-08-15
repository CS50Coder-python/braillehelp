import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const getLoginMode = () => {
  if (import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID) return "oauth" as const;
  return import.meta.env.PROD ? "unconfigured" as const : "development" as const;
};

export const getLoginDestination = (config: { oauthPortalUrl?: string; appId?: string }, location: Pick<Location, "origin" | "pathname" | "search">) => {
  if (!config.oauthPortalUrl || !config.appId) return `/api/dev-login?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
  const redirectUri = `${location.origin}/api/oauth/callback`;
  const url = new URL(`${config.oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", config.appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("type", "signIn");
  return url.toString();
};

export const startLogin = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (getLoginMode() === "unconfigured") {
    window.alert("Sign-in is not configured for this deployment yet. Please contact the site administrator.");
    return;
  }
  const destination = getLoginDestination({ oauthPortalUrl, appId }, window.location);
  if (destination.startsWith("/api/dev-login")) {
    window.location.href = destination;
    return;
  }
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(destination);
  url.searchParams.set("state", state);
  window.location.href = url.toString();
};
