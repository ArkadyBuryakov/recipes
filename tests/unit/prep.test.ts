import { describe, expect, test } from "bun:test";
import { recipeToMarkdown, shoppingListToMarkdown } from "@shared/markdown";
import { buildPrepList, buildShoppingList, formatShoppingAmounts, inlineSubRecipes } from "@shared/prep";
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

describe("inline sub-recipes", () => {
  test("places each sub-recipe under the first step that mentions it", () => {
    const withSubs = recipeDataSchema.parse({
      ...chashu,
      subRecipes: [{ slug: "tare" }, { slug: "eggs" }, { slug: "rice" }],
      sections: chashu.sections.map((s, i) =>
        i === 1
          ? {
              ...s,
              steps: [
                { id: "a", text: { ru: "Сварить {{recipe:eggs}}" } },
                { id: "b", text: { en: "Make {{recipe:tare}} and {{recipe:eggs}}" } },
                { id: "c", text: { en: "Serve over {{recipe:udon}}" } },
              ],
            }
          : s,
      ),
    });
    expect([...inlineSubRecipes(withSubs)]).toEqual([
      ["a", ["eggs"]],
      ["b", ["tare"]],
    ]);
  });

  test("a section that is a sub-recipe: must be listed, has nothing of its own, isn't also inlined", () => {
    const sections = [
      { id: "filling", title: { en: "Filling" }, recipe: "salad" },
      { id: "main", steps: [{ id: "a", text: { en: "Fill with the {{recipe:salad}}" } }] },
    ];
    const ok = recipeDataSchema.parse({ ...chashu, subRecipes: [{ slug: "salad" }], sections });
    expect(inlineSubRecipes(ok).size).toBe(0);
    expect(buildPrepList(ok, 1).sections.map((s) => s.section.id)).toEqual(["filling"]);
    expect(recipeToMarkdown(ok, { lang: "en" })).toContain("## Filling: salad");

    const unlisted = recipeDataSchema.safeParse({ ...chashu, subRecipes: [], sections });
    expect(unlisted.error?.issues.map((i) => i.path.join("."))).toContain("sections.0.recipe");
    const withSteps = recipeDataSchema.safeParse({
      ...chashu,
      subRecipes: [{ slug: "salad" }],
      sections: [{ ...sections[0], steps: [{ id: "x", text: { en: "x" } }] }],
    });
    expect(withSteps.success).toBe(false);
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
