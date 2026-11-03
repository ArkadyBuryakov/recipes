import { useEffect } from "react";
import { useStoredState } from "./storage";

export type Theme = "system" | "light" | "dark";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useStoredState<Theme>("theme", "system");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const next = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  return [theme, next];
}
