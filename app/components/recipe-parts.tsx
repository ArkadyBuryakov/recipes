import { type Lang, pick, t } from "@shared/l10n";
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
}: {
  id: string;
  checks: Checks;
  children: ReactNode;
  lead?: ReactNode;
}) {
  const done = checks.has(id);
  return (
    // A row-wide hit area: whole row toggles (large touch targets, ADR 0010).
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
      className="group flex min-h-14 cursor-pointer items-start gap-3.5 border-line border-b py-3.5 last:border-b-0"
    >
      {lead ?? (
        <span
          className={`mt-0.5 grid size-[26px] flex-none place-items-center rounded-lg border-2 text-base ${done ? "border-ok bg-ok text-white" : "border-line text-transparent"}`}
        >
          ✓
        </span>
      )}
      <span
        className={`flex-1 text-[17px] leading-relaxed ${done ? "text-muted line-through decoration-line" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}

function Fallback({ fallback }: { fallback: boolean }) {
  const tr = useT();
  return fallback ? (
    <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 align-middle text-[11px] text-muted no-underline">
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
    <>
      {qty && <span className="font-semibold tabular-nums">{qty} </span>}
      <L value={ing.name} />
      {ing.scaling === "to-taste" && !qty && <span className="text-muted"> — {tr.toTaste}</span>}
      {ing.optional && <span className="text-[15px] text-muted italic"> — {tr.optional}</span>}
      {ing.alternatives.map((a) => (
        <span key={t(a.name, "en")} className="text-[15px] text-muted italic">
          {" "}
          · {tr.or} {[formatQty(a.qty, a.unit, lang), t(a.name, lang)].filter(Boolean).join(" ")}
          {a.note && ` (${t(a.note, lang)})`}
        </span>
      ))}
      {ing.prep && <span className="block text-[15px] text-muted">{t(ing.prep, lang)}</span>}
    </>
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
        <div className="mb-2 rounded-2xl border border-line border-dashed px-4">
          {prep.tasks.map((task) => (
            <CheckRow key={task.id} id={`${ns}task:${task.id}`} checks={checks}>
              <span className="label block text-accent">
                {task.leadMin ? `${formatDuration(task.leadMin * 60, lang)} ${tr.ahead}` : tr.beforeStart}
              </span>
              <L value={task.text} />
            </CheckRow>
          ))}
        </div>
      )}
      {prep.sections.map(({ section, bowls, loose }) => (
        <section key={section.id}>
          {(section.title || prep.sections.length > 1) && (
            <h2 className="mt-7 mb-2 text-2xl">{section.title ? <L value={section.title} /> : section.id}</h2>
          )}
          {bowls.map((bowl) => (
            <div key={bowl.id} className="card my-2.5 px-4">
              <div className="label pt-3">{bowl.label ? <L value={bowl.label} /> : bowl.id}</div>
              {bowl.items.map(({ ingredient }) => (
                <CheckRow key={ingredient.id} id={`${ns}ing:${ingredient.id}`} checks={checks}>
                  <IngredientText ing={ingredient} factor={factor} />
                </CheckRow>
              ))}
            </div>
          ))}
          {loose.map(({ ingredient }) => (
            <CheckRow key={ingredient.id} id={`${ns}ing:${ingredient.id}`} checks={checks}>
              <IngredientText ing={ingredient} factor={factor} />
            </CheckRow>
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
      className="inline rounded-md bg-accent-soft px-1.5 py-px text-left font-medium text-ink"
      title={ing.prep ? t(ing.prep, lang) : undefined}
    >
      {label ?? lowerFirst(t(ing.name, lang))}
      {qty && <span className="font-bold whitespace-nowrap text-accent tabular-nums"> {qty}</span>}
      {open && ing.prep && <span className="font-normal text-muted"> ({t(ing.prep, lang)})</span>}
    </button>
  );
}

export function StepText({
  text,
  data,
  factor,
  label,
}: {
  text: string;
  data: RecipeData;
  factor: number;
  label: string;
}) {
  const lang = useLang();
  const byId = new Map(data.sections.flatMap((s) => s.ingredients.map((i) => [i.id, i] as const)));
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
              className="font-medium text-accent underline underline-offset-2"
            >
              {seg.slug}
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
}: {
  data: RecipeData;
  factor: number;
  checks: Checks;
  ns?: string;
}) {
  const lang = useLang();
  const tr = useT();
  const title = t(data.title, lang);
  let n = 0;
  return (
    <div>
      {data.sections.map((section) => (
        <section key={section.id}>
          {section.steps.length > 0 && (section.title || data.sections.length > 1) && (
            <h2 className="mt-7 mb-2 text-2xl">{section.title ? <L value={section.title} /> : section.id}</h2>
          )}
          {section.steps.map((step) => {
            n++;
            const num = n;
            const p = pick(step.text, lang);
            const label = section.title ? `${t(section.title, lang)} · ${num}` : `${title} · ${num}`;
            return (
              <CheckRow
                key={step.id}
                id={`${ns}step:${step.id}`}
                checks={checks}
                lead={
                  <span
                    className={`grid size-[30px] flex-none place-items-center rounded-full text-sm font-bold ${checks.has(`${ns}step:${step.id}`) ? "bg-ok text-white" : "bg-surface-2 text-muted"}`}
                  >
                    {num}
                  </span>
                }
              >
                <StepText text={p.text} data={data} factor={factor} label={label} />
                <Fallback fallback={p.fallback} />
              </CheckRow>
            );
          })}
          {section.waitAfterMin && (
            <p className="my-3 rounded-xl bg-surface-2 px-4 py-3 text-muted">
              ⏳ {tr.wait}: {formatDuration(section.waitAfterMin * 60, lang)}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
