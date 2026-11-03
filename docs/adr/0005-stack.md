# 0005. Stack: single Bun service, React Router SSR

**Status:** Accepted

## Context

You want: better-auth, a TypeScript backend, React + Vite, **full SSR** for indexing and link previews (round-2 D1), **Bun** as runtime and package manager (D2), the MCP in the same service, Postgres, and to keep it small. The CAX11 is ARM64, 2 vCPU, 4 GB.

## Decision

- **One app, one process, one port.**
  - **Hono** on Bun is the HTTP server. It mounts:
    - better-auth at `/api/auth/*`
    - the JSON API at `/api/*`
    - MCP at `/mcp` and `/mcp/editor` (0007)
    - `/healthz`
    - everything else → **React Router v7 (framework mode, SSR)** request handler
  - Vite builds both the client and the SSR bundle.
- **Layout:** a single package, so the monorepo adds no ceremony.
  - `app/`: React Router routes, components, i18n
  - `server/`: Hono, auth, MCP, DB, domain services
  - `shared/`: Zod recipe schema (0002), units, scaling, formatting. Pure, and used everywhere.
- **Libraries:**
  - **DB:** Postgres + Drizzle ORM + drizzle-kit migrations (run on start)
  - **Auth:** better-auth (email + password, admin, organization-less invites, OIDC/MCP provider, API keys)
  - **MCP:** MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), `createMcpHandler`: 2026-07-28 protocol plus
    stateless serving of 2025-era clients from the same factory
  - **UI:** Tailwind CSS v4 with a handful of hand-rolled components (`app/app.css` component classes). shadcn/Radix
    was dropped: the UI needs no complex primitives, and fewer dependencies keep the client bundle small.
  - **PWA:** a hand-written service worker (`public/sw.js`). `vite-plugin-pwa` targets static builds and adds little with SSR.
  - **Lint/format:** Biome. **Tests:** `bun test` for unit/integration, Playwright for e2e (0013).
- Rendering: public pages are SSR'd with `<title>`, meta/OG tags, and JSON-LD `Recipe` for rich results. Editor routes are SSR'd too, but auth-gated and `noindex`.

## Consequences

- If a dependency breaks on Bun, the Bun-compat risk falls on the React Router SSR handler and the MCP SDK. Both currently work on Bun. Integration tests run on Bun, so any break shows up in CI.
- Offline (0010) and SSR coexist: the service worker serves cached HTML/data when offline, and fresh SSR when online.
