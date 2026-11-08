import type { RecipeData } from "@shared/recipe";

/** Share links that hide the video id behind a redirect (ADR 0009). */
const SHORT_LINK =
  /^https?:\/\/(?:(?:www\.|m\.|web\.)?facebook\.com\/share\/[rv]\/|fb\.watch\/|(?:vm|vt)\.tiktok\.com\/)/i;

export function isShortVideoLink(url: string): boolean {
  return SHORT_LINK.test(url);
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Follow a short share link's redirects to the canonical video URL, dropping tracking query params
 * (keeping `v`, which carries the id of `/watch?v=` links). Returns the original url on any failure.
 */
export async function resolveShortLink(url: string, fetchFn: Fetch = fetch): Promise<string> {
  if (!isShortVideoLink(url)) return url;
  let current = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetchFn(current, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) break;
      current = new URL(location, current).toString();
      if (!isShortVideoLink(current)) break;
    }
  } catch {
    return url;
  }
  if (current === url || isShortVideoLink(current)) return url;
  const u = new URL(current);
  const v = u.searchParams.get("v");
  u.search = v ? `?v=${v}` : "";
  u.hash = "";
  return u.toString();
}

/** Replace a short share link in `source.url` with the video it points to. */
export async function resolveSourceUrl(data: RecipeData, fetchFn?: Fetch): Promise<RecipeData> {
  const url = data.source?.url;
  if (!data.source || !url || !isShortVideoLink(url)) return data;
  const resolved = await resolveShortLink(url, fetchFn);
  return resolved === url ? data : { ...data, source: { ...data.source, url: resolved } };
}
