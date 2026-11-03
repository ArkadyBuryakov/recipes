import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recipeInputSchema } from "@shared/recipe";
import { eq, sql } from "drizzle-orm";
import { auth } from "./auth";
import type { Db } from "./db/client";
import { seeds, user } from "./db/schema";
import { env } from "./env";
import type { RecipeService } from "./recipes/service";

// The process runs from the project root (dev, tests and the container's /app).
const SEED_DIR = join(process.cwd(), "seed/recipes");

/**
 * Initial data migration (ADR 0014): each seed file is applied exactly once, tracked in `seeds`,
 * so recipes edited or deleted later are never re-created or overwritten.
 */
export async function applySeeds(db: Db, recipes: RecipeService, dir = SEED_DIR): Promise<number> {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return 0;
  }
  const done = new Set((await db.select({ name: seeds.name }).from(seeds)).map((s) => s.name));
  let applied = 0;
  for (const file of files) {
    const name = `recipes/${file}`;
    if (done.has(name)) continue;
    const input = recipeInputSchema.parse(JSON.parse(readFileSync(`${dir}/${file}`, "utf8")));
    const exists = await recipes.get(input.slug, { includeDrafts: true }).then(
      () => true,
      () => false,
    );
    if (!exists)
      await recipes.create(
        { slug: input.slug, status: input.status ?? "published", recipe: input.recipe },
        { userId: null, kind: "system", channel: "migration", ref: name },
      );
    await db.insert(seeds).values({ name }).onConflictDoNothing();
    applied++;
  }
  return applied;
}

/** First admin from ADMIN_EMAIL/ADMIN_PASSWORD when there are no users yet (ADR 0006). */
export async function bootstrapAdmin(db: Db): Promise<boolean> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return false;
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(user);
  if (n > 0) return false;
  await createUserWithPassword(db, {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    name: env.ADMIN_NAME,
    role: "admin",
  });
  return true;
}

export async function createUserWithPassword(
  db: Db,
  input: { email: string; password: string; name: string; role: "admin" | "editor" },
) {
  const ctx = await auth.$context;
  const email = input.email.trim().toLowerCase();
  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing) throw new Error(`User ${email} already exists`);
  const created = await ctx.internalAdapter.createUser(
    { email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(input.password),
  });
  await db.update(user).set({ role: input.role }).where(eq(user.id, created.id));
  return created;
}
