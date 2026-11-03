# 0011. Search: Postgres full-text

**Status:** Accepted

## Context

Keyword search is enough for now. Semantic search is left to the agent (round-1 F5). Content is in RU and EN.

## Decision

- A generated `tsvector` column per recipe, built from title, description, tags, and ingredient names, with weights A/B/C/D: `to_tsvector('russian', ru…) || to_tsvector('english', en…)`. GIN index.
- **Ingredient filter** (`ingredients: ["chicken", "rice"]`) matches recipes that contain *all* the given ingredients, using a normalized ingredient-names array with a GIN index.
- `pg_trgm` fallback for typos and partial words (e.g. "карто" → "картошка").
- The same query function backs the web search and the `search_recipes` MCP tool.

## Consequences

- If embeddings are added later, they'd use `pgvector` in the same DB, with no new service.
