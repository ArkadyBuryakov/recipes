import { EDITOR, PUBLIC, type RecipeSummary } from "@server/recipes/service";
import { isLang, type Lang, t as pick } from "@shared/l10n";
import { formatDuration } from "@shared/tokens";
import { Form, Link, useNavigation, useSubmit } from "react-router";
import { getCtx } from "~/lib/ctx.server";
import { dictionaries, useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/home";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const ctx = getCtx(context);
  const v = ctx.principal ? EDITOR : PUBLIC;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const recipes = q
    ? await ctx.services.recipes.search(v, { query: q, limit: 100 })
    : (await ctx.services.recipes.list(v, { limit: 200 })).items;
  const lang = isLang(params.lang) ? params.lang : "ru";
  return { recipes, q, origin: ctx.publicUrl, lang };
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

function RecipeRow({ r, n, lang }: { r: RecipeSummary; n: number; lang: Lang }) {
  const t = useT();
  const total = (r.times?.prepMin ?? 0) + (r.times?.cookMin ?? 0) || (r.times?.passiveMin ?? 0);
  const to = `/${lang}/r/${r.slug}`;
  return (
    <tr className="relative border-line border-b hover:bg-accent-soft">
      <td className="w-12 py-3.5 pr-3 font-mono text-muted tabular-nums max-sm:hidden">
        {String(n).padStart(2, "0")}
      </td>
      <td className="py-3.5 pr-3">
        {/* The link covers the whole row. */}
        <Link to={to} className="font-mono text-base font-medium after:absolute after:inset-0">
          {pick(r.title, lang)}
        </Link>
        {r.status === "draft" && <span className="tag ml-2 align-middle">{t.draft}</span>}
      </td>
      <td className="py-3.5 pr-3 font-mono text-sm text-muted max-sm:hidden">
        {r.tags
          .slice(0, 2)
          .map((tag) => pick(tag, lang))
          .join(" · ")}
      </td>
      <td className="py-3.5 text-right font-mono text-sm whitespace-nowrap tabular-nums">
        {total > 0 ? formatDuration(total * 60, lang) : "—"}
      </td>
    </tr>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { recipes, q } = loaderData;
  const lang = useLang();
  const t = useT();
  const submit = useSubmit();
  const navigation = useNavigation();
  const searching = navigation.location?.pathname === `/${lang}` && navigation.state === "loading";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-28 sm:px-6 sm:pt-12">
      <h1 className="mb-6 text-4xl sm:text-5xl">{t.whatToCook}</h1>
      <Form
        method="get"
        role="search"
        onChange={(e) => submit(e.currentTarget, { replace: true, preventScrollReset: true })}
      >
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.search}
          aria-label={t.search}
          className="input min-h-14 font-mono text-base shadow-lg sm:min-h-16 sm:text-lg"
          autoComplete="off"
        />
      </Form>
      <p className="label mt-7 mb-2">{t.recipeCount(recipes.length)}</p>
      {recipes.length > 0 ? (
        <table className={`w-full border-collapse ${searching ? "opacity-60" : ""}`}>
          <tbody className="border-line-strong border-t-2">
            {recipes.map((r, i) => (
              <RecipeRow key={r.slug} r={r} n={i + 1} lang={lang} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-16 text-center text-muted">{t.nothingFound}</p>
      )}
      <Link to={`/${lang}/agents`} className="label mt-10 inline-block hover:text-ink">
        {t.agents} →
      </Link>
    </main>
  );
}
