import { DomainError } from "@server/errors";
import { EDITOR, PUBLIC, type ResolvedSubRecipe } from "@server/recipes/service";
import { isLang, type Lang, pick, t } from "@shared/l10n";
import { ingredientLine, renderStepText } from "@shared/markdown";
import { buildShoppingList, formatShoppingAmounts } from "@shared/prep";
import { detectSourceKind, type RecipeData } from "@shared/recipe";
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
      <details key={s.recipe.slug} className="card mt-6 px-4 open:pb-4">
        <summary className="min-h-14 cursor-pointer py-4 font-semibold">
          ↳ {tr.subRecipes}: <L value={s.recipe.title} />{" "}
          <Link
            to={`/${lang}/r/${s.recipe.slug}`}
            className="font-normal text-accent"
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
  const kind = recipe.source ? detectSourceKind(recipe.source) : null;
  const title = pick(recipe.title, lang);
  useWakeLock();

  const step = base >= 4 && Number.isInteger(base) ? 1 : base / 2;
  const groceries = buildShoppingList([{ data: recipe, factor }, ...flatten(subRecipes, factor)], lang);
  const servingsLabel = recipe.servings.label
    ? `${servings} ${t(recipe.servings.label, lang)}`
    : tr.servings(servings);

  return (
    <div className="flex flex-1">
      <main className="min-w-0 flex-1 px-4 pt-6 pb-32 lg:px-10">
        <article className="mx-auto max-w-[720px]">
          {recipe.status === "draft" && <span className="tag mb-2 inline-block">{tr.draft}</span>}
          <h1 className="mb-2.5 text-[32px] leading-tight sm:text-[40px]">
            {title.text}
            {title.fallback && (
              <span className="ml-2 align-middle font-sans text-xs text-muted">({tr.notTranslated})</span>
            )}
          </h1>
          {recipe.description && (
            <p className="mb-4 text-[17px] leading-relaxed text-muted">
              <L value={recipe.description} />
            </p>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {recipe.times?.prepMin ? (
              <span className="pill">
                {tr.prepTime}{" "}
                <b className="font-semibold text-ink">{formatDuration(recipe.times.prepMin * 60, lang)}</b>
              </span>
            ) : null}
            {recipe.times?.cookMin ? (
              <span className="pill">
                {tr.cookTime}{" "}
                <b className="font-semibold text-ink">{formatDuration(recipe.times.cookMin * 60, lang)}</b>
              </span>
            ) : null}
            {recipe.times?.passiveMin ? (
              <span className="pill">
                {tr.passiveTime}{" "}
                <b className="font-semibold text-ink">{formatDuration(recipe.times.passiveMin * 60, lang)}</b>
              </span>
            ) : null}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Link
                key={t(tag, "en")}
                to={`/${lang}?tag=${encodeURIComponent(t(tag, lang))}`}
                className="tag"
              >
                {t(tag, lang)}
              </Link>
            ))}
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

          <div className="sticky top-14 z-20 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 bg-bg px-4 py-2.5 print:hidden">
            <div className="flex rounded-xl bg-surface-2 p-1 max-sm:w-full" role="tablist">
              {(["prep", "cook", "total"] as const).map((x) => (
                <button
                  key={x}
                  type="button"
                  role="tab"
                  aria-selected={tab === x}
                  onClick={() => setState((s) => ({ ...s, tab: x }))}
                  className={`min-h-11 rounded-lg px-4 text-[15px] font-semibold max-sm:flex-1 max-sm:px-1.5 max-sm:text-sm ${tab === x ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
                >
                  {x === "prep" ? tr.prep : x === "cook" ? tr.cook : tr.total}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-line bg-surface">
                <button
                  type="button"
                  className="h-11 w-11 text-xl"
                  aria-label="−"
                  onClick={() =>
                    setState((s) => ({ ...s, servings: Math.max(step, +(s.servings - step).toFixed(2)) }))
                  }
                >
                  −
                </button>
                <span className="min-w-24 text-center text-[15px] tabular-nums">{servingsLabel}</span>
                <button
                  type="button"
                  className="h-11 w-11 text-xl"
                  aria-label="+"
                  onClick={() => setState((s) => ({ ...s, servings: +(s.servings + step).toFixed(2) }))}
                >
                  +
                </button>
              </div>
              {kind === "youtube" && (
                <button type="button" className="btn" onClick={video.toggle}>
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

          {tab === "prep" && <PrepPanel data={recipe} factor={factor} checks={checks} />}
          {tab === "cook" && <CookPanel data={recipe} factor={factor} checks={checks} />}
          {tab === "total" && (
            <section>
              <h2 className="mt-4 mb-2 text-2xl">{tr.groceries}</h2>
              {groceries.map((g) => {
                const amounts = formatShoppingAmounts(g, lang);
                return (
                  <CheckRow key={g.key} id={`buy:${g.key}`} checks={checks}>
                    {amounts && <span className="font-semibold tabular-nums">{amounts} </span>}
                    {g.name}
                    {g.optional && <span className="text-[15px] text-muted italic"> — {tr.optional}</span>}
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
      {recipe.source && kind === "youtube" && (
        <VideoPanel source={recipe.source} lang={lang} panel={video.panel} />
      )}
    </div>
  );
}
