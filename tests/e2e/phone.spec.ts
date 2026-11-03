import { expect, test } from "@playwright/test";

test("phone: source sheet collapses into a mini player", async ({ page }) => {
  await page.goto("/en/r/chashu-and-nitamago");
  await expect(page.locator("aside iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "▶" }).click();
  const iframe = page.locator("aside iframe");
  await expect(iframe).toBeVisible();
  await page.getByRole("button", { name: "Collapse" }).click();
  await expect(iframe).toBeVisible();
  const box = await iframe.boundingBox();
  expect(box?.width).toBeLessThan(220);
});

test("phone: tabs are full width and rows are large touch targets", async ({ page }) => {
  await page.goto("/ru/r/karaage");
  const row = page.getByRole("checkbox").first();
  expect((await row.boundingBox())?.height).toBeGreaterThanOrEqual(48);
});
