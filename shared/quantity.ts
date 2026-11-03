import type { Lang } from "./l10n";
import type { Ingredient, Qty } from "./recipe";
import { FRACTION_UNITS, type Unit, unitLabel } from "./units";

export function scaleQty(
  qty: Qty | undefined,
  factor: number,
  scaling: Ingredient["scaling"],
): Qty | undefined {
  if (!qty || scaling !== "linear" || factor === 1) return qty;
  return { min: qty.min * factor, ...(qty.max !== undefined && { max: qty.max * factor }) };
}

/** Promote g→kg and ml→l once the larger end reaches 1000 (ADR 0004). */
export function promote(qty: Qty, unit: Unit | undefined): { qty: Qty; unit: Unit | undefined } {
  const top = qty.max ?? qty.min;
  const next = unit === "g" ? "kg" : unit === "ml" ? "l" : undefined;
  if (!next || top < 1000) return { qty, unit };
  return { qty: { min: qty.min / 1000, ...(qty.max !== undefined && { max: qty.max / 1000 }) }, unit: next };
}

const FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

function fraction(n: number): string | null {
  const whole = Math.floor(n);
  const rest = n - whole;
  let best: [number, string] = [0, ""];
  for (const f of FRACTIONS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
  if (Math.abs(best[0] - rest) > 0.05) return null;
  const w = best[0] === 1 ? whole + 1 : whole;
  if (!w && !best[1]) return null;
  return `${w || ""}${best[1]}`;
}

export function formatNumber(n: number, unit: Unit | undefined, lang: Lang): string {
  if (unit && FRACTION_UNITS.has(unit)) {
    const f = fraction(n);
    if (f) return f;
  }
  const digits = n >= 10 ? 0 : n >= 1 ? 1 : 2;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(n);
}

/** "750–1000 г", "1½ tbsp", "3" (count), "" when no quantity. */
export function formatQty(qty: Qty | undefined, unit: Unit | undefined, lang: Lang): string {
  if (!qty) return "";
  const p = promote(qty, unit);
  const min = formatNumber(p.qty.min, p.unit, lang);
  const max = p.qty.max !== undefined ? formatNumber(p.qty.max, p.unit, lang) : undefined;
  const amount = max !== undefined && max !== min ? `${min}–${max}` : min;
  if (!p.unit) return amount;
  return `${amount} ${unitLabel(p.unit, p.qty.max ?? p.qty.min, lang)}`;
}

/** Quantity text for an ingredient at a given scale factor. */
export function formatIngredientQty(ing: Ingredient, factor: number, lang: Lang): string {
  return formatQty(scaleQty(ing.qty, factor, ing.scaling), ing.unit, lang);
}
