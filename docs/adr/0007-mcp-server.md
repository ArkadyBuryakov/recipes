# 0007. MCP server

**Status:** Accepted

## Context

Any MCP-capable agent should be able to read without auth, and read + write with auth. There's no server-side LLM: the agent does extraction, translation, and formatting.

## Decision

- **Transport:** Streamable HTTP, stateless.
- **Two endpoints:**
  - `https://recipes.buryakov.pro/mcp`: public, read-only, no auth. Only published recipes.
  - `https://recipes.buryakov.pro/mcp/editor`: authenticated, read (including drafts) + write
- **Setup instructions** per client (Claude Code, claude.ai/Desktop, ChatGPT, Codex, Cursor, Gemini CLI, VS Code): the public `/:lang/agents` page (linked from home) shows the read-only server; editors get the editor endpoint, OAuth and token variants on `/:lang/tokens`.
- **Editor auth:** both of these.
  - **OAuth 2.1** through better-auth's MCP/OIDC provider: protected-resource metadata, dynamic client registration, PKCE, and a consent screen. For claude.ai/Desktop connectors and Claude Code.
  - **Personal API tokens** (bearer), created and revoked in the UI, scoped to the user. For scripts and agents without OAuth support. Hashed at rest, and shown once.
- **Implementation:** `@better-auth/mcp` (OAuth 2.1 authorization server + RFC 9728 protected resource metadata,
  JWT access tokens bound to the `/mcp/editor` resource) with Dynamic Client Registration enabled. Client ID Metadata
  Documents (CIMD) are not enabled yet: on Bun the plugin needs an application-supplied SSRF-safe fetch transport.
  DCR works with Claude Code, Cursor and claude.ai connectors today; add `@better-auth/cimd` when a client requires it.
- **Every recipe returned by any tool includes `url`** (absolute site link in the requested language).
- Audit revisions from MCP record `channel: 'mcp'` and the token or OAuth client id.

### Tools

| Tool | Endpoint | Notes |
| --- | --- | --- |
| `search_recipes(query?, tags?, ingredients?, lang?)` | both | full-text + filters (0011) |
| `list_recipes(tag?, cursor?, lang?)` / `list_tags()` | both | summaries + url |
| `get_recipe(slug, lang?, servings?, format?)` | both | `format: 'markdown'` (default, token-cheap) \| `'json'` (schema) |
| `get_prep_list(slug, servings?, lang?)` | both | sections → bowls → items, plus prep tasks by lead time |
| `shopping_list(items: {slug, servings?}[], lang?)` | both | merged, same-unit sums (0004) |
| `get_recipe_schema()` | both | JSON Schema + authoring guide: allowed units, token syntax, sections vs prep tasks, both languages |
| `create_recipe(recipe)` / `update_recipe(slug, recipe)` | editor | full validation with precise errors. New recipes default to `draft`. |
| `publish_recipe(slug)` / `unpublish_recipe(slug)` | editor | |
| `delete_recipe(slug)` / `restore_recipe(slug)` | editor | soft delete (0001) |
| `upload_image({ url } \| { base64, mimeType })` | editor | returns `imageKey`. Max 10 MB, re-encoded to WebP. |

- **Dropped:** `import_from_url` (the agent fetches and structures pages itself) and `add_cooking_note` (no cooking log).
- Write-tool descriptions state the allowed units and the token syntax inline, so agents don't need a separate call.

## Consequences

- OAuth adds the most complexity in the project (discovery metadata, dynamic client registration, consent screen). It's covered by e2e tests against the real flow.
