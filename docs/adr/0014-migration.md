# 0014. Migration of existing recipes

**Status:** Accepted

## Context

All ~30 recipes in the vault get migrated as part of the initial migration. `Дневник/`, `attachments/`, and loose images are left out. There's no server-side LLM.

## Decision

- I (Claude Code) convert each markdown file into the schema (0002) **once**:
  - add the missing RU/EN translation
  - convert imperial units to metric
  - add ingredient tokens in steps, bowls, prep actions, and `{{timer:…}}` tokens
  - turn implicit prep into sections or prep tasks
- Multi-day processes (Комбуча, Квашеная капуста) become sections separated by `waitAfterMin`.
- `Pepcorn` → "Popcorn" (slug `popcorn`).
- The output is committed as `seed/recipes/*.json`, so you can **review it as normal diffs** before anything touches the DB.
- A seed step runs on start after the schema migrations. It's validated by the same Zod schema and recorded with revision `channel: 'migration'`, and the recipes are created as `published`. It's idempotent: it's tracked in a `seeds` table, so recipes you deleted or edited later are never re-created or overwritten.
- Photo-based sources (the kekс jpgs) are left out along with the images. The source becomes `text`, or is omitted.

## Consequences

- The vault copy becomes stale after migration. The symlink can be removed once you've reviewed the migrated recipes.
