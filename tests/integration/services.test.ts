import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { AccessLinks } from "../../server/access-links";
import { applySeeds, createUserWithPassword } from "../../server/bootstrap";
import { pushTimers, session, user } from "../../server/db/schema";
import { DomainError } from "../../server/errors";
import { PushService } from "../../server/push";
import { EDITOR, RecipeService } from "../../server/recipes/service";
import { chashu } from "../fixtures/chashu";
import { db, resetDb, system } from "./db";

beforeEach(resetDb);

const sub = (n = 1) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: "p", auth: "a" } });

describe("push timers", () => {
  const push = new PushService(db);

  test("schedules, reschedules and cancels", async () => {
    const id = crypto.randomUUID();
    await push.schedule({ id, subscription: sub(), endsAt: Date.now() + 60_000, title: "Eggs" });
    await push.schedule({ id, subscription: sub(), endsAt: Date.now() + 120_000, title: "Eggs" });
    expect(await db.select().from(pushTimers)).toHaveLength(1);
    await push.cancel(id);
    expect(await db.select().from(pushTimers)).toHaveLength(0);
  });

  test("rejects invalid input and out-of-range times", async () => {
    await expect(push.schedule({ id: "x" })).rejects.toBeInstanceOf(DomainError);
    await expect(
      push.schedule({
        id: crypto.randomUUID(),
        subscription: sub(),
        endsAt: Date.now() + 30 * 86400_000,
        title: "x",
      }),
    ).rejects.toThrow("out of range");
    await expect(
      push.schedule({
        id: crypto.randomUUID(),
        subscription: { ...sub(), endpoint: "http://insecure" },
        endsAt: Date.now(),
        title: "x",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("sends due timers once and prunes dead subscriptions", async () => {
    await push.schedule({
      id: crypto.randomUUID(),
      subscription: sub(1),
      endsAt: Date.now() - 1000,
      title: "Rice",
    });
    await push.schedule({
      id: crypto.randomUUID(),
      subscription: sub(2),
      endsAt: Date.now() - 1000,
      title: "Gone",
    });
    await push.schedule({
      id: crypto.randomUUID(),
      subscription: sub(2),
      endsAt: Date.now() + 60_000,
      title: "Later",
    });
    await push.schedule({
      id: crypto.randomUUID(),
      subscription: sub(3),
      endsAt: Date.now() + 60_000,
      title: "Other",
    });
    const sent: string[] = [];
    const n = await push.sendDue(async (s, payload) => {
      if (s.endpoint?.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      sent.push(JSON.parse(payload).title);
    });
    expect(n).toBe(2);
    expect(sent).toEqual(["Rice"]);
    expect(await push.sendDue(async () => {})).toBe(0);
    const left = await db.select({ title: pushTimers.title }).from(pushTimers);
    expect(left.map((l) => l.title)).toEqual(["Other"]);
  });
});

describe("invites and password resets", () => {
  const links = new AccessLinks(db);

  test("an invite creates an editor exactly once", async () => {
    const admin = await createUserWithPassword(db, {
      email: "a@x.test",
      password: "password1",
      name: "A",
      role: "admin",
    });
    const { url } = await links.createInvite("editor", admin.id, "sister");
    const token = url.split("/invite/")[1] ?? "";
    expect(await links.pendingInvites()).toHaveLength(1);
    const created = await links.acceptInvite(token, { name: "S", email: "S@X.test", password: "password2" });
    const [row] = await db.select().from(user).where(eq(user.id, created.id));
    expect(row?.role).toBe("editor");
    expect(row?.email).toBe("s@x.test");
    await expect(
      links.acceptInvite(token, { name: "S", email: "t@x.test", password: "password2" }),
    ).rejects.toThrow("invalid or expired");
    expect(await links.pendingInvites()).toHaveLength(0);
  });

  test("a failed signup frees the invite again", async () => {
    const admin = await createUserWithPassword(db, {
      email: "a@x.test",
      password: "password1",
      name: "A",
      role: "admin",
    });
    const token = (await links.createInvite("editor", admin.id)).url.split("/invite/")[1] ?? "";
    await expect(
      links.acceptInvite(token, { name: "A", email: "a@x.test", password: "password2" }),
    ).rejects.toThrow("already exists");
    expect(await links.find(token, "invite")).not.toBeNull();
  });

  test("reset changes the password and signs out everywhere", async () => {
    const u = await createUserWithPassword(db, {
      email: "u@x.test",
      password: "password1",
      name: "U",
      role: "editor",
    });
    await db
      .insert(session)
      .values({ token: "t", userId: u.id, expiresAt: new Date(Date.now() + 1e6), updatedAt: new Date() });
    const token = (await links.createReset(u.id, null)).url.split("/reset/")[1] ?? "";
    await expect(links.resetPassword(token, "short")).rejects.toBeInstanceOf(DomainError);
    expect(await links.resetPassword(token, "new-password")).toEqual({ email: "u@x.test" });
    expect(await db.select().from(session).where(eq(session.userId, u.id))).toHaveLength(0);
    await expect(links.resetPassword(token, "again-password")).rejects.toThrow("invalid or expired");
  });
});

describe("seeds", () => {
  test("apply once and never resurrect deleted recipes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-"));
    writeFileSync(
      join(dir, "chashu.json"),
      JSON.stringify({ slug: "chashu", status: "published", recipe: chashu }),
    );
    const recipes = new RecipeService(db);
    expect(await applySeeds(db, recipes, dir)).toBe(1);
    expect(await applySeeds(db, recipes, dir)).toBe(0);
    await recipes.remove("chashu", system);
    expect(await applySeeds(db, recipes, dir)).toBe(0);
    expect((await recipes.list(EDITOR)).total).toBe(0);
    const history = await recipes.revisions("chashu");
    expect(history.at(-1)?.channel).toBe("migration");
  });

  test("every committed seed recipe loads", async () => {
    const recipes = new RecipeService(db);
    expect(await applySeeds(db, recipes)).toBeGreaterThanOrEqual(31);
  });
});
