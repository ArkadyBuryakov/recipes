# Round 2: Conflicts and open details

Same rules as before: answer under **Answer:**, and anything skipped means "go with the recommendation". Each question links to the ADR it unblocks. ⚠️ marks a conflict between round-1 answers.

---

## A. Units ([0004](../adr/0004-units.md))

### A1. How should imperial units be handled on MCP writes?

When an agent sends `oz`, should the server **reject it with a conversion hint** (recommended: the agent fixes it and the stored data stays clean) or **auto-convert silently**?

**Answer:** reject, but mcp tool description should state what measurements should be provided.

### A2. Which cup?

Cups are kept as a measure. Do you mean the US cup (240 ml) or the metric cup (250 ml)? It only matters for the tooltip "≈ 240 ml". Want that tooltip at all?

**Answer:** no tooltip

### A3. Auto-format scaled quantities?

When scaling produces 1500 g, should it show `1.5 kg`? And what about 0.33 tbsp: round to `1/3 tbsp`, or switch to `1 tsp`?

- a) Show raw, rounded to sensible precision
- b) Promote g→kg / ml→l, and show fractions for spoons and cups (recommended)
- c) Also swap tbsp→tsp when the amount gets small

**Answer:** b

---

## B. Recipe schema ([0002](../adr/0002-recipe-schema.md))

### B1. What should the web editor look like?

The data is structured JSON, so hand-writing JSON is out.

- a) **Structured form**: sections → ingredient rows (name / qty / unit / prep / bowl) → steps with an `@` autocomplete that inserts ingredient chips into the step text (recommended)
- b) **Text DSL** (Cooklang-like) with a live preview, compiled to JSON on save. Fastest to type, harder to build bilingual.
- c) Both (form + "raw" mode)

**Answer:** a

### B2. Free-text ingredient names or a shared ingredient catalog?

- a) **Free text per recipe** (`name: {ru, en}`). Simple. Shopping-list merge and ingredient search use normalized name matching ("Garlic" = "garlic").
- b) **Shared catalog**: each ingredient is an entity (`garlic`/`чеснок`), and recipes reference it. This gives exact merges, translation for free, and better "what can I make with X". Costs: the agent has to look up or create catalog entries, and the editor needs a picker.
- c) Free text now, catalog later

**Answer:** a

### B3. Should sub-recipes scale with the parent?

If Sushi uses "Рис для суши" (×1) and you scale Sushi to ×2, does the embedded rice recipe scale ×2 too? (Recommended: yes, with a per-reference `factor`.)

**Answer:** recommended option

### B4. How do ingredient alternatives behave?

For "Sake: 1 tbsp (or water)", is the alternative just displayed ("or water"), or can you **switch** to it, so that steps and prep then show "water"? (Recommended: display only.)

**Answer:** just displayed

### B5. ⚠️ Is a draft status needed?

Should recipes have `draft | published`, so you can save half-done work without it going public?

**Answer:** yes

---

## C. Bilingual ([0003](../adr/0003-bilingual-content.md))

### C1. Is one language enough to save?

- a) Both languages are mandatory on save
- b) At least one is mandatory. The missing language falls back to the other, with a "not translated" badge. (recommended: the agent *should* send both, and you typing by hand might not)

**Answer:** b

### C2. How is the language chosen?

- a) URL prefix `/ru/…`, `/en/…`, defaulting from the browser language, with a toggle (recommended, SEO-friendly)
- b) No URL prefix, just a toggle stored locally

**Answer:** a

### C3. What about slugs?

- a) One Latin slug for both languages (`/ru/r/borscht`, `/en/r/borscht`) (recommended)
- b) Localized slugs (`/ru/r/borshch-ot-babushki-palany`)

**Answer:** a

---

## D. Stack ([0005](../adr/0005-stack.md))

### D1. ⚠️ SPA vs indexing

