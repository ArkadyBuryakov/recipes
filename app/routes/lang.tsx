import { isLang } from "@shared/l10n";
import { data, Outlet } from "react-router";
import { Header } from "~/components/header";
import { TimerTray } from "~/components/timers";
import type { Route } from "./+types/lang";

export function loader({ params }: Route.LoaderArgs) {
  if (!isLang(params.lang)) throw data(null, { status: 404 });
  return null;
}

export default function LangLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <Outlet />
      <TimerTray />
    </div>
  );
}
