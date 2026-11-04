import { isLang, type Lang } from "@shared/l10n";
import { Link } from "react-router";
import { AgentSetup } from "~/components/agent-setup";
import { getCtx } from "~/lib/ctx.server";
import { useLang, useT } from "~/lib/i18n";
import type { Route } from "./+types/agents";

export function loader({ context, params }: Route.LoaderArgs) {
  return { origin: getCtx(context).publicUrl, lang: isLang(params.lang) ? params.lang : "ru" };
}

const TEXT = {
  ru: {
    title: "Рецепты в ИИ-агенте",
    intro:
      "У сайта есть MCP-сервер: подключите его к Claude, ChatGPT или другому агенту, и он сможет искать рецепты, пересчитывать порции и собирать списки покупок. Вход не нужен.",
    examples: "Например, спросите",
    prompts: [
      "Что приготовить из куриных бёдер?",
      "Список покупок для хинкали на 6 порций",
      "Что нужно подготовить заранее для лазаньи?",
    ],
    setup: "Подключение",
  },
  en: {
    title: "Recipes in your AI agent",
    intro:
      "The site has an MCP server: connect it to Claude, ChatGPT or another agent, and it can search recipes, scale servings and build shopping lists. No login needed.",
    examples: "For example, ask",
    prompts: [
      "What can I cook with chicken thighs?",
      "Shopping list for khinkali for 6",
      "What do I need to prep ahead for lasagna?",
    ],
    setup: "Setup",
  },
} satisfies Record<Lang, unknown>;

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [];
  const t = TEXT[data.lang];
  return [
    { title: t.title },
    { name: "description", content: t.intro },
    { tagName: "link", rel: "canonical", href: `${data.origin}/${data.lang}/agents` },
  ];
}

/** Public MCP instructions (ADR 0007): read-only server only; editors get the full set on /tokens. */
export default function Agents({ loaderData }: Route.ComponentProps) {
  const lang = useLang();
  const tr = useT();
  const t = TEXT[lang];
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32">
      <Link to={`/${lang}`} className="font-mono text-sm text-muted hover:text-ink">
        ← {tr.allRecipes}
      </Link>
      <h1 className="mt-3 mb-3 text-3xl">{t.title}</h1>
      <p className="mb-5 max-w-2xl text-muted">{t.intro}</p>
      <div className="card mb-8 p-4 text-sm">
        <b>{t.examples}:</b>
        <ul className="mt-2 grid gap-1.5">
          {t.prompts.map((p) => (
            <li key={p} className="font-mono">
              › {p}
            </li>
          ))}
        </ul>
      </div>
      <h2 className="mb-2 text-xl">{t.setup}</h2>
      <AgentSetup origin={loaderData.origin} lang={lang} editor={false} />
    </main>
  );
}
