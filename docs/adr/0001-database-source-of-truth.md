# 0001. Postgres is the source of truth

**Status:** Accepted

## Context

Recipes have to be created, edited, and deleted both in a web UI and through an authenticated MCP. The Obsidian vault is only reachable on the laptop, and Coolify can't see it (it's gitignored).

## Decision

- PostgreSQL (Coolify-managed, set up manually) is the single source of truth. The Obsidian vault is retired as a source for recipes.
- **Every delete is a soft delete** (`deleted_at`, `deleted_by`). Soft-deleted recipes are hidden from public reads and MCP reads, and editors can restore them.
- **Audit history:** every create, update, delete, and restore writes an immutable revision row holding a full JSON snapshot of the recipe, plus actor (user id or MCP token id), channel (`web` | `mcp` | `migration`), and timestamp. Full snapshots, not diffs: recipes are small, and snapshots make restore and diff views trivial.
- Images live in an S3-compatible bucket (same setup as apply-crm). The DB stores object keys only.

## Consequences

- Git no longer backs up content. DB backups to a bucket are mandatory (see 0012).
- There's no "hard delete" path in the app. A purge, if ever needed, is a manual DB operation.
