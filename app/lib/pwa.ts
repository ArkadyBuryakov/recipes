import { useEffect, useState } from "react";

/** Registers the service worker (production only) and asks it to refresh the offline cookbook. */
export function useServiceWorker() {
  useEffect(() => {
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.active?.postMessage("sync"))
      .catch(() => {});
  }, []);
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome fires this once, possibly before any component mounts, so catch it at module load.
let deferredPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    for (const l of installListeners) l();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    for (const l of installListeners) l();
  });
}

const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * How this browser can add the app to the home screen: "prompt" (Chrome/Android, native dialog),
 * "ios" (Safari has no API, only Share → Add to Home Screen), or null (installed or unsupported).
 */
export function useInstall() {
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);
  useEffect(() => {
    const update = () => {
      if (isStandalone()) return setMode(null);
      if (deferredPrompt) return setMode("prompt");
      const ios =
        /iP(hone|ad|od)/.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
      setMode(ios ? "ios" : null);
    };
    update();
    installListeners.add(update);
    return () => {
      installListeners.delete(update);
    };
  }, []);
  const install = async () => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    deferredPrompt = null;
    for (const l of installListeners) l();
  };
  return { mode, install };
}
