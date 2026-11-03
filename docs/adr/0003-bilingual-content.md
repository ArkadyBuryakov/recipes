# 0003. Bilingual content (RU/EN)

**Status:** Accepted

## Context

Recipes are bilingual. There's no server-side LLM, so translations come from a human or the agent at write time.

## Decision

- Every human-readable field is `L10n = { ru?: string; en?: string }`. Structure (ingredients, quantities, steps, tokens) is **shared** between languages. Only the text is translated, so RU and EN can't drift on quantities.
- **At least one language** is required per field. A missing translation falls back to the other language, with a small "not translated" badge. MCP tool descriptions ask agents to supply both.
- **The language is in the URL:** `/ru/…` and `/en/…`. `/` redirects based on `Accept-Language` (default `ru`). The language toggle keeps you on the same page. `hreflang` alternates and the canonical link are rendered by SSR.
- **One Latin slug** for both languages: `/ru/r/borscht`, `/en/r/borscht`.
- The UI (chrome and labels) is localized in both languages.

## Consequences

- Editor forms show RU/EN side by side (desktop) or as tabs (phone).
- Full-text search indexes both languages with the matching Postgres configs (0011).
