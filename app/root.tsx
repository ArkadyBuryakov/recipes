import { isLang } from "@shared/l10n";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useParams,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { getCtx } from "./lib/ctx.server";
import { dictionaries, useLang } from "./lib/i18n";
import { TimersProvider } from "./lib/timers";

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = getCtx(context);
  return { user: ctx.principal?.user ?? null, vapidPublicKey: ctx.vapidPublicKey };
}

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/icon-192.png" },
];

// Applied before paint so the chosen theme never flashes (system | light | dark in localStorage).
const THEME_SCRIPT = `(()=>{try{var t=JSON.parse(localStorage.getItem("recipes:theme"))||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams();
  return (
    <html lang={isLang(lang) ? lang : "ru"} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#faf8f5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#161412" media="(prefers-color-scheme: dark)" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function useRootData() {
  return useRouteLoaderData<typeof loader>("root");
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <TimersProvider vapidKey={loaderData.vapidPublicKey}>
      <Outlet />
    </TimersProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const t = dictionaries[useLang()];
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-3xl">{notFound ? t.notFound : t.error}</h1>
      <a className="btn" href="/">
        {t.allRecipes}
      </a>
    </main>
  );
}
