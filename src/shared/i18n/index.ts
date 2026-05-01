import uz from './uz';
import en from './en';
import ru from './ru';

export type Locale = 'uz' | 'en' | 'ru';
export type TranslationKey = keyof typeof uz;

const translations: Record<Locale, Record<string, string>> = {
  uz: uz as Record<string, string>,
  en: en as Record<string, string>,
  ru: ru as Record<string, string>,
};

export function getT(locale: Locale): (key: TranslationKey) => string {
  return (key: TranslationKey) =>
    translations[locale][key] ?? translations.uz[key] ?? key;
}
