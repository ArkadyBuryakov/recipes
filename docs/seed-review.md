# Seed recipes: review notes

The 31 vault recipes were converted to `seed/recipes/*.json` (ADR 0014) and all pass `bun scripts/validate-seed.ts`.
They load once, on the first start of an empty database. Edit a JSON file before the first production deploy, or
edit the recipe in the web editor afterwards. Things worth a look:

**Content added that was not in the source**
- `apricot-grilled-cheese`: the source has ingredient lists only. The béchamel and pan-toasting steps were written generically. Rewrite or delete them.
- `puff-pastry`: the source has no method, so the two sections have ingredients and no steps.
- `milk-sponge-cake`: the starter method and some quantities were transcribed from the two photos (`кекс_на_молочной_опаре_*.jpg`). The sugar that is struck through in the markdown was left out.

**Estimated servings** (not stated in the source): chashu-and-nitamago 4, chicken-teriyaki 2, kladdkaka 8, karaage 2, peach-turnover-cake 8, popcorn 2, apricot-grilled-cheese 2, lamb-ribs 4, grandma-palana-borscht 6, roasted-cabbage 2, chinese-beef-salad 2, lasagna 6, baghrir 4, paella 4, ptitim-with-chicken 2, sushi-rice 4, saj-kavurma 4, alla-vodka-sauce 2, turkish-manti-soup 4, khinkali 4, chakhokhbili 6.

**Interpretations**
- Timers for ranges like "4–5 min" use the lower bound; the step text keeps the range.
- `chicken-tartiflette`: thyme is listed, but the source never says when to add it.
- `japanese-curry`: the steps mention tomato paste but the ingredient list has canned tomatoes. Canned tomatoes were used.
- `meatballs`: the intro says veal and the ingredients say beef. Beef was kept.
- `saj-kavurma`: "1 dessert spoon salt" became 2 tsp.
- `khinkali`: the step "добавить тесто в кружочек" was read as putting the filling onto a dough circle.
- `grandma-palana-borscht`: tagged "ukrainian", which is a guess.
- Existing steps name ingredients in the nominative case. Adding `{{ing:id|word}}` labels would make the Russian read naturally ("Залить {{ing:pork|свинину}}").
