import { appContext } from "@server/context";
import type { Lang } from "@shared/l10n";
import { type RouterContextProvider, redirect } from "react-router";

export function getCtx(context: Readonly<RouterContextProvider>) {
  return context.get(appContext);
}

/** Editor-only routes: anonymous visitors are sent to the (unlinked) login page. */
export function requireEditor(context: Readonly<RouterContextProvider>, request: Request) {
  const ctx = getCtx(context);
  if (!ctx.principal) {
    const next = new URL(request.url);
    throw redirect(`/login?next=${encodeURIComponent(next.pathname + next.search)}`);
  }
  return { ...ctx, principal: ctx.principal };
}

export function requireAdmin(context: Readonly<RouterContextProvider>, request: Request, lang: Lang) {
  const ctx = requireEditor(context, request);
  if (ctx.principal.user.role !== "admin") throw redirect(`/${lang}`);
  return ctx;
}
