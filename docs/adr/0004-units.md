# 0004. Units: metric + kitchen measures

**Status:** Accepted

## Context

Sources mix g, oz, cups, Tbsp, and "pinch". You want to keep kitchen and utensil measures and convert imperial to metric.

## Decision

- Allowed units are a closed enum:
  - **Metric:** `g`, `kg`, `ml`, `l`
  - **Kitchen:** `tsp`, `tbsp`, `cup`, `pinch`, `dash`, `handful`, `clove`, `stalk`, `slice`, `piece`, `bunch`, `can`, `sprig`
  - **None:** a count ("3 eggs")
- **Imperial units are rejected on write.** The validation error names the conversion (e.g. `oz → g ×28.35`). The MCP write-tool descriptions and the `get_recipe_schema` guide **list the allowed units up front**, so agents get it right the first time. The migration converts once.
- Cups are a measure only. No ml tooltip.
- **Display formatting of scaled quantities:**
  - promote `g→kg` and `ml→l` at ≥1000
  - spoons and cups render as common fractions (¼, ⅓, ½, ⅔, ¾)
  - other values are rounded to sensible precision
  - no tbsp↔tsp swapping
- Ranges (`200–400 g`) scale on both ends. `fixed` and `to-taste` ingredients never scale.

## Consequences

- Shopping-list merges only sum quantities with the same unit (after kg/g normalization). Different units are listed side by side ("garlic: 3 cloves + 10 g").
