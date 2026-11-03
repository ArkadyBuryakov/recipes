import { Outlet } from "react-router";
import { requireEditor } from "~/lib/ctx.server";
import type { Route } from "./+types/editor-layout";

export function loader({ context, request }: Route.LoaderArgs) {
  requireEditor(context, request);
  return null;
}

export const meta = () => [{ name: "robots", content: "noindex" }];

export default function EditorLayout() {
  return <Outlet />;
}
