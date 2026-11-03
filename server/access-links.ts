import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "./auth";
import { createUserWithPassword } from "./bootstrap";
import type { Db } from "./db/client";
import { accessLinks, session, user } from "./db/schema";
import { env } from "./env";
import { DomainError, formatIssues } from "./errors";

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
const RESET_TTL_MS = 24 * 3600 * 1000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export const acceptInviteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
});

/** One-time invite and password-reset links, copied and sent out-of-band by the admin (ADR 0006). */
export class AccessLinks {
  constructor(private readonly db: Db) {}

  async createInvite(role: "admin" | "editor", createdBy: string, note?: string) {
    const token = newToken();
    const [row] = await this.db
      .insert(accessLinks)
      .values({
        kind: "invite",
        tokenHash: hash(token),
        role,
        note: note ?? null,
        createdBy,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning();
    return { id: row?.id, url: `${env.PUBLIC_URL}/invite/${token}` };
  }

  async createReset(userId: string, createdBy: string | null) {
    const token = newToken();
    await this.db.insert(accessLinks).values({
      kind: "reset",
      tokenHash: hash(token),
      userId,
      createdBy,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    return { url: `${env.PUBLIC_URL}/reset/${token}` };
  }

  async pendingInvites() {
    return this.db
      .select({
        id: accessLinks.id,
        role: accessLinks.role,
        note: accessLinks.note,
        expiresAt: accessLinks.expiresAt,
        createdAt: accessLinks.createdAt,
      })
      .from(accessLinks)
      .where(
        and(
          eq(accessLinks.kind, "invite"),
          isNull(accessLinks.usedAt),
          gt(accessLinks.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(accessLinks.createdAt));
  }

  async revoke(id: string) {
    await this.db.delete(accessLinks).where(and(eq(accessLinks.id, id), isNull(accessLinks.usedAt)));
  }

  /** A still-valid link for the token, or null. */
  async find(token: string, kind: "invite" | "reset") {
    const [row] = await this.db
      .select()
      .from(accessLinks)
      .where(
        and(
          eq(accessLinks.tokenHash, hash(token)),
          eq(accessLinks.kind, kind),
          isNull(accessLinks.usedAt),
          gt(accessLinks.expiresAt, new Date()),
        ),
      );
    return row ?? null;
  }

  async acceptInvite(token: string, input: unknown) {
    const parsed = acceptInviteSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("validation", "Invalid form", formatIssues(parsed.error));
    const link = await this.find(token, "invite");
    if (!link) throw new DomainError("not_found", "This invite link is invalid or expired");
    // Claim first so a link can't be used twice concurrently.
    const [claimed] = await this.db
      .update(accessLinks)
      .set({ usedAt: new Date() })
      .where(and(eq(accessLinks.id, link.id), isNull(accessLinks.usedAt)))
      .returning();
    if (!claimed) throw new DomainError("conflict", "This invite link was already used");
    try {
      const created = await createUserWithPassword(this.db, { ...parsed.data, role: link.role ?? "editor" });
      await this.db.update(accessLinks).set({ usedBy: created.id }).where(eq(accessLinks.id, link.id));
      return created;
    } catch (e) {
      await this.db.update(accessLinks).set({ usedAt: null }).where(eq(accessLinks.id, link.id));
      if (e instanceof Error && /already exists/.test(e.message))
        throw new DomainError("conflict", e.message);
      throw e;
    }
  }

  async resetPassword(token: string, password: string) {
    if (password.length < 8) throw new DomainError("validation", "Password must be at least 8 characters");
    const link = await this.find(token, "reset");
    if (!link?.userId) throw new DomainError("not_found", "This reset link is invalid or expired");
    const ctx = await auth.$context;
    await ctx.internalAdapter.updatePassword(link.userId, await ctx.password.hash(password));
    await this.db
      .update(accessLinks)
      .set({ usedAt: new Date(), usedBy: link.userId })
      .where(eq(accessLinks.id, link.id));
    // Sign the account out everywhere.
    await this.db.delete(session).where(eq(session.userId, link.userId));
    const [u] = await this.db.select({ email: user.email }).from(user).where(eq(user.id, link.userId));
    return { email: u?.email ?? "" };
  }
}
