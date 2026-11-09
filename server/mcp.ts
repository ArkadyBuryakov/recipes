import { requireMcpAuth } from "@better-auth/mcp";
import { type CallToolResult, createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { DEFAULT_LANG, type Lang, t } from "@shared/l10n";
import { prepListToMarkdown, recipeToMarkdown, shoppingListToMarkdown } from "@shared/markdown";
import { type RecipeData, recipeInputSchema, SCHEMA_VERSION, slugSchema } from "@shared/recipe";
import { TOKEN_SYNTAX_TEXT } from "@shared/tokens";
import { UNIT_POLICY_TEXT } from "@shared/units";
import { z } from "zod";
import { apiKeyPrincipal, oauthPrincipal, type Principal } from "./access";
import { API_KEY_PREFIX, auth, MCP_EDITOR_RESOURCE } from "./auth";
import { DomainError } from "./errors";
import {
  EDITOR,
  PUBLIC,
  type RecipeSummary,
  type ResolvedSubRecipe,
  recipeUrl,
  type Visibility,
} from "./recipes/service";
import type { Services } from "./services";

const lang = z.enum(["ru", "en"]).optional().describe("Language of the returned text (default ru)");
const slug = slugSchema.describe("Recipe slug, as returned by search_recipes/list_recipes");

export const AUTHORING_GUIDE = `How to write a recipe for this cookbook:
- Recipes are bilingual: every text field is { ru?, en? }. Provide BOTH languages; structure (ingredients, quantities, steps) is shared.
- ${UNIT_POLICY_TEXT}
- Split the recipe into sections in cooking order. Prep that involves cooking (making a sauce, marinating meat) is its own section. Non-cooking prep (preheat oven, take butter out, soak beans overnight) goes to prepTasks with leadMin.
- Every ingredient has an id unique within the recipe. Put prep actions ("finely chopped", "room temperature") in ingredient.prep, not in the name.
- Ingredients that are prepped together and go into the pan at the same moment share a bowl: declare it in section.bowls and set ingredient.bowl.
- ${TOKEN_SYNTAX_TEXT} Reference every ingredient a step uses with {{ing:id}} so the cook view shows its quantity inline; add {{timer:…}} wherever the step says to wait or cook for a time.
- Multi-day processes (fermentation): one section per active stage, with waitAfterMin between them.
- Quantity ranges use qty.max. Use scaling "fixed" for things that should not scale (1 bay leaf) and "to-taste" (no qty) for salt and pepper.
- Set source.url to the original page/video; YouTube and social links are detected automatically. For a family recipe without a link, use source.label.
- A component recipe (sushi rice, a sauce, a dough) goes to subRecipes, not into a section. It renders collapsed before the main steps; to place it mid-way instead, mention it in the step where it is made: "While the dough rests, make {{recipe:<slug>}}" (cook mode opens it under that step).
- Slugs are lowercase latin words separated by dashes (e.g. "chicken-teriyaki"). New recipes are created as drafts; call publish_recipe when the user is happy.`;

function json(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

async function guarded(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DomainError)
      return { isError: true, content: [{ type: "text", text: JSON.stringify(e.toJSON(), null, 2) }] };
    throw e;
  }
}

function summary(r: RecipeSummary, l: Lang, editor: boolean) {
  return {
    slug: r.slug,
    title: t(r.title, l),
    ...(r.description && { description: t(r.description, l) }),
    tags: r.tags.map((tag) => t(tag, l)),
    url: recipeUrl(r.slug, l),
    ...(editor && { status: r.status }),
  };
}

function flattenSubRecipes(
  subs: ResolvedSubRecipe[],
  factor: number,
): { data: RecipeData; factor: number }[] {
  return subs.flatMap((s) => [
    { data: s.recipe, factor: factor * s.factor },
    ...flattenSubRecipes(s.subRecipes, factor * s.factor),
  ]);
}

