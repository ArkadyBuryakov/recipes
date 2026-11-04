import { type Lang, t } from "@shared/l10n";
import { detectSourceKind, type Source, videoEmbed } from "@shared/recipe";
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
  if (source.url && videoEmbed(source.url)) return null;
  return (
    <p className="mb-4 text-[15px] text-muted">
      {tr.source}:{" "}
      {kind === "photo" && source.imageKey ? (
        <>
          <button type="button" onClick={() => setPreview(true)} className="align-middle">
            <img
              src={`/img/${source.imageKey}?w=200`}
              alt={label}
              className="inline h-14 border-2 border-line-strong"
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
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline decoration-accent decoration-2 underline-offset-2"
        >
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

const PROVIDER = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" } as const;

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
  const embed = source.url ? videoEmbed(source.url) : null;
  if (!embed || !source.url) return null;
  const active = isDesktop ? desktopOpen : mode !== "closed";
  const label = source.label ? t(source.label, lang) : "";
  const phone =
    mode === "open"
      ? "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:border-line-strong max-lg:border-t-2 max-lg:p-4 max-lg:pb-6"
      : mode === "mini"
        ? `max-lg:fixed max-lg:right-3 max-lg:bottom-20 max-lg:z-50 max-lg:overflow-hidden ${embed.vertical ? "max-lg:w-32" : "max-lg:w-48"} max-lg:border-2 max-lg:border-line-strong max-lg:shadow-lg`
        : "max-lg:hidden";
  const desktop = desktopOpen
    ? "lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-[420px] lg:flex-none lg:overflow-y-auto lg:border-line-strong lg:border-l-2 lg:p-5"
    : "lg:hidden";
  return (
    <aside className={`bg-surface print:hidden ${phone} ${desktop}`}>
      <div className={`mb-3 flex items-center justify-between ${mode === "mini" ? "max-lg:hidden" : ""}`}>
        <strong className="label text-ink">{tr.source}</strong>
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
            className={`border-2 border-line-strong bg-black ${
              embed.vertical
                ? // Vertical video: sized by height so it fits the sidebar/sheet, width follows. Instagram wraps
                  // the video in a header and footer, so its frame is taller.
                  `mx-auto block ${embed.provider === "instagram" ? "aspect-[1/2]" : "aspect-[9/16]"} max-w-full lg:h-[min(calc(100dvh-13rem),720px)] ${mode === "mini" ? "max-lg:w-full" : "max-lg:h-[60dvh]"}`
                : "aspect-video w-full"
            }`}
            src={embed.src}
            title={label || PROVIDER[embed.provider]}
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
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="btn mt-3">
          {tr.openOn(PROVIDER[embed.provider])}
        </a>
        {label && <p className="mt-2 text-sm text-muted">{label}</p>}
      </div>
    </aside>
  );
}
