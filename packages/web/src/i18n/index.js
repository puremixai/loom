import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';
const STORAGE_KEY = 'loom-lang';
export function readStoredLocale() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'zh' || v === 'en')
            return v;
    }
    catch {
        // access denied (e.g., strict privacy mode) — fall through
    }
    return 'zh';
}
export function writeStoredLocale(locale) {
    try {
        localStorage.setItem(STORAGE_KEY, locale);
    }
    catch {
        // ignore
    }
}
i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        zh: { translation: zh },
    },
    lng: readStoredLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
});
export default i18n;
