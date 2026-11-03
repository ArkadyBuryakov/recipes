import { isLang } from "@shared/l10n";
import { data, Outlet } from "react-router";
import { Header } from "~/components/header";
import { TimerTray } from "~/components/timers";
import { useT } from "~/lib/i18n";
import { useOnline } from "~/lib/pwa";
import type { Route } from "./+types/lang";

export function loader({ params }: Route.LoaderArgs) {
  if (!isLang(params.lang)) throw data(null, { status: 404 });
  return null;
}

export default function LangLayout() {
  const online = useOnline();
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      {!online && <p className="bg-surface-2 px-4 py-2 text-center text-sm text-muted">{t.offline}</p>}
      <Outlet />
      <TimerTray />
    </div>
  );
}
