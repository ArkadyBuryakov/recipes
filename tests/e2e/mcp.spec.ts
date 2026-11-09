import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN } from "../../playwright.config";
import { callTool, login, mcp } from "./helpers";

const recipe = {
  title: { ru: "Гренки", en: "Croutons" },
  servings: { amount: 2 },
  tags: [{ ru: "закуска", en: "snack" }],
  sections: [
    {
      id: "main",
      ingredients: [
        {
          id: "bread",
          name: { ru: "Хлеб", en: "Bread" },
          qty: { min: 200 },
          unit: "g",
          prep: { ru: "кубиками", en: "cubed" },
        },
        { id: "oil", name: { ru: "Масло", en: "Oil" }, qty: { min: 2 }, unit: "tbsp" },
      ],
      steps: [
        {
          id: "s1",
          text: {
            ru: "Обжарить {{ing:bread}} в {{ing:oil|масле}} {{timer:5m}}",
            en: "Fry {{ing:bread}} in {{ing:oil}} {{timer:5m}}",
          },
        },
      ],
    },
  ],
};

test.describe("MCP", () => {
  test("public endpoint is read-only and returns urls", async ({ baseURL }) => {
    const init = await mcp(baseURL!, "/mcp", "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "e2e", version: "1" },
    });
    expect(init.status).toBe(200);
    const { body } = await mcp(baseURL!, "/mcp", "tools/list");
    const names = ((body.result?.tools ?? []) as { name: string }[]).map((t) => t.name).sort();
    expect(names).toEqual([
      "get_prep_list",
      "get_recipe",
      "get_recipe_schema",
      "list_recipes",
      "list_tags",
      "search_recipes",
      "shopping_list",
    ]);

    const search = await callTool(baseURL!, "/mcp", "search_recipes", {
      ingredients: ["chicken"],
      lang: "en",
    });
    const found = JSON.parse(search.text).recipes as { slug: string; url: string }[];
    expect(found.some((r) => r.slug === "chicken-teriyaki")).toBe(true);
    expect(found[0]?.url).toMatch(/^http.*\/en\/r\//);

    const md = await callTool(baseURL!, "/mcp", "get_recipe", {
      slug: "chicken-teriyaki",
      lang: "en",
      servings: 4,
    });
    expect(md.text).toContain("# ");
    expect(md.text).toContain("/en/r/chicken-teriyaki");

    const missing = await callTool(baseURL!, "/mcp", "get_recipe", { slug: "nope" });
    expect(missing.isError).toBe(true);
  });

  test("editor endpoint challenges unauthenticated clients", async ({ baseURL }) => {
    const res = await mcp(baseURL!, "/mcp/editor", "tools/list");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
    const meta = await (
      await fetch(new URL("/.well-known/oauth-protected-resource/mcp/editor", baseURL))
    ).json();
    expect(meta.resource).toBe(`${baseURL}/mcp/editor`);
  });

  test("tokens page: setup instructions per agent", async ({ page }) => {
    await login(page, "/en");
    await page.goto("/en/tokens");
    await expect(page.getByRole("tabpanel")).toContainText("claude mcp add --transport http recipes ");
    await page.getByRole("tab", { name: "Cursor" }).click();
    await expect(page.getByRole("tabpanel")).toContainText('"mcpServers"');
    await page.getByRole("tab", { name: "ChatGPT" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Developer mode");
  });

  test("API token: create, publish and find a recipe", async ({ page, baseURL }) => {
    await login(page, "/en");
    await page.goto("/en/tokens");
    await page.getByPlaceholder(/Name/).fill("e2e agent");
    await page.getByRole("button", { name: "Create token" }).click();
    const token = await page.locator("input[readonly]").inputValue();
    expect(token).toMatch(/^rcp_/);

    const bad = await callTool(
      baseURL!,
      "/mcp/editor",
      "create_recipe",
      {
        slug: "bad",
        recipe: {
          ...recipe,
          sections: [
            {
              ...recipe.sections[0],
              ingredients: [{ id: "x", name: { en: "X" }, qty: { min: 1 }, unit: "oz" }],
            },
          ],
        },
      },
      token,
    );
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("imperial unit");

    const created = await callTool(
      baseURL!,
      "/mcp/editor",
      "create_recipe",
      { slug: "croutons", recipe },
      token,
    );
    expect(created.isError).toBe(false);
    expect(JSON.parse(created.text).status).toBe("draft");
    expect((await callTool(baseURL!, "/mcp", "get_recipe", { slug: "croutons" })).isError).toBe(true);

    await callTool(baseURL!, "/mcp/editor", "publish_recipe", { slug: "croutons" }, token);
    const pub = await callTool(baseURL!, "/mcp", "get_recipe", { slug: "croutons", lang: "ru" });
    expect(pub.text).toContain("Обжарить хлеб (200 г) в масле (2 ст. л.) 5 мин");

    const history = await page.goto("/en/r/croutons/history");
    expect(history?.status()).toBe(200);
    await expect(page.getByText(/API token/).first()).toBeVisible();
  });

  test("OAuth: register, login, consent, token, call tools", async ({ browser, baseURL }) => {
    const redirect = "http://127.0.0.1:9/callback";
    const reg = await fetch(new URL("/api/auth/oauth2/register", baseURL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "E2E Agent",
        redirect_uris: [redirect],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(reg.status).toBeLessThan(300);
    const { client_id } = (await reg.json()) as { client_id: string };

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const resource = `${baseURL}/mcp/editor`;
    const authorize = new URL("/api/auth/oauth2/authorize", baseURL);
    for (const [k, v] of Object.entries({
      response_type: "code",
      client_id,
      redirect_uri: redirect,
      scope: "openid profile offline_access",
      state: "xyz",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource,
    }))
      authorize.searchParams.set(k, v);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let callback = "";
    await page.route("http://127.0.0.1:9/**", (route) => {
      callback = route.request().url();
      return route.fulfill({ body: "ok" });
    });
    await page.goto(authorize.toString());
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel(/Email/).fill(ADMIN.email);
    await page.getByLabel(/Пароль|Password/).fill(ADMIN.password);
    await page.getByRole("button", { name: /Войти|Sign in/ }).click();
    await expect(page).toHaveURL(/\/consent/);
    await expect(page.getByText("E2E Agent")).toBeVisible();
    await page.getByRole("button", { name: /Разрешить|Allow/ }).click();
    await expect.poll(() => callback).toContain("code=");
    const code = new URL(callback).searchParams.get("code") ?? "";
    expect(new URL(callback).searchParams.get("state")).toBe("xyz");
    await ctx.close();

    const tokenRes = await fetch(new URL("/api/auth/oauth2/token", baseURL), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
        client_id,
        code_verifier: verifier,
        resource,
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
    expect(tokens.error).toBeUndefined();
    const { body } = await mcp(baseURL!, "/mcp/editor", "tools/list", {}, tokens.access_token);
    const names = ((body.result?.tools ?? []) as { name: string }[]).map((t) => t.name);
    expect(names).toContain("create_recipe");
    const me = await callTool(baseURL!, "/mcp/editor", "list_recipes", { limit: 1 }, tokens.access_token);
    expect(JSON.parse(me.text).recipes[0].status).toBeDefined();
  });
  test("sub-recipes: unmentioned ones first, mentioned ones under their step", async ({ page, baseURL }) => {
    await login(page, "/en");
    await page.goto("/en/tokens");
    await page.getByPlaceholder(/Name/).fill("e2e sub-recipes");
    await page.getByRole("button", { name: "Create token" }).click();
    const token = await page.locator("input[readonly]").inputValue();
    const create = (slug: string, data: unknown) =>
      callTool(baseURL!, "/mcp/editor", "create_recipe", { slug, recipe: data }, token);
    const simple = (en: string, ru: string) => ({
      title: { ru, en },
      servings: { amount: 2 },
      sections: [{ id: "main", steps: [{ id: "s1", text: { ru: `${ru}: шаг`, en: `${en}: step` } }] }],
    });
    expect((await create("e2e-rice", simple("Rice", "Рис"))).isError).toBe(false);
    expect((await create("e2e-sauce", simple("Sauce", "Соус"))).isError).toBe(false);
    const parent = await create("e2e-bowl", {
      title: { ru: "Боул", en: "Bowl" },
      servings: { amount: 2 },
      subRecipes: [{ slug: "e2e-rice" }, { slug: "e2e-sauce" }],
      sections: [
        {
          id: "main",
          steps: [
            { id: "a", text: { ru: "Нарезать овощи", en: "Chop the vegetables" } },
            { id: "b", text: { ru: "Сделать {{recipe:e2e-sauce}}", en: "Make {{recipe:e2e-sauce}}" } },
            { id: "c", text: { ru: "Собрать боул", en: "Assemble the bowl" } },
          ],
        },
      ],
    });
    expect(parent.isError, parent.text).toBe(false);

    await page.goto("/en/r/e2e-bowl");
    await page.getByRole("tab", { name: "Cook" }).click();
    // Top-level blocks in document order: sub-recipe summaries and the parent's own steps.
    const order = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("main summary, main [role=checkbox]")]
          .filter((el) => el.tagName === "SUMMARY" || !el.closest("details"))
          .map((el) =>
            el.tagName === "SUMMARY"
              ? `sub:${el.textContent?.match(/Rice|Sauce/)?.[0]}`
              : el.textContent?.replace(/^✓\d+\./, "").trim(),
          ),
      );
    await expect
      .poll(order)
      .toEqual(["sub:Rice", "Chop the vegetables", "Make Sauce", "sub:Sauce", "Assemble the bowl"]);
    await page.getByRole("tab", { name: "Prep" }).click();
    await expect(page.locator("main summary")).toHaveText([/Rice/, /Sauce/]);
  });
});
