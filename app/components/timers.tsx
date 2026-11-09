import { formatDuration } from "@shared/tokens";
import { useEffect, useState } from "react";
import { useLang, useT } from "~/lib/i18n";
import { useStoredState } from "~/lib/storage";
import { formatClock, remaining, useTimers } from "~/lib/timers";

export function TimerChip({ seconds, label }: { seconds: number; label: string }) {
  const lang = useLang();
  const { start } = useTimers();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        start(label, seconds);
      }}
      className="mx-0.5 inline-flex items-center gap-1 border-2 border-line-strong px-1.5 align-baseline font-mono text-[13px] font-medium leading-6 hover:bg-accent hover:text-accent-ink"
    >
      ⏱ {formatDuration(seconds, lang)}
    </button>
  );
}

function Settings({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { settings, setSettings, enablePush, testPush } = useTimers();
  const [pushError, setPushError] = useState(false);
  const [test, setTest] = useState<"idle" | "sent" | "failed">("idle");
  const isIos = typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && matchMedia("(display-mode: standalone)").matches;
  const toggle = (key: "sound" | "vibration" | "ring") => (
    <label className="flex min-h-11 items-center justify-between gap-4">
      <span>{key === "sound" ? t.sound : key === "vibration" ? t.vibration : t.ringUntilDismissed}</span>
      <input
        type="checkbox"
        className="size-5 accent-[var(--color-accent)]"
        checked={settings[key]}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
      />
    </label>
  );
  return (
    <div className="card w-80 max-w-[calc(100vw-24px)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <strong>{t.timerSettings}</strong>
        <button type="button" className="btn btn-ghost min-h-9 px-2" onClick={onClose}>
          ✕
        </button>
      </div>
      {toggle("sound")}
      {/* iPhone has no vibration API */}
      {typeof navigator !== "undefined" && "vibrate" in navigator && toggle("vibration")}
      {toggle("ring")}
      <label className="flex min-h-11 items-center justify-between gap-4">
        <span>{t.enableNotifications}</span>
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-accent)]"
          checked={settings.push}
          onChange={async (e) => {
            if (!e.target.checked) return setSettings({ ...settings, push: false });
            setPushError(!(await enablePush()));
          }}
        />
      </label>
      {settings.push && (
        <div className="flex min-h-11 items-center justify-between gap-4">
          <button
            type="button"
            className="btn btn-ghost min-h-9 px-2"
            onClick={async () => setTest((await testPush(t.testNotificationTitle)) ? "sent" : "failed")}
          >
            {t.testNotification}
          </button>
          {test !== "idle" && (
            <span className="text-sm text-muted">
              {test === "sent" ? t.testNotificationSent : t.testNotificationFailed}
            </span>
          )}
        </div>
      )}
      {(pushError || (isIos && !standalone)) && <p className="mt-1 text-sm text-muted">{t.iosInstallHint}</p>}
    </div>
  );
}

const OPEN_SETTINGS = "recipes:timer-settings";
export const openTimerSettings = () => window.dispatchEvent(new Event(OPEN_SETTINGS));

/** While a timer runs without push, explain that a locked phone stays silent and offer to turn push on. */
function PushHint() {
  const t = useT();
  const { timers, settings, pushAvailable, enablePush } = useTimers();
  const [dismissed, setDismissed, loaded] = useStoredState("push-hint-dismissed", false);
  const running = timers.some((x) => x.endsAt !== null);
  if (!loaded || dismissed || settings.push || !pushAvailable || !running) return null;
  return (
    <div className="card flex w-80 max-w-[calc(100vw-24px)] items-center gap-2 p-3 text-sm">
      <span className="flex-1">{t.pushHint}</span>
      <button type="button" className="btn btn-primary min-h-9 px-3" onClick={() => void enablePush()}>
        {t.turnOn}
      </button>
      <button
        type="button"
        className="btn btn-ghost min-h-9 px-2"
        aria-label="dismiss hint"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}

/** Floating tray of running timers, shown on every page. */
export function TimerTray() {
  const t = useT();
  const { timers, now, pause, resume, extend, cancel } = useTimers();
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS, open);
    return () => window.removeEventListener(OPEN_SETTINGS, open);
  }, []);
  if (!timers.length && !settingsOpen) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-3 print:hidden">
      {settingsOpen && (
        <div className="pointer-events-auto">
          <Settings onClose={() => setSettingsOpen(false)} />
        </div>
      )}
      <div className="pointer-events-auto">
        <PushHint />
      </div>
      <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-2" aria-live="polite">
        {timers.map((timer) => {
          const ms = remaining(timer, now);
          const ringing = timer.firedAt !== null;
          const paused = timer.endsAt === null && !ringing;
          return (
            <div
              key={timer.id}
              className={`flex items-center gap-2 border-2 border-accent py-2 pr-2 pl-3.5 font-mono ${ringing ? "animate-pulse bg-accent text-accent-ink" : "bg-ink text-bg"}`}
            >
              <span className="max-w-32 truncate text-sm">{timer.label}</span>
              <b className="text-xl tabular-nums">{ringing ? t.timerDone : formatClock(ms)}</b>
              {!ringing && (
                <button
                  type="button"
                  className="h-9 min-w-9 border border-current/40 px-2"
                  onClick={() => (paused ? resume(timer.id) : pause(timer.id))}
                  aria-label={paused ? "resume" : "pause"}
                >
                  {paused ? "▶" : "❚❚"}
                </button>
              )}
              <button
                type="button"
                className="h-9 border border-current/40 px-2"
                onClick={() => extend(timer.id, 60)}
              >
                +1′
              </button>
              <button
                type="button"
                className="h-9 min-w-9 border border-current/40 px-2"
                onClick={() => cancel(timer.id)}
                aria-label="dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="h-11 w-11 border-2 border-line-strong bg-surface text-ink shadow-sm"
          title={t.timerSettings}
          aria-label={t.timerSettings}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
