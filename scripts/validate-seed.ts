// Validates seed/recipes/*.json: schema, plus links between seed recipes (sub-recipes and {{recipe:slug}} tokens).
// Usage: bun scripts/validate-seed.ts [file ...]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recipeInputSchema } from "@shared/recipe";
import { parseStepText } from "@shared/tokens";

const dir = join(import.meta.dir, "../seed/recipes");
const all = readdirSync(dir).filter((f) => f.endsWith(".json"));
const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => f.split("/").pop() ?? f) : all;
const slugs = new Set(all.map((f) => f.replace(/\.json$/, "")));
let failed = 0;

for (const file of files) {
  const problems: string[] = [];
  let input: unknown;
  try {
    input = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    problems.push(`invalid JSON: ${(e as Error).message}`);
  }
  const parsed = recipeInputSchema.safeParse(input);
  if (input !== undefined && !parsed.success)
    for (const i of parsed.error.issues) problems.push(`${i.path.join(".")}: ${i.message}`);
  if (parsed.success) {
    const { slug, recipe } = parsed.data;
    if (`${slug}.json` !== file) problems.push(`slug "${slug}" must match the file name`);
    const links = recipe.subRecipes.map((s) => s.slug);
    for (const s of recipe.sections)
      for (const st of s.steps)
        for (const v of [st.text.ru, st.text.en])
          if (v) for (const seg of parseStepText(v).segments) if (seg.type === "recipe") links.push(seg.slug);
    for (const l of links) if (!slugs.has(l)) problems.push(`links to unknown seed recipe "${l}"`);
    if (!recipe.title.ru || !recipe.title.en) problems.push("title should have both ru and en");
  }
  if (problems.length) {
    failed++;
    console.log(`✗ ${file}\n${problems.map((p) => `    ${p}`).join("\n")}`);
  } else console.log(`✓ ${file}`);
}
console.log(`\n${files.length - failed}/${files.length} valid`);
process.exit(failed ? 1 : 0);
