export const LANGS = ["ru", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ru";

export type L10n = { ru?: string; en?: string };

export function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en";
}

export function otherLang(lang: Lang): Lang {
  return lang === "ru" ? "en" : "ru";
}

/** Text in the requested language, falling back to the other one (ADR 0003). */
export function pick(value: L10n | undefined, lang: Lang): { text: string; fallback: boolean } {
  const own = value?.[lang];
  if (own) return { text: own, fallback: false };
  const other = value?.[otherLang(lang)];
  return { text: other ?? "", fallback: Boolean(other) };
}

export function t(value: L10n | undefined, lang: Lang): string {
  return pick(value, lang).text;
}
