import { z } from "zod";
import { parseStepText, tokenSignature } from "./tokens";
import { IMPERIAL_HINTS, UNIT_POLICY_TEXT, UNITS, type Unit } from "./units";

export const SCHEMA_VERSION = 1;

const text = z.string().trim().min(1);
const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lowercase latin letters, digits and dashes")
  .max(40);
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "slug: lowercase latin words separated by dashes, e.g. chicken-teriyaki",
  )
  .max(80);

export const l10nSchema = z
  .strictObject({ ru: text.optional(), en: text.optional() })
  .refine((v) => v.ru !== undefined || v.en !== undefined, "at least one of ru/en is required")
  .describe("Localized text: { ru?, en? }, at least one. Provide both when possible.");

const minutes = z.number().int().nonnegative();

export const unitSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .superRefine((v, ctx) => {
    if ((UNITS as readonly string[]).includes(v)) return;
    const hint = IMPERIAL_HINTS[v];
    ctx.addIssue({
      code: "custom",
      message: hint
        ? `imperial unit "${v}" is not allowed: ${hint}`
        : `unknown unit "${v}". ${UNIT_POLICY_TEXT}`,
    });
  })
  .transform((v) => v as Unit)
  .describe(UNIT_POLICY_TEXT);

export const qtySchema = z
  .strictObject({ min: z.number().positive(), max: z.number().positive().optional() })
  .refine((q) => q.max === undefined || q.max > q.min, "qty.max must be greater than qty.min")
  .describe("Quantity; use max for ranges like 200-400 g");

const alternativeSchema = z.strictObject({
  name: l10nSchema,
  qty: qtySchema.optional(),
  unit: unitSchema.optional(),
  note: l10nSchema.optional(),
});

export const ingredientSchema = z
  .strictObject({
    id: id.describe("Stable id unique within the recipe, referenced from steps as {{ing:<id>}}"),
    name: l10nSchema,
    qty: qtySchema.optional(),
    unit: unitSchema.optional(),
    scaling: z
      .enum(["linear", "fixed", "to-taste"])
      .default("linear")
      .describe("linear scales with servings; fixed never scales (e.g. 1 bay leaf); to-taste has no qty"),
    prep: l10nSchema.optional().describe('Prep action, e.g. { ru: "тонко нарезать", en: "thinly sliced" }'),
    bowl: id.optional().describe("Id of a bowl in the same section: ingredients prepped together"),
    optional: z.boolean().default(false),
    alternatives: z.array(alternativeSchema).default([]).describe('Displayed as "or …", e.g. sake → water'),
  })
  .refine((i) => i.unit === undefined || i.qty !== undefined, "unit requires qty");

export const stepSchema = z.strictObject({
  id,
  text: l10nSchema.describe("Step text with tokens {{ing:id}}, {{timer:20m}}, {{recipe:slug}}"),
});

export const bowlSchema = z.strictObject({ id, label: l10nSchema.optional() });

export const sectionSchema = z.strictObject({
  id,
  title: l10nSchema.optional(),
  bowls: z.array(bowlSchema).default([]),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).default([]),
  waitAfterMin: minutes
    .positive()
    .optional()
    .describe("Passive wait after this section before the next one (e.g. fermentation: 4320 = 3 days)"),
});

export const prepTaskSchema = z.strictObject({
  id,
  text: l10nSchema,
  leadMin: minutes.optional().describe("How long before cooking to do it, in minutes (1440 = a day ahead)"),
});

