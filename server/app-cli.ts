// Development entry for `bun server.ts cli …` (production uses the bundled server/app.ts export).
import type { Hono } from "hono";
import { cli } from "./cli";
import { db } from "./db/client";
import { runMigrations } from "./db/migrate";

export const app = undefined as unknown as Hono;
export const init = () => runMigrations(db);
export { cli };
