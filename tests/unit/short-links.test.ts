import { describe, expect, test } from "bun:test";
import { isShortVideoLink, resolveShortLink } from "@server/recipes/short-links";

const redirects =
  (map: Record<string, string>) =>
  async (url: string): Promise<Response> =>
    map[url]
      ? new Response(null, { status: 302, headers: { location: map[url] } })
      : new Response("ok", { status: 200 });

describe("short video links", () => {
  test("detects share links only", () => {
    expect(isShortVideoLink("https://www.facebook.com/share/r/1Ry1Msro5a/")).toBe(true);
    expect(isShortVideoLink("https://m.facebook.com/share/v/abc/")).toBe(true);
    expect(isShortVideoLink("https://fb.watch/abc123/")).toBe(true);
    expect(isShortVideoLink("https://vm.tiktok.com/ZMabc/")).toBe(true);
    expect(isShortVideoLink("https://www.facebook.com/reel/1032933139459318/")).toBe(false);
    expect(isShortVideoLink("https://example.com/share/r/x")).toBe(false);
  });

  test("follows the redirect and drops tracking params", async () => {
    const fetchFn = redirects({
      "https://www.facebook.com/share/r/1Ry1Msro5a/":
        "https://www.facebook.com/reel/1032933139459318/?rdid=lQjv&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fr%2F1Ry1Msro5a%2F",
      "https://fb.watch/abc/": "https://www.facebook.com/watch/?v=987654321&ref=sharing",
    });
    expect(await resolveShortLink("https://www.facebook.com/share/r/1Ry1Msro5a/", fetchFn)).toBe(
      "https://www.facebook.com/reel/1032933139459318/",
    );
    expect(await resolveShortLink("https://fb.watch/abc/", fetchFn)).toBe(
      "https://www.facebook.com/watch/?v=987654321",
    );
  });

  test("keeps the original url when resolving fails", async () => {
    const url = "https://www.facebook.com/share/r/x/";
    expect(await resolveShortLink(url, redirects({}))).toBe(url);
    expect(
      await resolveShortLink(url, async () => {
        throw new Error("offline");
      }),
    ).toBe(url);
    expect(await resolveShortLink("https://example.com/r", redirects({}))).toBe("https://example.com/r");
  });
});
