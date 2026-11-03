import { describe, expect, test } from "bun:test";
import { recipeToMarkdown, shoppingListToMarkdown } from "@shared/markdown";
import { buildPrepList, buildShoppingList, formatShoppingAmounts } from "@shared/prep";
import { recipeDataSchema } from "@shared/recipe";
import { chashu } from "../fixtures/chashu";

const data = recipeDataSchema.parse(chashu);

describe("prep list", () => {
  test("orders tasks by lead time and groups by section and bowl", () => {
    const prep = buildPrepList(data, 1);
    expect(prep.tasks.map((t) => t.id)).toEqual(["ahead", "string"]);
    const [chashuSection, marinade] = prep.sections;
    expect(chashuSection?.bowls.map((b) => b.items.map((i) => i.ingredient.id))).toEqual([
      ["garlic", "ginger"],
    ]);
    expect(chashuSection?.loose.map((i) => i.ingredient.id)).toEqual(["pork"]);
    expect(marinade?.loose).toHaveLength(5);
  });

  test("scales quantities", () => {
    const prep = buildPrepList(data, 2);
    expect(prep.sections[0]?.loose[0]?.qty).toEqual({ min: 1500, max: 2000 });
  });
});

describe("shopping list", () => {
  test("merges the same ingredient across sections and recipes", () => {
    const list = buildShoppingList(
      [
        { data, factor: 1 },
        { data, factor: 0.5 },
      ],
      "en",
    );
    const garlic = list.find((i) => i.key === "garlic");
    expect(garlic?.amounts).toEqual([{ unit: "clove", qty: { min: 6, max: 7.5 } }]);
    const pork = list.find((i) => i.key === "pork belly");
    expect(pork && formatShoppingAmounts(pork, "en")).toBe("1.1–1.5 kg");
    expect(list.find((i) => i.key === "salt")?.unquantified).toBe(true);
  });

  test("renders markdown", () => {
    expect(shoppingListToMarkdown([{ data, factor: 1 }], "ru")).toContain("- Чеснок: 4–5 зубчиков");
  });
});

describe("markdown", () => {
  test("inlines scaled quantities into steps", () => {
    const md = recipeToMarkdown(data, { lang: "en", servings: 8, url: "https://x/en/r/chashu" });
    expect(md).toContain("# Chashu and nitamago");
    expect(md).toContain("Servings: 8");
    expect(md).toContain("1. Add garlic (4–6 cloves) and ginger (20 g), simmer 1 h 30 min");
    expect(md).toContain("- **Aromatics**");
    expect(md).toContain("Sake: 2 tbsp — or water");
    expect(md).toContain("Bay leaf: 1");
    expect(md).toContain("Start a day ahead (1 d ahead)");
  });

  test("falls back to the other language", () => {
    const md = recipeToMarkdown(data, { lang: "en" });
    expect(md).toContain("[Taiji's Kitchen](https://www.youtube.com/watch?v=sYUp0qCAtzw)");
  });
});
