import { asc, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { apikey, session, user } from "./db/schema";
import { DomainError } from "./errors";

export class UserService {
  constructor(private readonly db: Db) {}

  list() {
    return this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(asc(user.createdAt));
  }

  /** Revoking access signs the user out everywhere and disables their API tokens (ADR 0006). */
  async setBanned(id: string, banned: boolean, by: string) {
    if (id === by) throw new DomainError("validation", "You cannot revoke your own access");
    await this.db.update(user).set({ banned }).where(eq(user.id, id));
    if (banned) {
      await this.db.delete(session).where(eq(session.userId, id));
      await this.db.update(apikey).set({ enabled: false }).where(eq(apikey.referenceId, id));
    }
  }

  async setRole(id: string, role: "admin" | "editor", by: string) {
    if (id === by) throw new DomainError("validation", "You cannot change your own role");
    await this.db.update(user).set({ role }).where(eq(user.id, id));
  }
}
