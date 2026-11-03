import { describe, expect, test } from "bun:test";
import { formatQty, scaleQty } from "@shared/quantity";
import { formatDuration, parseDuration, parseStepText } from "@shared/tokens";
import { unitLabel } from "@shared/units";

describe("formatQty", () => {
  test("ranges and metric", () => {
    expect(formatQty({ min: 750, max: 1000 }, "g", "ru")).toBe("0,75–1 кг");
    expect(formatQty({ min: 200, max: 400 }, "g", "en")).toBe("200–400 g");
    expect(formatQty({ min: 1500 }, "ml", "en")).toBe("1.5 l");
  });

  test("fractions for spoons and cups", () => {
    expect(formatQty({ min: 1.5 }, "tbsp", "en")).toBe("1½ tbsp");
    expect(formatQty({ min: 1 / 3 }, "cup", "en")).toBe("⅓ cup");
    expect(formatQty({ min: 2 }, "cup", "en")).toBe("2 cups");
    expect(formatQty({ min: 0.66 }, "tsp", "ru")).toBe("⅔ ч. л.");
  });

  test("counts and russian plurals", () => {
    expect(formatQty({ min: 3 }, undefined, "ru")).toBe("3");
    expect(formatQty({ min: 1 }, "clove", "ru")).toBe("1 зубчик");
    expect(formatQty({ min: 2, max: 3 }, "clove", "ru")).toBe("2–3 зубчика");
    expect(formatQty({ min: 5 }, "clove", "ru")).toBe("5 зубчиков");
    expect(formatQty({ min: 21 }, "clove", "ru")).toBe("21 зубчик");
    expect(formatQty({ min: 1 }, "clove", "en")).toBe("1 clove");
    expect(unitLabel("cup", 1.5, "ru")).toBe("чашки");
  });

  test("sensible rounding", () => {
    expect(formatQty({ min: 333.333 }, "g", "en")).toBe("333 g");
    expect(formatQty({ min: 2.25 }, "g", "en")).toBe("2.3 g");
    expect(formatQty({ min: 0.125 }, "kg", "en")).toBe("0.13 kg");
  });
});

describe("scaleQty", () => {
  test("linear scales both ends, fixed and to-taste don't", () => {
    expect(scaleQty({ min: 2, max: 3 }, 2, "linear")).toEqual({ min: 4, max: 6 });
    expect(scaleQty({ min: 1 }, 2, "fixed")).toEqual({ min: 1 });
    expect(scaleQty(undefined, 2, "to-taste")).toBeUndefined();
  });
});

describe("tokens", () => {
  test("parses durations", () => {
    expect(parseDuration("20m")).toBe(1200);
    expect(parseDuration("1h30m")).toBe(5400);
    expect(parseDuration("2d")).toBe(172800);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("0m")).toBeNull();
    expect(formatDuration(5400, "ru")).toBe("1 ч 30 мин");
  });

  test("splits text into segments", () => {
    const { segments, errors } = parseStepText(
      "Add {{ing:ginger}} for {{ timer:5m }} then {{recipe:sushi-rice}}.",
    );
    expect(errors).toEqual([]);
    expect(segments.map((s) => s.type)).toEqual(["text", "ing", "text", "timer", "text", "recipe", "text"]);
  });

  test("flags unbalanced braces", () => {
    expect(parseStepText("Add {{ing:ginger").errors.length).toBe(1);
  });
});

describe("ingredient labels", () => {
  test("{{ing:id|label}} keeps the author's wording and the same signature", async () => {
    const { tokenSignature } = await import("@shared/tokens");
    const { segments } = parseStepText("Залить {{ing:pork|свинину}} водой");
    expect(segments[1]).toEqual({ type: "ing", id: "pork", label: "свинину" });
    expect(tokenSignature("Залить {{ing:pork|свинину}}")).toBe(tokenSignature("Cover {{ing:pork}}"));
  });

  test("lowercases names inside sentences but keeps acronyms", async () => {
    const { lowerFirst } = await import("@shared/markdown");
    expect(lowerFirst("Свиная грудинка")).toBe("свиная грудинка");
    expect(lowerFirst("BBQ sauce")).toBe("BBQ sauce");
  });
});