You want a static SPA **and** search-engine indexing. A plain SPA indexes poorly: Google renders JS eventually, and other engines and link previews (Telegram/WhatsApp) mostly don't.

- a) Plain SPA, accept weak SEO and link previews
- b) SPA + the **server injects `<title>`/meta/OG tags + JSON-LD `Recipe`** into `index.html` per recipe route. Cheap, and fixes previews and Google rich results. (recommended)
- c) SPA + build-time prerender of every recipe. Not suitable because content lives in the DB.
- d) Full SSR (e.g. React Router framework mode). Moves away from "static SPA".

**Answer:** let's go with full SSR.

### D2. Runtime and tooling

Which do you prefer?

- Runtime: Node 22 LTS (recommended for better-auth / MCP SDK compatibility) or Bun?
- Package manager: pnpm (recommended) / npm / bun?
- Hono for the server: OK, or do you prefer Fastify / Express?
- Router: TanStack Router (recommended) or React Router?
- UI: Tailwind + shadcn/ui-style components (recommended) or something else?

**Answer:** let's go with bun runtime and pm, everything else - your default choice

---

## E. Access ([0006](../adr/0006-access-model.md))

### E1. ⚠️ "No 3rd party": does that include email?

You said "no 3rd party auth". I read that as no social logins and no LLM APIs. Without an email provider (SMTP), the consequences are:

- invites are **copy-paste links** you send yourself
- **password reset** is admin-driven: you generate a reset link for a family member, and if *you* forget, it's a CLI command on the server

Is that OK, or should I add SMTP (e.g. the one you use elsewhere)?

**Answer:** you read it wrong, it was about 3rd party services - we don't authenticate to 3rd party services for LLM. It's not about our app authentication.

### E2. What can editors do?

- a) Everything except invite/revoke users (recommended: they can create, edit, and soft-delete)
- b) Create/edit only. Delete and restore are admin only.
- c) Same as admin

**Answer:** a

### E3. Login method

Is email + password enough? Or do you want passkeys too (better-auth plugin, nice on a phone)?

**Answer:** email + password for now.

### E4. Who sees the audit history?

- a) Admin only
- b) All editors, with a diff view + "restore this version" button (recommended)

**Answer:** b

---

## F. MCP ([0007](../adr/0007-mcp-server.md))

### F1. One endpoint or two?

- a) One `/mcp` endpoint. Write tools appear when authenticated. Cleanest, but some clients cache the tool list from an unauthenticated first connect.
- b) Two endpoints: `/mcp` (public, read-only, no auth) and `/mcp/editor` (OAuth, read + write). Unambiguous for every client. (recommended)

**Answer:** b

### F2. Auth for the write MCP

- a) OAuth only (works with claude.ai/Desktop connectors, and Claude Code supports it too)
- b) OAuth + personal API tokens created in the UI, for scripts and agents without OAuth support (recommended)

**Answer:** b

### F3. How do images arrive over MCP?

How does an agent attach a cover or source photo?

- a) `image_url`: the server downloads it (simple, but the agent must have a URL)
- b) Base64 in the tool call (works with photos the agent has locally, but large payloads)
- c) Both (recommended)

**Answer:** c

### F4. ⚠️ Conflicts in "yes to all"

- **`import_from_url`** is server-side extraction, but there's no LLM on the server (I4). Options:
  - a) Drop it. The agent fetches and structures pages itself, then calls `create_recipe` (recommended: that's your stated model)
  - b) A non-LLM version: fetch the page and return its schema.org `Recipe` JSON-LD / cleaned text for the agent to structure. No writes. This helps agents that can't browse.
- **`add_cooking_note`**: B3 said **no** to a cooking log and rating, but F4 and J1 said yes to everything. Which is it?
  - a) No cooking notes (follow B3)
  - b) Simple private notes per recipe (editors only, not public)
  - c) Public notes

**Answer:** a, a.

### F5. Tool output format

