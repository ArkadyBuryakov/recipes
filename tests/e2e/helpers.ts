import { expect, type Page } from "@playwright/test";
import { ADMIN } from "../../playwright.config";

/** Hidden entry (ADR 0006): 10 quick taps on the logo, then the regular login form. */
export async function login(page: Page, next = "/ru") {
  await page.goto(next);
  const logo = page.getByRole("link", { name: /Рецепты|Recipes/ }).first();
  for (let i = 0; i < 10; i++) await logo.click({ delay: 10 });
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel(/Email/).fill(ADMIN.email);
  await page.getByLabel(/Пароль|Password/).fill(ADMIN.password);
  await page.getByRole("button", { name: /Войти|Sign in/ }).click();
  await expect(page.getByRole("button", { name: /E2E Admin/ })).toBeVisible();
}

export type Rpc = { result?: Record<string, unknown>; error?: { message: string } };

/** Minimal JSON-RPC over Streamable HTTP (2025-era stateless mode). */
export async function mcp(
  baseURL: string,
  path: string,
  method: string,
  params: unknown = {},
  token?: string,
) {
  const res = await fetch(new URL(path, baseURL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Protocol-Version": "2025-06-18",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  const data = text.includes("data:")
    ? text
        .split("\n")
        .find((l) => l.startsWith("data:"))
        ?.slice(5)
    : text;
  return { status: res.status, headers: res.headers, body: (data ? JSON.parse(data) : {}) as Rpc };
}

export async function callTool(baseURL: string, path: string, name: string, args: unknown, token?: string) {
  const { body } = await mcp(baseURL, path, "tools/call", { name, arguments: args }, token);
  const result = body.result as { content: { text: string }[]; isError?: boolean } | undefined;
  return { text: result?.content[0]?.text ?? "", isError: Boolean(result?.isError), raw: body };
}
