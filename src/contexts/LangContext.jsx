/* ═══════════════════════════════════════════════════════════
 * LANG CONTEXT
 * Language context provider + useT hook
 * ═══════════════════════════════════════════════════════════ */
import React, { createContext, useContext } from "react";
import { TRANSLATIONS } from "../config/translations";

/* ⭐ Context */
export const LangCtx = createContext(TRANSLATIONS.en);

/* ⭐ Provider */
export function LangProvider({ lang = "en", children }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  return <LangCtx.Provider value={t}>{children}</LangCtx.Provider>;
}

/* ⭐ Hook */
export const useT = () => {
  const ctx = useContext(LangCtx);
  return ctx || TRANSLATIONS.en;
};

/* ⭐ Hook بديل للحصول على اللغة الحالية */
export const useLang = () => {
  const t = useT();
  return t.code || "en";
};

/* ⭐ Export للـ Direct use */
export { TRANSLATIONS };
