import { type Lang, t } from "@shared/l10n";
import { detectSourceKind, type Source, youtubeId } from "@shared/recipe";
import { useEffect, useState } from "react";
import { useT } from "~/lib/i18n";
import { useStoredState } from "~/lib/storage";

function siteName(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** Inline source line for non-video kinds (ADR 0009): link, photo preview or plain text. */
export function SourceLine({ source, lang }: { source: Source; lang: Lang }) {
  const tr = useT();
  const [preview, setPreview] = useState(false);
  const kind = detectSourceKind(source);
  const label = source.label ? t(source.label, lang) : "";
  if (kind === "youtube") return null;
  return (
    <p className="mb-4 text-[15px] text-muted">
      {tr.source}:{" "}
      {kind === "photo" && source.imageKey ? (
        <>
          <button type="button" onClick={() => setPreview(true)} className="align-middle">
            <img
              src={`/img/${source.imageKey}?w=200`}
              alt={label}
              className="inline h-14 rounded-lg border border-line"
            />
          </button>
          {label && ` ${label}`}
          {preview && (
            <button
              type="button"
              className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/90 p-2"
              onClick={() => setPreview(false)}
              aria-label={tr.close}
            >
              <img
                src={`/img/${source.imageKey}`}
                alt={label}
                className="max-h-full max-w-full object-contain"
              />
            </button>
          )}
        </>
      ) : source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">
          {label || siteName(source.url)} ↗
        </a>
      ) : (
        label
      )}
    </p>
  );
}

/**
 * YouTube source: a right-hand sidebar on laptops; a bottom sheet on phones that collapses into a
 * floating mini player. The iframe stays mounted while moving between states, so playback continues.
 */
export function useVideoPanel() {
  const [desktopOpen, setDesktopOpen] = useStoredState("source-sidebar", true);
  const [mode, setMode] = useState<"closed" | "open" | "mini">("closed");
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return {
    toggle: () => (isDesktop ? setDesktopOpen(!desktopOpen) : setMode(mode === "open" ? "mini" : "open")),
    panel: { desktopOpen, setDesktopOpen, mode, setMode, isDesktop },
  };
}

export function VideoPanel({
  source,
  lang,
  panel,
}: {
  source: Source;
  lang: Lang;
  panel: ReturnType<typeof useVideoPanel>["panel"];
}) {
  const tr = useT();
  const { desktopOpen, setDesktopOpen, mode, setMode, isDesktop } = panel;
  const id = source.url ? youtubeId(source.url) : null;
  if (!id || !source.url) return null;
  const active = isDesktop ? desktopOpen : mode !== "closed";
  const label = source.label ? t(source.label, lang) : "";
  const phone =
    mode === "open"
      ? "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:rounded-t-3xl max-lg:p-4 max-lg:pb-6 max-lg:shadow-2xl"
      : mode === "mini"
        ? "max-lg:fixed max-lg:right-3 max-lg:bottom-20 max-lg:z-50 max-lg:w-48 max-lg:overflow-hidden max-lg:rounded-xl max-lg:shadow-2xl"
        : "max-lg:hidden";
  const desktop = desktopOpen
    ? "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-[420px] lg:flex-none lg:overflow-y-auto lg:border-line lg:border-l lg:p-5"
    : "lg:hidden";
  return (
    <aside className={`bg-surface print:hidden ${phone} ${desktop}`}>
      <div className={`mb-3 flex items-center justify-between ${mode === "mini" ? "max-lg:hidden" : ""}`}>
        <strong className="font-serif text-xl">{tr.source}</strong>
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-2"
          onClick={() => (isDesktop ? setDesktopOpen(false) : setMode("mini"))}
        >
          {isDesktop ? "✕" : tr.collapse}
        </button>
      </div>
      <div className="relative">
        {active && (
          <iframe
            className="aspect-video w-full rounded-xl bg-black max-lg:[.rounded-xl_&]:rounded-none"
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={label || "YouTube"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
        {mode === "mini" && (
          <div className="absolute inset-x-0 top-0 flex justify-between lg:hidden">
            <button
              type="button"
              className="h-8 w-8 bg-black/60 text-white"
              onClick={() => setMode("open")}
              aria-label={tr.source}
            >
              ⤢
            </button>
            <button
              type="button"
              className="h-8 w-8 bg-black/60 text-white"
              onClick={() => setMode("closed")}
              aria-label={tr.close}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className={mode === "mini" ? "max-lg:hidden" : ""}>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block font-semibold text-accent"
        >
          {tr.openOn("YouTube")}
        </a>
        {label && <p className="mt-2 text-sm text-muted">{label}</p>}
      </div>
    </aside>
  );
}
