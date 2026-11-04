import { DomainError } from "@server/errors";
import { EDITOR, PUBLIC, type ResolvedSubRecipe } from "@server/recipes/service";
import { isLang, type Lang, pick, t } from "@shared/l10n";
import { ingredientLine, renderStepText } from "@shared/markdown";
import { buildShoppingList, formatShoppingAmounts } from "@shared/prep";
import { type RecipeData, videoEmbed } from "@shared/recipe";
import { formatDuration } from "@shared/tokens";
import { useMemo } from "react";
import { data, Link } from "react-router";
import { CheckRow, type Checks, CookPanel, L, PrepPanel } from "~/components/recipe-parts";
import { SourceLine, useVideoPanel, VideoPanel } from "~/components/source-panel";
import { openTimerSettings } from "~/components/timers";
import { getCtx } from "~/lib/ctx.server";
import { useLang, useT } from "~/lib/i18n";
import { useStoredState } from "~/lib/storage";
import { useWakeLock } from "~/lib/wake-lock";
import type { Route } from "./+types/recipe";

export async function loader({ context, params }: Route.LoaderArgs) {
  const ctx = getCtx(context);
  const v = ctx.principal ? EDITOR : PUBLIC;
  try {
    const recipe = await ctx.services.recipes.get(params.slug, v);
    const subRecipes = await ctx.services.recipes.resolveSubRecipes(recipe, v);
    return { recipe, subRecipes, origin: ctx.publicUrl, canEdit: Boolean(ctx.principal) };
  } catch (e) {
    if (e instanceof DomainError && e.code === "not_found") throw data(null, { status: 404 });
    throw e;
  }
}

const iso = (min?: number) =>
  min
    ? `PT${Math.floor(min / 60) ? `${Math.floor(min / 60)}H` : ""}${min % 60 ? `${min % 60}M` : ""}`
    : undefined;

/** schema.org Recipe for rich results (ADR 0005). */
function jsonLd(r: RecipeData & { slug: string }, lang: Lang, url: string, origin: string) {
  const ingredients = new Map(r.sections.flatMap((s) => s.ingredients.map((i) => [i.id, i] as const)));
  const total = (r.times?.prepMin ?? 0) + (r.times?.cookMin ?? 0) + (r.times?.passiveMin ?? 0);
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: t(r.title, lang),
    ...(r.description && { description: t(r.description, lang) }),
    inLanguage: lang,
    url,
    ...(r.cover && { image: `${origin}/img/${r.cover.imageKey}` }),
    recipeYield: String(r.servings.amount),
    ...(r.times?.prepMin && { prepTime: iso(r.times.prepMin) }),
    ...(r.times?.cookMin && { cookTime: iso(r.times.cookMin) }),
    ...(total && { totalTime: iso(total) }),
    keywords: r.tags.map((tag) => t(tag, lang)).join(", "),
    recipeIngredient: r.sections.flatMap((s) => s.ingredients.map((i) => ingredientLine(i, 1, lang))),
    recipeInstructions: r.sections.flatMap((s) =>
      s.steps.map((st) => ({
        "@type": "HowToStep",
        text: renderStepText(t(st.text, lang), ingredients, 1, lang),
      })),
    ),
  };
}

export function meta({ loaderData: d, params }: Route.MetaArgs) {
  if (!d) return [];
  const lang: Lang = isLang(params.lang) ? params.lang : "ru";
  const other: Lang = lang === "ru" ? "en" : "ru";
  const r = d.recipe;
  const url = `${d.origin}/${lang}/r/${r.slug}`;
  const title = t(r.title, lang);
  const description = r.description ? t(r.description, lang) : title;
  return [
    { title: `${title} — ${lang === "ru" ? "Рецепты" : "Recipes"}` },
    { name: "description", content: description },
    ...(r.status === "draft" ? [{ name: "robots", content: "noindex" }] : []),
    { tagName: "link", rel: "canonical", href: url },
    { tagName: "link", rel: "alternate", hrefLang: lang, href: url },
    { tagName: "link", rel: "alternate", hrefLang: other, href: `${d.origin}/${other}/r/${r.slug}` },
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    ...(r.cover ? [{ property: "og:image", content: `${d.origin}/img/${r.cover.imageKey}?w=1200` }] : []),
    { "script:ld+json": jsonLd(r, lang, url, d.origin) },
  ];
}

