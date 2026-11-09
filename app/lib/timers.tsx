import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStoredState } from "./storage";

/** Kitchen timers (ADR 0010): end timestamps in localStorage, in-page alert, server Web Push when locked. */
export type Timer = {
  id: string;
  label: string;
  url: string;
  durationMs: number;
  /** Wall-clock end while running; null while paused. */
  endsAt: number | null;
  /** Remaining time while paused. */
  remainingMs: number;
  firedAt: number | null;
};

export type TimerSettings = { sound: boolean; vibration: boolean; ring: boolean; push: boolean };

const DEFAULT_SETTINGS: TimerSettings = { sound: true, vibration: true, ring: true, push: false };

type TimersApi = {
  timers: Timer[];
  now: number;
  settings: TimerSettings;
  setSettings: (s: TimerSettings) => void;
  start: (label: string, seconds: number) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  extend: (id: string, seconds: number) => void;
  cancel: (id: string) => void;
  /** Asks for notification permission, subscribes, and schedules pushes for the running timers. */
  enablePush: () => Promise<boolean>;
  /** Schedules a push in a few seconds, to check the whole chain (lock the phone and wait). */
  testPush: (label: string) => Promise<boolean>;
  /** Web Push can work here (iOS: only in the Home Screen app) and isn't blocked. */
  pushAvailable: boolean;
};

const TimersContext = createContext<TimersApi | null>(null);

export function remaining(timer: Timer, now: number): number {
  return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - now);
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** iOS: "playback" rings through the silent switch like an alarm; "auto" lets other audio (music) carry on. */
function setAudioSession(type: "playback" | "auto") {
  const session = (navigator as AudioSessionNavigator).audioSession;
  try {
    if (session && session.type !== type) session.type = type;
  } catch {
    // unsupported value on this browser
  }
}

function beep(ctx: AudioContext) {
  for (const [offset, freq] of [
    [0, 880],
    [0.25, 880],
    [0.5, 1320],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.22);
  }
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const s = atob(
    base64
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(base64.length / 4) * 4, "="),
  );
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pushSubscription(vapidKey: string | null, create: boolean): Promise<PushSubscription | null> {
  if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidKey) });
}

async function schedulePush(timer: Timer, vapidKey: string | null): Promise<boolean> {
  const sub = await pushSubscription(vapidKey, false).catch(() => null);
  if (!sub || timer.endsAt === null) return false;
  const res = await fetch("/api/timers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: timer.id,
      subscription: sub.toJSON(),
      endsAt: timer.endsAt,
      title: timer.label,
      url: timer.url,
    }),
  }).catch(() => null);
  return res?.ok ?? false;
}

function unschedulePush(id: string) {
  fetch(`/api/timers/${id}`, { method: "DELETE" }).catch(() => {});
}

/**
 * iOS suspends ("interrupted") the AudioContext when the screen locks, and a chime scheduled on a stopped
 * clock stays silent until something resumes it. Resume first and play once; never queue more than one chime.
 */
function chime(ctx: AudioContext, pending: { current: boolean }) {
  setAudioSession("playback");
  if (ctx.state === "running") return beep(ctx);
  if (pending.current) return;
  pending.current = true;
  ctx
    .resume()
    .then(() => beep(ctx))
    .catch(() => {})
    .finally(() => {
      pending.current = false;
    });
}

