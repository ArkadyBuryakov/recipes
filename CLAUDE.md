# Recipes

Bilingual (RU/EN) cookbook at https://recipes.buryakov.pro with prep/cook modes and an MCP server.
Decisions live in `docs/adr/` (read the relevant ADR before changing behaviour); requirements Q&A in `docs/questions/`.

## Stack

Bun + Hono server (`server/`), React Router v8 framework-mode SSR (`app/`), shared pure domain code (`shared/`:
Zod recipe schema, units, scaling, prep/shopping lists, markdown). Postgres via Drizzle, better-auth (+ api-key, mcp
plugins), MCP SDK v2 (`@modelcontextprotocol/server`). One process: `server.ts` → `server/app.ts`.

## Commands

- `wf run dev` — per-worktree docker compose stack with watch (`scripts/dev.sh env` prints ports/URLs). `wf run destroy` drops volumes.
- `bun run check` — format, lint, typecheck, unit tests (pre-commit hook, Stop hook).
- `bun run check:all` — plus integration tests (throwaway Postgres in Docker) and Playwright e2e against a production build.
- `bun run db:generate` — new migration after editing `server/db/schema.ts`. Never edit applied migrations.
- `bun scripts/validate-seed.ts` — validate `seed/recipes/*.json` (initial data, applied once per file).
- `bun run cli reset-link <email>` — admin password reset link.

## Rules

- **Before saying work is done, run `bun run check:all` and report its result.** The Stop hook runs `bun run check` automatically and blocks on failure; that does not replace the full suite.
- Never commit with failing checks; don't bypass the lefthook pre-commit hook.
- Recipe content rules (units, tokens, sections vs prep tasks, both languages) are in `AUTHORING_GUIDE` (`server/mcp.ts`) and the schema in `shared/recipe.ts`; keep them in sync with ADR 0002/0004.
- All deletes are soft; every recipe write goes through `RecipeService` so it gets a revision row.
- Route modules may import from `@server/*` only inside `loader`/`action` (or `*.server.ts`), so server code is tree-shaken from the client bundle.
- Biome's `--unsafe` fixes can change semantics; review them.
- Visual style is ADR 0015 ("Workshop"): use the tokens and component classes in `app/app.css`; the reference is `docs/design/styles.html#workshop/<page>/<device>` with the Quiet headers.
