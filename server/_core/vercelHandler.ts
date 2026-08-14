import { createApp } from "./app";

// This module is bundled into api/[...path].js during the production build so
// serverless execution does not rely on unresolved workspace-relative imports.
export default createApp();
