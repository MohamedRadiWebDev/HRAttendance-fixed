export type ThemeMode = "light" | "dark" | "system";

const KEY = "ui:theme";

export function getSavedTheme(): ThemeMode {
  const raw = localStorage.getItem(KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldDark = mode === "dark" || (mode === "system" && systemDark);
  root.classList.toggle("dark", shouldDark);
}

export function setSavedTheme(mode: ThemeMode) {
  localStorage.setItem(KEY, mode);
  applyTheme(mode);
}
