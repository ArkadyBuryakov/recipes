import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

// Resolved from the project root: works for both `server/` sources and the bundled `build/server/`.
const migrationsFolder = fileURLToPath(new URL("../../server/db/migrations", import.meta.url));

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
}
