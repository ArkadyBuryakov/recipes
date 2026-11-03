// Process entrypoint. Development: Vite middleware (HMR, SSR module graph) in front of the Hono app.
// Production: Bun.serve with static assets from build/client and the bundled app from build/server.
import type { Hono } from "hono";

type AppModule = { app: Hono; init: () => Promise<void>; cli: (args: string[]) => Promise<number> };

const PORT = Number(process.env.PORT ?? 3000);

if (process.argv[2] === "cli") {
  // Admin commands, e.g. `bun server.ts cli reset-link me@example.com` (in the container: production build).
  const mod: AppModule =
    process.env.NODE_ENV === "production"
      ? // @ts-ignore: produced by `react-router build`
        await import("./build/server/index.js")
      : await import("./server/app-cli");
  process.exit(await mod.cli(process.argv.slice(3)));
} else if (process.env.NODE_ENV === "production") {
  const { serveStatic } = await import("hono/bun");
  const { Hono } = await import("hono");
  // @ts-expect-error: produced by `react-router build`
  const mod: AppModule = await import("./build/server/index.js");
  await mod.init();

  const outer = new Hono();
  outer.use(
    "/assets/*",
    serveStatic({
      root: "./build/client",
      onFound: (_path, c) => c.header("Cache-Control", "public, max-age=31536000, immutable"),
    }),
  );
  outer.use("*", serveStatic({ root: "./build/client" }));
  outer.route("/", mod.app);

  Bun.serve({ port: PORT, fetch: outer.fetch, idleTimeout: 120 });
  console.log(`recipes listening on :${PORT}`);
} else {
  const { createServer } = await import("node:http");
  const { createServer: createVite } = await import("vite");
  const { getRequestListener } = await import("@hono/node-server");

  const httpServer = createServer();
  const vite = await createVite({ server: { middlewareMode: true, hmr: { server: httpServer } } });
  const load = () => vite.ssrLoadModule("./server/app.ts") as Promise<AppModule>;
  await (await load()).init();

  const listener = getRequestListener(async (request) => {
    try {
      return await (await load()).app.fetch(request);
    } catch (error) {
      if (error instanceof Error) vite.ssrFixStacktrace(error);
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
  httpServer.on("request", (req, res) => vite.middlewares(req, res, () => listener(req, res)));
  httpServer.listen(PORT, () => console.log(`recipes dev server on :${PORT}`));
}
