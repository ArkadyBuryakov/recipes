import { type L10n, pick, t } from "@shared/l10n";
import { lowerFirst } from "@shared/markdown";
import { buildPrepList } from "@shared/prep";
import { formatIngredientQty, formatQty } from "@shared/quantity";
import type { Ingredient, RecipeData, Step } from "@shared/recipe";
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
  trail,
  className = "",
}: {
  id: string;
  checks: Checks;
  children: ReactNode;
  lead?: ReactNode;
  /** Rendered after the text, on the right (buttons inside don't toggle the row). */
  trail?: ReactNode;
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
      {trail}
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

/** A sub-recipe as the panels show it; the page builds `body` (its nested prep or cook panel). */
export type SubView = { slug: string; title: L10n; body: ReactNode };
export type SubLookup = (slug: string) => SubView | undefined;

/** Card wrapper; inside an expanded sub-recipe (compact) blocks lose the card chrome. */
function Block({ compact, children }: { compact: boolean; children: ReactNode }) {
  return compact ? (
    <section className="mb-3">{children}</section>
  ) : (
    <section className="card mb-7 px-4 pb-1 sm:px-5">{children}</section>
  );
}

function BlockTitle({ n, compact, children }: { n: number; compact: boolean; children: ReactNode }) {
  return compact ? (
    <h3 className="label pt-2 pb-1 text-ink">{children}</h3>
  ) : (
    <SectionTitle n={n}>{children}</SectionTitle>
  );
}

/**
 * The expand/collapse affordance: a plain chevron on expandable rows, or (`boxed`) the same chevron
 * in a bordered box like the other buttons, filled when open, where it sits beside step text and
 * must read as a button.
 */
function Chevron({ open, boxed = false }: { open: boolean; boxed?: boolean }) {
  // font-mono pinned: rows (mono headers) and step buttons (sans text) would otherwise draw ▸ from
  // different fallback fonts, at very different sizes.
  const glyph = (
    <span aria-hidden className="w-6 flex-none text-center font-mono text-2xl leading-none">
      {open ? "▾" : "▸"}
    </span>
  );
  return boxed ? (
    <span
      aria-hidden
      className={`grid size-9 flex-none place-items-center border-2 border-line-strong ${open ? "bg-accent text-accent-ink" : "bg-surface"}`}
    >
      {glyph}
    </span>
  ) : (
    glyph
  );
}

/** An expanded sub-recipe; `rule` marks it off with a left line when it's indented under a step. */
function SubBody({ sub, rule = false }: { sub: SubView; rule?: boolean }) {
  const lang = useLang();
  const tr = useT();
  return (
    <div className={rule ? "border-line-strong border-l-2 pt-1 pl-3" : "pt-1"}>
      {sub.body}
      <Link
        to={`/${lang}/r/${sub.slug}`}
        className="mb-2 inline-block font-mono text-sm text-muted underline decoration-accent decoration-2"
      >
        {tr.openRecipe} ↗
      </Link>
    </div>
  );
}

/**
 * A sub-recipe as one expandable row: a section that is a sub-recipe (`01 Salad filling: Tuna salad ▸`,
 * with n), or one shown above the recipe (no n).
 */
export function SubRow({
  sub,
  n,
  label,
  compact = false,
}: {
  sub: SubView;
  n?: number;
  label?: ReactNode;
  compact?: boolean;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const head = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      className="-my-2 flex min-h-11 w-full items-center gap-3 text-left"
    >
      {n !== undefined && !compact && <span className="sec-no">{String(n).padStart(2, "0")}</span>}
      <span className="flex-1">
        {label ? <>{label}: </> : n === undefined ? <>↳ {tr.subRecipes}: </> : null}
        <L value={sub.title} />
      </span>
      <Chevron open={open} />
    </button>
  );
  return compact ? (
    <section className="mb-3">
      <h3 className="label text-ink">{head}</h3>
      {open && <SubBody sub={sub} />}
    </section>
  ) : (
    <section className="card mb-7 px-4 sm:px-5">
      <h2 className={`sec-title ${open ? "mb-3" : "border-b-0"}`}>{head}</h2>
      {open && <SubBody sub={sub} />}
    </section>
  );
}

/** Mise en place: tasks by lead time, then sections → bowls → loose items (ADR 0008). */
export function PrepPanel({
  data,
  factor,
  checks,
  ns = "",
  subs,
  compact = false,
}: {
  data: RecipeData;
  factor: number;
  checks: Checks;
  ns?: string;
  subs?: SubLookup;
  compact?: boolean;
}) {
  const lang = useLang();
  const tr = useT();
  const prep = buildPrepList(data, factor);
  return (
    <div>
      {prep.tasks.length > 0 && (
        <Block compact={compact}>
          <h2 className={`label ${compact ? "pt-2" : "pt-4"} pb-1 text-ink`}>{tr.prepAhead}</h2>
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
        </Block>
      )}
      {prep.sections.map(({ section, bowls, loose }, i) => {
        const title = section.title ? <L value={section.title} /> : undefined;
        if (section.recipe)
          return (
            <SectionSub
              key={section.id}
              slug={section.recipe}
              subs={subs}
              n={i + 1}
              label={title}
              compact={compact}
            />
          );
        return (
          <Block key={section.id} compact={compact}>
            {(section.title || prep.sections.length > 1) && (
              <BlockTitle n={i + 1} compact={compact}>
                {title ?? section.id}
              </BlockTitle>
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
          </Block>
        );
      })}
    </div>
  );
}

/** A section that is a sub-recipe; a sub-recipe hidden from this viewer (a draft) shows as its slug. */
function SectionSub({
  slug,
  subs,
  n,
  label,
  compact,
}: {
  slug: string;
  subs: SubLookup | undefined;
  n: number;
  label: ReactNode;
  compact: boolean;
}) {
  const sub = subs?.(slug);
  if (sub) return <SubRow sub={sub} n={n} label={label} compact={compact} />;
  return (
    <Block compact={compact}>
      <BlockTitle n={n} compact={compact}>
        {label ? <>{label}: </> : null}
        <span className="font-mono text-muted">{slug}</span>
      </BlockTitle>
    </Block>
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
  subs,
  expands,
}: {
  text: string;
  data: RecipeData;
  factor: number;
  label: string;
  /** Sub-recipes on this page: their titles are shown instead of a bare slug. */
  subs?: SubLookup | undefined;
  /** Sub-recipes this step expands: their names toggle it instead of navigating ("Open recipe" does that). */
  expands?: { slugs: string[]; open: boolean; toggle: () => void } | undefined;
}) {
  const lang = useLang();
  const byId = new Map(data.sections.flatMap((s) => (s.ingredients ?? []).map((i) => [i.id, i] as const)));
  return (
    <>
      {parseStepText(text).segments.map((seg, i) => {
        const key = `${seg.type}-${i}`;
        if (seg.type === "text") return <span key={key}>{seg.value}</span>;
        if (seg.type === "timer") return <TimerChip key={key} seconds={seg.seconds} label={label} />;
        if (seg.type === "recipe" && expands?.slugs.includes(seg.slug))
          return (
            <button
              key={key}
              type="button"
              aria-expanded={expands.open}
              onClick={expands.toggle}
              className="inline text-left font-medium underline decoration-2 decoration-accent underline-offset-2"
            >
              {t(subs?.(seg.slug)?.title, lang) || seg.slug}
            </button>
          );
        if (seg.type === "recipe")
          return (
            <Link
              key={key}
              to={`/${lang}/r/${seg.slug}`}
              className="font-medium underline decoration-2 decoration-accent underline-offset-2"
            >
              {subs?.(seg.slug) ? t(subs(seg.slug)?.title, lang) : seg.slug}
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
  subs,
  inline,
  compact = false,
}: {
  data: RecipeData;
  factor: number;
  checks: Checks;
  ns?: string;
  subs?: SubLookup;
  /** Step id → sub-recipes that expand inside that step (see inlineSubRecipes). */
  inline?: Map<string, string[]>;
  compact?: boolean;
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
        if (!section.steps.length && !section.recipe) return null;
        sn++;
        const sectionTitle = section.title ? <L value={section.title} /> : undefined;
        return (
          <div key={section.id}>
            {section.recipe ? (
              <SectionSub slug={section.recipe} subs={subs} n={sn} label={sectionTitle} compact={compact} />
            ) : (
              <Block compact={compact}>
                {(section.title || data.sections.length > 1) && (
                  <BlockTitle n={sn} compact={compact}>
                    {sectionTitle ?? section.id}
                  </BlockTitle>
                )}
                {section.steps.map((step) => {
                  n++;
                  const label = section.title ? `${t(section.title, lang)} · ${n}` : `${title} · ${n}`;
                  return (
                    <StepRow
                      key={step.id}
                      step={step}
                      num={n}
                      label={label}
                      data={data}
                      factor={factor}
                      checks={checks}
                      ns={ns}
                      current={step.id === current}
                      compact={compact}
                      subs={subs}
                      expands={(inline?.get(step.id) ?? []).flatMap((slug) => subs?.(slug) ?? [])}
                    />
                  );
                })}
              </Block>
            )}
            {section.waitAfterMin && (
              <p
                className={`${compact ? "mb-3" : "-mt-3 mb-7"} flex items-center gap-3 font-mono text-sm text-muted before:flex-1 before:border-line before:border-t before:border-dashed after:flex-1 after:border-line after:border-t after:border-dashed`}
              >
                {tr.wait} {formatDuration(section.waitAfterMin * 60, lang)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepRow({
  step,
  num,
  label,
  data,
  factor,
  checks,
  ns,
  current,
  compact,
  subs,
  expands,
}: {
  step: Step;
  num: number;
  label: string;
  data: RecipeData;
  factor: number;
  checks: Checks;
  ns: string;
  current: boolean;
  compact: boolean;
  subs: SubLookup | undefined;
  /** Sub-recipes this step makes: a toggle on the right expands them under the step text. */
  expands: SubView[];
}) {
  const lang = useLang();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const p = pick(step.text, lang);
  const done = checks.has(`${ns}step:${step.id}`);
  const highlight = current
    ? compact
      ? "-mx-2 bg-accent-soft px-2"
      : "-mx-4 bg-accent-soft px-4 sm:-mx-5 sm:px-5"
    : "";
  const row = (
    <CheckRow
      id={`${ns}step:${step.id}`}
      checks={checks}
      className={`${highlight} ${expands.length ? "border-b-0!" : ""}`}
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
      trail={
        expands.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? tr.collapse : tr.expand}
            onClick={() => setOpen((o) => !o)}
            className="-my-1.5 -mr-1 grid size-11 flex-none place-items-center"
          >
            <Chevron open={open} boxed />
          </button>
        )
      }
    >
      <span className="text-[17px] leading-relaxed">
        <StepText
          text={p.text}
          data={data}
          factor={factor}
          label={label}
          subs={subs}
          expands={
            expands.length
              ? { slugs: expands.map((x) => x.slug), open, toggle: () => setOpen((o) => !o) }
              : undefined
          }
        />
      </span>
      <Fallback fallback={p.fallback} />
    </CheckRow>
  );
  if (!expands.length) return row;
  return (
    <div className="border-line border-b border-dashed last:border-b-0">
      {row}
      {open && (
        <div className="pb-3 pl-1 sm:pl-6">
          {expands.map((sub) => (
            <SubBody key={sub.slug} sub={sub} rule />
          ))}
        </div>
      )}
    </div>
  );
}
