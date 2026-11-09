# 0008. Prep mode and cook mode

**Status:** Accepted

## Context

The main reason the site exists: prep everything (measure, clean, chop), then cook, mostly on a phone (round-1 C1–C4, D1, D3).

## Decision

### Prep mode
- Ordered **by recipe section** (as authored). Inside a section, ingredients that share a `bowl` key are grouped into one card ("Bowl: garlic + ginger + scallion"). The rest form a flat list.
- Each item shows the scaled quantity + unit + prep action, and has a checkbox.
- **No merging across sections.** Each section is prepped separately.
- **Prep tasks** ("preheat oven", "butter out") are listed at the top and ordered by lead time ("start 24 h before"). Prep that involves cooking is an authored section, not a task.
- A separate **"Total ingredients"** view merges everything for grocery planning (same logic as the `shopping_list` MCP tool).

### Cook mode
- The same page with the steps list (not one step at a time). Each step has a checkbox.
- Ingredient tokens render inline as the **name plus the scaled quantity** (e.g. "add **ginger 10 g**"). Tapping one shows the prep note.
- Timer tokens render as tappable timer chips (0010).

### Shared
- A servings control defaults to the recipe's `servings`, and scaling applies everywhere (prep, cook, totals).
- Checkbox state and the chosen servings **persist locally per recipe** (localStorage / IndexedDB) and survive reload and screen lock. A "reset" button clears them. No cross-device sync.
- Sub-recipes render collapsed on the same page, with their own prep and cook blocks. They come **before** the recipe's own blocks, since a sub-recipe is usually something the main steps need ready. In cook mode, a sub-recipe that a step mentions with `{{recipe:<slug>}}` opens **under the first step that mentions it** instead, so a sub-recipe made mid-way ("while the dough rests, make the filling") sits where it's needed. A `{{recipe:<slug>}}` to a recipe that isn't in `subRecipes` stays a link.

## Consequences

- No server state for checklists, so the public, anonymous use case works fully.
