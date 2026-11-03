import { describe, expect, test } from "bun:test";
import { detectSourceKind, normalizeRecipeData, recipeDataSchema, youtubeId } from "@shared/recipe";
import { chashu } from "../fixtures/chashu";

const clone = () => structuredClone(chashu);
const messages = (input: unknown) => {
  const r = recipeDataSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("recipe schema", () => {
  test("accepts a full recipe and applies defaults", () => {
    const data = recipeDataSchema.parse(chashu);
    expect(data.sections[0]?.ingredients[0]?.scaling).toBe("linear");
    expect(data.subRecipes).toEqual([]);
  });

  test("normalizes unit case", () => {
    const r = clone();
    r.sections[0]!.ingredients![1]!.unit = "Clove";
    expect(recipeDataSchema.parse(r).sections[0]?.ingredients[1]?.unit).toBe("clove");
  });

  test("rejects imperial units with a conversion hint", () => {
    const r = clone();
    r.sections[0]!.ingredients![0]!.unit = "oz";
    expect(messages(r).join()).toContain("convert to g (1 oz = 28.35 g)");
  });

  test("rejects unknown units listing the allowed ones", () => {
    const r = clone();
    r.sections[0]!.ingredients![0]!.unit = "glass";
    expect(messages(r).join()).toContain("Allowed units:");
  });

  test("requires at least one language", () => {
    const r = clone();
    r.title = {};
    expect(messages(r)).toContain("at least one of ru/en is required");
  });

  test("rejects steps referencing unknown ingredients", () => {
    const r = clone();
    r.sections[1]!.steps![0]!.text = { ru: "Залить {{ing:mirin}}" };
    expect(messages(r).join()).toContain("{{ing:mirin}} references an unknown ingredient");
  });

  test("steps may reference ingredients of other sections", () => {
    const r = clone();
    r.sections[1]!.steps![0]!.text = { ru: "Добавить {{ing:pork}}" };
    expect(messages(r)).toEqual([]);
  });

  test("rejects invalid tokens", () => {
    const r = clone();
    r.sections[1]!.steps![0]!.text = { ru: "Варить {{timer:soon}} {{foo:bar}}" };
    const m = messages(r).join();
    expect(m).toContain('invalid duration "soon"');
    expect(m).toContain('unknown token kind "foo"');
  });

  test("RU and EN must carry the same tokens", () => {
    const r = clone();
    r.sections[1]!.steps![0]!.text = { ru: "Залить {{ing:soy}}", en: "Pour it" };
    expect(messages(r)).toContain("RU and EN text must contain the same tokens");
  });

  test("rejects undefined bowls and duplicate ids", () => {
    const r = clone();
    r.sections[1]!.ingredients![0]!.bowl = "aromatics";
    r.sections[1]!.ingredients![1]!.id = "pork";
    const m = messages(r).join();
    expect(m).toContain('bowl "aromatics" is not defined in section "marinade"');
    expect(m).toContain('duplicate ingredient id "pork"');
  });

  test("unit requires qty", () => {
    const r = clone();
    r.sections[1]!.ingredients![3]!.unit = "pinch";
    expect(messages(r)).toContain("unit requires qty");
  });

  test("rejects unknown keys", () => {
    expect(messages({ ...clone(), rating: 5 }).length).toBeGreaterThan(0);
  });
});

describe("sources", () => {
  test("detects kinds from urls", () => {
    expect(detectSourceKind({ url: "https://youtu.be/abc" })).toBe("youtube");
    expect(detectSourceKind({ url: "https://www.instagram.com/reel/x" })).toBe("social");
    expect(detectSourceKind({ url: "https://example.com/recipe" })).toBe("web");
    expect(detectSourceKind({ label: { ru: "Бабушка" } })).toBe("text");
    expect(detectSourceKind({ url: "https://example.com", kind: "social" })).toBe("social");
  });

  test("normalize stores the detected kind", () => {
    expect(normalizeRecipeData(recipeDataSchema.parse(chashu)).source?.kind).toBe("youtube");
  });

  test("extracts youtube ids", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=sYUp0qCAtzw&ab_channel=x")).toBe("sYUp0qCAtzw");
    expect(youtubeId("https://youtu.be/abc123")).toBe("abc123");
    expect(youtubeId("https://www.youtube.com/shorts/xyz")).toBe("xyz");
  });
});
