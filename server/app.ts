import { Hono } from "hono";
import { createRequestHandler, RouterContextProvider } from "react-router";
import { auth } from "./auth";
import { db, sql } from "./db/client";
import { runMigrations } from "./db/migrate";

export const app = new Hono();

app.get("/healthz", async (c) => {
  await sql`select 1`;
  return c.json({ ok: true });
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// OAuth/MCP discovery at the origin root. The provider matches RFC 8414/9728 path-inserted forms
// (/.well-known/oauth-protected-resource/mcp/editor, /.well-known/oauth-authorization-server/api/auth)
// on the raw path; plain root forms fall back to the copies under the auth base path.
app.get("/.well-known/*", async (c) => {
  const direct = await auth.handler(c.req.raw);
  if (direct.status !== 404) return direct;
  const url = new URL(c.req.url);
  url.pathname = `/api/auth${url.pathname}`;
  return auth.handler(new Request(url, c.req.raw));
});

const handleRequest = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

app.all("*", (c) => handleRequest(c.req.raw, new RouterContextProvider()));

/** One-time startup work: schema migrations, then seeds and bootstrap (added later). */
export async function init() {
  await runMigrations(db);
}
