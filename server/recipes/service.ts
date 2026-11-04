import { t } from "@shared/l10n";
import { nameKey } from "@shared/prep";
import {
  normalizeRecipeData,
  type Recipe,
  type RecipeData,
  type RecipeStatus,
  recipeDataSchema,
  slugSchema,
} from "@shared/recipe";
import { parseStepText } from "@shared/tokens";
import { and, desc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  type ActorKind,
  type Channel,
  type RecipeSnapshot,
  type RevisionAction,
  recipeRevisions,
  recipes,
  user,
} from "../db/schema";
import { env } from "../env";
import { DomainError, validationError } from "../errors";

export type Actor = {
  userId: string | null;
  kind: ActorKind;
  ref?: string;
  channel: Channel;
};

export type Visibility = { includeDrafts: boolean };
export const PUBLIC: Visibility = { includeDrafts: false };
export const EDITOR: Visibility = { includeDrafts: true };

export type RecipeSummary = {
  slug: string;
  status: RecipeStatus;
  title: RecipeData["title"];
  description?: RecipeData["description"];
  tags: RecipeData["tags"];
  cover?: RecipeData["cover"];
  times?: RecipeData["times"];
  servings: RecipeData["servings"];
  updatedAt: string;
};

type Row = typeof recipes.$inferSelect;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

export type ResolvedSubRecipe = { recipe: Recipe; factor: number; subRecipes: ResolvedSubRecipe[] };

export function recipeUrl(slug: string, lang: "ru" | "en"): string {
  return `${env.PUBLIC_URL}/${lang}/r/${slug}`;
}

