import { DomainError } from "@server/errors";
import { data, Form, Link, redirect } from "react-router";
import { requireEditor } from "~/lib/ctx.server";
import { diffLines, withContext } from "~/lib/diff";
import { useLang } from "~/lib/i18n";
import type { Route } from "./+types/history";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const ctx = requireEditor(context, request);
  try {
    const revisions = await ctx.services.recipes.revisions(params.slug);
    return {
      slug: params.slug,
      revisions: revisions.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        json: JSON.stringify(r.snapshot, null, 2),
      })),
    };
  } catch (e) {
    if (e instanceof DomainError && e.code === "not_found") throw data(null, { status: 404 });
    throw e;
  }
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const ctx = requireEditor(context, request);
  const form = await request.formData();
  const restored = await ctx.services.recipes.restoreRevision(
    params.slug,
    Number(form.get("revision")),
    ctx.principal.actor,
  );
  return redirect(`/${params.lang}/r/${restored.slug}`);
}

const ACTOR = { user: "web", api_key: "API token", oauth: "MCP (OAuth)", system: "system" } as const;

/** Audit history with a diff against the previous version and one-click restore (ADR 0001, round-2 E4). */
export default function History({ loaderData }: Route.ComponentProps) {
  const lang = useLang();
  const { slug, revisions } = loaderData;
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-6 pb-32">
      <Link to={`/${lang}/r/${slug}`} className="text-link">
        ← {slug}
      </Link>
      <h1 className="mt-2 mb-5 text-3xl">{lang === "ru" ? "История изменений" : "History"}</h1>
      {revisions.map((rev, i) => {
        const prev = revisions[i + 1];
        // Diff output is static (never reorders), so its position is a stable key.
        const lines = prev
          ? withContext(diffLines(prev.json, rev.json)).map((l, pos) => ({ ...l, pos }))
          : [];
        return (
          <details key={rev.id} className="card mb-2 px-4" open={i === 0}>
            <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 py-3">
              <b>v{rev.version}</b>
              <span className="tag">{rev.action}</span>
              <span className="text-muted">
                {new Date(rev.createdAt).toLocaleString(lang)} · {rev.actorName ?? ACTOR[rev.actorKind]} ·{" "}
                {rev.channel}
                {rev.actorKind !== "user" && rev.actorName ? ` (${ACTOR[rev.actorKind]})` : ""}
              </span>
            </summary>
            {prev ? (
              <pre className="mb-3 max-h-96 overflow-auto rounded-lg bg-surface-2 p-2 text-xs leading-5">
                {lines.map((l) =>
                  l.kind === "gap" ? (
                    <div key={`g${l.pos}`} className="text-muted">
                      ⋯ {l.count}
                    </div>
                  ) : (
                    <div
                      key={`l${l.pos}`}
                      className={
                        l.kind === "add"
                          ? "bg-ok/15 text-ok"
                          : l.kind === "del"
                            ? "bg-danger/10 text-danger"
                            : ""
                      }
                    >
                      {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
                      {l.text}
                    </div>
                  ),
                )}
              </pre>
            ) : (
              <p className="mb-3 text-muted">{lang === "ru" ? "Первая версия" : "First version"}</p>
            )}
            {i > 0 && (
              <Form method="post" className="mb-3">
                <input type="hidden" name="revision" value={rev.id} />
                <button type="submit" className="btn">
                  ↺ {lang === "ru" ? "Восстановить эту версию" : "Restore this version"}
                </button>
              </Form>
            )}
          </details>
        );
      })}
    </main>
  );
}
