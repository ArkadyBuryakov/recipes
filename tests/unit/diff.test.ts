import { describe, expect, test } from "bun:test";
import { diffLines, withContext } from "~/lib/diff";

describe("diffLines", () => {
  test("marks additions and deletions", () => {
    expect(diffLines("a\nb\nc", "a\nx\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });

  test("collapses unchanged runs", () => {
    const lines = diffLines("1\n2\n3\n4\n5\n6\n7", "1\n2\n3\n4\n5\n6\n8");
    expect(withContext(lines, 1)[0]).toEqual({ kind: "gap", count: 5 });
  });
});
