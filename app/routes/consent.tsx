import { useEffect, useState } from "react";
import { redirect, useSearchParams } from "react-router";
import { AuthShell, ErrorText, followRedirect } from "~/components/auth-shell";
import { authClient } from "~/lib/auth-client";
import { getCtx } from "~/lib/ctx.server";
import { langFromRequest } from "~/lib/i18n";
import type { Route } from "./+types/consent";

const TEXT = {
  ru: {
    title: "Доступ для агента",
    body: "запрашивает доступ к редактированию рецептов от вашего имени.",
    allow: "Разрешить",
    deny: "Отклонить",
    as: "Вы вошли как",
  },
  en: {
    title: "Agent access",
    body: "wants to edit recipes on your behalf.",
    allow: "Allow",
    deny: "Deny",
    as: "Signed in as",
  },
};

export function loader({ context, request }: Route.LoaderArgs) {
  const principal = getCtx(context).principal;
  const url = new URL(request.url);
  if (!principal) throw redirect(`/login${url.search}`);
  return { lang: langFromRequest(request), user: principal.user };
}

export const meta = () => [{ title: "Consent" }, { name: "robots", content: "noindex" }];

/** OAuth consent for MCP clients connecting to /mcp/editor (ADR 0007). */
export default function Consent({ loaderData }: Route.ComponentProps) {
  const t = TEXT[loaderData.lang];
  const [params] = useSearchParams();
  const clientId = params.get("client_id") ?? "";
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);
  const [client, setClient] = useState<string>(clientId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then(({ data }) => {
        const name = (data as { client_name?: string } | null)?.client_name;
        if (name) setClient(name);
      })
      .catch(() => {});
  }, [clientId]);

  const decide = async (accept: boolean) => {
    setBusy(true);
    const { data, error } = await authClient.oauth2.consent({ accept });
    setBusy(false);
    if (error) return setError(error.message ?? "Error");
    followRedirect(data, "/");
  };

  return (
    <AuthShell title={t.title}>
      <p className="mb-3 text-lg">
        <b>{client}</b> {t.body}
      </p>
      {scopes.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-1.5">
          {scopes.map((s) => (
            <li key={s} className="pill">
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="mb-5 text-sm text-muted">
        {t.as} {loaderData.user.email}
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>
          {t.allow}
        </button>
        <button type="button" className="btn flex-1" disabled={busy} onClick={() => decide(false)}>
          {t.deny}
        </button>
      </div>
    </AuthShell>
  );
}
