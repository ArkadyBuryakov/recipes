import type { Lang } from "./l10n";

export const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "pinch",
  "dash",
  "handful",
  "clove",
  "stalk",
  "slice",
  "piece",
  "bunch",
  "can",
  "sprig",
] as const;

export type Unit = (typeof UNITS)[number];

/** Imperial units are rejected on write with this conversion hint (ADR 0004). */
export const IMPERIAL_HINTS: Record<string, string> = {
  oz: "convert to g (1 oz = 28.35 g)",
  ounce: "convert to g (1 oz = 28.35 g)",
  ounces: "convert to g (1 oz = 28.35 g)",
  lb: "convert to g (1 lb = 453.6 g)",
  lbs: "convert to g (1 lb = 453.6 g)",
  pound: "convert to g (1 lb = 453.6 g)",
  pounds: "convert to g (1 lb = 453.6 g)",
  "fl oz": "convert to ml (1 fl oz = 29.57 ml)",
  floz: "convert to ml (1 fl oz = 29.57 ml)",
  pint: "convert to ml (1 US pint = 473 ml)",
  pt: "convert to ml (1 US pint = 473 ml)",
  quart: "convert to ml (1 US quart = 946 ml)",
  qt: "convert to ml (1 US quart = 946 ml)",
  gallon: "convert to l (1 US gallon = 3.785 l)",
  gal: "convert to l (1 US gallon = 3.785 l)",
};

export const UNIT_POLICY_TEXT = `Allowed units: ${UNITS.join(", ")}; omit unit for plain counts (e.g. 3 eggs). Imperial units (oz, lb, fl oz, pint, quart, gallon) are rejected: convert them to g/ml/l first. Cups and spoons are kept as measures.`;

/** Spoons and cups render as common fractions (ADR 0004). */
export const FRACTION_UNITS: ReadonlySet<Unit> = new Set(["tsp", "tbsp", "cup"]);

type Forms = { one: string; few?: string; many?: string };

const LABELS: Record<Lang, Record<Unit, Forms>> = {
  en: {
    g: { one: "g" },
    kg: { one: "kg" },
    ml: { one: "ml" },
    l: { one: "l" },
    tsp: { one: "tsp" },
    tbsp: { one: "tbsp" },
    cup: { one: "cup", many: "cups" },
    pinch: { one: "pinch", many: "pinches" },
    dash: { one: "dash", many: "dashes" },
    handful: { one: "handful", many: "handfuls" },
    clove: { one: "clove", many: "cloves" },
    stalk: { one: "stalk", many: "stalks" },
    slice: { one: "slice", many: "slices" },
    piece: { one: "piece", many: "pieces" },
    bunch: { one: "bunch", many: "bunches" },
    can: { one: "can", many: "cans" },
    sprig: { one: "sprig", many: "sprigs" },
  },
  ru: {
    g: { one: "г" },
    kg: { one: "кг" },
    ml: { one: "мл" },
    l: { one: "л" },
    tsp: { one: "ч. л." },
    tbsp: { one: "ст. л." },
    cup: { one: "чашка", few: "чашки", many: "чашек" },
    pinch: { one: "щепотка", few: "щепотки", many: "щепоток" },
    dash: { one: "капля", few: "капли", many: "капель" },
    handful: { one: "горсть", few: "горсти", many: "горстей" },
    clove: { one: "зубчик", few: "зубчика", many: "зубчиков" },
    stalk: { one: "стебель", few: "стебля", many: "стеблей" },
    slice: { one: "ломтик", few: "ломтика", many: "ломтиков" },
    piece: { one: "шт." },
    bunch: { one: "пучок", few: "пучка", many: "пучков" },
    can: { one: "банка", few: "банки", many: "банок" },
    sprig: { one: "веточка", few: "веточки", many: "веточек" },
  },
};

function pluralCategory(n: number, lang: Lang): keyof Forms {
  if (lang === "en") return n <= 1 ? "one" : "many";
  // Fractions and ranges read as genitive singular in Russian ("1,5 чашки"), which is the "few" form.
  if (!Number.isInteger(n)) return "few";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

/** Unit label agreeing with the (last) number shown before it. */
export function unitLabel(unit: Unit, amount: number, lang: Lang): string {
  const forms = LABELS[lang][unit];
  const cat = pluralCategory(amount, lang);
  return forms[cat] ?? (cat === "few" ? forms.many : undefined) ?? forms.one;
}
