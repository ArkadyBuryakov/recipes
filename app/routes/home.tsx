import { EDITOR, PUBLIC, type RecipeSummary } from "@server/recipes/service";
import { isLang, type Lang, t as pick } from "@shared/l10n";
import { formatDuration } from "@shared/tokens";
import { Form, Link, useNavigation, useSearchParams, useSubmit } from "react-router";
import { getCtx } from "~/lib/ctx.server";
import { dictionaries, useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/home";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const ctx = getCtx(context);
  const v = ctx.principal ? EDITOR : PUBLIC;
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const tag = url.searchParams.get("tag")?.trim() ?? "";
  const [recipes, tags] = await Promise.all([
    q || tag
      ? ctx.services.recipes.search(v, { query: q, ...(tag && { tags: [tag] }), limit: 100 })
      : ctx.services.recipes.list(v, { limit: 200 }).then((r) => r.items),
    ctx.services.recipes.tags(v),
  ]);
  const lang = isLang(params.lang) ? params.lang : "ru";
  return { recipes, tags, q, tag, origin: ctx.publicUrl, lang };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [];
  const t = dictionaries[data.lang];
  const other: Lang = data.lang === "ru" ? "en" : "ru";
  return [
    { title: t.appName },
    {
      name: "description",
      content:
        data.lang === "ru"
          ? "Домашние рецепты с подготовкой и пошаговой готовкой."
          : "Home recipes with mise en place and step-by-step cooking.",
    },
    { tagName: "link", rel: "canonical", href: `${data.origin}/${data.lang}` },
    { tagName: "link", rel: "alternate", hrefLang: other, href: `${data.origin}/${other}` },
  ];
}

function RecipeCard({ r, lang }: { r: RecipeSummary; lang: Lang }) {
  const t = useT();
  const total = (r.times?.prepMin ?? 0) + (r.times?.cookMin ?? 0);
  return (
    <Link
      to={`/${lang}/r/${r.slug}`}
      className="card group flex flex-col gap-2 p-4 transition-colors hover:border-accent"
    >
      {r.cover && (
        <img
          src={`/img/${r.cover.imageKey}?w=600`}
          alt=""
          loading="lazy"
          className="-mx-4 -mt-4 mb-1 aspect-[16/10] w-[calc(100%+2rem)] max-w-none rounded-t-2xl object-cover"
        />
      )}
      <h2 className="text-xl leading-snug group-hover:text-accent">
        {pick(r.title, lang)}
        {r.status === "draft" && <span className="tag ml-2 align-middle font-sans text-xs">{t.draft}</span>}
      </h2>
      {r.description && <p className="line-clamp-2 text-[15px] text-muted">{pick(r.description, lang)}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {total > 0 && <span className="pill py-1 text-[13px]">⏱ {formatDuration(total * 60, lang)}</span>}
        {r.tags.slice(0, 3).map((tag) => (
          <span key={pick(tag, "en")} className="tag">
            {pick(tag, lang)}
          </span>
        ))}
      </div>
    </Link>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { recipes, tags, q, tag } = loaderData;
  const lang = useLang();
  const t = useT();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const searching = navigation.location?.pathname === `/${lang}` && navigation.state === "loading";
  const tagLink = (value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== tag) next.set("tag", value);
    else next.delete("tag");
    const s = next.toString();
    return `/${lang}${s ? `?${s}` : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28">
      <Form
        method="get"
        role="search"
        className="mb-4"
        onChange={(e) => submit(e.currentTarget, { replace: true, preventScrollReset: true })}
      >
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.search}
          aria-label={t.search}
          className="input min-h-12 text-base"
          autoComplete="off"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
      </Form>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link
          to={tagLink("")}
          className={`rounded-full px-3 py-1.5 text-sm ${!tag ? "bg-ink text-bg" : "bg-surface-2 text-muted"}`}
        >
          {t.allRecipes}
        </Link>
        {tags.map(({ tag: tg, count }) => {
          const value = pick(tg, lang);
          const active = tag.toLowerCase() === value.toLowerCase();
          return (
            <Link
              key={pick(tg, "en")}
              to={tagLink(value)}
              className={`rounded-full px-3 py-1.5 text-sm ${active ? "bg-accent text-white" : "bg-accent-soft text-accent"}`}
            >
              {value} <span className="opacity-60">{count}</span>
            </Link>
          );
        })}
      </div>
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${searching ? "opacity-60" : ""}`}>
        {recipes.map((r) => (
          <RecipeCard key={r.slug} r={r} lang={lang} />
        ))}
      </div>
      {!recipes.length && <p className="py-16 text-center text-muted">{t.nothingFound}</p>}
    </main>
  );
}
