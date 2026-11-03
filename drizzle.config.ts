import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://recipes:recipes@localhost:5432/recipes" },
});
