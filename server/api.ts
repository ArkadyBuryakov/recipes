import { Hono } from "hono";
import sharp from "sharp";
import { sessionPrincipal } from "./access";
import { env } from "./env";
import { DomainError } from "./errors";
import { PUBLIC } from "./recipes/service";
import type { Services } from "./services";

const THUMB_WIDTHS = new Set([200, 600, 1200]);

/** JSON/HTTP endpoints that are not pages: images, push timers, offline manifest, SEO files. */
export function createApi(services: Services) {
  const api = new Hono();

  api.onError((err, c) => {
    if (err instanceof DomainError) return c.json(err.toJSON(), err.status as 400);
    console.error(err);
    return c.json({ error: "internal", message: "Internal error" }, 500);
  });

  api.post("/api/timers", async (c) => {
    await services.push.schedule(await c.req.json());
    return c.body(null, 204);
  });
  api.delete("/api/timers/:id", async (c) => {
    await services.push.cancel(c.req.param("id"));
    return c.body(null, 204);
  });

  api.post("/api/images", async (c) => {
    const principal = await sessionPrincipal(c.req.raw.headers);
    if (!principal) throw new DomainError("unauthorized", "Login required");
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("validation", "Expected a file field");
    return c.json(await services.images.upload(new Uint8Array(await file.arrayBuffer()), principal.user.id));
  });

  api.get("/img/:key{.+}", async (c) => {
    const image = await services.images.get(c.req.param("key"));
    if (!image) return c.notFound();
    const w = Number(c.req.query("w"));
    const bytes = THUMB_WIDTHS.has(w)
      ? await sharp(image.bytes)
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer()
      : image.bytes;
    return c.body(new Uint8Array(bytes), 200, {
      "Content-Type": "image/webp",
      // Keys are content-addressed (never overwritten), so they cache forever.
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });

  /** URLs the service worker caches for offline use (ADR 0010): every published recipe, both languages. */
  api.get("/api/offline", async (c) => {
    const { items } = await services.recipes.list(PUBLIC, { limit: 200 });
    const version =
      items
        .map((r) => r.updatedAt)
        .sort()
        .at(-1) ?? "";
    const pages = ["ru", "en"].flatMap((l) => [`/${l}`, ...items.map((r) => `/${l}/r/${r.slug}`)]);
    const images = items.flatMap((r) => (r.cover ? [`/img/${r.cover.imageKey}?w=600`] : []));
    return c.json({ version, pages, images }, 200, { "Cache-Control": "no-store" });
  });

  api.get("/robots.txt", (c) =>
    c.text(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /login",
        "Disallow: /consent",
        "Disallow: /invite/",
        "Disallow: /reset/",
        "Disallow: /*/new",
        "Disallow: /*/edit",
        "Disallow: /*/history",
        `Sitemap: ${env.PUBLIC_URL}/sitemap.xml`,
      ].join("\n"),
    ),
  );

  api.get("/sitemap.xml", async (c) => {
    const { items } = await services.recipes.list(PUBLIC, { limit: 200 });
    const entry = (path: string, lastmod?: string) =>
      `<url><loc>${env.PUBLIC_URL}/ru${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}` +
      `<xhtml:link rel="alternate" hreflang="ru" href="${env.PUBLIC_URL}/ru${path}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${env.PUBLIC_URL}/en${path}"/></url>` +
      `<url><loc>${env.PUBLIC_URL}/en${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}` +
      `<xhtml:link rel="alternate" hreflang="ru" href="${env.PUBLIC_URL}/ru${path}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${env.PUBLIC_URL}/en${path}"/></url>`;
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entry("")}${items.map((r) => entry(`/r/${r.slug}`, r.updatedAt.slice(0, 10))).join("")}</urlset>`;
    return c.body(body, 200, { "Content-Type": "application/xml" });
  });

  return api;
}
