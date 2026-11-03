# Round 1 — Requirements

Answer inline under each **Answer:** line. Pick an option letter, write your own, or say "you decide". Skip anything you don't care about. That counts as "you decide".

---

## A. Source of truth & content

### A1. Where do recipes live?

The vault is symlinked and gitignored, so Coolify never sees it.

- a) **Obsidian vault stays the source.** A sync step (vault folder → its own git repo, or a script that copies into this repo) feeds the site. The site is read-only.
- b) **This repo is the source.** Recipes move here as markdown. You edit in an editor (or point Obsidian at this folder). Push to deploy.
- c) **Site database is the source.** You edit in a web UI. Obsidian is retired for recipes.
- d) **Site database, written mostly by your agent over MCP** ("save this YouTube recipe"), with minimal web editing.

**Answer:** I want to be able to create/edit/delete notes manually and via MCP. I'm going to need an admin account to authorize (hidden enter, like 10 clicks on home page logo). Also I'm going to need an authorized-mcp version.

So let's store it in DB. All deletes should be soft deletes with audit history.

### A2. What happens to the existing ~30 recipes?

- a) Migrate all of them (I convert them, you review)
- b) Migrate selectively
- c) Start fresh

**Answer:** Migrate all of them. Add to initial migration.

### A3. What about the non-recipe material in the folder?

There's `Дневник/` (a diary?), images in `attachments/`, and two loose `.jpg` files (`кекс_на_молочной_опаре_*`). Are any of these part of the site? What is `Дневник`?

**Answer:** omit them

### A4. How will you add new recipes most of the time?

- a) Type them by hand
- b) Paste a URL / YouTube link and have it extracted (by LLM)
- c) Ask my agent to do it via MCP
- d) Photo of a cookbook page / handwritten note (OCR)

**Answer:** either by hand on authorized web page (a) or via authorized-mcp (c, indirectly covers b and d with agent capabilities)

---

## B. Recipe format

### B1. How strict a format will you accept in exchange for a good prep mode?

Prep mode needs, per ingredient: name, quantity, unit, **prep action** ("thinly sliced", "room temperature"), and group ("marinade"). Ideally also **which step uses it**.

- a) **Strict schema** (YAML/JSON frontmatter or a dedicated format). Most precise. Harder to hand-write.
- b) **Light markdown convention**, e.g. `- Ginger: 10 g — thinly sliced`. Easy to write, no step linking.
- c) **Freeform + LLM parsing** at import time. Zero effort, but there's drift and an API dependency.

**Answer:** a

### B2. Should steps reference ingredients inline?

For example "Add {ginger} and {garlic}", so the cook view can show the quantity right inside the step and you never scroll back up.

**Answer:** yes, 100% killer feature

### B3. Which metadata do you want on a recipe?

Mark what you want:

- [yes] Servings / yield
- [yes] Prep time / cook time / total time (incl. passive, e.g. "marinate overnight")
- [yes - for search] Tags / cuisine / category
- [no] Equipment list (pots, pans, thermometer…)
- [yes, optional cover only] Photos (cover, per step)
- [no] Personal notes / cooking log ("made 2026-10-01, too salty")
- [no] Rating
- [varied ingredients] Variations / substitutions (e.g. "sake → water")
- [yes, probably show on the same page collapsed] Sub-recipes / links between recipes (chashu marinade → teriyaki sauce, "Рис для суши" used by other dishes)
- [ ] Other:

**Answer:** answers are in brackets

### B4. How should language be handled?

Your recipes mix English ingredient names with Russian steps, sometimes in the same file.

- a) Keep each recipe as-is, mixed. The UI is in one language (which?).
- b) Normalize every recipe to one language (which?)
- c) Bilingual. Each recipe can exist in RU and EN (LLM-translated?)

**Answer:** c) Bilingual

### B5. How should units work?

The originals mix grams, oz, cups, and Tbsp.

- a) Store as written, no conversion
- b) Normalize to metric on import
- c) Store as written, plus a toggle for metric/imperial in the UI

**Answer:** keep cups and spoons, pinches and other bodily/utensils measurements, imperial should be converted to metric system.

### B6. Scaling servings?

Do you want a "×2 / for 6 people" control that recalculates quantities? (Some things don't scale linearly, like salt, eggs, and pan size. Is a naive scale OK?)

**Answer:** yes, but keep prefilled defaults for recipe

---

## C. Prep mode (mise en place)

### C1. What does prep mode show, and how is it organized?

- a) A flat checklist of all ingredients with quantity + prep action. Tick them off as you go.
- b) Grouped **by container/bowl**: things that go into the pan at the same time are grouped ("bowl 1: garlic + ginger + scallion")
- c) Grouped by **recipe section** (as written: "Chashu", "Marinade")
- d) Grouped by **prep action** (all chopping together, all measuring together)

