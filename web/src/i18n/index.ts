// File: web/src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import rw from "./translations/rw.json";
import en from "./translations/en.json";

i18n.use(initReactI18next).init({
  resources: {
    rw: { translation: rw },
    en: { translation: en },
  },
  lng: "rw",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
