/**
 * Step text tokens (ADR 0002):
 *   {{ing:<ingredient-id>}}   inline ingredient with scaled quantity
 *   {{timer:<duration>}}      tappable timer, duration like 45s, 20m, 1h30m, 2d
 *   {{recipe:<slug>}}         link to another recipe
 */
export type Segment =
  | { type: "text"; value: string }
  | { type: "ing"; id: string }
  | { type: "timer"; seconds: number; raw: string }
  | { type: "recipe"; slug: string };

export type TokenError = { token: string; message: string };

const TOKEN_RE = /\{\{\s*([a-z]+)\s*:\s*([^}]*?)\s*\}\}/g;
const DURATION_RE = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

export const TOKEN_SYNTAX_TEXT =
  "Step text tokens: {{ing:<ingredient id>}} renders the ingredient name with its scaled quantity; {{timer:<duration>}} renders a timer, durations like 45s, 20m, 1h30m, 2d; {{recipe:<slug>}} links another recipe. RU and EN texts of a step must contain the same tokens.";

export function parseDuration(raw: string): number | null {
  const m = DURATION_RE.exec(raw);
  if (!m || raw === "") return null;
  const [, d, h, min, s] = m;
  const seconds = Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
  return seconds > 0 ? seconds : null;
}

export function parseStepText(text: string): { segments: Segment[]; errors: TokenError[] } {
  const segments: Segment[] = [];
  const errors: TokenError[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const [token, kind = "", arg = ""] = match;
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", value: text.slice(last, index) });
    last = index + token.length;
    if (kind === "ing" && /^[a-z0-9][a-z0-9-]*$/.test(arg)) segments.push({ type: "ing", id: arg });
    else if (kind === "recipe" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(arg))
      segments.push({ type: "recipe", slug: arg });
    else if (kind === "timer") {
      const seconds = parseDuration(arg);
      if (seconds) segments.push({ type: "timer", seconds, raw: arg });
      else errors.push({ token, message: `invalid duration "${arg}" (use e.g. 45s, 20m, 1h30m, 2d)` });
    } else if (kind === "ing" || kind === "recipe")
      errors.push({ token, message: `invalid ${kind} reference "${arg}"` });
    else errors.push({ token, message: `unknown token kind "${kind}" (allowed: ing, timer, recipe)` });
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  if (/\{\{|\}\}/.test(text.replace(TOKEN_RE, "")))
    errors.push({ token: text, message: "unbalanced {{ }} in step text" });
  return { segments, errors };
}

/** Canonical, order-independent token signature used to check that RU and EN steps agree. */
export function tokenSignature(text: string): string {
  return parseStepText(text)
    .segments.filter((s) => s.type !== "text")
    .map((s) =>
      s.type === "ing" ? `ing:${s.id}` : s.type === "recipe" ? `recipe:${s.slug}` : `timer:${s.seconds}`,
    )
    .sort()
    .join(",");
}

export function formatDuration(seconds: number, lang: "ru" | "en"): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const u = lang === "ru" ? { d: "д", h: "ч", m: "мин", s: "с" } : { d: "d", h: "h", m: "min", s: "s" };
  return [d && `${d} ${u.d}`, h && `${h} ${u.h}`, m && `${m} ${u.m}`, s && `${s} ${u.s}`]
    .filter(Boolean)
    .join(" ");
}
