import { expect, test } from "@playwright/test";

test.describe("public cookbook", () => {
  test("root redirects by language and lists seeded recipes", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/(ru|en)$/);
    await page.goto("/ru");
    await expect(page.getByRole("heading", { name: "Чашу и нитамаго" })).toBeVisible();
    expect(await page.locator("main a h2").count()).toBeGreaterThan(25);
  });

  test("search and tag filter", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("searchbox").fill("lentil");
    await expect(page.getByRole("heading", { name: /Turkish lentil soup/i })).toBeVisible();
    await expect(page.locator("main a h2")).toHaveCount(1);
    await page.goto("/en");
    await page.getByRole("link", { name: /^soup \d+$/ }).click();
    await expect(page).toHaveURL(/tag=soup/);
    await expect(page.getByRole("heading", { name: /borscht/i })).toBeVisible();
  });

  test("language toggle keeps the page", async ({ page }) => {
    await page.goto("/ru/r/kombucha");
    await page.getByRole("link", { name: "en", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/r\/kombucha$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Kombucha/i);
  });

  test("prep checklist and servings persist across reloads", async ({ page }) => {
    await page.goto("/ru/r/chicken-teriyaki");
    const first = page.getByRole("checkbox").first();
    await first.click();
    await expect(first).toHaveAttribute("aria-checked", "true");
    const qty = page.getByRole("checkbox").filter({ hasText: /Соевый соус/ });
    await expect(qty).toContainText("3 ст. л.");
    await page.getByRole("button", { name: "+" }).click();
    await page.getByRole("button", { name: "+" }).click();
    await expect(qty).toContainText("6 ст. л.");
    await page.reload();
    await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");
    await expect(qty).toContainText("6 ст. л.");
    await page.getByRole("button", { name: /Сбросить/ }).click();
    await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-checked", "false");
  });

  test("cook mode inlines quantities and starts timers", async ({ page }) => {
    await page.goto("/en/r/chashu-and-nitamago");
    await page.getByRole("tab", { name: "Cook" }).click();
    await expect(
      page.getByRole("button", { name: /pork belly 750–1000 g|pork belly 0.75–1 kg/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /⏱ 1 min/ })
      .first()
      .click();
    await expect(page.getByText(/^0:5\d$/)).toBeVisible();
    await page.getByRole("button", { name: "dismiss" }).click();
  });

  test("groceries merge the whole recipe", async ({ page }) => {
    await page.goto("/en/r/chashu-and-nitamago");
    await page.getByRole("tab", { name: "Groceries" }).click();
    await expect(page.getByRole("checkbox").filter({ hasText: /garlic/i })).toHaveCount(1);
  });

  test("youtube source opens in the sidebar on laptops", async ({ page }) => {
    await page.goto("/en/r/chashu-and-nitamago");
    await expect(page.locator("aside iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
    await expect(page.getByRole("link", { name: /Open on YouTube/ })).toHaveAttribute("href", /youtube\.com/);
  });

  test("SEO: JSON-LD, hreflang, sitemap, robots", async ({ page, request }) => {
    await page.goto("/en/r/kombucha");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(ld["@type"]).toBe("Recipe");
    expect(ld.recipeIngredient.length).toBeGreaterThan(2);
    await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
      "href",
      /\/ru\/r\/kombucha$/,
    );
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/en/r/kombucha");
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /login");
  });

  test("unknown recipe is a 404", async ({ request }) => {
    expect((await request.get("/ru/r/does-not-exist")).status()).toBe(404);
  });

  test("timer push scheduling validates input", async ({ request }) => {
    const ok = await request.post("/api/timers", {
      data: {
        id: crypto.randomUUID(),
        subscription: { endpoint: "https://push.example.com/x", keys: { p256dh: "k", auth: "a" } },
        endsAt: Date.now() + 60_000,
        title: "Eggs",
        url: "/en/r/chashu-and-nitamago",
      },
    });
    expect(ok.status()).toBe(204);
    const bad = await request.post("/api/timers", { data: { id: "nope" } });
    expect(bad.status()).toBe(400);
  });
});
