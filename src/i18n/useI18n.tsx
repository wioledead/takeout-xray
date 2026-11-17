import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from '../types/domain';
import { DICTIONARY, type TranslationDictionary } from './dictionary';

const LANG_STORAGE_KEY = 'takeout_xray_lang';

function readInitialLang(): Language {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ru') return saved;
    }
  } catch {
    // Ignore storage access errors in restricted privacy contexts
  }
  return 'en';
}

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readInitialLang);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANG_STORAGE_KEY, next);
      }
    } catch {
      // Ignore storage write errors
    }
  };

  const value: I18nContextValue = {
    lang,
    setLang,
    t: DICTIONARY[lang],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}
