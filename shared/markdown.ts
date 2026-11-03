import { type Lang, t } from "./l10n";
import { buildPrepList, buildShoppingList, formatShoppingAmounts } from "./prep";
import { formatIngredientQty, formatQty } from "./quantity";
import { detectSourceKind, type Ingredient, type RecipeData } from "./recipe";
import { formatDuration, parseStepText } from "./tokens";

const L = {
  ru: {
    servings: "Порции",
    prep: "Подготовка",
    cook: "Готовка",
    tasks: "Заранее",
    ingredients: "Ингредиенты",
    steps: "Шаги",
    source: "Источник",
    optional: "по желанию",
    or: "или",
    toTaste: "по вкусу",
    wait: "Ожидание",
    sub: "Вложенные рецепты",
    ahead: "заранее",
  },
  en: {
    servings: "Servings",
    prep: "Prep",
    cook: "Cook",
    tasks: "Ahead",
    ingredients: "Ingredients",
    steps: "Steps",
    source: "Source",
    optional: "optional",
    or: "or",
    toTaste: "to taste",
    wait: "Wait",
    sub: "Sub-recipes",
    ahead: "ahead",
  },
} as const;

/** Plain-text step with ingredient quantities inlined: "Add ginger (10 g)". */
export function renderStepText(
  text: string,
  ingredients: Map<string, Ingredient>,
  factor: number,
  lang: Lang,
  recipeUrl?: (slug: string) => string,
): string {
  return parseStepText(text)
    .segments.map((s) => {
      if (s.type === "text") return s.value;
      if (s.type === "timer") return formatDuration(s.seconds, lang);
      if (s.type === "recipe") return recipeUrl ? `[${s.slug}](${recipeUrl(s.slug)})` : s.slug;
      const ing = ingredients.get(s.id);
      if (!ing) return s.id;
      const qty = formatIngredientQty(ing, factor, lang);
      return qty ? `${t(ing.name, lang)} (${qty})` : t(ing.name, lang);
    })
    .join("");
}

export function ingredientLine(ing: Ingredient, factor: number, lang: Lang): string {
  const l = L[lang];
  const qty = formatIngredientQty(ing, factor, lang);
  const parts = [qty ? `${t(ing.name, lang)}: ${qty}` : t(ing.name, lang)];
  if (ing.scaling === "to-taste" && !qty) parts[0] += ` (${l.toTaste})`;
  if (ing.prep) parts.push(t(ing.prep, lang));
  if (ing.optional) parts.push(l.optional);
  const alts = ing.alternatives.map((a) =>
    [t(a.name, lang), formatQty(a.qty, a.unit, lang)].filter(Boolean).join(" "),
  );
  if (alts.length) parts.push(`${l.or} ${alts.join(` ${l.or} `)}`);
  return parts.join(" — ");
}

export type MarkdownOptions = {
  lang: Lang;
  servings?: number;
  url?: string;
  recipeUrl?: (slug: string) => string;
};

export function recipeToMarkdown(data: RecipeData, opts: MarkdownOptions): string {
  const { lang } = opts;
  const l = L[lang];
  const servings = opts.servings ?? data.servings.amount;
  const factor = servings / data.servings.amount;
  const ingredients = new Map(data.sections.flatMap((s) => s.ingredients.map((i) => [i.id, i] as const)));
  const out: string[] = [`# ${t(data.title, lang)}`];
  if (data.description) out.push(t(data.description, lang));
  const meta = [`${l.servings}: ${servings}${data.servings.label ? ` ${t(data.servings.label, lang)}` : ""}`];
  if (data.times?.prepMin) meta.push(`${l.prep}: ${formatDuration(data.times.prepMin * 60, lang)}`);
  if (data.times?.cookMin) meta.push(`${l.cook}: ${formatDuration(data.times.cookMin * 60, lang)}`);
  if (data.times?.passiveMin) meta.push(`${l.wait}: ${formatDuration(data.times.passiveMin * 60, lang)}`);
  out.push(meta.join(" · "));
  if (opts.url) out.push(opts.url);
  if (data.source) {
    const kind = detectSourceKind(data.source);
    const label = data.source.label ? t(data.source.label, lang) : "";
    const value = data.source.url
      ? label
        ? `[${label}](${data.source.url})`
        : data.source.url
      : label || kind;
    out.push(`${l.source}: ${value}`);
  }

  if (data.prepTasks.length) {
    out.push(`\n## ${l.tasks}`);
    for (const task of buildPrepList(data, factor).tasks) {
      const lead = task.leadMin ? ` (${formatDuration(task.leadMin * 60, lang)} ${l.ahead})` : "";
      out.push(`- ${t(task.text, lang)}${lead}`);
    }
  }

  for (const section of data.sections) {
    const title = section.title ? t(section.title, lang) : data.sections.length > 1 ? section.id : "";
    if (title) out.push(`\n## ${title}`);
    if (section.ingredients.length) {
      out.push(`\n### ${l.ingredients}`);
      for (const bowl of section.bowls) {
        const items = section.ingredients.filter((i) => i.bowl === bowl.id);
        if (!items.length) continue;
        out.push(`- **${bowl.label ? t(bowl.label, lang) : bowl.id}**`);
        for (const i of items) out.push(`  - ${ingredientLine(i, factor, lang)}`);
      }
      for (const i of section.ingredients.filter((i) => !i.bowl))
        out.push(`- ${ingredientLine(i, factor, lang)}`);
    }
    if (section.steps.length) {
      out.push(`\n### ${l.steps}`);
      section.steps.forEach((step, n) => {
        out.push(
          `${n + 1}. ${renderStepText(t(step.text, lang), ingredients, factor, lang, opts.recipeUrl)}`,
        );
      });
    }
    if (section.waitAfterMin) out.push(`\n_${l.wait}: ${formatDuration(section.waitAfterMin * 60, lang)}_`);
  }

  if (data.subRecipes.length) {
    out.push(`\n## ${l.sub}`);
    for (const s of data.subRecipes) {
      const link = opts.recipeUrl ? `[${s.slug}](${opts.recipeUrl(s.slug)})` : s.slug;
      out.push(`- ${link}${s.factor !== 1 ? ` ×${s.factor}` : ""}`);
    }
  }
  return out.join("\n");
}

export function shoppingListToMarkdown(entries: { data: RecipeData; factor: number }[], lang: Lang): string {
  return buildShoppingList(entries, lang)
    .map((i) => {
      const amounts = formatShoppingAmounts(i, lang);
      const extra = [i.unquantified && amounts ? "+" : "", i.optional ? `(${L[lang].optional})` : ""]
        .filter(Boolean)
        .join(" ");
      return `- ${i.name}${amounts ? `: ${amounts}` : ""}${extra ? ` ${extra}` : ""}`;
    })
    .join("\n");
}
