import { sql } from "drizzle-orm";
import { db } from "../../server/db/client";
import { runMigrations } from "../../server/db/migrate";
import type { Actor } from "../../server/recipes/service";

let migrated: Promise<void> | undefined;

/** Migrate once per process, then wipe data between tests. */
export async function resetDb() {
  migrated ??= runMigrations(db);
  await migrated;
  await db.execute(
    sql`truncate recipes, recipe_revisions, images, access_links, push_timers, seeds, "user", apikey restart identity cascade`,
  );
}

export const system: Actor = { userId: null, kind: "system", channel: "web" };

export { db };
