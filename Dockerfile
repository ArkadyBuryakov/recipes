# syntax=docker/dockerfile:1
FROM oven/bun:1.4-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Local development (compose.yaml): sources are synced in by `docker compose watch`.
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
CMD ["bun", "run", "dev"]

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build /app/build build
COPY package.json server.ts ./
COPY server/db/migrations server/db/migrations
COPY seed seed
USER bun
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s \
  CMD ["bun", "-e", "fetch('http://localhost:3000/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["bun", "server.ts"]
