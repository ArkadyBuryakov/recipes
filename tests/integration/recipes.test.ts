import { beforeEach, describe, expect, test } from "bun:test";
import type { RecipeDataInput } from "@shared/recipe";
import { DomainError } from "../../server/errors";
import { EDITOR, PUBLIC, RecipeService } from "../../server/recipes/service";
import { chashu } from "../fixtures/chashu";
import { db, resetDb, system } from "./db";

const svc = new RecipeService(db);
const soup: RecipeDataInput = {
  title: { ru: "Турецкий чечевичный суп", en: "Turkish lentil soup" },
  servings: { amount: 4 },
  tags: [{ ru: "суп", en: "soup" }],
  sections: [
    {
      id: "main",
      ingredients: [
        { id: "lentils", name: { ru: "Красная чечевица", en: "Red lentils" }, qty: { min: 200 }, unit: "g" },
        { id: "onion", name: { ru: "Лук", en: "Onion" }, qty: { min: 1 } },
      ],
      steps: [
        {
          id: "s1",
          text: {
            ru: "Сварить {{ing:lentils}} с {{ing:onion}}",
            en: "Cook {{ing:lentils}} with {{ing:onion}}",
          },
        },
      ],
    },
  ],
};

async function rejects(p: Promise<unknown>, code: DomainError["code"]): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return e as DomainError;
  }
  throw new Error(`expected ${code}`);
}

beforeEach(resetDb);

describe("recipe lifecycle", () => {
  test("drafts are hidden from the public until published", async () => {
    await svc.create({ slug: "chashu", recipe: chashu }, system);
    await rejects(svc.get("chashu", PUBLIC), "not_found");
    expect((await svc.get("chashu", EDITOR)).status).toBe("draft");
    await svc.setStatus("chashu", "published", system);
    const r = await svc.get("chashu", PUBLIC);
    expect(r.version).toBe(2);
    expect(r.source?.kind).toBe("youtube");
  });

  test("duplicate slugs conflict", async () => {
    await svc.create({ slug: "chashu", recipe: chashu }, system);
    await rejects(svc.create({ slug: "chashu", recipe: chashu }, system), "conflict");
  });

  test("validation errors list precise issues", async () => {
    const bad = structuredClone(chashu);
    bad.sections[0]!.ingredients![0]!.unit = "lb";
    const err = await rejects(svc.create({ slug: "bad", recipe: bad }, system), "validation");
    expect(err.issues.join()).toContain("sections.0.ingredients.0.unit: imperial unit");
  });

  test("optimistic locking on update", async () => {
    await svc.create({ slug: "soup", recipe: soup }, system);
    const updated = await svc.update(
      "soup",
      { recipe: { ...soup, servings: { amount: 6 } }, expectedVersion: 1 },
      system,
    );
    expect(updated.version).toBe(2);
    await rejects(svc.update("soup", { recipe: soup, expectedVersion: 1 }, system), "conflict");
  });

  test("rename keeps history", async () => {
    await svc.create({ slug: "soup", recipe: soup }, system);
    await svc.update("soup", { recipe: soup, slug: "lentil-soup" }, system);
    expect((await svc.get("lentil-soup", EDITOR)).title.en).toBe("Turkish lentil soup");
    expect(await svc.revisions("lentil-soup")).toHaveLength(2);
  });

  test("soft delete, restore and audit history", async () => {
    await svc.create({ slug: "soup", recipe: soup, status: "published" }, system);
    await svc.remove("soup", system);
    await rejects(svc.get("soup", EDITOR), "not_found");
    expect((await svc.list(EDITOR, { deleted: true })).items.map((i) => i.slug)).toEqual(["soup"]);
    await svc.restore("soup", system);
    expect((await svc.get("soup", PUBLIC)).version).toBe(3);
    const history = await svc.revisions("soup");
    expect(history.map((h) => h.action)).toEqual(["restore", "delete", "create"]);
  });

  test("restoring a revision creates a new version with old content", async () => {
    await svc.create({ slug: "soup", recipe: soup }, system);
    await svc.update("soup", { recipe: { ...soup, title: { ru: "Другое" } } }, system);
    const first = (await svc.revisions("soup")).at(-1)!;
    const restored = await svc.restoreRevision("soup", first.id, system);
    expect(restored.title.ru).toBe("Турецкий чечевичный суп");
    expect(restored.version).toBe(3);
  });
});

