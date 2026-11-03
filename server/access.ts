import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db/client";
import { user } from "./db/schema";
import type { Actor } from "./recipes/service";

export type Role = "admin" | "editor";
export type Editor = { id: string; name: string; email: string; role: Role };
export type Principal = { user: Editor; actor: Actor };

type UserRow = { id: string; name: string; email: string; role: string | null; banned: boolean | null };

function asEditor(u: UserRow | undefined | null): Editor | null {
  if (!u || u.banned) return null;
  const role = u.role === "admin" ? "admin" : u.role === "editor" ? "editor" : null;
  return role ? { id: u.id, name: u.name, email: u.email, role } : null;
}

async function loadUser(id: string): Promise<Editor | null> {
  const [u] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return asEditor(u);
}

/** Cookie session from the web UI. */
export async function sessionPrincipal(headers: Headers): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  const editor = asEditor(session?.user as UserRow | undefined);
  return editor ? { user: editor, actor: { userId: editor.id, kind: "user", channel: "web" } } : null;
}

/** Personal API token (ADR 0007), used by scripts and agents without OAuth. */
export async function apiKeyPrincipal(key: string): Promise<Principal | null> {
  const result = await auth.api.verifyApiKey({ body: { key } }).catch(() => null);
  if (!result?.valid || !result.key) return null;
  const editor = await loadUser(result.key.referenceId);
  return editor
    ? { user: editor, actor: { userId: editor.id, kind: "api_key", ref: result.key.id, channel: "mcp" } }
    : null;
}

/** OAuth access token claims verified by requireMcpAuth. */
export async function oauthPrincipal(claims: { sub?: string; azp?: unknown; client_id?: unknown }) {
  if (!claims.sub) return null;
  const editor = await loadUser(claims.sub);
  const client = String(claims.azp ?? claims.client_id ?? "");
  return editor
    ? {
        user: editor,
        actor: { userId: editor.id, kind: "oauth" as const, ref: client, channel: "mcp" as const },
      }
    : null;
}
