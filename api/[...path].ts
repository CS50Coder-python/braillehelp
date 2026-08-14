import { createApp } from "../server/_core/app";

// Vercel invokes this Express app for every /api/* route, including OAuth and
// tRPC. The local server continues to use the same application factory.
const app = createApp();

export default app;
