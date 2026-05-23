import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import rw from './rw.json';
import en from './en.json';
import fr from './fr.json';

const i18n = new I18n({ rw, en, fr });

i18n.locale = Localization.getLocales()[0].languageCode?.startsWith('rw') ? 'rw' :
               Localization.getLocales()[0].languageCode?.startsWith('fr') ? 'fr' : 'en';

i18n.enableFallback = true;
i18n.defaultLocale = 'rw';

export default i18n;
