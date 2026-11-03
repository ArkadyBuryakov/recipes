import { auth } from "@server/auth";
import { useState } from "react";
import { Form, useActionData } from "react-router";
import { requireEditor } from "~/lib/ctx.server";
import { useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/tokens";

type KeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: string;
  lastRequest: string | null;
  enabled: boolean;
};

export async function loader({ context, request }: Route.LoaderArgs) {
  const ctx = requireEditor(context, request);
  const res = (await auth.api.listApiKeys({ headers: request.headers })) as unknown as
    | { apiKeys: Record<string, unknown>[] }
    | Record<string, unknown>[];
  const list = Array.isArray(res) ? res : res.apiKeys;
  const keys: KeyRow[] = list.map((k) => ({
    id: String(k.id),
    name: (k.name as string | null) ?? null,
    start: (k.start as string | null) ?? null,
    createdAt: new Date(k.createdAt as string).toISOString(),
    lastRequest: k.lastRequest ? new Date(k.lastRequest as string).toISOString() : null,
    enabled: k.enabled !== false,
  }));
  return { keys, origin: ctx.publicUrl };
}

export async function action({ context, request }: Route.ActionArgs) {
  requireEditor(context, request);
  const form = await request.formData();
  if (form.get("intent") === "create") {
    const created = await auth.api.createApiKey({
      headers: request.headers,
      body: { name: String(form.get("name") ?? "").trim() || "agent" },
    });
    return { key: created.key };
  }
  await auth.api.deleteApiKey({ headers: request.headers, body: { keyId: String(form.get("id")) } });
  return null;
}

const TEXT = {
  ru: {
    endpoints: "MCP-серверы",
    public: "Публичный, только чтение, без авторизации",
    editor: "Для редактирования: OAuth (агент откроет страницу входа) или API-токен",
    tokens: "API-токены",
    name: "Название (агент, скрипт)",
    create: "Создать токен",
    once: "Скопируйте токен сейчас — он больше не будет показан:",
    used: "использован",
    never: "не использовался",
  },
  en: {
    endpoints: "MCP servers",
    public: "Public, read-only, no auth",
    editor: "For editing: OAuth (the agent opens a login page) or an API token",
    tokens: "API tokens",
    name: "Name (agent, script)",
    create: "Create token",
    once: "Copy the token now — it won't be shown again:",
    used: "last used",
    never: "never used",
  },
};

function Snippet({ children }: { children: string }) {
  return <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs">{children}</pre>;
}

export default function Tokens({ loaderData }: Route.ComponentProps) {
  const lang = useLang();
  const tr = useT();
  const t = TEXT[lang];
  const result = useActionData<typeof action>();
  const [copied, setCopied] = useState(false);
  const { origin, keys } = loaderData;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32">
      <h1 className="mb-5 text-3xl">{tr.tokens}</h1>

      <h2 className="mb-2 text-xl">{t.endpoints}</h2>
      <div className="card mb-6 grid gap-4 p-4 text-sm">
        <div>
          <b>{t.public}</b>
          <Snippet>{`claude mcp add --transport http recipes ${origin}/mcp`}</Snippet>
        </div>
        <div>
          <b>{t.editor}</b>
          <Snippet>{`claude mcp add --transport http recipes-editor ${origin}/mcp/editor`}</Snippet>
          <Snippet>{`claude mcp add --transport http recipes-editor ${origin}/mcp/editor \\\n  --header "Authorization: Bearer rcp_…"`}</Snippet>
        </div>
      </div>

      <h2 className="mb-2 text-xl">{t.tokens}</h2>
      {result?.key && (
        <div className="card mb-4 border-accent p-4">
          <p className="mb-2 text-sm">{t.once}</p>
          <div className="flex gap-2">
            <input
              className="input font-mono text-sm"
              readOnly
              value={result.key}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(result.key);
                setCopied(true);
              }}
            >
              {copied ? "✓" : "⧉"}
            </button>
          </div>
        </div>
      )}
      <Form method="post" className="card mb-4 flex gap-2 p-3">
        <input type="hidden" name="intent" value="create" />
        <input className="input" name="name" placeholder={t.name} />
        <button type="submit" className="btn btn-primary" onClick={() => setCopied(false)}>
          {t.create}
        </button>
      </Form>
      {keys.map((k) => (
        <Form method="post" key={k.id} className="card mb-2 flex items-center gap-3 p-3">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={k.id} />
          <span className="flex-1">
            <b>{k.name}</b> <span className="font-mono text-sm text-muted">{k.start}…</span>
            <span className="block text-xs text-muted">
              {k.lastRequest ? `${t.used} ${new Date(k.lastRequest).toLocaleString(lang)}` : t.never}
            </span>
          </span>
          <button type="submit" className="btn btn-ghost text-danger">
            ✕
          </button>
        </Form>
      ))}
    </main>
  );
}
