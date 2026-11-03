import { DomainError } from "@server/errors";
import { useState } from "react";
import { data, Form, useActionData } from "react-router";
import { requireAdmin } from "~/lib/ctx.server";
import { useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/admin";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const ctx = requireAdmin(context, request, params.lang === "en" ? "en" : "ru");
  const [users, invites] = await Promise.all([
    ctx.services.users.list(),
    ctx.services.links.pendingInvites(),
  ]);
  return {
    me: ctx.principal.user.id,
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    invites: invites.map((i) => ({
      ...i,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const ctx = requireAdmin(context, request, params.lang === "en" ? "en" : "ru");
  const form = await request.formData();
  const me = ctx.principal.user.id;
  const id = String(form.get("id") ?? "");
  try {
    switch (form.get("intent")) {
      case "invite": {
        const role = form.get("role") === "admin" ? "admin" : "editor";
        const note = String(form.get("note") ?? "").trim();
        const { url } = await ctx.services.links.createInvite(role, me, note || undefined);
        return { link: url, kind: "invite" as const };
      }
      case "revoke-invite":
        await ctx.services.links.revoke(id);
        return null;
      case "reset": {
        const { url } = await ctx.services.links.createReset(id, me);
        return { link: url, kind: "reset" as const };
      }
      case "ban":
        await ctx.services.users.setBanned(id, true, me);
        return null;
      case "unban":
        await ctx.services.users.setBanned(id, false, me);
        return null;
      case "role":
        await ctx.services.users.setRole(id, form.get("role") === "admin" ? "admin" : "editor", me);
        return null;
    }
    return null;
  } catch (e) {
    if (e instanceof DomainError) return data({ error: e.message }, { status: e.status });
    throw e;
  }
}

const TEXT = {
  ru: {
    invite: "Пригласить",
    note: "Кому (для себя)",
    pending: "Активные приглашения",
    copy: "Скопируйте и отправьте ссылку — она одноразовая:",
    reset: "Ссылка для сброса пароля",
    revoke: "Отозвать доступ",
    restore: "Вернуть доступ",
    revoked: "доступ отозван",
    expires: "до",
  },
  en: {
    invite: "Invite",
    note: "Who it's for (note)",
    pending: "Pending invites",
    copy: "Copy and send this one-time link:",
    reset: "Password reset link",
    revoke: "Revoke access",
    restore: "Restore access",
    revoked: "access revoked",
    expires: "until",
  },
};

export default function Admin({ loaderData }: Route.ComponentProps) {
  const lang = useLang();
  const tr = useT();
  const t = TEXT[lang];
  const result = useActionData<typeof action>() as { link?: string; error?: string } | null | undefined;
  const [copied, setCopied] = useState(false);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32">
      <h1 className="mb-5 text-3xl">{tr.admin}</h1>
      {result?.error && <p className="mb-4 rounded-xl bg-danger/10 p-3 text-danger">{result.error}</p>}
      {result?.link && (
        <div className="card mb-5 bg-accent-soft p-4">
          <p className="mb-2 text-sm">{t.copy}</p>
          <div className="flex gap-2">
            <input
              className="input font-mono text-sm"
              readOnly
              value={result.link}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(result.link ?? "");
                setCopied(true);
              }}
            >
              {copied ? "✓" : "⧉"}
            </button>
          </div>
        </div>
      )}

      <Form method="post" className="card mb-6 grid gap-2 p-4 sm:grid-cols-[1fr_140px_auto]">
        <input type="hidden" name="intent" value="invite" />
        <input className="input" name="note" placeholder={t.note} />
        <select className="input" name="role" defaultValue="editor">
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </select>
        <button type="submit" className="btn btn-primary" onClick={() => setCopied(false)}>
          + {t.invite}
        </button>
      </Form>

      {loaderData.invites.length > 0 && (
        <>
          <h2 className="mb-2 text-xl">{t.pending}</h2>
          {loaderData.invites.map((i) => (
            <Form method="post" key={i.id} className="card mb-2 flex items-center gap-3 p-3">
              <input type="hidden" name="intent" value="revoke-invite" />
              <input type="hidden" name="id" value={i.id} />
              <span className="flex-1">
                {i.note || "—"} <span className="tag">{i.role}</span>{" "}
                <span className="text-sm text-muted">
                  {t.expires} {new Date(i.expiresAt).toLocaleDateString(lang)}
                </span>
              </span>
              <button type="submit" className="btn btn-ghost text-danger">
                ✕
              </button>
            </Form>
          ))}
        </>
      )}

      <h2 className="mt-6 mb-2 text-xl">{tr.admin}</h2>
      {loaderData.users.map((u) => (
        <div key={u.id} className="card mb-2 flex flex-wrap items-center gap-2 p-3">
          <span className="min-w-40 flex-1">
            <b>{u.name}</b> <span className="text-muted">{u.email}</span>
            {u.banned && <span className="tag ml-2">{t.revoked}</span>}
          </span>
          {u.id !== loaderData.me && (
            <>
              <Form method="post">
                <input type="hidden" name="intent" value="role" />
                <input type="hidden" name="id" value={u.id} />
                <select
                  className="input min-h-10 w-28"
                  name="role"
                  defaultValue={u.role ?? "editor"}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                >
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="reset" />
                <input type="hidden" name="id" value={u.id} />
                <button
                  type="submit"
                  className="btn min-h-10"
                  title={t.reset}
                  onClick={() => setCopied(false)}
                >
                  🔑
                </button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value={u.banned ? "unban" : "ban"} />
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className={`btn min-h-10 ${u.banned ? "" : "btn-danger"}`}>
                  {u.banned ? t.restore : t.revoke}
                </button>
              </Form>
            </>
          )}
          {u.id === loaderData.me && <span className="tag">{u.role}</span>}
        </div>
      ))}
    </main>
  );
}