type Tab = "prep" | "cook" | "total";
type SavedState = { servings: number; tab: Tab; checked: string[] };

function useChecks(slug: string, version: number, defaultServings: number) {
  const [state, setState] = useStoredState<SavedState>(`recipe:${slug}:v${version}`, {
    servings: defaultServings,
    tab: "prep",
    checked: [],
  });
  const checked = useMemo(() => new Set(state.checked), [state.checked]);
  const checks: Checks = {
    has: (id) => checked.has(id),
    toggle: (id) =>
      setState((s) => ({
        ...s,
        checked: s.checked.includes(id) ? s.checked.filter((c) => c !== id) : [...s.checked, id],
      })),
  };
  return { state, setState, checks };
}

function flatten(subs: ResolvedSubRecipe[], factor: number): { data: RecipeData; factor: number }[] {
  return subs.flatMap((s) => [
    { data: s.recipe, factor: factor * s.factor },
    ...flatten(s.subRecipes, factor * s.factor),
  ]);
}

function SubRecipes({
  subs,
  factor,
  checks,
  tab,
}: {
  subs: ResolvedSubRecipe[];
  factor: number;
  checks: Checks;
  tab: Tab;
}) {
  const lang = useLang();
  const tr = useT();
  return subs.map((s) => {
    const f = factor * s.factor;
    const ns = `sub:${s.recipe.slug}:`;
    return (
      <details key={s.recipe.slug} className="card mb-7 px-4 open:pb-4 sm:px-5">
        <summary className="min-h-14 cursor-pointer py-4 font-mono font-medium">
          ↳ {tr.subRecipes}: <L value={s.recipe.title} />{" "}
          <Link
            to={`/${lang}/r/${s.recipe.slug}`}
            className="font-normal underline decoration-accent decoration-2"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </Link>
        </summary>
        {tab === "cook" ? (
          <CookPanel data={s.recipe} factor={f} checks={checks} ns={ns} />
        ) : (
          <PrepPanel data={s.recipe} factor={f} checks={checks} ns={ns} />
        )}
        <SubRecipes subs={s.subRecipes} factor={f} checks={checks} tab={tab} />
      </details>
    );
  });
}

