import { DomainError } from "@server/errors";
import { EDITOR } from "@server/recipes/service";
import { isLang } from "@shared/l10n";
import type { RecipeDataInput, RecipeStatus } from "@shared/recipe";
import { useState } from "react";
import { data, Link, redirect, useFetcher } from "react-router";
import { cleanRecipe, type EditorLangs, emptyRecipe, RecipeForm } from "~/components/recipe-form";
import { requireEditor } from "~/lib/ctx.server";
import { useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/editor";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const ctx = requireEditor(context, request);
  if (!params.slug) return { recipe: null };
  try {
    const {
      id: _id,
      slug,
      status,
      version,
      updatedAt: _u,
      ...recipe
    } = await ctx.services.recipes.get(params.slug, EDITOR);
    return { recipe: { slug, status, version, data: recipe as RecipeDataInput } };
  } catch (e) {
    if (e instanceof DomainError && e.code === "not_found") throw data(null, { status: 404 });
    throw e;
  }
}

type Body = {
  intent: "save" | "delete";
  slug: string;
  status: RecipeStatus;
  recipe: unknown;
  expectedVersion?: number;
};

export async function action({ context, request, params }: Route.ActionArgs) {
  const ctx = requireEditor(context, request);
  const lang = isLang(params.lang) ? params.lang : "ru";
  const body = (await request.json()) as Body;
  const actor = ctx.principal.actor;
  const svc = ctx.services.recipes;
  try {
    if (body.intent === "delete" && params.slug) {
      await svc.remove(params.slug, actor);
      return redirect(`/${lang}`);
    }
    const saved = params.slug
      ? await svc.update(
          params.slug,
          {
            recipe: body.recipe,
            slug: body.slug,
            status: body.status,
            ...(body.expectedVersion !== undefined && { expectedVersion: body.expectedVersion }),
          },
          actor,
        )
      : await svc.create({ slug: body.slug, status: body.status, recipe: body.recipe }, actor);
    return redirect(`/${lang}/r/${saved.slug}`);
  } catch (e) {
    if (e instanceof DomainError) return data({ error: e.message, issues: e.issues }, { status: e.status });
    throw e;
  }
}

export default function Editor({ loaderData }: Route.ComponentProps) {
  const lang = useLang();
  const tr = useT();
  const existing = loaderData.recipe;
  const [draft, setDraft] = useState<RecipeDataInput>(existing?.data ?? emptyRecipe());
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [status, setStatus] = useState<RecipeStatus>(existing?.status ?? "draft");
  const [langs, setLangs] = useState<EditorLangs>("both");
  const fetcher = useFetcher<typeof action>();
  const saving = fetcher.state !== "idle";
  const result = fetcher.data as { error?: string; issues?: string[] } | undefined;

  const submit = (intent: Body["intent"]) =>
    fetcher.submit(
      {
        intent,
        slug,
        status,
        recipe: cleanRecipe(draft),
        ...(existing && { expectedVersion: existing.version }),
      } as never,
      { method: "post", encType: "application/json" },
    );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-6 pb-32">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl">{existing ? tr.edit : tr.newRecipe}</h1>
        <div className="flex overflow-hidden rounded-xl border border-line">
          {(["ru", "en", "both"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLangs(l)}
              className={`min-h-10 px-3 text-sm font-semibold uppercase ${langs === l ? "bg-ink text-bg" : "bg-surface"}`}
            >
              {l === "both" ? "RU+EN" : l}
            </button>
          ))}
        </div>
      </div>

      {result?.error && (
        <div
          className="mb-5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          <b>{result.error}</b>
          {result.issues && result.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {result.issues.map((i) => (
                <li key={i} className="font-mono text-xs">
                  {i}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <RecipeForm draft={draft} setDraft={setDraft} slug={slug} setSlug={setSlug} langs={langs} />

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex flex-wrap items-center gap-2 border-line border-t bg-bg px-4 py-3">
        <select
          className="input w-40"
          value={status}
          onChange={(e) => setStatus(e.target.value as RecipeStatus)}
        >
          <option value="draft">{tr.draft}</option>
          <option value="published">published</option>
        </select>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => submit("save")}>
          {saving ? "…" : "Save"}
        </button>
        {existing && (
          <Link className="btn btn-ghost" to={`/${lang}/r/${existing.slug}`}>
            Cancel
          </Link>
        )}
        {existing && (
          <button
            type="button"
            className="btn btn-danger ml-auto"
            disabled={saving}
            onClick={() => submit("delete")}
          >
            🗑 {tr.trash}
          </button>
        )}
      </div>
    </main>
  );
}
