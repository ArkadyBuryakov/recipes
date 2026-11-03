import { redirect } from "react-router";
import { langFromRequest } from "~/lib/i18n";
import type { Route } from "./+types/root-redirect";

export function loader({ request }: Route.LoaderArgs) {
  return redirect(`/${langFromRequest(request)}`);
}
