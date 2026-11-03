import { sql } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RecipeData } from "../../shared/recipe";
import { user } from "./auth-schema";

export * from "./auth-schema";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    data: jsonb("data").$type<RecipeData>().notNull(),
    version: integer("version").notNull().default(1),
    // Denormalized from `data` on every write, for listing, filtering and search (ADR 0011).
    titleRu: text("title_ru"),
    titleEn: text("title_en"),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    ingredientNames: text("ingredient_names").array().notNull().default(sql`'{}'`),
    searchRu: text("search_ru").notNull().default(""),
    searchEn: text("search_en").notNull().default(""),
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title_ru, '')), 'A') || setweight(to_tsvector('russian', search_ru), 'C') || setweight(to_tsvector('english', coalesce(title_en, '')), 'A') || setweight(to_tsvector('english', search_en), 'C')`,
    ),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
    publishedAt: tstz("published_at"),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
    deletedAt: tstz("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("recipes_slug_idx").on(t.slug),
    index("recipes_search_idx").using("gin", t.search),
    index("recipes_tags_idx").using("gin", t.tags),
    index("recipes_ingredients_idx").using("gin", t.ingredientNames),
    index("recipes_trgm_idx").using(
      "gin",
      sql`(coalesce(title_ru, '') || ' ' || coalesce(title_en, '')) gin_trgm_ops`,
    ),
  ],
);

export type RevisionAction = "create" | "update" | "delete" | "restore" | "publish" | "unpublish";
export type Channel = "web" | "mcp" | "migration";
export type ActorKind = "user" | "api_key" | "oauth" | "system";
export type RecipeSnapshot = { slug: string; status: "draft" | "published"; data: RecipeData };

export const recipeRevisions = pgTable(
  "recipe_revisions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    action: text("action").$type<RevisionAction>().notNull(),
    snapshot: jsonb("snapshot").$type<RecipeSnapshot>().notNull(),
    actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorKind: text("actor_kind").$type<ActorKind>().notNull(),
    actorRef: text("actor_ref"),
    channel: text("channel").$type<Channel>().notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("recipe_revisions_recipe_idx").on(t.recipeId, t.version)],
);

export const images = pgTable("images", {
  key: text("key").primaryKey(),
  mime: text("mime").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

/** One-time links: invites for new editors and admin-issued password resets (ADR 0006). */
export const accessLinks = pgTable("access_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["invite", "reset"] }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role", { enum: ["admin", "editor"] }),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  note: text("note"),
  createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: tstz("created_at").notNull().defaultNow(),
  expiresAt: tstz("expires_at").notNull(),
  usedAt: tstz("used_at"),
  usedBy: uuid("used_by").references(() => user.id, { onDelete: "set null" }),
});

/** Server-sent Web Push for kitchen timers (ADR 0010). */
export const pushTimers = pgTable(
  "push_timers",
  {
    id: uuid("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    subscription: jsonb("subscription").$type<PushSubscriptionJSON>().notNull(),
    endsAt: tstz("ends_at").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    url: text("url"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_timers_ends_at_idx").on(t.endsAt)],
);

export const seeds = pgTable("seeds", {
  name: text("name").primaryKey(),
  appliedAt: tstz("applied_at").notNull().defaultNow(),
});
