"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Language, ThemeMode } from "./i18n";

const LANG_KEY = "billclarity_lang";
const THEME_KEY = "billclarity_theme";
const DEFAULT_LANG: Language = "en";
const DEFAULT_THEME: ThemeMode = "system";

/*
 * Language and theme live in a small store backed by localStorage.
 *
 * - The server, and the first pass in the browser, render the defaults; React
 *   then switches to the saved values. Rendering the saved values straight
 *   away would not match the server HTML, which left the wrong theme button
 *   highlighted after a reload.
 * - Storage can be blocked outright (private windows, embedded previews).
 *   Every access is guarded, and the choice then simply lasts for the visit.
 */
const listeners = new Set<() => void>();
let cachedLang: Language | null = null;
let cachedTheme: ThemeMode | null = null;

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the in-memory value still applies for this visit.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function getLang(): Language {
  if (cachedLang === null) {
    const stored = readStored(LANG_KEY);
    cachedLang = stored === "ms" || stored === "en" ? stored : DEFAULT_LANG;
  }
  return cachedLang;
}

function getTheme(): ThemeMode {
  if (cachedTheme === null) {
    const stored = readStored(THEME_KEY);
    cachedTheme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : DEFAULT_THEME;
  }
  return cachedTheme;
}

function setLang(next: Language): void {
  cachedLang = next;
  writeStored(LANG_KEY, next);
  notify();
}

function setTheme(next: ThemeMode): void {
  cachedTheme = next;
  writeStored(THEME_KEY, next);
  notify();
}

const getServerLang = (): Language => DEFAULT_LANG;
const getServerTheme = (): ThemeMode => DEFAULT_THEME;

function applyDomTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

interface PreferencesContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getLang, getServerLang);
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    applyDomTheme(theme);
    if (theme !== "system") return;
    // Follow the operating system while "System" is selected.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDomTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const value = useMemo(
    () => ({ lang, setLang, theme, setTheme }),
    [lang, theme]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
