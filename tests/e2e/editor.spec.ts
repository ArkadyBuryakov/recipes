import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("editor", () => {
  test("anonymous visitors are sent to login", async ({ page }) => {
    await page.goto("/ru/new");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("create, publish, edit, view history, delete and restore", async ({ page }) => {
    await login(page);
    await page.goto("/en/new");
    await page.getByPlaceholder("Title (ru)").fill("Тестовый омлет");
    await page.getByPlaceholder("Title (en)").fill("Test omelette");
    await page.getByPlaceholder("chicken-teriyaki").fill("test-omelette");
    await page.getByRole("button", { name: "+ ingredient" }).click();
    await page.getByPlaceholder("Name (ru)").fill("Яйца");
    await page.getByPlaceholder("Name (en)").fill("Eggs");
    await page.getByPlaceholder("qty", { exact: true }).fill("3");
    await page.getByRole("button", { name: "+ step" }).click();
    const ru = page.getByPlaceholder(/Шаг \(ru\)/);
    await ru.fill("Взбить @Яй");
    await page.getByRole("button", { name: "Яйца" }).click();
    await expect(ru).toHaveValue(/^Взбить \{\{ing:i-[a-z0-9]+\}\}$/);
    const token = (await ru.inputValue()).match(/\{\{ing:[^}]+\}\}/)?.[0] ?? "";
    await page.getByPlaceholder(/Step \(en\)/).fill(`Whisk ${token} for {{timer:2m}}`);
    await ru.fill(`Взбить ${token} {{timer:2m}}`);
    await page.getByRole("combobox").last().selectOption("published");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/en\/r\/test-omelette$/);
    await page.getByRole("tab", { name: "Cook" }).click();
    await expect(page.getByRole("button", { name: "eggs 3" })).toBeVisible();

    // Validation errors are shown with paths.
    await page.getByRole("link", { name: /Edit/ }).click();
    await page.getByPlaceholder(/Step \(en\)/).fill("Whisk it");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert")).toContainText("RU and EN text must contain the same tokens");
    await page.getByPlaceholder(/Step \(en\)/).fill(`Whisk ${token} well {{timer:2m}}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/en\/r\/test-omelette$/);

    await page.getByRole("link", { name: "↺" }).click();
    await expect(page.getByText("v2")).toBeVisible();
    await expect(page.getByText("v1")).toBeVisible();

    await page.goto("/en/r/test-omelette/edit");
    await page.getByRole("button", { name: /Trash/ }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/trash");
    await page.getByRole("button", { name: /Restore/ }).click();
    await expect(page.getByRole("button", { name: /Restore/ })).toHaveCount(0);
    await page.goto("/en/r/test-omelette");
    await expect(page.getByRole("heading", { name: "Test omelette" })).toBeVisible();
  });

  test("invite a new editor who signs up from the link", async ({ page, browser }) => {
    await login(page, "/en");
    await page.goto("/en/admin");
    await page.getByPlaceholder(/Who it's for/).fill("Sister");
    await page.getByRole("button", { name: "+ Invite" }).click();
    const link = await page.locator("input[readonly]").inputValue();
    expect(link).toContain("/invite/");

    const guest = await browser.newContext();
    const p2 = await guest.newPage();
    await p2.goto(link);
    await p2.getByLabel("Name").fill("Sister");
    await p2.getByLabel("Email").fill("sister@e2e.test");
    await p2.getByLabel("Password").fill("sister-password");
    await p2.getByRole("button", { name: /Create account/ }).click();
    await expect(p2.getByRole("button", { name: /Sister/ })).toBeVisible();
    await p2.goto(link);
    await expect(p2.getByText(/invalid or has expired/)).toBeVisible();
    await guest.close();
  });
});
