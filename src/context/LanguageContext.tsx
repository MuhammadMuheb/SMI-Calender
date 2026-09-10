import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import translations, { type Lang } from '../i18n/translations';
import { supabase } from '../lib/supabase';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'smi_lang';

export function LanguageProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'it' ? 'it' : 'en') as Lang;
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    if (userId) {
      supabase.from('users').update({ lang: newLang }).eq('id', userId).then(() => {});
    }
  }, [userId]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang][key] || translations['en'][key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
