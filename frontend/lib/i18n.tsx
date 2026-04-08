"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";

const messages: Record<string, typeof fr> = { fr, en };

type Locale = "fr" | "en";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "fr",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const saved = localStorage.getItem("ifpc_locale");
    if (saved === "fr" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("ifpc_locale", l);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const parts = key.split(".");
    let obj: any = messages[locale];
    for (const p of parts) {
      if (obj == null) return key;
      obj = obj[p];
    }
    let result = typeof obj === "string" ? obj : key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }
    return result;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
