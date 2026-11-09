import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import hi from "./locales/hi";
import ta from "./locales/ta";
import te from "./locales/te";

// English is the source language: its strings are the translation keys.
// Any string without a translation falls back to the English text.
export const LANGUAGES = [
  { code: "en", name: "English", native: "English", speech: "en-IN" },
  { code: "hi", name: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", speech: "te-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", speech: "ta-IN" },
];

const DICTS = { en: {}, hi, te, ta };
const STORAGE_KEY = "accessai_lang";

export function getStoredLang() {
  try {
    const code = localStorage.getItem(STORAGE_KEY);
    if (code && DICTS[code]) return code;
  } catch {
    // ignore
  }
  return "en";
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// Translate outside React components (voice assistant, guidance, speech)
export function translate(lang, key, vars) {
  const text = DICTS[lang]?.[key] ?? key;
  return interpolate(text, vars);
}

export function tr(key, vars) {
  return translate(getStoredLang(), key, vars);
}

export function getSpeechLocale(lang = getStoredLang()) {
  return LANGUAGES.find((l) => l.code === lang)?.speech ?? "en-IN";
}

// Pick an installed text-to-speech voice for the current language (if the device has one)
export function pickVoice(lang = getStoredLang()) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const locale = getSpeechLocale(lang).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const norm = (v) => v.lang.replace("_", "-").toLowerCase();
  // Prefer installed (local) voices: they start speaking faster than network voices
  const pick = (list) => list.find((v) => v.localService) || list[0] || null;
  return (
    pick(voices.filter((v) => norm(v) === locale)) ||
    pick(voices.filter((v) => norm(v).startsWith(locale.slice(0, 2))))
  );
}

// Set language + voice on an utterance
export function applySpeechLanguage(utterance, lang = getStoredLang()) {
  utterance.lang = getSpeechLocale(lang);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
}

const I18nContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLang);

  const setLang = useCallback((code) => {
    if (!DICTS[code]) return;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
    setLangState(code);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Works (in English) even without a provider
  return { lang: "en", setLang: () => {}, t: (key, vars) => interpolate(key, vars), languages: LANGUAGES };
}