# 0012. Hosting and deployment

**Status:** Accepted

## Context

Hetzner CAX11 (ARM64) runs Coolify. The setup is the same as `apply-crm.buryakov.pro`: a Cloudflare DNS-only (grey cloud) record pointing at the VPS (`91.98.20.87`), with TLS from Coolify/Traefik via Let's Encrypt. You may enable the proxy later. You set up the DB and buckets manually.

## Decision

- **Domain:** `recipes.buryakov.pro`, an A record to `91.98.20.87`, grey cloud. If the proxy is enabled later, the SSL mode must be **Full (strict)**. The app trusts `CF-Connecting-IP` / `X-Forwarded-For` only from the proxy, for rate limiting.
- **Repo:** public `github.com/<you>/recipes`, created with `gh`, and linked to Coolify through the existing GitHub App.
- **Deploy:** Coolify auto-deploys on push to `main`. CI runs in parallel and is informational (round-2 H3). It doesn't gate deploys.
- **Build:** a multi-stage `Dockerfile` on `oven/bun` (install → build → slim runtime), for `linux/arm64`. Healthcheck at `GET /healthz` (checks the DB).
- **DB migrations** run on container start, before the server listens. If a migration fails, the container fails and Coolify keeps the old one running.
- **Images:** Hetzner Object Storage, Nuremberg (`nbg1`), in a private bucket. Images are served through the app at `/img/:key`, with long-lived cache headers, so the bucket never needs to be public and a proxy or CDN can cache it later.
- **Backups:** Coolify's scheduled Postgres backups to the backup bucket (daily, keep 30 days).
- **Env:**

  | Area | Variables |
  | --- | --- |
  | Core | `DATABASE_URL`, `PUBLIC_URL` |
  | Auth | `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
  | Images | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
  | Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

## Consequences

- Since CI doesn't gate deploys, a broken `main` will deploy. The pre-commit hook and the agent's stop hook are the main safety nets (0013).
- Restoring needs both the DB dump and the images bucket.