`get_recipe` returns structured JSON. Should it also offer `format: "markdown"` (human-readable, compact for chat)? (Recommended: yes, and markdown by default because it's cheaper on tokens.)

**Answer:** recommended option

---

## G. Kitchen features ([0009](../adr/0009-source-sidebar.md), [0010](../adr/0010-kitchen-features.md))

### G1. YouTube on the phone

When you open the source sheet and start the video, then collapse the sheet to read the steps:

- a) The video stops
- b) It keeps playing in a small floating mini player (recommended)

**Answer:** b

### G2. iPhone or Android?

A web app **can't set the OS timer** on either platform (details in ADR 0010).

- iPhone: I can add a "send to iOS timer" button that runs an Apple Shortcut you install once.
- Android: there's no workaround. In-app timers + notifications only.

Which phone(s) do you and your family use? Do you want the Shortcut path?

**Answer:** use in-app timer with push notifications.

### G3. Offline scope

- a) Cache the app + **all public recipes** on first visit (tiny dataset, everything works offline) (recommended)
- b) Cache only recipes you opened
- c) Also allow offline *editing* with sync later. This is significantly more complex, so not recommended.

**Answer:** a

### G4. Timer alert

Is sound + vibration + system notification when a timer ends OK? Do you want a specific sound? Should it keep ringing until dismissed?

**Answer:** ok, add setting saved in local storage for that

---

## H. Hosting ([0012](../adr/0012-hosting-deployment.md))

### H1. ⚠️ Cloudflare mode

You wrote "dns only with proxy (orange cloud)". DNS-only is the grey cloud, and proxied is orange, so those contradict each other. If the record is **orange (proxied)**, what's the SSL/TLS mode: *Full (strict)* with Let's Encrypt certs from Coolify? I'll copy whatever apply-crm uses. Can I check it myself (the `dig` result for `apply-crm.buryakov.pro`, and do you have a Cloudflare API token or the `wrangler`/`flarectl` CLI)? Or will you create the DNS record yourself?

**Answer:** same as for apply-crm. It works with grey cloud, but I might enable proxy later.

### H2. GitHub repo

- Name: `recipes`? Under your personal account?
- Public or private?

**Answer:** public, under personal account. name "recipes"

### H3. Deploy gating

By default, Coolify deploys on every push to `main`, even if CI fails.

- a) Coolify auto-deploys on push. CI is informational only.
- b) Turn off Coolify auto-deploy, and have GitHub Actions call the **Coolify deploy webhook only after CI passes** (recommended)

**Answer:** a

### H4. Do you have an image bucket now?

Which S3 provider does apply-crm use (Hetzner Object Storage / R2 / other)? Should recipe images be public-read via a CDN URL, or proxied through the server?

**Answer:** I'll create bucket on hetzner object storage (nuremberg)

---

## I. Quality ([0013](../adr/0013-quality-gates.md))

### I1. Pre-commit weight

A full suite with Testcontainers + Playwright on every commit means roughly 30–90 s.

- a) Pre-commit runs everything
- b) Pre-commit runs format + lint + typecheck + unit tests (fast). CI runs integration + e2e. The agent runs the full `pnpm check:all` before saying work is done. (recommended)

**Answer:** b

### I2. Is a Claude Code `Stop` hook OK?

The hook would automatically run the checks when I try to finish, and block me if they fail. It's stronger than a `CLAUDE.md` rule.

**Answer:** yes

---

## J. Misc

### J1. Pepcorn

Is `Pepcorn.md` popcorn? And `Combucha`/`Квашеная капуста` are processes spanning days. Are they recipes like any other? (Their prep tasks would have multi-day lead times.)

**Answer:** Pepcorn is a popcorn, yes. Combucha and sour cabbage should have cooking sections between waiting days. They are also recipes.

### J2. Design direction

With no references, I'll propose a clean, typography-led layout: large readable text, generous spacing, one accent colour, and no stock photos. Should I make a quick mockup before building?

**Answer:** yes, do a mockup.
