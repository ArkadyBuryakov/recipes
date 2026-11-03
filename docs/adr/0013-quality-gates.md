# 0013. Quality gates

**Status:** Accepted

## Context

Everything is auto-tested, with a CI check and pre-commit hooks. The Claude Code agent must run the checks before saying work is done. Pre-commit stays fast (round-2 I1b). A Claude Code `Stop` hook is approved (I2).

## Decision

- **Two scripts:**
  - `bun run check` (fast): Biome format + lint, `tsc --noEmit`, unit tests
  - `bun run check:all` (full): `check` + integration tests against a real Postgres + Playwright e2e
- **Pre-commit (lefthook):** `bun run check`.
- **CI (GitHub Actions)** on push/PR: `check:all`, with Postgres as a service container, plus an arm64 Docker build.
- **Agent:**
  - `CLAUDE.md` requires `bun run check:all` before saying work is done
  - a `.claude/settings.json` **`Stop` hook** runs `bun run check` and blocks finishing when it fails. The full suite is too slow for every stop, so the hook runs the fast one, and `CLAUDE.md` mandates the full one.
- **Integration tests** run against a real Postgres (Docker locally, a service container in CI), with no mocks. Each test file runs in its own schema or transaction.
- **e2e** covers:
  - public browse, search, prep, cook, scaling, and the language toggle
  - login via the hidden gesture
  - creating a recipe in the editor
  - public MCP read and editor MCP write, with an API token and with OAuth
  - the timer start → push request flow
- **MCP contract tests:** snapshot tests of tool names and input/output JSON Schemas.

## Consequences

- Local `check:all` needs Docker running.
