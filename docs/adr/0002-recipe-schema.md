# 0002. Own structured recipe schema (not Cooklang)

**Status:** Accepted

## Context

The killer feature is steps that reference ingredients inline, so quantities show up inside the step. Prep mode needs, per ingredient: quantity, unit, prep action, section, and bowl grouping. The content is bilingual, and agents write it over MCP with no server-side LLM, so the format has to be easy for an agent to produce correctly and easy for the server to validate.

### Does Cooklang cover the requirements? (round-1 J3)

| Requirement | Cooklang |
| --- | --- |
| Inline ingredient refs in steps | ✅ `@ginger{10%g}` |
| Prep action | ✅ `@ginger{10%g}(thinly sliced)` |
| Sections | ✅ `== Marinade ==` |
| Timers | ✅ `~{20%minutes}` |
| Non-scaling quantities | ✅ `@salt{=1%tsp}` |
| Sub-recipe references | ✅ `@./Sushi rice{}` (newer spec) |
| Metadata (servings, tags, times) | ✅ front matter |
| **Bilingual** | ❌ one text per file. Two files can't share ingredient identities, so RU and EN could drift apart (different quantities). |
| **Bowl grouping** | ❌ no concept |
| **Ingredient alternatives** ("sake → water") | ❌ not native |
| **Prep tasks with lead time** ("start 24h before") | ❌ not native |
| **Quantity ranges** (`200–400 g`) | ⚠️ not standard |
| Agent-friendly writes with strict validation | ⚠️ a DSL is easier to get subtly wrong than JSON validated against a schema |

**Verdict:** Cooklang covers about 70% of the requirements. The gaps (bilingual, bowls, alternatives, lead times) are central here, so working around them means a non-standard dialect, and then the parser ecosystem stops being useful.

## Decision

Canonical storage is a **versioned JSON document per recipe** (Postgres `jsonb` plus indexed columns for slug, status, tags, and search), validated by one shared Zod schema. The server, the web app, and the MCP input schemas all use it.

```ts
Recipe {
  schemaVersion: 1
  id, slug                                   // one Latin slug for both languages
  status: 'draft' | 'published'              // drafts: editors only, never public/public MCP
  title: L10n, description?: L10n            // L10n = { ru?: string; en?: string }, ≥1 required
  servings: { amount: number; label?: L10n } // default for scaling
  times?: { prepMin?, cookMin?, passiveMin? } // total is derived
  tags: string[]
  cover?: { imageKey }
  source?: { kind: 'youtube'|'web'|'social'|'photo'|'text'; url?; label?: L10n; imageKey? }
  sections: Section[]
  prepTasks: PrepTask[]
  subRecipes?: { slug; factor: number }[]   // default 1; scales with the parent, shown collapsed
}
Section {
  id, title: L10n
  waitAfterMin?: number                      // passive gap before the next section (fermentation days)
  ingredients: Ingredient[]
  steps: Step[]
}
Ingredient {
  id                                         // stable within the recipe, referenced by steps
  name: L10n                                 // free text, no shared catalog
  qty?: { min: number; max?: number }
  unit?: Unit                                // see 0004
  scaling: 'linear' | 'fixed' | 'to-taste'
  prep?: L10n                                // "thinly sliced"
  bowl?: string                              // same key within a section = prepped together
  optional?: boolean
  alternatives?: { name: L10n; qty?; unit?; note?: L10n }[]  // display only ("or water")
}
Step {
  id
  text: L10n   // tokens: {{ing:<id>}}  {{timer:20m}}  {{recipe:<slug>}}
}
PrepTask { id; text: L10n; leadMin?: number }
```

- Tokens are validated on write: every `{{ing:id}}` must exist in the recipe, and every `{{recipe:slug}}` must point to an existing recipe. A write with unresolved tokens is rejected.
- Prep that needs cooking (mixing a sauce, marinating meat) is its own **section**, not a prep task.
- Multi-day processes (kombucha, sauerkraut) are sequences of sections separated by `waitAfterMin`.
- Ingredient names are **free text**. Shopping-list merges and ingredient search match on a normalized name (lowercased, trimmed, per language).
- Alternatives are display only. You can't switch to them.

## Consequences

- The web editor is a structured form (sections → ingredient rows → steps with an `@` autocomplete that inserts ingredient chips).
- One schema makes MCP, the UI, and the migration consistent, and the agent gets precise validation errors back.
- Free-text names mean "Garlic" and "Чеснок (зубчики)" won't merge. That's acceptable for now.
