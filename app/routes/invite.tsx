import { DomainError } from "@server/errors";
import { useEffect, useState } from "react";
import { data, Form, useActionData, useNavigation } from "react-router";
import { AuthShell, ErrorText, Field } from "~/components/auth-shell";
import { authClient } from "~/lib/auth-client";
import { getCtx } from "~/lib/ctx.server";
import { dictionaries, langFromRequest } from "~/lib/i18n";
import type { Route } from "./+types/invite";

const TEXT = {
  ru: { title: "Приглашение", invalid: "Ссылка недействительна или устарела.", create: "Создать аккаунт" },
  en: { title: "Invitation", invalid: "This link is invalid or has expired.", create: "Create account" },
};

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const link = await getCtx(context).services.links.find(params.token, "invite");
  return { lang: langFromRequest(request), valid: Boolean(link) };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const form = Object.fromEntries(await request.formData());
  try {
    await getCtx(context).services.links.acceptInvite(params.token, form);
    return { ok: true as const, email: String(form.email), password: String(form.password) };
  } catch (e) {
    if (e instanceof DomainError)
      return data({ ok: false as const, error: [e.message, ...e.issues].join(". ") }, { status: e.status });
    throw e;
  }
}

export const meta = () => [{ title: "Invite" }, { name: "robots", content: "noindex" }];

export default function Invite({ loaderData }: Route.ComponentProps) {
  const t = TEXT[loaderData.lang];
  const d = dictionaries[loaderData.lang];
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const [signInError, setSignInError] = useState("");

  // Account created: sign in with the same credentials and continue to the site.
  useEffect(() => {
    if (!result?.ok) return;
    void authClient.signIn.email({ email: result.email, password: result.password }).then(({ error }) => {
      if (error) setSignInError(error.message ?? "Login failed");
      else window.location.assign(`/${loaderData.lang}`);
    });
  }, [result, loaderData.lang]);

  if (!loaderData.valid && !result?.ok)
    return (
      <AuthShell title={t.title}>
        <p className="text-muted">{t.invalid}</p>
      </AuthShell>
    );

  return (
    <AuthShell title={t.title}>
      <Form method="post">
        <ErrorText>{(result && !result.ok && result.error) || signInError}</ErrorText>
        <Field label={d.name} name="name" autoComplete="name" required />
        <Field label={d.email} name="email" type="email" autoComplete="username" required />
        <Field
          label={d.password}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <button type="submit" className="btn btn-primary mt-2 w-full" disabled={busy || result?.ok}>
          {t.create}
        </button>
      </Form>
    </AuthShell>
  );
}