**Answer:** a, b, c. Group by recipe section. then if something goes together - group by bowl. other than that - flat list.

### C2. Should the same ingredient be merged across sections?

For example, garlic appears in both "Chashu" and "Marinade". Should prep show "garlic: 4–6 cloves total (2–3 → chashu, 2–3 → marinade)"?

**Answer:** no. they cooked separetely and prepped separetely. However you can have a section for total ingredients merged to plan groceries.

### C3. Should prep include non-ingredient tasks?

"Preheat oven", "boil water", "take butter out 1h before", "marinate overnight". Should those surface as prep tasks, maybe with a timeline ("start 24h before")?

**Answer:** yes. but if it requires cooking (mixing sauces and cutting chicken - do it as a separate section of recipe)

### C4. Should checklist state persist?

- a) No, it resets on reload
- b) Locally on the device (survives reload / phone locking)
- c) Synced across devices (prep on tablet, check on phone)

**Answer:** b

---

## D. Cook mode

### D1. What does cook mode look like?

- a) Same page, just the steps list
- b) One step at a time, big font, swipe/tap to advance
- c) All steps, with the current one highlighted

**Answer:** a with checklist

### D2. Which kitchen-device features do you want?

Mark what you want:

- [yes] Screen wake lock (screen stays on)
- [yes] Built-in timers parsed from steps ("варить 20 минут" → tap to start a 20-min timer)
- [yes] Multiple concurrent timers
- [no] Voice control / hands-free next step
- [yes] Large touch targets for messy hands
- [yes] Works offline (PWA), e.g. bad wifi in the kitchen

**Answer:** answers in brackets. ideally timers should set phone timer if possible.

### D3. Which device(s) will you cook with?

Phone, tablet, laptop? Portrait or landscape? This matters a lot for the sidebar.

**Answer:** mostly phone. but add support for laptop.

---

## E. Source sidebar

### E1. What should the sidebar show for each source type?

YouTube embeds fine. **Most recipe websites block iframes** (`X-Frame-Options`), so a site can't simply be shown in the sidebar.

- a) YouTube embedded. For other sites, just a link that opens a new tab.
- b) YouTube embedded. For other sites, a **saved snapshot / reader-view copy** captured when the recipe is added. This also protects against link rot.
- c) Try an iframe, and fall back to a link if it's blocked
- d) Something else

**Answer:** a - but show link for youtube as well, so I can go and check description/comments.

### E2. YouTube specifics?

Should the video sync with steps? For example, store a timestamp per step so tapping step 5 seeks the video to 4:32. Or is just embedding the video enough?

**Answer:** no

### E3. What other source types are there?

Instagram reels, TikTok, cookbook photo, "grandma" (Борщ от бабушки Паланы 🙂), no source? How should a source without a URL appear?

**Answer:** social media - just link in new tab. Photo - open photo preview, no link - show just text. no source - don't show source section.

---

## F. MCP server

### F1. Read-only or write too?

- a) Read-only: search, get recipe
- b) Read + write: also create/update recipes from the agent (needs auth)

**Answer:** read without auth, read+write with auth.

### F2. Who can access it?

The site is "public", but how public is the MCP?

- a) Fully open. Anyone can read my recipes via MCP.
- b) Open reads, writes behind a token
- c) Everything behind auth (bearer token or OAuth)

If auth: is a static bearer token OK, or does your agent client need **OAuth** (claude.ai custom connectors require OAuth for authenticated servers)?

**Answer:** read fully open

### F3. Which agent clients will use it?

Claude Code, claude.ai / Claude Desktop connector, Cursor, your own agent? This decides transport (Streamable HTTP is the standard for remote) and auth.

**Answer:** any agent that supports MCP protocol

### F4. Which tools should it expose?

Mark / add:

- [ ] `search_recipes(query, tags?, ingredients?)`, e.g. "what can I make with chicken and rice"
- [ ] `get_recipe(id, format?)`: full recipe
- [ ] `get_prep_list(id, servings?)`: mise en place checklist
- [ ] `list_recipes / list_tags`
- [ ] `create_recipe / update_recipe`
- [ ] `import_from_url(url)`: server-side extraction
- [ ] `shopping_list(recipe_ids[], servings?)`: merged groceries for multiple recipes
- [ ] `add_cooking_note(id, note)`
- [ ] Other:

**Answer:** yes to all. listing recipes (through list and search) should also return full url, so agent can give me a link to navigate to website.

### F5. Should search be semantic or keyword?

- a) Keyword / full-text is enough
- b) Semantic ("something warm and soupy with lentils") with embeddings. Adds complexity and maybe an API cost.
- c) Keyword in the app. The agent does the semantic reasoning itself over `list_recipes`.

**Answer:** a for now

---

## G. Access & users