export const SOURCE_KINDS = ["youtube", "web", "social", "photo", "text"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const sourceSchema = z
  .strictObject({
    kind: z.enum(SOURCE_KINDS).optional().describe("Detected from url when omitted"),
    url: z.url().optional(),
    label: l10nSchema.optional(),
    imageKey: z.string().min(1).optional().describe("For kind=photo: key returned by upload_image"),
  })
  .superRefine((s, ctx) => {
    const kind = s.kind ?? (s.url ? "web" : s.imageKey ? "photo" : "text");
    if ((kind === "youtube" || kind === "web" || kind === "social") && !s.url)
      ctx.addIssue({ code: "custom", message: `source.url is required for kind ${kind}` });
    if (kind === "photo" && !s.imageKey)
      ctx.addIssue({ code: "custom", message: "source.imageKey is required for kind photo" });
    if (kind === "text" && !s.label)
      ctx.addIssue({ code: "custom", message: "source.label is required for kind text" });
  });

const recipeDataBase = z.strictObject({
  title: l10nSchema,
  description: l10nSchema.optional(),
  servings: z.strictObject({
    amount: z.number().positive().describe("Default servings/yield the quantities are written for"),
    label: l10nSchema.optional().describe('Yield noun when not portions, e.g. { ru: "шт.", en: "pieces" }'),
  }),
  times: z
    .strictObject({
      prepMin: minutes.optional(),
      cookMin: minutes.optional(),
      passiveMin: minutes.optional(),
    })
    .optional(),
  tags: z.array(l10nSchema).max(30).default([]),
  cover: z.strictObject({ imageKey: z.string().min(1) }).optional(),
  source: sourceSchema.optional(),
  prepTasks: z
    .array(prepTaskSchema)
    .default([])
    .describe("Non-cooking prep: preheat oven, take butter out, …"),
  sections: z
    .array(sectionSchema)
    .min(1)
    .describe("Cooking sections in order; prep that involves cooking (sauce, marinade) is its own section"),
  subRecipes: z
    .array(z.strictObject({ slug: slugSchema, factor: z.number().positive().default(1) }))
    .default([])
    .describe("Recipes embedded collapsed on this page; scale with this recipe times factor"),
});

export const recipeDataSchema = recipeDataBase.superRefine(validateReferences);

export const recipeStatusSchema = z.enum(["draft", "published"]);
export type RecipeStatus = z.infer<typeof recipeStatusSchema>;

export type RecipeData = z.output<typeof recipeDataSchema>;
export type RecipeDataInput = z.input<typeof recipeDataSchema>;
export type Section = RecipeData["sections"][number];
export type Ingredient = Section["ingredients"][number];
export type Step = Section["steps"][number];
export type PrepTask = RecipeData["prepTasks"][number];
export type Source = NonNullable<RecipeData["source"]>;
export type Qty = z.output<typeof qtySchema>;

/** Stored/returned recipe: data plus identity and lifecycle. */
export type Recipe = RecipeData & {
  id: string;
  slug: string;
  status: RecipeStatus;
  version: number;
  updatedAt: string;
};

function validateReferences(r: z.output<typeof recipeDataBase>, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const unique = (ids: string[], path: (string | number)[], what: string) => {
    const seen = new Set<string>();
    for (const v of ids) {
      if (seen.has(v)) issue(path, `duplicate ${what} id "${v}"`);
      seen.add(v);
    }
  };

  const ingredientIds = new Set<string>();
  unique(
    r.sections.map((s) => s.id),
    ["sections"],
    "section",
  );
  unique(
    r.prepTasks.map((p) => p.id),
    ["prepTasks"],
    "prep task",
  );
  unique(
    r.sections.flatMap((s) => s.steps.map((st) => st.id)),
    ["sections"],
    "step",
  );
  unique(
    r.sections.flatMap((s) => s.ingredients.map((i) => i.id)),
    ["sections"],
    "ingredient",
  );
  for (const s of r.sections) for (const i of s.ingredients) ingredientIds.add(i.id);

  r.sections.forEach((section, si) => {
    const bowls = new Set(section.bowls.map((b) => b.id));
    unique([...section.bowls.map((b) => b.id)], ["sections", si, "bowls"], "bowl");
    section.ingredients.forEach((ing, ii) => {
      if (ing.bowl && !bowls.has(ing.bowl))
        issue(
          ["sections", si, "ingredients", ii, "bowl"],
          `bowl "${ing.bowl}" is not defined in section "${section.id}"`,
        );
    });
    section.steps.forEach((step, sti) => {
      const path = ["sections", si, "steps", sti, "text"];
      for (const lang of ["ru", "en"] as const) {
        const value = step.text[lang];
        if (!value) continue;
        const { segments, errors } = parseStepText(value);
        for (const e of errors) issue([...path, lang], `${e.message}: ${e.token}`);
        for (const seg of segments)
          if (seg.type === "ing" && !ingredientIds.has(seg.id))
            issue([...path, lang], `{{ing:${seg.id}}} references an unknown ingredient`);
      }
      if (step.text.ru && step.text.en && tokenSignature(step.text.ru) !== tokenSignature(step.text.en))
        issue(path, "RU and EN text must contain the same tokens");
    });
  });
}

export const recipeInputSchema = z.strictObject({
  slug: slugSchema,
  status: recipeStatusSchema.optional(),
  recipe: recipeDataSchema,
});

/** Detect the source kind from its url when not given (ADR 0009). */
export function detectSourceKind(source: Source): SourceKind {
  if (source.kind) return source.kind;
  if (source.url) {
    const host = new URL(source.url).hostname.replace(/^www\.|^m\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") return "youtube";
    if (
      /(^|\.)(instagram\.com|tiktok\.com|facebook\.com|vk\.com|t\.me|x\.com|twitter\.com|pinterest\.com)$/.test(
        host,
      )
    )
      return "social";
    return "web";
  }
  return source.imageKey ? "photo" : "text";
}

export function youtubeId(url: string): string | null {
  const u = new URL(url);
  if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1) || null;
  if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/"))
    return u.pathname.split("/")[2] ?? null;
  return u.searchParams.get("v");
}

/** Normalize derived fields before storing. */
export function normalizeRecipeData(data: RecipeData): RecipeData {
  return data.source ? { ...data, source: { ...data.source, kind: detectSourceKind(data.source) } } : data;
}
