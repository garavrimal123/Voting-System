import { createContext, useContext, useState } from 'react';
import { TRANSLATIONS } from '../data/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en');

  function toggleLang() {
    const next = lang === 'en' ? 'ne' : 'en';
    setLang(next);
    localStorage.setItem('lang', next); // a display preference, fine to persist across sessions
  }

  // Falls back to the key itself (usually the English text) so a missing
  // translation shows something sensible rather than breaking the page.
  function t(key) {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
