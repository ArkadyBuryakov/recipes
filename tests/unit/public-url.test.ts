import { describe, expect, test } from "bun:test";
import { withPublicScheme } from "@server/public-url";

describe("withPublicScheme", () => {
  test("restores https behind a TLS-terminating proxy, keeping method, headers and body", async () => {
    const req = new Request("http://recipes.example.com/ru/r/x/edit.data?a=1", {
      method: "POST",
      headers: { origin: "https://recipes.example.com", "content-type": "application/json" },
      body: '{"ok":true}',
    });
    const out = withPublicScheme(req, "https://recipes.example.com");
    expect(out.url).toBe("https://recipes.example.com/ru/r/x/edit.data?a=1");
    expect(out.method).toBe("POST");
    expect(out.headers.get("origin")).toBe("https://recipes.example.com");
    expect(await out.text()).toBe('{"ok":true}');
  });

  test("leaves other hosts and matching schemes alone", () => {
    const other = new Request("http://localhost:3000/ru");
    expect(withPublicScheme(other, "https://recipes.example.com")).toBe(other);
    const same = new Request("http://localhost:3000/ru");
    expect(withPublicScheme(same, "http://localhost:3000")).toBe(same);
  });
});
