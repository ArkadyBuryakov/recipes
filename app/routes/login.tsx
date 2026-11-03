import { useState } from "react";
import { redirect, useSearchParams } from "react-router";
import { AuthShell, ErrorText, Field, followRedirect } from "~/components/auth-shell";
import { authClient } from "~/lib/auth-client";
import { getCtx } from "~/lib/ctx.server";
import { dictionaries, langFromRequest } from "~/lib/i18n";
import type { Route } from "./+types/login";

const isOAuthFlow = (params: URLSearchParams) => params.has("client_id") || params.has("sig");

export function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const lang = langFromRequest(request);
  const next = url.searchParams.get("next");
  if (getCtx(context).principal && !isOAuthFlow(url.searchParams))
    throw redirect(next?.startsWith("/") ? next : `/${lang}`);
  return { lang };
}

export const meta = () => [{ title: "Login" }, { name: "robots", content: "noindex" }];

export default function Login({ loaderData }: Route.ComponentProps) {
  const t = dictionaries[loaderData.lang];
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = params.get("next");

  return (
    <AuthShell title={t.login}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          const { data, error } = await authClient.signIn.email({
            email: String(form.get("email")),
            password: String(form.get("password")),
          });
          setBusy(false);
          if (error) return setError(error.message ?? "Login failed");
          followRedirect(data, next?.startsWith("/") ? next : `/${loaderData.lang}`);
        }}
      >
        <ErrorText>{error}</ErrorText>
        <Field label={t.email} name="email" type="email" autoComplete="username" required />
        <Field label={t.password} name="password" type="password" autoComplete="current-password" required />
        <button type="submit" className="btn btn-primary mt-2 w-full" disabled={busy}>
          {t.signIn}
        </button>
      </form>
    </AuthShell>
  );
}
