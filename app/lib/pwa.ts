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
