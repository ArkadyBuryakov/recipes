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
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link
          to={`/${lang}`}
          onClick={onLogoTap}
          className="select-none font-serif text-[22px] font-bold"
          draggable={false}
        >
          {t.appName}
          <span className="text-accent">.</span>
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
                className="card absolute right-0 mt-1 flex w-56 flex-col p-1.5 shadow-lg"
                onClick={() => setMenu(false)}
              >
                <Link className="rounded-lg px-3 py-2.5 hover:bg-surface-2" to={`/${lang}/new`}>
                  + {t.newRecipe}
                </Link>
                <Link className="rounded-lg px-3 py-2.5 hover:bg-surface-2" to={`/${lang}/trash`}>
                  {t.trash}
                </Link>
                {user.role === "admin" && (
                  <Link className="rounded-lg px-3 py-2.5 hover:bg-surface-2" to={`/${lang}/admin`}>
                    {t.admin}
                  </Link>
                )}
                <Link className="rounded-lg px-3 py-2.5 hover:bg-surface-2" to={`/${lang}/tokens`}>
                  {t.tokens}
                </Link>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2.5 text-left hover:bg-surface-2"
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
        <div className="flex overflow-hidden rounded-xl border border-line">
          {(["ru", "en"] as const).map((l) => (
            <Link
              key={l}
              to={switchLangPath(pathname, l) + search}
              aria-current={l === lang}
              hrefLang={l}
              className={`grid min-h-10 min-w-10 place-items-center px-2 text-sm font-semibold uppercase ${l === lang ? "bg-ink text-bg" : "bg-surface"}`}
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
