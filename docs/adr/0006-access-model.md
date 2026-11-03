# 0006. Access model: public read, invite-only editors

**Status:** Accepted

## Context

The site is a public read-only cookbook. You and your family edit behind a login, invite only. The login is entered through a hidden gesture (10 taps on the logo). "No 3rd party" applied only to LLM services, not to app auth or email (round-2 E1).

## Decision

- **Public:** all *published*, non-deleted recipes, search, prep mode, cook mode, timers, and the public read-only MCP. No account needed.
- **Roles:**
  - `admin` (you): everything, plus inviting and revoking users
  - `editor` (family): create, edit, soft-delete, restore, publish/unpublish, view the audit history (with a diff view and a "restore this version" button), and manage their own API tokens
- **Login:** email + password via better-auth. No social login or passkeys (yet). Public sign-up is **disabled server-side**.
- **Invites:** the admin creates an invite in the UI, which gives a one-time link (7-day expiry) to copy and send. Email delivery isn't wired up initially. It's a pluggable mailer, so it can be added later without schema changes.
- **Password reset:** the admin generates a reset link for an editor. For the admin: `bun server.ts cli reset-link <email>`
  in the container (Coolify terminal) prints a one-time link.
- **Rate limiting:** better-auth's limiter (database storage) is on in production; `AUTH_RATE_LIMIT=false` turns it off
  (used by the e2e suite).
- **Hidden entry:** 10 taps on the logo within 3 s opens `/login`. This is UX, **not security**: `/login` is a real route that's `noindex`, unlinked, and rate-limited.
- **Bootstrap:** the first admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars on first start, if there are no users yet.

## Consequences

- Without email, a forgotten admin password means shell access via the Coolify terminal. That's acceptable.
