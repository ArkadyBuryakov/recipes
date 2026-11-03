import { type Lang, t } from "./l10n";
import { formatQty, scaleQty } from "./quantity";
import type { Ingredient, PrepTask, Qty, RecipeData, Section } from "./recipe";
import type { Unit } from "./units";

export type PrepItem = { ingredient: Ingredient; qty: Qty | undefined };
export type PrepBowl = { id: string; label: Section["bowls"][number]["label"]; items: PrepItem[] };
export type PrepSection = { section: Section; bowls: PrepBowl[]; loose: PrepItem[] };
export type PrepList = { tasks: PrepTask[]; sections: PrepSection[] };

/** Prep mode (ADR 0008): by section, then bowls, then the rest as a flat list. No cross-section merging. */
export function buildPrepList(data: RecipeData, factor: number): PrepList {
  const tasks = [...data.prepTasks].sort((a, b) => (b.leadMin ?? -1) - (a.leadMin ?? -1));
  const sections = data.sections
    .filter((s) => s.ingredients.length > 0)
    .map((section) => {
      const item = (ingredient: Ingredient): PrepItem => ({
        ingredient,
        qty: scaleQty(ingredient.qty, factor, ingredient.scaling),
      });
      const bowls = section.bowls
        .map((b) => ({
          id: b.id,
          label: b.label,
          items: section.ingredients.filter((i) => i.bowl === b.id).map(item),
        }))
        .filter((b) => b.items.length > 0);
      const loose = section.ingredients.filter((i) => !i.bowl).map(item);
      return { section, bowls, loose };
    });
  return { tasks, sections };
}

export type ShoppingAmount = { qty: Qty; unit: Unit | undefined };
export type ShoppingItem = {
  key: string;
  name: string;
  amounts: ShoppingAmount[];
  /** Some occurrences have no quantity ("to taste", unspecified). */
  unquantified: boolean;
  optional: boolean;
};

const BASE: Partial<Record<Unit, { unit: Unit; factor: number }>> = {
  kg: { unit: "g", factor: 1000 },
  l: { unit: "ml", factor: 1000 },
};

export function nameKey(name: string): string {
  return name.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Grocery list merged across sections and recipes (ADR 0004): same normalized name in the
 * requested language, quantities summed per unit (kg/g and l/ml are combined), other units listed side by side.
 */
export function buildShoppingList(
  entries: { data: RecipeData; factor: number }[],
  lang: Lang,
): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();
  for (const { data, factor } of entries) {
    for (const section of data.sections) {
      for (const ing of section.ingredients) {
        const name = t(ing.name, lang);
        const key = nameKey(name);
        const item = items.get(key) ?? { key, name, amounts: [], unquantified: false, optional: true };
        item.optional &&= ing.optional;
        const qty = scaleQty(ing.qty, factor, ing.scaling);
        if (!qty) item.unquantified = true;
        else {
          const base = ing.unit ? BASE[ing.unit] : undefined;
          const unit = base?.unit ?? ing.unit;
          const k = base?.factor ?? 1;
          const min = qty.min * k;
          const max = (qty.max ?? qty.min) * k;
          const existing = item.amounts.find((a) => a.unit === unit);
          if (existing) {
            existing.qty = { min: existing.qty.min + min, max: (existing.qty.max ?? existing.qty.min) + max };
          } else item.amounts.push({ unit, qty: { min, max } });
        }
        items.set(key, item);
      }
    }
  }
  for (const item of items.values())
    for (const a of item.amounts) if (a.qty.max === a.qty.min) a.qty = { min: a.qty.min };
  return [...items.values()];
}

export function formatShoppingAmounts(item: ShoppingItem, lang: Lang): string {
  return item.amounts.map((a) => formatQty(a.qty, a.unit, lang)).join(" + ");
}
