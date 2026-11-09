import { type L10n, pick, t } from "@shared/l10n";
import { lowerFirst } from "@shared/markdown";
import { buildPrepList } from "@shared/prep";
import { formatIngredientQty, formatQty } from "@shared/quantity";
import type { Ingredient, RecipeData } from "@shared/recipe";
import { formatDuration, parseStepText } from "@shared/tokens";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { useLang, useT } from "~/lib/i18n";
import { TimerChip } from "./timers";

export type Checks = { has: (id: string) => boolean; toggle: (id: string) => void };

export function CheckRow({
  id,
  checks,
  children,
  lead,
  className = "",
}: {
  id: string;
  checks: Checks;
  children: ReactNode;
  lead?: ReactNode;
  className?: string;
}) {
  const done = checks.has(id);
  return (
    // A row-wide hit area: the whole row toggles (large touch targets, ADR 0010). A native checkbox
    // can't contain the interactive chips (timers, ingredient notes) that steps render inline.
    // biome-ignore lint/a11y/useSemanticElements: see above
    <div
      role="checkbox"
      aria-checked={done}
      tabIndex={0}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button,a")) checks.toggle(id);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          checks.toggle(id);
        }
      }}
      className={`group flex min-h-13 cursor-pointer items-start gap-3.5 border-line border-b border-dashed py-3 last:border-b-0 ${className}`}
    >
      {lead ?? (
        <span
          className={`mt-0.5 grid size-[22px] flex-none place-items-center border-2 border-line-strong text-sm ${done ? "bg-ink text-accent" : "text-transparent"}`}
        >
          ✓
        </span>
      )}
      <span
        className={`flex-1 text-base leading-relaxed ${done ? "text-muted line-through decoration-muted" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}

function Fallback({ fallback }: { fallback: boolean }) {
  const tr = useT();
  return fallback ? (
    <span className="ml-1.5 bg-surface-2 px-1.5 py-0.5 align-middle font-mono text-[11px] text-muted no-underline">
      {tr.notTranslated}
    </span>
  ) : null;
}

export function L({ value }: { value: Parameters<typeof pick>[0] }) {
  const lang = useLang();
  const p = pick(value, lang);
  return (
    <>
      {p.text}
      <Fallback fallback={p.fallback} />
    </>
  );
}

export function IngredientText({ ing, factor }: { ing: Ingredient; factor: number }) {
  const lang = useLang();
  const tr = useT();
  const qty = formatIngredientQty(ing, factor, lang);
  return (
    <span className="grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[8.5rem_1fr]">
      <span className="font-mono tabular-nums">{qty || (ing.scaling === "to-taste" ? tr.toTaste : "")}</span>
      <span>
        <L value={ing.name} />
        {ing.optional && (
          <span className="ml-2 border border-line px-1.5 align-middle font-mono text-[11px] text-muted">
            {tr.optional}
          </span>
        )}
        {ing.alternatives.map((a) => (
          <span key={t(a.name, "en")} className="text-[15px] text-muted italic">
            {" "}
            · {tr.or} {[formatQty(a.qty, a.unit, lang), t(a.name, lang)].filter(Boolean).join(" ")}
            {a.note && ` (${t(a.note, lang)})`}
          </span>
        ))}
        {ing.prep && <span className="text-muted">, {t(ing.prep, lang)}</span>}
      </span>
    </span>
  );
}

export function SectionTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="sec-title">
      <span className="sec-no">{String(n).padStart(2, "0")}</span>
      {children}
    </h2>
  );
}

/** Mise en place: tasks by lead time, then sections → bowls → loose items (ADR 0008). */
export function PrepPanel({
  data,
  factor,
  checks,
  ns = "",
}: {
  data: RecipeData;
  factor: number;
  checks: Checks;
  ns?: string;
}) {
  const lang = useLang();
  const tr = useT();
  const prep = buildPrepList(data, factor);
  return (
    <div>
      {prep.tasks.length > 0 && (
        <div className="card mb-7 px-4 pb-1 sm:px-5">
          <h2 className="label pt-4 pb-1 text-ink">{tr.prepAhead}</h2>
          {prep.tasks.map((task) => (
            <CheckRow key={task.id} id={`${ns}task:${task.id}`} checks={checks}>
              <L value={task.text} />
              {task.leadMin ? (
                <span className="text-muted">
                  {" "}
                  · {formatDuration(task.leadMin * 60, lang)} {tr.ahead}
                </span>
              ) : null}
            </CheckRow>
          ))}
        </div>
      )}
      {prep.sections.map(({ section, bowls, loose }, i) => (
        <section key={section.id} className="card mb-7 px-4 pb-1 sm:px-5">
          {(section.title || prep.sections.length > 1) && (
            <SectionTitle n={i + 1}>{section.title ? <L value={section.title} /> : section.id}</SectionTitle>
          )}
          {loose.map(({ ingredient }) => (
            <CheckRow key={ingredient.id} id={`${ns}ing:${ingredient.id}`} checks={checks}>
              <IngredientText ing={ingredient} factor={factor} />
            </CheckRow>
          ))}
          {bowls.map((bowl) => (
            <div key={bowl.id}>
              <div className="label pt-4 text-[11px]">
                ▣ {tr.bowl}: {bowl.label ? <L value={bowl.label} /> : bowl.id}
              </div>
              {bowl.items.map(({ ingredient }) => (
                <CheckRow key={ingredient.id} id={`${ns}ing:${ingredient.id}`} checks={checks}>
                  <IngredientText ing={ingredient} factor={factor} />
                </CheckRow>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function InlineIngredient({ ing, factor, label }: { ing: Ingredient; factor: number; label?: string }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const qty = formatIngredientQty(ing, factor, lang);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="marker inline px-1 text-left font-medium text-ink"
      title={ing.prep ? t(ing.prep, lang) : undefined}
    >
      {label ?? lowerFirst(t(ing.name, lang))}
      {qty && (
        <span className="font-mono text-[0.85em] font-normal whitespace-nowrap tabular-nums"> {qty}</span>
      )}
      {open && ing.prep && <span className="font-normal text-muted"> ({t(ing.prep, lang)})</span>}
    </button>
  );
}

export function StepText({
  text,
  data,
  factor,
  label,
  recipeTitles,
}: {
  text: string;
  data: RecipeData;
  factor: number;
  label: string;
  /** Titles of the sub-recipes on this page, shown instead of a bare slug. */
  recipeTitles?: Map<string, L10n>;
}) {
  const lang = useLang();
  const byId = new Map(data.sections.flatMap((s) => (s.ingredients ?? []).map((i) => [i.id, i] as const)));
  return (
    <>
      {parseStepText(text).segments.map((seg, i) => {
        const key = `${seg.type}-${i}`;
        if (seg.type === "text") return <span key={key}>{seg.value}</span>;
        if (seg.type === "timer") return <TimerChip key={key} seconds={seg.seconds} label={label} />;
        if (seg.type === "recipe")
          return (
            <Link
              key={key}
              to={`/${lang}/r/${seg.slug}`}
              className="font-medium underline decoration-2 decoration-accent underline-offset-2"
            >
              {recipeTitles?.has(seg.slug) ? t(recipeTitles.get(seg.slug), lang) : seg.slug}
            </Link>
          );
        const ing = byId.get(seg.id);
        return ing ? (
          <InlineIngredient key={key} ing={ing} factor={factor} {...(seg.label && { label: seg.label })} />
        ) : (
          <span key={key}>{seg.label ?? seg.id}</span>
        );
      })}
    </>
  );
}

/** Cook mode: steps with inline quantities and timer chips, checkable (ADR 0008). */
export function CookPanel({
  data,
  factor,
  checks,
  ns = "",
  afterStep,
  recipeTitles,
}: {
  data: RecipeData;
  factor: number;
  checks: Checks;
  ns?: string;
  /** Rendered between a step and the next one (a sub-recipe the step mentions); splits the section card there. */
  afterStep?: (stepId: string) => ReactNode;
  recipeTitles?: Map<string, L10n>;
}) {
  const lang = useLang();
  const tr = useT();
  const title = t(data.title, lang);
  // The first unchecked step is highlighted, so it's easy to find your place at the stove.
  const current = data.sections.flatMap((s) => s.steps).find((st) => !checks.has(`${ns}step:${st.id}`))?.id;
  let n = 0;
  let sn = 0;
  return (
    <div>
      {data.sections.map((section) => {
        if (!section.steps.length) return null;
        sn++;
        // Steps run in one card until a step with an inline block; the block sits between two cards.
        const chunks: { rows: ReactNode[]; after: ReactNode }[] = [{ rows: [], after: null }];
        for (const step of section.steps) {
          n++;
          const num = n;
          const p = pick(step.text, lang);
          const label = section.title ? `${t(section.title, lang)} · ${num}` : `${title} · ${num}`;
          const done = checks.has(`${ns}step:${step.id}`);
          const chunk = chunks[chunks.length - 1] as (typeof chunks)[number];
          chunk.rows.push(
            <CheckRow
              key={step.id}
              id={`${ns}step:${step.id}`}
              checks={checks}
              className={step.id === current ? "-mx-4 bg-accent-soft px-4 sm:-mx-5 sm:px-5" : ""}
              lead={
                <span className="flex flex-none items-start gap-3">
                  <span
                    className={`mt-1 grid size-[22px] place-items-center border-2 border-line-strong text-sm ${done ? "bg-ink text-accent" : "text-transparent"}`}
                  >
                    ✓
                  </span>
                  <span className="min-w-7 pt-0.5 font-mono font-medium tabular-nums">{num}.</span>
                </span>
              }
            >
              <span className="text-[17px] leading-relaxed">
                <StepText
                  text={p.text}
                  data={data}
                  factor={factor}
                  label={label}
                  {...(recipeTitles && { recipeTitles })}
                />
              </span>
              <Fallback fallback={p.fallback} />
            </CheckRow>,
          );
          const after = afterStep?.(step.id);
          if (after) {
            chunk.after = after;
            chunks.push({ rows: [], after: null });
          }
        }
        return (
          <div key={section.id}>
            {chunks.map((chunk, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: chunks are positional and stable per render
              <div key={i}>
                {chunk.rows.length > 0 && (
                  <section className="card mb-7 px-4 pb-1 sm:px-5">
                    {i === 0 && (section.title || data.sections.length > 1) && (
                      <SectionTitle n={sn}>
                        {section.title ? <L value={section.title} /> : section.id}
                      </SectionTitle>
                    )}
                    {chunk.rows}
                  </section>
                )}
                {chunk.after}
              </div>
            ))}
            {section.waitAfterMin && (
              <p className="-mt-3 mb-7 flex items-center gap-3 font-mono text-sm text-muted before:flex-1 before:border-line before:border-t before:border-dashed after:flex-1 after:border-line after:border-t after:border-dashed">
                {tr.wait} {formatDuration(section.waitAfterMin * 60, lang)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