export function TimersProvider({ children, vapidKey }: { children: ReactNode; vapidKey: string | null }) {
  const [timers, setTimers] = useStoredState<Timer[]>("timers", []);
  const [settings, setSettings] = useStoredState<TimerSettings>("timer-settings", DEFAULT_SETTINGS);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const chimePending = useRef(false);
  const lastRing = useRef(0);
  const [pushAvailable, setPushAvailable] = useState(false);

  useEffect(() => {
    setPushAvailable(
      Boolean(vapidKey) &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        Notification.permission !== "denied",
    );
  }, [vapidKey]);

  // Browsers only start or resume audio on a user gesture; take any tap, and retry when the page is shown again
  // (after a screen lock), so the end-of-timer chime can play.
  useEffect(() => {
    const unlock = () => {
      audio.current ??= new AudioContext();
      if (audio.current.state !== "running") void audio.current.resume().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && audio.current?.state !== "running")
        void audio.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const running = timers.some((t) => t.endsAt !== null || t.firedAt !== null);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Fire timers that reached zero; keep ringing while undismissed if configured.
  useEffect(() => {
    const due = timers.filter((t) => t.endsAt !== null && t.endsAt <= now && t.firedAt === null);
    if (due.length)
      setTimers((ts) =>
        ts.map((t) =>
          due.some((d) => d.id === t.id) ? { ...t, firedAt: now, endsAt: null, remainingMs: 0 } : t,
        ),
      );
    const ringing = timers.some((t) => t.firedAt !== null);
    if (!ringing && !due.length) setAudioSession("auto");
    const shouldAlert = due.length > 0 || (ringing && settings.ring && now - lastRing.current > 2000);
    if (!shouldAlert) return;
    lastRing.current = now;
    if (settings.sound) {
      audio.current ??= new AudioContext();
      chime(audio.current, chimePending);
    }
    if (settings.vibration && due.length) navigator.vibrate?.([300, 150, 300, 150, 600]);
  }, [now, timers, settings, setTimers]);

  const update = useCallback(
    (id: string, fn: (t: Timer) => Timer) => setTimers((ts) => ts.map((t) => (t.id === id ? fn(t) : t))),
    [setTimers],
  );

  const api = useMemo<TimersApi>(
    () => ({
      timers,
      now,
      settings,
      setSettings,
      start(label, seconds) {
        // Unlock audio on the user gesture that starts a timer (iOS requirement).
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
        const t: Timer = {
          id: crypto.randomUUID(),
          label,
          url: location.pathname,
          durationMs: seconds * 1000,
          endsAt: Date.now() + seconds * 1000,
          remainingMs: seconds * 1000,
          firedAt: null,
        };
        setTimers((ts) => [...ts, t]);
        setNow(Date.now());
        if (settings.push) void schedulePush(t, vapidKey);
      },
      pause(id) {
        update(id, (t) =>
          t.endsAt === null ? t : { ...t, remainingMs: remaining(t, Date.now()), endsAt: null },
        );
        unschedulePush(id);
      },
      resume(id) {
        const t = timers.find((x) => x.id === id);
        if (!t || t.endsAt !== null || t.firedAt !== null) return;
        const next = { ...t, endsAt: Date.now() + t.remainingMs };
        update(id, () => next);
        if (settings.push) void schedulePush(next, vapidKey);
      },
      extend(id, seconds) {
        const t = timers.find((x) => x.id === id);
        if (!t) return;
        const base = t.firedAt !== null ? { ...t, firedAt: null, endsAt: Date.now(), remainingMs: 0 } : t;
        const next =
          base.endsAt === null
            ? { ...base, remainingMs: base.remainingMs + seconds * 1000 }
            : { ...base, endsAt: base.endsAt + seconds * 1000 };
        update(id, () => next);
        if (settings.push && next.endsAt !== null) void schedulePush(next, vapidKey);
      },
      cancel(id) {
        setTimers((ts) => ts.filter((t) => t.id !== id));
        unschedulePush(id);
      },
      async enablePush() {
        if (!("Notification" in window)) return false;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return false;
        const sub = await pushSubscription(vapidKey, true).catch(() => null);
        if (!sub) return false;
        setSettings((s) => ({ ...s, push: true }));
        // Timers already running when push is turned on get a notification too.
        for (const t of timers) if (t.endsAt !== null) void schedulePush(t, vapidKey);
        return true;
      },
      testPush(label) {
        const at = Date.now() + 5000;
        const t: Timer = {
          id: crypto.randomUUID(),
          label,
          url: location.pathname,
          durationMs: 5000,
          endsAt: at,
          remainingMs: 5000,
          firedAt: null,
        };
        return schedulePush(t, vapidKey);
      },
      pushAvailable,
    }),
    [timers, now, settings, setSettings, setTimers, update, vapidKey, pushAvailable],
  );

  return <TimersContext.Provider value={api}>{children}</TimersContext.Provider>;
}

export function useTimers(): TimersApi {
  const api = useContext(TimersContext);
  if (!api) throw new Error("useTimers outside TimersProvider");
  return api;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