export default function RecipePage({ loaderData }: Route.ComponentProps) {
  const { recipe, subRecipes, canEdit } = loaderData;
  const lang = useLang();
  const tr = useT();
  const base = recipe.servings.amount;
  const { state, setState, checks } = useChecks(recipe.slug, recipe.version, base);
  const { servings, tab } = state;
  const factor = servings / base;
  const video = useVideoPanel();
  const embed = recipe.source?.url ? videoEmbed(recipe.source.url) : null;
  const title = pick(recipe.title, lang);
  useWakeLock();

  const step = base >= 4 && Number.isInteger(base) ? 1 : base / 2;
  const groceries = buildShoppingList([{ data: recipe, factor }, ...flatten(subRecipes, factor)], lang);
  const servingsLabel = recipe.servings.label
    ? `${servings} ${t(recipe.servings.label, lang)}`
    : tr.servings(servings);

  const nIngredients = recipe.sections.reduce((n, s) => n + s.ingredients.length, 0);
  const nSteps = recipe.sections.reduce((n, s) => n + s.steps.length, 0);
  const times = [
    [tr.prepTime, recipe.times?.prepMin],
    [tr.cookTime, recipe.times?.cookMin],
    [tr.passiveTime, recipe.times?.passiveMin],
  ] as const;

  return (
    <div className="flex flex-1">
      <main className="min-w-0 flex-1 px-4 pt-4 pb-32 sm:px-6 lg:px-10">
        <article className="mx-auto max-w-[760px]">
          <Link to={`/${lang}`} className="font-mono text-sm text-muted hover:text-ink print:hidden">
            ← {tr.allRecipes}
          </Link>
          <h1 className="mt-5 mb-3 text-[34px] leading-[1.1] sm:text-[46px]">
            {title.text}
            {recipe.status === "draft" && <span className="tag ml-3 align-middle">{tr.draft}</span>}
            {title.fallback && (
              <span className="ml-2 align-middle font-sans text-xs text-muted">({tr.notTranslated})</span>
            )}
          </h1>
          {recipe.description && (
            <p className="mb-5 max-w-[640px] text-lg leading-relaxed text-muted">
              <L value={recipe.description} />
            </p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-x-7 gap-y-3">
            {times.map(([label, min]) =>
              min ? (
                <div key={label} className="text-sm text-muted">
                  {label}
                  <b className="block font-mono text-[17px] font-medium text-ink">
                    {formatDuration(min * 60, lang)}
                  </b>
                </div>
              ) : null,
            )}
            <div className="flex items-center gap-2.5 print:hidden">
              <div className="flex items-center border-2 border-line-strong bg-surface font-mono">
                <button
                  type="button"
                  className="h-10 w-10 text-lg"
                  aria-label="−"
                  onClick={() =>
                    setState((s) => ({ ...s, servings: Math.max(step, +(s.servings - step).toFixed(2)) }))
                  }
                >
                  −
                </button>
                <span className="min-w-24 text-center text-sm font-medium tabular-nums">{servingsLabel}</span>
                <button
                  type="button"
                  className="h-10 w-10 text-lg"
                  aria-label="+"
                  onClick={() => setState((s) => ({ ...s, servings: +(s.servings + step).toFixed(2) }))}
                >
                  +
                </button>
              </div>
              {embed && (
                <button type="button" className="btn min-h-11" onClick={video.toggle}>
                  ▶ <span className="max-sm:hidden">{tr.source}</span>
                </button>
              )}
              <button
                type="button"
                className="btn w-11 px-0"
                onClick={openTimerSettings}
                title={tr.timerSettings}
                aria-label={tr.timerSettings}
              >
                ⏱
              </button>
            </div>
          </div>
          {recipe.source && <SourceLine source={recipe.source} lang={lang} />}
          {canEdit && (
            <div className="mb-4 flex gap-2 print:hidden">
              <Link className="btn" to={`/${lang}/r/${recipe.slug}/edit`}>
                ✎ {tr.edit}
              </Link>
              <Link className="btn btn-ghost" to={`/${lang}/r/${recipe.slug}/history`}>
                ↺
              </Link>
            </div>
          )}

          <div className="sticky top-16 z-20 mt-6 mb-7 border-line-strong border-b-2 bg-bg py-3 print:hidden">
            <div className="flex gap-1.5" role="tablist">
              {(["prep", "cook", "total"] as const).map((x) => (
                <button
                  key={x}
                  type="button"
                  role="tab"
                  aria-selected={tab === x}
                  onClick={() => setState((s) => ({ ...s, tab: x }))}
                  className={`min-h-11 border-2 border-line-strong px-4 font-mono text-sm font-medium uppercase max-sm:flex-1 max-sm:px-1.5 max-sm:text-[13px] ${tab === x ? "bg-accent text-accent-ink" : ""}`}
                >
                  {x === "prep" ? tr.prep : x === "cook" ? tr.cook : tr.total}
                  {x !== "total" && (
                    <span className="ml-1.5 text-xs opacity-60 max-sm:hidden">
                      {x === "prep" ? nIngredients : nSteps}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {tab === "prep" && <PrepPanel data={recipe} factor={factor} checks={checks} />}
          {tab === "cook" && <CookPanel data={recipe} factor={factor} checks={checks} />}
          {tab === "total" && (
            <section className="card mb-7 px-4 pb-1 sm:px-5">
              <h2 className="label pt-4 pb-1 text-ink">{tr.groceries}</h2>
              {groceries.map((g) => {
                const amounts = formatShoppingAmounts(g, lang);
                return (
                  <CheckRow key={g.key} id={`buy:${g.key}`} checks={checks}>
                    <span className="grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[8.5rem_1fr]">
                      <span className="font-mono tabular-nums">{amounts}</span>
                      <span>
                        {g.name}
                        {g.optional && <span className="text-muted"> — {tr.optional}</span>}
                      </span>
                    </span>
                  </CheckRow>
                );
              })}
            </section>
          )}
          {tab !== "total" && <SubRecipes subs={subRecipes} factor={factor} checks={checks} tab={tab} />}

          {(state.checked.length > 0 || servings !== base) && (
            <button
              type="button"
              className="btn btn-ghost mt-6 text-muted print:hidden"
              onClick={() => setState({ servings: base, tab, checked: [] })}
            >
              ↺ {tr.reset}
            </button>
          )}
        </article>
      </main>
      {recipe.source && embed && <VideoPanel source={recipe.source} lang={lang} panel={video.panel} />}
    </div>
  );
}