/** One McpServer per request (stateless); the editor flavour adds write tools (ADR 0007). */
export function buildMcpServer(services: Services, principal: Principal | null): McpServer {
  const editor = principal !== null;
  const v: Visibility = editor ? EDITOR : PUBLIC;
  const r = services.recipes;
  const server = new McpServer(
    { name: editor ? "recipes-editor" : "recipes", version: "1.0.0" },
    {
      instructions: `Personal bilingual (RU/EN) cookbook at ${recipeUrl("", "ru").replace(/\/ru\/r\/$/, "")}. Search or list recipes, then fetch one; every result includes a url to share with the user. ${
        editor
          ? "You are authenticated as an editor and may create and edit recipes: call get_recipe_schema first and follow its guide."
          : "This endpoint is read-only."
      }`,
    },
  );

  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description:
        "Full-text search (Russian and English, tolerant to typos) with optional tag and ingredient filters, e.g. ingredients ['chicken', 'rice'] finds recipes containing both. Returns summaries with urls.",
      inputSchema: z.object({
        query: z.string().optional(),
        tags: z.array(z.string()).optional(),
        ingredients: z.array(z.string()).optional(),
        lang,
        limit: z.number().int().min(1).max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ query, tags, ingredients, lang: l = DEFAULT_LANG, limit }) =>
      guarded(async () => {
        const items = await r.search(v, {
          ...(query && { query }),
          ...(tags && { tags }),
          ...(ingredients && { ingredients }),
          ...(limit && { limit }),
        });
        return json({ recipes: items.map((i) => summary(i, l, editor)) });
      }),
  );

  server.registerTool(
    "list_recipes",
    {
      title: "List recipes",
      description: "All recipes alphabetically, optionally filtered by tag. Returns summaries with urls.",
      inputSchema: z.object({
        tag: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        lang,
      }),
      annotations: { readOnlyHint: true },
    },
    ({ tag, offset, limit, lang: l = DEFAULT_LANG }) =>
      guarded(async () => {
        const res = await r.list(v, {
          ...(tag && { tag }),
          ...(offset !== undefined && { offset }),
          ...(limit && { limit }),
        });
        return json({ total: res.total, recipes: res.items.map((i) => summary(i, l, editor)) });
      }),
  );

  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description: "Tags used across recipes with counts.",
      inputSchema: z.object({ lang }),
      annotations: { readOnlyHint: true },
    },
    ({ lang: l = DEFAULT_LANG }) =>
      guarded(async () =>
        json({ tags: (await r.tags(v)).map((x) => ({ tag: t(x.tag, l), count: x.count })) }),
      ),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description:
        "A full recipe. format=markdown (default) is compact and readable, with quantities scaled to `servings` and inlined into steps; format=json returns the structured document (use it before update_recipe).",
      inputSchema: z.object({
        slug,
        lang,
        servings: z.number().positive().optional(),
        format: z.enum(["markdown", "json"]).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ slug: s, lang: l = DEFAULT_LANG, servings, format = "markdown" }) =>
      guarded(async () => {
        const recipe = await r.get(s, v);
        const url = recipeUrl(s, l);
        if (format === "json") return json({ url, ...recipe });
        const subs = await r.resolveSubRecipes(recipe, v);
        const factor = (servings ?? recipe.servings.amount) / recipe.servings.amount;
        const parts = [
          recipeToMarkdown(recipe, {
            lang: l,
            ...(servings && { servings }),
            url,
            recipeUrl: (x) => recipeUrl(x, l),
          }),
          ...flattenSubRecipes(subs, factor).map((sub) =>
            recipeToMarkdown(sub.data, {
              lang: l,
              servings: sub.data.servings.amount * sub.factor,
              recipeUrl: (x) => recipeUrl(x, l),
            }).replace(/^# /, "## ↳ "),
          ),
        ];
        return text(parts.join("\n\n---\n\n"));
      }),
  );

  server.registerTool(
    "get_prep_list",
    {
      title: "Prep list (mise en place)",
      description:
        "What to prepare before cooking: tasks ordered by lead time, then each section's ingredients grouped by bowl, with scaled quantities and prep actions.",
      inputSchema: z.object({ slug, servings: z.number().positive().optional(), lang }),
      annotations: { readOnlyHint: true },
    },
    ({ slug: s, servings, lang: l = DEFAULT_LANG }) =>
      guarded(async () => {
        const recipe = await r.get(s, v);
        return text(
          `${prepListToMarkdown(recipe, { lang: l, ...(servings && { servings }) })}\n\n${recipeUrl(s, l)}`,
        );
      }),
  );

  server.registerTool(
    "shopping_list",
    {
      title: "Shopping list",
      description:
        "Groceries merged across one or more recipes (including their sub-recipes), quantities summed per unit.",
      inputSchema: z.object({
        items: z.array(z.object({ slug, servings: z.number().positive().optional() })).min(1),
        lang,
      }),
      annotations: { readOnlyHint: true },
    },
    ({ items, lang: l = DEFAULT_LANG }) =>
      guarded(async () => {
        const entries: { data: RecipeData; factor: number }[] = [];
        for (const item of items) {
          const recipe = await r.get(item.slug, v);
          const factor = (item.servings ?? recipe.servings.amount) / recipe.servings.amount;
          entries.push(
            { data: recipe, factor },
            ...flattenSubRecipes(await r.resolveSubRecipes(recipe, v), factor),
          );
        }
        return text(shoppingListToMarkdown(entries, l));
      }),
  );

  server.registerTool(
    "get_recipe_schema",
    {
      title: "Recipe format",
      description:
        "JSON Schema of the recipe document and the authoring guide. Read before create_recipe/update_recipe.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () =>
      guarded(async () =>
        json({
          schemaVersion: SCHEMA_VERSION,
          guide: AUTHORING_GUIDE,
          schema: z.toJSONSchema(recipeInputSchema, { io: "input", unrepresentable: "any" }),
        }),
      ),
  );

  if (!principal) return server;
  const actor = principal.actor;
  const recipeArg = z
    .record(z.string(), z.unknown())
    .describe(
      "Recipe document; see get_recipe_schema (the `recipe` property). Validation errors list exact paths.",
    );
  const status = z.enum(["draft", "published"]);
  const written = (recipe: { slug: string; status: string; version: number }) =>
    json({
      slug: recipe.slug,
      status: recipe.status,
      version: recipe.version,
      url: recipeUrl(recipe.slug, "ru"),
      urlEn: recipeUrl(recipe.slug, "en"),
    });

  server.registerTool(
    "create_recipe",
    {
      title: "Create recipe",
      description: `Create a recipe (draft unless status=published). ${UNIT_POLICY_TEXT}`,
      inputSchema: z.object({ slug, status: status.optional(), recipe: recipeArg }),
    },
    ({ slug: s, status: st, recipe }) =>
      guarded(async () => written(await r.create({ slug: s, ...(st && { status: st }), recipe }, actor))),
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Update recipe",
      description:
        "Replace a recipe document (fetch it with get_recipe format=json first). Pass expectedVersion from that response to avoid overwriting concurrent edits; newSlug renames.",
      inputSchema: z.object({
        slug,
        recipe: recipeArg,
        newSlug: slugSchema.optional(),
        status: status.optional(),
        expectedVersion: z.number().int().optional(),
      }),
    },
    ({ slug: s, recipe, newSlug, status: st, expectedVersion }) =>
      guarded(async () =>
        written(
          await r.update(
            s,
            {
              recipe,
              ...(newSlug && { slug: newSlug }),
              ...(st && { status: st }),
              ...(expectedVersion !== undefined && { expectedVersion }),
            },
            actor,
          ),
        ),
      ),
  );

  const lifecycle = (
    name: string,
    title: string,
    description: string,
    fn: (s: string) => Promise<{ slug: string; status: string; version: number }>,
    destructive = false,
  ) =>
    server.registerTool(
      name,
      { title, description, inputSchema: z.object({ slug }), annotations: { destructiveHint: destructive } },
      ({ slug: s }) => guarded(async () => written(await fn(s))),
    );
  lifecycle("publish_recipe", "Publish recipe", "Make a draft public.", (s) =>
    r.setStatus(s, "published", actor),
  );
  lifecycle("unpublish_recipe", "Unpublish recipe", "Turn a public recipe back into a draft.", (s) =>
    r.setStatus(s, "draft", actor),
  );
  lifecycle(
    "delete_recipe",
    "Delete recipe",
    "Soft-delete a recipe (restorable with restore_recipe).",
    (s) => r.remove(s, actor),
    true,
  );
  lifecycle("restore_recipe", "Restore recipe", "Restore a soft-deleted recipe.", (s) => r.restore(s, actor));

  server.registerTool(
    "upload_image",
    {
      title: "Upload image",
      description:
        "Upload a cover or source photo from a public url or base64 bytes; returns imageKey to use as recipe.cover.imageKey or source.imageKey. Max 10 MB, stored as WebP.",
      inputSchema: z.object({
        url: z.url().optional(),
        base64: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    },
    ({ url, base64 }) =>
      guarded(async () => {
        if (!url === !base64) throw new DomainError("validation", "Provide exactly one of url or base64");
        const result = url
          ? await services.images.uploadFromUrl(url, principal.user.id)
          : await services.images.upload(Buffer.from(base64 ?? "", "base64"), principal.user.id);
        return json(result);
      }),
  );

  return server;
}

/** Fetch handlers for /mcp (public) and /mcp/editor (OAuth or API token). */
export function createMcpEndpoints(services: Services) {
  const publicHandler = createMcpHandler(() => buildMcpServer(services, null));
  const editorHandler = createMcpHandler(({ authInfo }) =>
    buildMcpServer(services, (authInfo?.extra?.principal as Principal | undefined) ?? null),
  );

  const unauthorized = (message: string) =>
    Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource/mcp/editor", MCP_EDITOR_RESOURCE)}"`,
        },
      },
    );

  const viaOAuth = requireMcpAuth(
    auth,
    async (request, claims) => {
      const principal = await oauthPrincipal(claims);
      if (!principal) return unauthorized("Account is not an editor");
      return editorHandler.fetch(request, {
        authInfo: {
          token: "",
          clientId: principal.actor.ref ?? "",
          scopes: String(claims.scope ?? "")
            .split(" ")
            .filter(Boolean),
          extra: { principal },
        },
      });
    },
    { resource: MCP_EDITOR_RESOURCE },
  );

  return {
    public: (request: Request) => publicHandler.fetch(request),
    editor: async (request: Request) => {
      const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (token?.startsWith(API_KEY_PREFIX)) {
        const principal = await apiKeyPrincipal(token);
        if (!principal) return unauthorized("Invalid API token");
        return editorHandler.fetch(request, {
          authInfo: {
            token: "",
            clientId: `api-key:${principal.actor.ref}`,
            scopes: [],
            extra: { principal },
          },
        });
      }
      return viaOAuth(request);
    },
  };
}