describe("links between recipes", () => {
  test("sub-recipes must exist and cannot form cycles", async () => {
    await rejects(
      svc.create({ slug: "a", recipe: { ...soup, subRecipes: [{ slug: "b" }] } }, system),
      "validation",
    );
    await svc.create({ slug: "b", recipe: soup }, system);
    await svc.create({ slug: "a", recipe: { ...soup, subRecipes: [{ slug: "b" }] } }, system);
    await rejects(
      svc.update("b", { recipe: { ...soup, subRecipes: [{ slug: "a" }] } }, system),
      "validation",
    );
    await rejects(
      svc.update("b", { recipe: { ...soup, subRecipes: [{ slug: "b" }] } }, system),
      "validation",
    );
  });

  test("recipe tokens must point to existing recipes", async () => {
    const withLink = structuredClone(soup);
    withLink.sections[0]!.steps![0]!.text = { ru: "Подать с {{recipe:rice}}" };
    await rejects(svc.create({ slug: "a", recipe: withLink }, system), "validation");
  });

  test("resolves sub-recipes with factors, respecting visibility", async () => {
    await svc.create({ slug: "rice", recipe: soup, status: "published" }, system);
    await svc.create(
      { slug: "bowl", recipe: { ...soup, subRecipes: [{ slug: "rice", factor: 2 }] }, status: "published" },
      system,
    );
    const bowl = await svc.get("bowl", PUBLIC);
    const subs = await svc.resolveSubRecipes(bowl, PUBLIC);
    expect(subs.map((s) => [s.recipe.slug, s.factor])).toEqual([["rice", 2]]);
    await svc.setStatus("rice", "draft", system);
    expect(await svc.resolveSubRecipes(bowl, PUBLIC)).toEqual([]);
  });
});

describe("search", () => {
  beforeEach(async () => {
    await svc.create({ slug: "chashu", recipe: chashu, status: "published" }, system);
    await svc.create({ slug: "soup", recipe: soup, status: "published" }, system);
    await svc.create({ slug: "draft-soup", recipe: { ...soup, title: { en: "Secret soup" } } }, system);
  });

  const slugs = async (opts: Parameters<RecipeService["search"]>[1], v = PUBLIC) =>
    (await svc.search(v, opts)).map((r) => r.slug);

  test("full-text in both languages with stemming", async () => {
    expect(await slugs({ query: "супы" })).toEqual(["soup"]);
    expect(await slugs({ query: "lentil" })).toEqual(["soup"]);
    expect(await slugs({ query: "pork" })).toEqual(["chashu"]);
  });

  test("partial words and typos", async () => {
    expect(await slugs({ query: "чечев" })).toEqual(["soup"]);
    expect(await slugs({ query: "chashoo" })).toEqual(["chashu"]);
  });

  test("ingredient and tag filters", async () => {
    expect(await slugs({ ingredients: ["чесн", "soy sauce"] })).toEqual(["chashu"]);
    expect(await slugs({ ingredients: ["onion", "pork"] })).toEqual([]);
    expect(await slugs({ tags: ["Soup"] })).toEqual(["soup"]);
    expect(await slugs({ tags: ["суп"] }, EDITOR)).toEqual(["draft-soup", "soup"]);
  });

  test("lists and tags respect visibility", async () => {
    expect((await svc.list(PUBLIC)).total).toBe(2);
    expect((await svc.list(EDITOR)).total).toBe(3);
    expect((await svc.list(PUBLIC, { tag: "japanese" })).items.map((i) => i.slug)).toEqual(["chashu"]);
    const tags = await svc.tags(EDITOR);
    expect(tags[0]).toEqual({ tag: { ru: "суп", en: "soup" }, count: 2 });
  });
});
