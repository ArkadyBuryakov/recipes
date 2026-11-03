import { type L10n, type Lang, t } from "@shared/l10n";
import type { RecipeDataInput } from "@shared/recipe";
import { UNITS } from "@shared/units";
import { type ReactNode, useRef, useState } from "react";
import { StepText } from "./recipe-parts";

type Draft = RecipeDataInput;
type SectionDraft = Draft["sections"][number];
type IngredientDraft = NonNullable<SectionDraft["ingredients"]>[number];
type StepDraft = NonNullable<SectionDraft["steps"]>[number];

export type EditorLangs = "ru" | "en" | "both";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

export function emptyRecipe(): Draft {
  return {
    title: { ru: "", en: "" },
    servings: { amount: 4 },
    tags: [],
    prepTasks: [],
    sections: [{ id: uid("s"), ingredients: [], steps: [] }],
    subRecipes: [],
  };
}

/** Drop empty strings and empty L10n objects so the server validates the meaningful content only. */
export function cleanRecipe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanRecipe);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = cleanRecipe(v);
      if (c === "" || c === undefined || c === null) continue;
      if (typeof c === "object" && !Array.isArray(c) && Object.keys(c as object).length === 0) continue;
      out[k] = c;
    }
    return out;
  }
  return typeof value === "string" ? value.trim() : value;
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-semibold text-muted">{children}</span>;
}

function L10nInput({
  value,
  onChange,
  langs,
  placeholder,
  multiline,
}: {
  value: L10n | undefined;
  onChange: (v: L10n) => void;
  langs: EditorLangs;
  placeholder?: string;
  multiline?: boolean;
}) {
  const shown: Lang[] = langs === "both" ? ["ru", "en"] : [langs];
  return (
    <div className={`grid gap-2 ${shown.length === 2 ? "sm:grid-cols-2" : ""}`}>
      {shown.map((l) =>
        multiline ? (
          <textarea
            key={l}
            className="input min-h-20 py-2"
            placeholder={`${placeholder ?? ""} (${l})`}
            value={value?.[l] ?? ""}
            onChange={(e) => onChange({ ...value, [l]: e.target.value })}
          />
        ) : (
          <input
            key={l}
            className="input"
            placeholder={`${placeholder ?? ""} (${l})`}
            value={value?.[l] ?? ""}
            onChange={(e) => onChange({ ...value, [l]: e.target.value })}
          />
        ),
      )}
    </div>
  );
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j] as T, next[i] as T];
  return next;
}

function RowTools({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-1">
      <button type="button" className="btn btn-ghost min-h-9 px-2" onClick={onUp} aria-label="up">
        ↑
      </button>
      <button type="button" className="btn btn-ghost min-h-9 px-2" onClick={onDown} aria-label="down">
        ↓
      </button>
      <button
        type="button"
        className="btn btn-ghost min-h-9 px-2 text-danger"
        onClick={onRemove}
        aria-label="remove"
      >
        ✕
      </button>
    </div>
  );
}