### G1. Who is the site for?

- a) Only me, public read for anyone with the link
- b) Only me, private (login required)
- c) Me + family/partner who can also edit
- d) Public cookbook, meant to be shared

**Answer:** public cookbook read only. Only me and my family for edits (behind login). Invite only.

### G2. Should search engines index the site?

Or should it be noindex?

**Answer:** yeah, read-only part.

### G3. Copyright

Some recipes are transcriptions from YouTube creators. Public is fine for personal notes with attribution, but say if you'd rather keep it private or noindex because of that.

**Answer:** keep them public

---

## H. Hosting & deployment

### H1. Which domain?

`recipes.arkady.buryakov` isn't a valid domain (`.buryakov` isn't a TLD). Is it `recipes.buryakov.pro`, `recipes.arkady.buryakov.pro`, or something else?

**Answer:** recipes.buryakov.pro

### H2. Cloudflare setup

Is it DNS-only (grey cloud) with Coolify/Traefik doing TLS via Let's Encrypt, or proxied (orange cloud) with Cloudflare TLS? Do you already have other apps on this Coolify that I should match?

**Answer:** I have buryakov.pro - personal website and apply-crm.buryakov.pro with the same setup. Coolify is dns only with proxy (orange cloud).

### H3. Coolify build method

- a) Dockerfile in the repo (most control)
- b) Nixpacks / auto-detect
- c) Docker Compose (needed if there's a separate DB container)
- d) You decide

**Answer:** Dockerfile, i'll setup DB manually.

### H4. Git host

GitHub, Gitea, something else? Coolify needs to be connected to it for auto-deploy on push. Is it already connected?

**Answer:** github app connection. You can use gh to create repo

### H5. Persistence & backups

If there's a database or uploaded photos: is a Coolify volume on the Hetzner VPS fine? Do you need backups (to Hetzner Storage Box / S3 / R2)? If recipes are in git, git *is* the backup. Is that a factor in A1?

**Answer:** I can create buckets for documents and backups same as for apply-crm.

### H6. VPS resources

What size is the VPS and what else runs on it? This decides whether a heavier stack is OK (e.g. Postgres + Node + embeddings vs. SQLite + a single binary).

**Answer:** It's CAX11. just do a postgres with node, it's ok. mem usage is lower than 50%, cpu under 10% most of the time

---

## I. Stack & engineering

### I1. Language/framework preference?

Anything you know well, want to learn, or refuse to touch? (e.g. TypeScript + Next.js/Astro/SvelteKit, Go, Python, Elixir…)

**Answer:** better auth for authorization, so typescript backend to make it smaller. Web app - static spa, react with vite.

### I2. Static site or app server?

If recipes are in git and the site is read-only, it could be a **static site** + a tiny MCP server. A web editor, synced checklists, or MCP writes require a real backend.

- a) Prefer static + minimal server
- b) A full app is fine
- c) You decide based on other answers

**Answer:** answered in I1

### I3. Should the MCP server live in the same service as the website?

Or a separate one? (Same process = one deploy, shared code; a separate one = isolation.)

**Answer:** keep small - same

### I4. Do you have an LLM API budget?

Is it OK for the server to call an LLM (Claude API) for URL import, parsing, translation, or embeddings? Roughly how much per month is acceptable?

**Answer:** no, no 3rd party auth. all "intelligence" will be done by agent that uses MCP and just uploads in correct format.

### I5. Tests, CI, quality bar?

Is this a weekend hack or something you want to maintain for years? Should tests or CI checks run before Coolify deploys?

**Answer:** autotest everything, CI check and pre-commit hooks. Also claude code agent should run same checks as pre-commit hooks before stating work done.

---

## J. Scope & priorities

### J1. What's the MVP, and what can wait?

Rank or mark **MVP / later / never**:

- Browse + read recipes
- Prep mode
- Cook mode
- Source sidebar
- MCP read
- MCP write
- Web editor
- URL import
- Timers
- Scaling
- Shopping list
- Search
- Photos
- Offline/PWA
- Cooking log

**Answer:** everything is in MVP

### J2. Look & feel

Do you have any references you like (Paprika, Mela, Crouton, NYT Cooking, Cooklang, a specific site)? Dark mode? Minimal or rich?

**Answer:** system/light/dark modes. No references, I don't like most of cooking sites and don't have any good in mind.

### J3. Have you considered Cooklang?

[Cooklang](https://cooklang.org) is an existing plain-text recipe markup where ingredients are inline in steps (`Add @ginger{10%g}(thinly sliced)`). It gives step-linking and prep lists for free, and it has a parser ecosystem. Is it worth adopting, or do you want your own format?

**Answer:** does it cover our functional requirements? Or there is a gap?

### J4. Anything I didn't ask about?

**Answer:** looks fine for now
