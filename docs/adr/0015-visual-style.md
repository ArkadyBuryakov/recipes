# 0015. Visual style: "Workshop"

**Status:** Accepted

## Context

The first UI (warm palette, system serif) didn't land, and it was hard to say why. Seven complete styles were mocked up across every page, on desktop and phone, in light and dark: `docs/design/styles.html`. "Workshop" was chosen, with its quiet section headers (variant C).

## Decision

- **Fonts:** IBM Plex Mono for headings, labels, quantities, tabs and buttons; IBM Plex Sans for body text. Both cover Cyrillic and Latin. They're self-hosted through `@fontsource` (bundled by Vite into `/assets/`), so they're cached for offline use and no third party sees requests.
- **Shapes:**
  - Square corners: Tailwind's `rounded-*` radii are set to 0.
  - 2px ink borders.
  - Hard offset shadows instead of blur: the `shadow-*` tokens are redefined.
- **Colour:** an off-white or near-black background, ink, and one yellow (`#ffd400`). Yellow fills the active tab, the primary button, the current cook step (as a soft tint), and the highlighter stroke behind inline ingredients. Text links use `link` (dark gold in light mode, yellow in dark mode), because yellow text on a light background is unreadable.
- **Section headers:** a small yellow number box, the title in normal case, and a dashed rule. No filled bars.
- **Home:** a large search box and a plain table (number, title, up to two tags as text, time). There is no tag filter or tag cloud; search covers it.
- **Recipe page:** sections are bordered boxes. The ingredient rows have a quantity column, and the first unchecked step is highlighted.
- Tokens and component classes live in `app/app.css`. The mockup page stays as the reference for the other styles, if one is wanted later.

## Consequences

- The `?tag=` web filter was removed. Tags still feed full-text search (0011) and the MCP `list_tags` and `search_recipes` filters (0007).
- Monospace text is wider, so long Russian titles wrap sooner on phones. That's acceptable.