function IngredientRow({
  ing,
  bowls,
  langs,
  onChange,
  tools,
}: {
  ing: IngredientDraft;
  bowls: { id: string; label?: L10n }[];
  langs: EditorLangs;
  onChange: (i: IngredientDraft) => void;
  tools: ReactNode;
}) {
  const num = (v: string) => (v === "" ? undefined : Number(v.replace(",", ".")));
  return (
    <div className="card mb-2 grid gap-2 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <L10nInput
            value={ing.name}
            onChange={(name) => onChange({ ...ing, name })}
            langs={langs}
            placeholder="Name"
          />
        </div>
        {tools}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input
          className="input"
          inputMode="decimal"
          placeholder="qty"
          value={ing.qty?.min ?? ""}
          onChange={(e) => {
            const min = num(e.target.value);
            onChange({ ...ing, qty: min === undefined ? undefined : { ...ing.qty, min } });
          }}
        />
        <input
          className="input"
          inputMode="decimal"
          placeholder="max (range)"
          value={ing.qty?.max ?? ""}
          onChange={(e) => ing.qty && onChange({ ...ing, qty: { ...ing.qty, max: num(e.target.value) } })}
        />
        <select
          className="input"
          value={ing.unit ?? ""}
          onChange={(e) => onChange({ ...ing, unit: e.target.value || undefined })}
        >
          <option value="">— count —</option>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={ing.scaling ?? "linear"}
          onChange={(e) => onChange({ ...ing, scaling: e.target.value as IngredientDraft["scaling"] })}
        >
          <option value="linear">scales</option>
          <option value="fixed">fixed</option>
          <option value="to-taste">to taste</option>
        </select>
        <select
          className="input"
          value={ing.bowl ?? ""}
          onChange={(e) => onChange({ ...ing, bowl: e.target.value || undefined })}
        >
          <option value="">no bowl</option>
          {bowls.map((b) => (
            <option key={b.id} value={b.id}>
              {t(b.label, "ru") || b.id}
            </option>
          ))}
        </select>
      </div>
      <L10nInput
        value={ing.prep}
        onChange={(prep) => onChange({ ...ing, prep })}
        langs={langs}
        placeholder="Prep (finely chopped…)"
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ing.optional ?? false}
            onChange={(e) => onChange({ ...ing, optional: e.target.checked })}
          />
          optional
        </label>
        <button
          type="button"
          className="text-accent"
          onClick={() =>
            onChange({ ...ing, alternatives: [...(ing.alternatives ?? []), { name: { ru: "", en: "" } }] })
          }
        >
          + alternative
        </button>
        <span className="text-muted">id: {ing.id}</span>
      </div>
      {(ing.alternatives ?? []).map((alt, ai) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: id-less list items, edited in place
        <div key={`${ing.id}-alt-${ai}`} className="flex items-start gap-2 pl-4">
          <span className="pt-3 text-muted">or</span>
          <div className="flex-1">
            <L10nInput
              value={alt.name}
              langs={langs}
              placeholder="Alternative"
              onChange={(name) => {
                const alternatives = [...(ing.alternatives ?? [])];
                alternatives[ai] = { ...alt, name };
                onChange({ ...ing, alternatives });
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost min-h-9 px-2 text-danger"
            onClick={() =>
              onChange({ ...ing, alternatives: (ing.alternatives ?? []).filter((_, k) => k !== ai) })
            }
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** Step textarea: typing "@" + part of a name offers ingredients and inserts {{ing:id}} (ADR 0002). */
function StepInput({
  value,
  onChange,
  ingredients,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  ingredients: IngredientDraft[];
  lang: Lang;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const matches =
    query === null
      ? []
      : ingredients
          .filter((i) =>
            [i.name.ru, i.name.en, i.id].some((n) => n?.toLowerCase().includes(query.toLowerCase())),
          )
          .slice(0, 8);

  const detect = () => {
    const el = ref.current;
    if (!el) return;
    const m = /@([\p{L}\p{N}-]*)$/u.exec(el.value.slice(0, el.selectionStart));
    setQuery(m ? (m[1] ?? "") : null);
  };

  const insert = (token: string) => {
    const el = ref.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart).replace(/@[\p{L}\p{N}-]*$/u, "");
    const after = el.value.slice(el.selectionStart);
    onChange(`${before}${token}${after}`);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = before.length + token.length;
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className="input min-h-20 py-2"
        placeholder={`${lang === "ru" ? "Шаг" : "Step"} (${lang}) — @ to insert an ingredient`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect();
        }}
        onKeyUp={detect}
        onClick={detect}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {matches.length > 0 && (
        <div className="card absolute z-20 mt-1 w-72 p-1 shadow-lg">
          {matches.map((i) => (
            <button
              key={i.id}
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
              onMouseDown={(e) => {
                e.preventDefault();
                insert(`{{ing:${i.id}}}`);
              }}
            >
              {t(i.name, lang) || i.id}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
        {["5m", "10m", "20m", "1h"].map((d) => (
          <button
            key={d}
            type="button"
            className="rounded-full bg-surface-2 px-2 py-1"
            onMouseDown={(e) => {
              e.preventDefault();
              ref.current?.focus();
              insert(`{{timer:${d}}}`);
            }}
          >
            ⏱ {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RecipeForm({
  draft,
  setDraft,
  slug,
  setSlug,
  langs,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  slug: string;
  setSlug: (s: string) => void;
  langs: EditorLangs;
}) {
  const sections = draft.sections;
  const allIngredients = sections.flatMap((s) => s.ingredients ?? []);
  const setSection = (i: number, s: SectionDraft) =>
    setDraft({ ...draft, sections: sections.map((x, k) => (k === i ? s : x)) });
  const stepLangs: Lang[] = langs === "both" ? ["ru", "en"] : [langs];
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/images", { method: "POST", body });
    setUploading(false);
    if (!res.ok) return null;
    return ((await res.json()) as { imageKey: string }).imageKey;
  };

  // Preview needs a parsed-ish recipe; the draft is structurally close enough for rendering steps.
  const preview = draft as unknown as Parameters<typeof StepText>[0]["data"];

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div>
          <Label>Title</Label>
          <L10nInput
            value={draft.title}
            onChange={(title) => setDraft({ ...draft, title })}
            langs={langs}
            placeholder="Title"
          />
        </div>
        <label>
          <Label>Slug (URL)</Label>
          <input
            className="input font-mono"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="chicken-teriyaki"
          />
        </label>
        <div>
          <Label>Description</Label>
          <L10nInput
            value={draft.description}
            onChange={(description) => setDraft({ ...draft, description })}
            langs={langs}
            placeholder="Description"
            multiline
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label>
            <Label>Servings</Label>
            <input
              className="input"
              inputMode="decimal"
              value={draft.servings.amount}
              onChange={(e) =>
                setDraft({ ...draft, servings: { ...draft.servings, amount: Number(e.target.value) || 0 } })
              }
            />
          </label>
          {(["prepMin", "cookMin", "passiveMin"] as const).map((k) => (
            <label key={k}>
              <Label>{k === "prepMin" ? "Prep, min" : k === "cookMin" ? "Cook, min" : "Waiting, min"}</Label>
              <input
                className="input"
                inputMode="numeric"
                value={draft.times?.[k] ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    times: { ...draft.times, [k]: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div>
          <Label>Yield noun, if not servings (pieces, jars…)</Label>
          <L10nInput
            value={draft.servings.label}
            onChange={(label) => setDraft({ ...draft, servings: { ...draft.servings, label } })}
            langs={langs}
            placeholder="шт. / pieces"
          />
        </div>
      </section>

      <section className="grid gap-2">
        <Label>Tags</Label>
        {(draft.tags ?? []).map((tag, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: id-less list items, edited in place
          <div key={`tag-${i}`} className="flex gap-2">
            <div className="flex-1">
              <L10nInput
                value={tag}
                langs={langs}
                placeholder="tag"
                onChange={(v) =>
                  setDraft({ ...draft, tags: (draft.tags ?? []).map((x, k) => (k === i ? v : x)) })
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost px-2 text-danger"
              onClick={() => setDraft({ ...draft, tags: (draft.tags ?? []).filter((_, k) => k !== i) })}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn w-fit"
          onClick={() => setDraft({ ...draft, tags: [...(draft.tags ?? []), { ru: "", en: "" }] })}
        >
          + tag
        </button>
      </section>

      <section className="grid gap-2">
        <Label>Source</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
          <input
            className="input"
            placeholder="https://… (YouTube, site, Instagram)"
            value={draft.source?.url ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, source: { ...draft.source, url: e.target.value || undefined } })
            }
          />
          <select
            className="input"
            value={draft.source?.kind ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                source: { ...draft.source, kind: (e.target.value || undefined) as never },
              })
            }
          >
            <option value="">auto</option>
            {["youtube", "web", "social", "photo", "text"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <L10nInput
          value={draft.source?.label}
          onChange={(label) => setDraft({ ...draft, source: { ...draft.source, label } })}
          langs={langs}
          placeholder="Source label (channel, grandma…)"
        />
        <div className="text-sm">
          <Label>Source photo (cookbook page, handwritten note)</Label>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const key = file && (await upload(file));
              if (key) setDraft({ ...draft, source: { ...draft.source, kind: "photo", imageKey: key } });
            }}
          />
        </div>
        <div className="text-sm">
          <Label>Cover photo {draft.cover && "✓"}</Label>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const key = file && (await upload(file));
              if (key) setDraft({ ...draft, cover: { imageKey: key } });
            }}
          />
          {uploading && <span className="ml-2 text-muted">…</span>}
          {draft.cover && (
            <button
              type="button"
              className="ml-2 text-danger"
              onClick={() => setDraft({ ...draft, cover: undefined })}
            >
              remove
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-2">
        <Label>Prep tasks (non-cooking: preheat oven, take butter out…)</Label>
        {(draft.prepTasks ?? []).map((task, i) => (
          <div key={task.id} className="card flex items-start gap-2 p-3">
            <div className="flex-1">
              <L10nInput
                value={task.text}
                langs={langs}
                placeholder="Task"
                onChange={(text) =>
                  setDraft({
                    ...draft,
                    prepTasks: (draft.prepTasks ?? []).map((x, k) => (k === i ? { ...x, text } : x)),
                  })
                }
              />
            </div>
            <input
              className="input w-28"
              inputMode="numeric"
              placeholder="min ahead"
              value={task.leadMin ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  prepTasks: (draft.prepTasks ?? []).map((x, k) =>
                    k === i ? { ...x, leadMin: e.target.value ? Number(e.target.value) : undefined } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              className="btn btn-ghost px-2 text-danger"
              onClick={() =>
                setDraft({ ...draft, prepTasks: (draft.prepTasks ?? []).filter((_, k) => k !== i) })
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn w-fit"
          onClick={() =>
            setDraft({
              ...draft,
              prepTasks: [...(draft.prepTasks ?? []), { id: uid("t"), text: { ru: "", en: "" } }],
            })
          }
        >
          + prep task
        </button>
      </section>

      {sections.map((section, si) => {
        const ingredients = section.ingredients ?? [];
        const steps = section.steps ?? [];
        const bowls = section.bowls ?? [];
        return (
          <section key={section.id} className="rounded-2xl border-2 border-line border-dashed p-3 sm:p-4">
            <div className="mb-3 flex items-start gap-2">
              <div className="flex-1">
                <Label>Section {si + 1}</Label>
                <L10nInput
                  value={section.title}
                  onChange={(title) => setSection(si, { ...section, title })}
                  langs={langs}
                  placeholder="Section title (sauce, dough…)"
                />
              </div>
              <RowTools
                onUp={() => setDraft({ ...draft, sections: move(sections, si, -1) })}
                onDown={() => setDraft({ ...draft, sections: move(sections, si, 1) })}
                onRemove={() =>
                  sections.length > 1 && setDraft({ ...draft, sections: sections.filter((_, k) => k !== si) })
                }
              />
            </div>

            <Label>Bowls (ingredients prepped together)</Label>
            <div className="mb-3 grid gap-2">
              {bowls.map((bowl, bi) => (
                <div key={bowl.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <L10nInput
                      value={bowl.label}
                      langs={langs}
                      placeholder="Bowl label"
                      onChange={(label) =>
                        setSection(si, {
                          ...section,
                          bowls: bowls.map((b, k) => (k === bi ? { ...b, label } : b)),
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 text-danger"
                    onClick={() =>
                      setSection(si, {
                        ...section,
                        bowls: bowls.filter((_, k) => k !== bi),
                        ingredients: ingredients.map((i) =>
                          i.bowl === bowl.id ? { ...i, bowl: undefined } : i,
                        ),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn w-fit"
                onClick={() =>
                  setSection(si, {
                    ...section,
                    bowls: [...bowls, { id: uid("b"), label: { ru: "", en: "" } }],
                  })
                }
              >
                + bowl
              </button>
            </div>

            <Label>Ingredients</Label>
            {ingredients.map((ing, ii) => (
              <IngredientRow
                key={ing.id}
                ing={ing}
                bowls={bowls}
                langs={langs}
                onChange={(next) =>
                  setSection(si, {
                    ...section,
                    ingredients: ingredients.map((x, k) => (k === ii ? next : x)),
                  })
                }
                tools={
                  <RowTools
                    onUp={() => setSection(si, { ...section, ingredients: move(ingredients, ii, -1) })}
                    onDown={() => setSection(si, { ...section, ingredients: move(ingredients, ii, 1) })}
                    onRemove={() =>
                      setSection(si, { ...section, ingredients: ingredients.filter((_, k) => k !== ii) })
                    }
                  />
                }
              />
            ))}
            <button
              type="button"
              className="btn mb-4 w-fit"
              onClick={() =>
                setSection(si, {
                  ...section,
                  ingredients: [...ingredients, { id: uid("i"), name: { ru: "", en: "" } }],
                })
              }
            >
              + ingredient
            </button>

            <Label>Steps</Label>
            {steps.map((step: StepDraft, sti) => (
              <div key={step.id} className="card mb-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <b className="text-muted">{sti + 1}</b>
                  <RowTools
                    onUp={() => setSection(si, { ...section, steps: move(steps, sti, -1) })}
                    onDown={() => setSection(si, { ...section, steps: move(steps, sti, 1) })}
                    onRemove={() => setSection(si, { ...section, steps: steps.filter((_, k) => k !== sti) })}
                  />
                </div>
                <div className={`grid gap-2 ${stepLangs.length === 2 ? "sm:grid-cols-2" : ""}`}>
                  {stepLangs.map((l) => (
                    <div key={l}>
                      <StepInput
                        value={step.text[l] ?? ""}
                        lang={l}
                        ingredients={allIngredients}
                        onChange={(v) =>
                          setSection(si, {
                            ...section,
                            steps: steps.map((x, k) =>
                              k === sti ? { ...x, text: { ...x.text, [l]: v } } : x,
                            ),
                          })
                        }
                      />
                      {step.text[l] && (
                        <p className="mt-2 rounded-lg bg-surface-2 p-2 text-[15px] leading-relaxed">
                          <StepText text={step.text[l] ?? ""} data={preview} factor={1} label="preview" />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn w-fit"
              onClick={() =>
                setSection(si, { ...section, steps: [...steps, { id: uid("st"), text: { ru: "", en: "" } }] })
              }
            >
              + step
            </button>

            <label className="mt-4 block">
              <Label>Wait after this section, minutes (fermentation, resting)</Label>
              <input
                className="input w-40"
                inputMode="numeric"
                value={section.waitAfterMin ?? ""}
                onChange={(e) =>
                  setSection(si, {
                    ...section,
                    waitAfterMin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
          </section>
        );
      })}
      <button
        type="button"
        className="btn w-fit"
        onClick={() =>
          setDraft({ ...draft, sections: [...sections, { id: uid("s"), ingredients: [], steps: [] }] })
        }
      >
        + section
      </button>

      <section className="grid gap-2">
        <Label>Sub-recipes (shown collapsed, scale with this one)</Label>
        {(draft.subRecipes ?? []).map((sub, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: id-less list items, edited in place
          <div key={`sub-${i}`} className="flex gap-2">
            <input
              className="input flex-1 font-mono"
              placeholder="slug"
              value={sub.slug}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subRecipes: (draft.subRecipes ?? []).map((x, k) =>
                    k === i ? { ...x, slug: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              className="input w-24"
              inputMode="decimal"
              placeholder="×"
              value={sub.factor ?? 1}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subRecipes: (draft.subRecipes ?? []).map((x, k) =>
                    k === i ? { ...x, factor: Number(e.target.value) || 1 } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              className="btn btn-ghost px-2 text-danger"
              onClick={() =>
                setDraft({ ...draft, subRecipes: (draft.subRecipes ?? []).filter((_, k) => k !== i) })
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn w-fit"
          onClick={() =>
            setDraft({ ...draft, subRecipes: [...(draft.subRecipes ?? []), { slug: "", factor: 1 }] })
          }
        >
          + sub-recipe
        </button>
      </section>
    </div>
  );
}
