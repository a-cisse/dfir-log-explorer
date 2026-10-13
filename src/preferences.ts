import { useEffect, useState } from "react";
export type Theme = "light" | "dark" | "system";
export function readPreference<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`dfir.${key}`) ?? "null",
    );
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function usePreference<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() =>
    readPreference(key, fallback, valid),
  );
  useEffect(() => {
    try {
      localStorage.setItem(`dfir.${key}`, JSON.stringify(value));
    } catch {
      /* Preferences are optional when storage is unavailable. */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
export function useTheme() {
  const [theme, setTheme] = usePreference<Theme>(
    "theme",
    "light",
    (v): v is Theme => v === "light" || v === "dark" || v === "system",
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return [theme, setTheme] as const;
}
