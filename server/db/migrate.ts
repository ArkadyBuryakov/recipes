import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

// The process runs from the project root (dev, tests and the container's /app).
const migrationsFolder = join(process.cwd(), "server/db/migrations");

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
}
