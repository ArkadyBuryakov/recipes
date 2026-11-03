import { EDITOR } from "@server/recipes/service";
import { t } from "@shared/l10n";
import { Form } from "react-router";
import { requireEditor } from "~/lib/ctx.server";
import { useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/trash";

export async function loader({ context, request }: Route.LoaderArgs) {
  const ctx = requireEditor(context, request);
  return { items: (await ctx.services.recipes.list(EDITOR, { deleted: true })).items };
}

export async function action({ context, request }: Route.ActionArgs) {
  const ctx = requireEditor(context, request);
  const form = await request.formData();
  await ctx.services.recipes.restore(String(form.get("slug")), ctx.principal.actor);
  return null;
}

export default function Trash({ loaderData }: Route.ComponentProps) {
  const lang = useLang();
  const tr = useT();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32">
      <h1 className="mb-5 text-3xl">{tr.trash}</h1>
      {loaderData.items.length === 0 && <p className="text-muted">—</p>}
      {loaderData.items.map((r) => (
        <Form method="post" key={r.slug} className="card mb-2 flex items-center gap-3 p-3">
          <span className="flex-1">{t(r.title, lang)}</span>
          <input type="hidden" name="slug" value={r.slug} />
          <button type="submit" className="btn">
            ↺ {lang === "ru" ? "Восстановить" : "Restore"}
          </button>
        </Form>
      ))}
    </main>
  );
}
