import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRequestHandler, RouterContextProvider } from "react-router";
import { sessionPrincipal } from "./access";
import { auth } from "./auth";
import { applySeeds, bootstrapAdmin } from "./bootstrap";
import { appContext } from "./context";
import { db, sql } from "./db/client";
import { runMigrations } from "./db/migrate";
import { env } from "./env";
import { createMcpEndpoints } from "./mcp";
import { services } from "./services";

export const app = new Hono();

app.get("/healthz", async (c) => {
  await sql`select 1`;
  return c.json({ ok: true });
});

// MCP clients may run in browsers (inspectors, web agents).
const mcpCors = cors({
  origin: "*",
  allowHeaders: [
    "Authorization",
    "Content-Type",
    "Mcp-Protocol-Version",
    "Mcp-Session-Id",
    "Last-Event-ID",
    "DPoP",
  ],
  exposeHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
});
app.use("/mcp/*", mcpCors);
app.use("/mcp", mcpCors);
app.use("/.well-known/*", mcpCors);

const mcp = createMcpEndpoints(services);
app.all("/mcp", (c) => mcp.public(c.req.raw));
app.all("/mcp/editor", (c) => mcp.editor(c.req.raw));

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

app.all("*", async (c) => {
  const context = new RouterContextProvider();
  context.set(appContext, {
    services,
    principal: await sessionPrincipal(c.req.raw.headers),
    publicUrl: env.PUBLIC_URL,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
  });
  return handleRequest(c.req.raw, context);
});

/** Startup: schema migrations, initial data migration (seeds), first admin. */
export async function init() {
  await runMigrations(db);
  const seeded = await applySeeds(db, services.recipes);
  if (seeded) console.log(`seeded ${seeded} recipes`);
  if (await bootstrapAdmin(db)) console.log("created admin account from ADMIN_EMAIL");
}
