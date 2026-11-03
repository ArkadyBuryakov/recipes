import { DomainError } from "@server/errors";
import { data, Form, Link, useActionData, useNavigation } from "react-router";
import { AuthShell, ErrorText, Field } from "~/components/auth-shell";
import { getCtx } from "~/lib/ctx.server";
import { dictionaries, langFromRequest } from "~/lib/i18n";
import type { Route } from "./+types/reset";

const TEXT = {
  ru: {
    title: "Новый пароль",
    invalid: "Ссылка недействительна или устарела.",
    save: "Сохранить",
    done: "Пароль изменён.",
  },
  en: {
    title: "New password",
    invalid: "This link is invalid or has expired.",
    save: "Save",
    done: "Password changed.",
  },
};

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const link = await getCtx(context).services.links.find(params.token, "reset");
  return { lang: langFromRequest(request), valid: Boolean(link) };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const form = await request.formData();
  try {
    await getCtx(context).services.links.resetPassword(params.token, String(form.get("password") ?? ""));
    return { ok: true as const };
  } catch (e) {
    if (e instanceof DomainError) return data({ ok: false as const, error: e.message }, { status: e.status });
    throw e;
  }
}

export const meta = () => [{ title: "Reset password" }, { name: "robots", content: "noindex" }];

export default function Reset({ loaderData }: Route.ComponentProps) {
  const t = TEXT[loaderData.lang];
  const d = dictionaries[loaderData.lang];
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  if (result?.ok)
    return (
      <AuthShell title={t.title}>
        <p className="mb-4">{t.done}</p>
        <Link className="btn btn-primary" to="/login">
          {d.login}
        </Link>
      </AuthShell>
    );
  if (!loaderData.valid)
    return (
      <AuthShell title={t.title}>
        <p className="text-muted">{t.invalid}</p>
      </AuthShell>
    );
  return (
    <AuthShell title={t.title}>
      <Form method="post">
        <ErrorText>{result && !result.ok && result.error}</ErrorText>
        <Field
          label={d.password}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <button type="submit" className="btn btn-primary mt-2 w-full" disabled={busy}>
          {t.save}
        </button>
      </Form>
    </AuthShell>
  );
}
