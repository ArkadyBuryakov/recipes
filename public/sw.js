// Service worker (ADR 0010): offline cookbook + kitchen timer push notifications.
const SHELL = "shell-v1";
const PAGES = "pages-v1";
const IMAGES = "images-v1";
const KEEP = [SHELL, PAGES, IMAGES];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isPage = (url) => /^\/(ru|en)(\/|$|\.data)/.test(url.pathname);
const dataUrl = (path) => `${path === "/" ? "/_root" : path}.data`;

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(request)) ?? (await cache.match(request, { ignoreSearch: true }));
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/assets/")) return event.respondWith(cacheFirst(SHELL, request));
  if (url.pathname.startsWith("/img/")) return event.respondWith(cacheFirst(IMAGES, request));
  if (isPage(url)) return event.respondWith(networkFirst(request));
});

/** Prefetch every published recipe page (HTML + route data) and the assets they reference. */
async function syncOffline() {
  const res = await fetch("/api/offline", { cache: "no-store" });
  if (!res.ok) return;
  const { version, pages, images } = await res.json();
  const meta = await caches.open(SHELL);
  const prev = await meta.match("/__offline-version");
  if (prev && (await prev.text()) === version) return;
  const cache = await caches.open(PAGES);
  const assets = new Set();
  const queue = pages.flatMap((p) => [p, dataUrl(p)]);
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const r = await fetch(path, { credentials: "same-origin" });
        if (!r.ok) continue;
        if (!path.endsWith(".data")) {
          const html = await r.clone().text();
          for (const m of html.matchAll(/\/assets\/[^"'\s)]+/g)) assets.add(m[0]);
        }
        await cache.put(path, r);
      } catch {
        // offline mid-sync: the next visit retries
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const shell = await caches.open(SHELL);
  await Promise.all(
    [...assets].map((a) => shell.match(a).then((hit) => hit ?? shell.add(a).catch(() => {}))),
  );
  const img = await caches.open(IMAGES);
  await Promise.all(images.map((i) => img.match(i).then((hit) => hit ?? img.add(i).catch(() => {}))));
  await meta.put("/__offline-version", new Response(version));
}

self.addEventListener("message", (event) => {
  if (event.data === "sync") event.waitUntil(syncOffline().catch(() => {}));
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      // The open page rings by itself; only notify when nobody is looking.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((w) => w.visibilityState === "visible" && w.focused)) return;
      await self.registration.showNotification(`⏱ ${data.title ?? "Timer"}`, {
        body: data.body || "",
        tag: data.tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 150, 300, 150, 600],
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((w) => new URL(w.url).pathname === url) ?? windows[0];
      if (same) {
        await same.focus();
        if (new URL(same.url).pathname !== url) await same.navigate(url);
      } else await self.clients.openWindow(url);
    })(),
  );
});
