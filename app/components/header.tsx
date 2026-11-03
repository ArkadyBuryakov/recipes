import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";
import { switchLangPath, useLang, useT } from "~/lib/i18n";
import { useTheme } from "~/lib/theme";
import { useRootData } from "~/root";

/** Hidden entry (ADR 0006): 10 taps on the logo within 3 s opens the login page. */
function useSecretTaps(onUnlock: () => void) {
  const taps = useRef<number[]>([]);
  return (e: React.MouseEvent) => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 10) {
      taps.current = [];
      // The logo is a home link; cancel that navigation so the unlock wins.
      e.preventDefault();
      onUnlock();
    }
  };
}

export function Header() {
  const t = useT();
  const lang = useLang();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const root = useRootData();
  const user = root?.user;
  const [theme, nextTheme] = useTheme();
  const [menu, setMenu] = useState(false);
  const onLogoTap = useSecretTaps(() => {
    if (!user) navigate(`/login?next=${encodeURIComponent(pathname)}`);
  });

  return (
    <header className="sticky top-0 z-30 bg-bg print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 border-line-strong border-b-2 px-4 sm:px-6">
        <Link
          to={`/${lang}`}
          onClick={onLogoTap}
          className="select-none font-mono text-lg font-medium lowercase"
          draggable={false}
        >
          <span className="text-muted">[</span>
          {t.appName}
          <span className="text-muted">]</span>
        </Link>
        <div className="flex-1" />
        {user && (
          <div className="relative">
            <button
              type="button"
              className="btn btn-ghost px-3"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
            >
              {user.name} ▾
            </button>
            {menu && (
              <nav
                className="card absolute right-0 mt-1 flex w-56 flex-col p-1.5"
                onClick={() => setMenu(false)}
              >
                <Link className="px-3 py-2.5 font-mono text-sm hover:bg-accent-soft" to={`/${lang}/new`}>
                  + {t.newRecipe}
                </Link>
                <Link className="px-3 py-2.5 font-mono text-sm hover:bg-accent-soft" to={`/${lang}/trash`}>
                  {t.trash}
                </Link>
                {user.role === "admin" && (
                  <Link className="px-3 py-2.5 font-mono text-sm hover:bg-accent-soft" to={`/${lang}/admin`}>
                    {t.admin}
                  </Link>
                )}
                <Link className="px-3 py-2.5 font-mono text-sm hover:bg-accent-soft" to={`/${lang}/tokens`}>
                  {t.tokens}
                </Link>
                <button
                  type="button"
                  className="px-3 py-2.5 text-left font-mono text-sm hover:bg-accent-soft"
                  onClick={async () => {
                    await authClient.signOut();
                    window.location.assign(`/${lang}`);
                  }}
                >
                  {t.logout}
                </button>
              </nav>
            )}
          </div>
        )}
        <div className="flex font-mono">
          {(["ru", "en"] as const).map((l) => (
            <Link
              key={l}
              to={switchLangPath(pathname, l) + search}
              aria-current={l === lang}
              hrefLang={l}
              className={`grid min-h-10 min-w-10 place-items-center px-2 text-[13px] uppercase ${l === lang ? "bg-surface-2 text-ink" : "text-muted"}`}
            >
              {l}
            </Link>
          ))}
        </div>
        <button
          type="button"
          className="btn min-h-10 w-10 px-0"
          title={t.theme[theme]}
          aria-label={t.theme[theme]}
          onClick={nextTheme}
        >
          {theme === "system" ? "◐" : theme === "light" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
}
