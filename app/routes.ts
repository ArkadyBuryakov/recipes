import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/root-redirect.tsx"),
  route("login", "routes/login.tsx"),
  route("consent", "routes/consent.tsx"),
  route("invite/:token", "routes/invite.tsx"),
  route("reset/:token", "routes/reset.tsx"),
  route(":lang", "routes/lang.tsx", [
    index("routes/home.tsx"),
    route("r/:slug", "routes/recipe.tsx"),
    layout("routes/editor-layout.tsx", [
      route("new", "routes/editor.tsx", { id: "recipe-new" }),
      route("r/:slug/edit", "routes/editor.tsx", { id: "recipe-edit" }),
      route("r/:slug/history", "routes/history.tsx"),
      route("trash", "routes/trash.tsx"),
      route("admin", "routes/admin.tsx"),
      route("tokens", "routes/tokens.tsx"),
    ]),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