function toRecipe(row: Row): Recipe {
  return {
    ...row.data,
    id: row.id,
    slug: row.slug,
    status: row.status,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(row: Row): RecipeSummary {
  const d = row.data;
  return {
    slug: row.slug,
    status: row.status,
    title: d.title,
    ...(d.description && { description: d.description }),
    tags: d.tags,
    ...(d.cover && { cover: d.cover }),
    ...(d.times && { times: d.times }),
    servings: d.servings,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const stripTokens = (text: string) =>
  parseStepText(text)
    .segments.map((s) => (s.type === "text" ? s.value : " "))
    .join("");

/** Columns denormalized from the document for listing and search. */
export function derive(data: RecipeData) {
  const langText = (lang: "ru" | "en") => {
    const parts: string[] = [];
    const add = (v?: { ru?: string; en?: string }) => {
      const s = v?.[lang];
      if (s) parts.push(s);
    };
    add(data.description);
    data.tags.forEach(add);
    for (const section of data.sections) {
      add(section.title);
      for (const ing of section.ingredients) {
        add(ing.name);
        ing.alternatives.forEach((a) => {
          add(a.name);
        });
      }
      for (const step of section.steps) {
        const s = step.text[lang];
        if (s) parts.push(stripTokens(s));
      }
    }
    return parts.join("\n");
  };
  const names = new Set<string>();
  for (const s of data.sections)
    for (const i of s.ingredients)
      for (const v of [i.name, ...i.alternatives.map((a) => a.name)])
        for (const n of [v.ru, v.en]) if (n) names.add(nameKey(n));
  const tags = new Set<string>();
  for (const tag of data.tags) for (const v of [tag.ru, tag.en]) if (v) tags.add(nameKey(v));
  return {
    titleRu: data.title.ru ?? null,
    titleEn: data.title.en ?? null,
    tags: [...tags],
    ingredientNames: [...names],
    searchRu: langText("ru"),
    searchEn: langText("en"),
  };
}

function parseData(input: unknown): RecipeData {
  const parsed = recipeDataSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error);
  return normalizeRecipeData(parsed.data);
}

function parseSlug(slug: unknown): string {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) throw validationError(parsed.error, "Invalid slug");
  return parsed.data;
}

export class RecipeService {
  constructor(private readonly db: Db) {}

  private visible(v: Visibility): SQL | undefined {
    return v.includeDrafts
      ? isNull(recipes.deletedAt)
      : and(isNull(recipes.deletedAt), eq(recipes.status, "published"));
  }

  private async row(
    slug: string,
    opts: { includeDrafts: boolean; includeDeleted?: boolean },
    exec: Exec = this.db,
  ): Promise<Row> {
    const where = opts.includeDeleted
      ? eq(recipes.slug, slug)
      : and(eq(recipes.slug, slug), this.visible(opts));
    const [row] = await exec.select().from(recipes).where(where).limit(1);
    if (!row) throw new DomainError("not_found", `Recipe "${slug}" not found`);
    return row;
  }

  /** Sub-recipes and {{recipe:slug}} tokens must point to existing (non-deleted) recipes, without cycles. */
  private async checkLinks(slug: string, data: RecipeData) {
    const linked = new Set(data.subRecipes.map((s) => s.slug));
    for (const s of data.sections)
      for (const step of s.steps)
        for (const v of [step.text.ru, step.text.en])
          if (v) for (const seg of parseStepText(v).segments) if (seg.type === "recipe") linked.add(seg.slug);
    if (data.subRecipes.some((s) => s.slug === slug))
      throw new DomainError("validation", "Recipe is invalid", [
        "subRecipes: a recipe cannot include itself",
      ]);
    if (!linked.size) return;
    const found = await this.db
      .select({ slug: recipes.slug, data: recipes.data })
      .from(recipes)
      .where(and(inArray(recipes.slug, [...linked]), isNull(recipes.deletedAt)));
    const missing = [...linked].filter((l) => !found.some((f) => f.slug === l));
    if (missing.length)
      throw new DomainError(
        "validation",
        "Recipe is invalid",
        missing.map((m) => `references unknown recipe "${m}"`),
      );
    for (const f of found)
      if (f.data.subRecipes.some((s) => s.slug === slug) && data.subRecipes.some((s) => s.slug === f.slug))
        throw new DomainError("validation", "Recipe is invalid", [
          `subRecipes: "${f.slug}" already includes "${slug}" (cycle)`,
        ]);
  }

  private async revision(tx: Exec, row: Row, action: RevisionAction, actor: Actor): Promise<void> {
    const snapshot: RecipeSnapshot = { slug: row.slug, status: row.status, data: row.data };
    await tx.insert(recipeRevisions).values({
      recipeId: row.id,
      version: row.version,
      action,
      snapshot,
      actorUserId: actor.userId,
      actorKind: actor.kind,
      actorRef: actor.ref ?? null,
      channel: actor.channel,
    });
  }

  async create(
    input: { slug: string; status?: RecipeStatus; recipe: unknown },
    actor: Actor,
  ): Promise<Recipe> {
    const slug = parseSlug(input.slug);
    const data = parseData(input.recipe);
    await this.checkLinks(slug, data);
    const status = input.status ?? "draft";
    return this.db.transaction(async (tx) => {
      const [taken] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.slug, slug));
      if (taken) throw new DomainError("conflict", `Slug "${slug}" is already used`);
      const [row] = await tx
        .insert(recipes)
        .values({
          slug,
          status,
          data,
          ...derive(data),
          createdBy: actor.userId,
          updatedBy: actor.userId,
          publishedAt: status === "published" ? new Date() : null,
        })
        .returning();
      if (!row) throw new Error("insert failed");
      await this.revision(tx, row, "create", actor);
      return toRecipe(row);
    });
  }

  async update(
    slug: string,
    input: { recipe: unknown; slug?: string; status?: RecipeStatus; expectedVersion?: number },
    actor: Actor,
  ): Promise<Recipe> {
    const data = parseData(input.recipe);
    const newSlug = input.slug ? parseSlug(input.slug) : slug;
    await this.checkLinks(newSlug, data);
    return this.db.transaction(async (tx) => {
      const current = await this.row(slug, EDITOR, tx);
      if (input.expectedVersion !== undefined && input.expectedVersion !== current.version)
        throw new DomainError(
          "conflict",
          `Recipe "${slug}" was changed meanwhile (version ${current.version}, expected ${input.expectedVersion}). Reload and retry.`,
        );
      if (newSlug !== slug) {
        const [taken] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.slug, newSlug));
        if (taken) throw new DomainError("conflict", `Slug "${newSlug}" is already used`);
      }
      const status = input.status ?? current.status;
      const [row] = await tx
        .update(recipes)
        .set({
          slug: newSlug,
          status,
          data,
          ...derive(data),
          version: current.version + 1,
          updatedAt: new Date(),
          updatedBy: actor.userId,
          publishedAt: status === "published" ? (current.publishedAt ?? new Date()) : current.publishedAt,
        })
        .where(eq(recipes.id, current.id))
        .returning();
      if (!row) throw new Error("update failed");
      await this.revision(tx, row, "update", actor);
      return toRecipe(row);
    });
  }

  private async transition(
    slug: string,
    actor: Actor,
    action: RevisionAction,
    find: { includeDeleted?: boolean },
    change: (row: Row) => Partial<typeof recipes.$inferInsert> | null,
  ): Promise<Recipe> {
    return this.db.transaction(async (tx) => {
      const current = await this.row(slug, { includeDrafts: true, ...find }, tx);
      const patch = change(current);
      if (!patch) return toRecipe(current);
      const [row] = await tx
        .update(recipes)
        .set({ ...patch, version: current.version + 1, updatedAt: new Date(), updatedBy: actor.userId })
        .where(eq(recipes.id, current.id))
        .returning();
      if (!row) throw new Error("update failed");
      await this.revision(tx, row, action, actor);
      return toRecipe(row);
    });
  }

  setStatus(slug: string, status: RecipeStatus, actor: Actor) {
    return this.transition(slug, actor, status === "published" ? "publish" : "unpublish", {}, (row) =>
      row.status === status
        ? null
        : { status, publishedAt: status === "published" ? (row.publishedAt ?? new Date()) : row.publishedAt },
    );
  }

  remove(slug: string, actor: Actor) {
    return this.transition(slug, actor, "delete", {}, () => ({
      deletedAt: new Date(),
      deletedBy: actor.userId,
    }));
  }

  restore(slug: string, actor: Actor) {
    return this.transition(slug, actor, "restore", { includeDeleted: true }, (row) =>
      row.deletedAt ? { deletedAt: null, deletedBy: null } : null,
    );
  }

  /** Restore an earlier revision's content as a new version. */
  async restoreRevision(slug: string, revisionId: number, actor: Actor): Promise<Recipe> {
    const current = await this.row(slug, EDITOR);
    const [rev] = await this.db
      .select()
      .from(recipeRevisions)
      .where(and(eq(recipeRevisions.id, revisionId), eq(recipeRevisions.recipeId, current.id)));
    if (!rev) throw new DomainError("not_found", `Revision ${revisionId} not found for "${slug}"`);
    return this.update(slug, { recipe: rev.snapshot.data, status: rev.snapshot.status }, actor);
  }

  async get(slug: string, v: Visibility): Promise<Recipe> {
    return toRecipe(await this.row(slug, v));
  }

  async getMany(slugs: string[], v: Visibility): Promise<Recipe[]> {
    if (!slugs.length) return [];
    const rows = await this.db
      .select()
      .from(recipes)
      .where(and(inArray(recipes.slug, slugs), this.visible(v)));
    return rows.map(toRecipe);
  }

  /** Sub-recipes for a page, resolved recursively (depth-limited), each with its effective factor. */
  async resolveSubRecipes(data: RecipeData, v: Visibility, depth = 3): Promise<ResolvedSubRecipe[]> {
    if (!data.subRecipes.length || depth === 0) return [];
    const found = await this.getMany(
      data.subRecipes.map((s) => s.slug),
      v,
    );
    const out: ResolvedSubRecipe[] = [];
    for (const ref of data.subRecipes) {
      const recipe = found.find((r) => r.slug === ref.slug);
      if (!recipe) continue;
      out.push({
        recipe,
        factor: ref.factor,
        subRecipes: await this.resolveSubRecipes(recipe, v, depth - 1),
      });
    }
    return out;
  }

  async list(
    v: Visibility,
    opts: { tag?: string; limit?: number; offset?: number; deleted?: boolean } = {},
  ): Promise<{ items: RecipeSummary[]; total: number }> {
    const where = and(
      opts.deleted ? sql`${recipes.deletedAt} is not null` : this.visible(v),
      opts.tag ? sql`${recipes.tags} @> array[${nameKey(opts.tag)}]::text[]` : undefined,
    );
    const limit = Math.min(opts.limit ?? 100, 200);
    const [rows, [count]] = await Promise.all([
      this.db
        .select()
        .from(recipes)
        .where(where)
        .orderBy(sql`coalesce(${recipes.titleRu}, ${recipes.titleEn})`)
        .limit(limit)
        .offset(opts.offset ?? 0),
      this.db.select({ n: sql<number>`count(*)::int` }).from(recipes).where(where),
    ]);
    return { items: rows.map(toSummary), total: count?.n ?? 0 };
  }

  /** Full-text (RU + EN) with trigram/substring fallback, plus tag and ingredient filters (ADR 0011). */
  async search(
    v: Visibility,
    opts: { query?: string; tags?: string[]; ingredients?: string[]; limit?: number },
  ): Promise<RecipeSummary[]> {
    const q = opts.query?.trim() ?? "";
    const tags = (opts.tags ?? []).map(nameKey).filter(Boolean);
    const ingredients = (opts.ingredients ?? []).map(nameKey).filter(Boolean);
    const conditions: (SQL | undefined)[] = [this.visible(v)];
    if (tags.length) conditions.push(sql`${recipes.tags} @> array[${sql.join(tags, sql`, `)}]::text[]`);
    for (const ing of ingredients)
      conditions.push(
        sql`exists (select 1 from unnest(${recipes.ingredientNames}) as n where n like ${`%${ing}%`})`,
      );
    const like = `%${q.toLowerCase()}%`;
    const titles = sql`(coalesce(${recipes.titleRu}, '') || ' ' || coalesce(${recipes.titleEn}, ''))`;
    const tsRu = sql`websearch_to_tsquery('russian', ${q})`;
    const tsEn = sql`websearch_to_tsquery('english', ${q})`;
    if (q)
      conditions.push(
        sql`(${recipes.search} @@ ${tsRu} or ${recipes.search} @@ ${tsEn} or word_similarity(${q}, ${titles}) >= 0.5 or lower(${titles} || ' ' || ${recipes.searchRu} || ' ' || ${recipes.searchEn}) like ${like})`,
      );
    const rank = q
      ? sql`ts_rank(${recipes.search}, ${tsRu}) + ts_rank(${recipes.search}, ${tsEn}) + word_similarity(${q}, ${titles}) + (case when lower(${titles}) like ${like} then 1 else 0 end)`
      : undefined;
    const rows = await this.db
      .select()
      .from(recipes)
      .where(and(...conditions))
      .orderBy(...(rank ? [desc(rank)] : []), sql`coalesce(${recipes.titleRu}, ${recipes.titleEn})`)
      .limit(Math.min(opts.limit ?? 20, 100));
    return rows.map(toSummary);
  }

  /** Distinct tags (as authored, bilingual) with recipe counts. */
  async tags(v: Visibility): Promise<{ tag: RecipeData["tags"][number]; count: number }[]> {
    const rows = await this.db.select({ data: recipes.data }).from(recipes).where(this.visible(v));
    const byKey = new Map<string, { tag: RecipeData["tags"][number]; count: number }>();
    for (const { data } of rows)
      for (const tag of data.tags) {
        const key = nameKey(tag.en ?? tag.ru ?? "");
        const entry = byKey.get(key);
        if (entry) {
          entry.count++;
          entry.tag = { ...tag, ...entry.tag };
        } else byKey.set(key, { tag, count: 1 });
      }
    return [...byKey.values()].sort(
      (a, b) => b.count - a.count || t(a.tag, "ru").localeCompare(t(b.tag, "ru")),
    );
  }

  async revisions(slug: string) {
    const current = await this.row(slug, { includeDrafts: true, includeDeleted: true });
    return this.db
      .select({
        id: recipeRevisions.id,
        version: recipeRevisions.version,
        action: recipeRevisions.action,
        channel: recipeRevisions.channel,
        actorKind: recipeRevisions.actorKind,
        actorRef: recipeRevisions.actorRef,
        actorName: user.name,
        createdAt: recipeRevisions.createdAt,
        snapshot: recipeRevisions.snapshot,
      })
      .from(recipeRevisions)
      .leftJoin(user, eq(user.id, recipeRevisions.actorUserId))
      .where(eq(recipeRevisions.recipeId, current.id))
      .orderBy(desc(recipeRevisions.id));
  }
}
