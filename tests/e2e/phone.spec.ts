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

test("phone: installable — manifest, maskable icon and apple-touch-icon resolve", async ({
  page,
  request,
}) => {
  await page.goto("/en");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href ?? "")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  for (const src of [...manifest.icons.map((i: { src: string }) => i.src), touch]) {
    expect((await request.get(src)).ok(), src).toBe(true);
  }
});

test.describe("iPhone Safari", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });

  test("phone: home explains Add to Home Screen", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /Install on your phone/ }).click();
    await expect(page.getByText("Add to Home Screen")).toBeVisible();
  });
});
