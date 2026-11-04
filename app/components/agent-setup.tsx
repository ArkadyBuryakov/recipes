import type { Lang } from "@shared/l10n";
import { useState } from "react";
import { useStoredState } from "~/lib/storage";

type Text = Record<Lang, string>;
/** `text` is shown before the snippet, `after` after it. */
type Block = { title: Text; text?: Text; code?: string; after?: Text };
type Agent = { id: string; label: string | Text; blocks: Block[] };

const READ: Text = { ru: "Только чтение (без входа)", en: "Read only (no login)" };
const OAUTH: Text = { ru: "Редактирование: вход через OAuth", en: "Editing: OAuth login" };
const TOKEN: Text = { ru: "Редактирование: API-токен", en: "Editing: API token" };
const NO_TOKEN: Text = {
  ru: "Свои заголовки здесь не задать, поэтому API-токен не подойдёт — используйте OAuth.",
  en: "Custom headers aren't supported here, so an API token won't work. Use OAuth.",
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Connection instructions per MCP client (ADR 0007): public read-only and editor endpoints. */
function agents(origin: string): Agent[] {
  const pub = `${origin}/mcp`;
  const ed = `${origin}/mcp/editor`;
  const bearer = "Bearer rcp_…";
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      blocks: [
        { title: READ, code: `claude mcp add --transport http recipes ${pub}` },
        {
          title: OAUTH,
          code: `claude mcp add --transport http recipes-editor ${ed}`,
          after: {
            ru: "Затем в Claude Code: /mcp → recipes-editor → Authenticate.",
            en: "Then in Claude Code: /mcp → recipes-editor → Authenticate.",
          },
        },
        {
          title: TOKEN,
          code: `claude mcp add --transport http recipes-editor ${ed} \\\n  --header "Authorization: ${bearer}"`,
        },
      ],
    },
    {
      id: "claude-ai",
      label: "Claude.ai / Desktop",
      blocks: [
        {
          title: { ru: "Подключение", en: "Setup" },
          text: {
            ru: "Настройки → Коннекторы → «Добавить свой коннектор». Название: Recipes, URL — один из адресов ниже. Коннектор, добавленный на claude.ai, появится и в Desktop, и в мобильном приложении. В Team/Enterprise его добавляет владелец организации.",
            en: "Settings → Connectors → Add custom connector. Name: Recipes, URL: one of the addresses below. A connector added on claude.ai also appears in the Desktop and mobile apps. On Team/Enterprise plans, an organization owner adds it.",
          },
        },
        { title: READ, code: pub },
        {
          title: OAUTH,
          code: ed,
          after: {
            ru: "Нажмите «Подключить», войдите в рецепты и подтвердите доступ.",
            en: "Click Connect, sign in to the cookbook and approve access.",
          },
        },
        { title: TOKEN, text: NO_TOKEN },
      ],
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      blocks: [
        {
          title: { ru: "Подключение", en: "Setup" },
          text: {
            ru: "Настройки → Apps & Connectors → Advanced settings → включите Developer mode (доступно не на всех тарифах). Затем «Create»: название, URL ниже и способ авторизации.",
            en: "Settings → Apps & Connectors → Advanced settings → turn on Developer mode (not available on every plan). Then Create: a name, the URL below and the authentication type.",
          },
        },
        {
          title: READ,
          code: pub,
          text: { ru: "Авторизация: No authentication.", en: "Authentication: No authentication." },
        },
        {
          title: OAUTH,
          code: ed,
          after: {
            ru: "Авторизация: OAuth. ChatGPT откроет страницу входа в рецепты.",
            en: "Authentication: OAuth. ChatGPT opens the cookbook's login page.",
          },
        },
        { title: TOKEN, text: NO_TOKEN },
      ],
    },
    {
      id: "codex",
      label: "Codex",
      blocks: [
        { title: READ, code: `codex mcp add recipes --url ${pub}` },
        { title: OAUTH, code: `codex mcp add recipes-editor --url ${ed}\ncodex mcp login recipes-editor` },
        {
          title: TOKEN,
          text: {
            ru: "В ~/.codex/config.toml, токен — в переменной окружения RECIPES_TOKEN:",
            en: "In ~/.codex/config.toml, with the token in the RECIPES_TOKEN environment variable:",
          },
          code: `[mcp_servers.recipes-editor]\nurl = "${ed}"\nbearer_token_env_var = "RECIPES_TOKEN"`,
        },
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      blocks: [
        {
          title: { ru: "Подключение", en: "Setup" },
          text: {
            ru: "Добавьте в ~/.cursor/mcp.json (или .cursor/mcp.json в проекте).",
            en: "Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project).",
          },
        },
        { title: READ, code: json({ mcpServers: { recipes: { url: pub } } }) },
        {
          title: OAUTH,
          code: json({ mcpServers: { "recipes-editor": { url: ed } } }),
          after: {
            ru: "Затем Settings → MCP → recipes-editor → Login.",
            en: "Then Settings → MCP → recipes-editor → Login.",
          },
        },
        {
          title: TOKEN,
          code: json({ mcpServers: { "recipes-editor": { url: ed, headers: { Authorization: bearer } } } }),
        },
      ],
    },
    {
      id: "gemini",
      label: "Gemini CLI",
      blocks: [
        { title: READ, code: `gemini mcp add --transport http recipes ${pub}` },
        {
          title: OAUTH,
          code: `gemini mcp add --transport http recipes-editor ${ed}`,
          after: {
            ru: "Затем в Gemini CLI: /mcp auth recipes-editor.",
            en: "Then in Gemini CLI: /mcp auth recipes-editor.",
          },
        },
        {
          title: TOKEN,
          code: `gemini mcp add --transport http recipes-editor ${ed} \\\n  --header "Authorization: ${bearer}"`,
        },
      ],
    },
    {
      id: "vscode",
      label: "VS Code",
      blocks: [
        {
          title: { ru: "Подключение", en: "Setup" },
          text: {
            ru: "Добавьте в .vscode/mcp.json (или в пользовательский mcp.json: MCP: Open User Configuration).",
            en: "Add to .vscode/mcp.json (or the user mcp.json: MCP: Open User Configuration).",
          },
        },
        { title: READ, code: json({ servers: { recipes: { type: "http", url: pub } } }) },
        {
          title: OAUTH,
          code: json({ servers: { "recipes-editor": { type: "http", url: ed } } }),
          after: {
            ru: "При запуске сервера VS Code предложит войти.",
            en: "VS Code asks you to sign in when the server starts.",
          },
        },
        {
          title: TOKEN,
          code: json({
            servers: { "recipes-editor": { type: "http", url: ed, headers: { Authorization: bearer } } },
          }),
        },
      ],
    },
    {
      id: "other",
      label: { ru: "Другие", en: "Other" },
      blocks: [
        {
          title: { ru: "Любой MCP-клиент", en: "Any MCP client" },
          text: {
            ru: "Транспорт Streamable HTTP. Для редактирования — OAuth 2.1 с динамической регистрацией клиента (адреса находятся автоматически по ответу 401) или заголовок Authorization с API-токеном.",
            en: "Streamable HTTP transport. For editing: OAuth 2.1 with dynamic client registration (discovered automatically from the 401 response), or an Authorization header with an API token.",
          },
        },
        { title: READ, code: pub },
        { title: OAUTH, code: ed },
        { title: TOKEN, code: `${ed}\nAuthorization: ${bearer}` },
      ],
    },
  ];
}

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-1.5">
      <pre className="overflow-x-auto border border-line bg-surface-2 p-2.5 pr-11 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <button
        type="button"
        className="btn btn-ghost absolute top-0.5 right-0.5 min-h-8 bg-surface-2 px-2"
        aria-label="Copy"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "✓" : "⧉"}
      </button>
    </div>
  );
}

export function AgentSetup({ origin, lang }: { origin: string; lang: Lang }) {
  const list = agents(origin);
  const [id, setId] = useStoredState("agent-setup", list[0]?.id ?? "");
  const agent = list.find((a) => a.id === id) ?? list[0];
  if (!agent) return null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        {list.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={a.id === agent.id}
            onClick={() => setId(a.id)}
            className={`min-h-10 border-2 border-line-strong px-3 font-mono text-[13px] font-medium ${a.id === agent.id ? "bg-accent text-accent-ink" : "bg-surface"}`}
          >
            {typeof a.label === "string" ? a.label : a.label[lang]}
          </button>
        ))}
      </div>
      <div className="card mb-6 grid gap-4 p-4 text-sm" role="tabpanel">
        {agent.blocks.map((b) => (
          <div key={b.title.en} className="min-w-0">
            <b>{b.title[lang]}</b>
            {b.text && <p className="mt-1 text-muted">{b.text[lang]}</p>}
            {b.code && <Snippet code={b.code} />}
            {b.after && <p className="mt-1.5 text-muted">{b.after[lang]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
