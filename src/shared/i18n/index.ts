import uz from './uz';
import en from './en';
import ru from './ru';

export type Locale = 'uz' | 'en' | 'ru';
export type TranslationKey = keyof typeof uz;

export const LOCALES: Locale[] = ['uz', 'en', 'ru'];

const translations: Record<Locale, Record<string, string>> = {
  uz: uz as Record<string, string>,
  en: en as Record<string, string>,
  ru: ru as Record<string, string>,
};

export type PluralCategory = 'one' | 'few' | 'many' | 'other';

// Per-locale plural category via Intl.PluralRules (uz → always 'other').
const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};
export function pluralCategory(locale: Locale, n: number): PluralCategory {
  if (locale === 'uz') return 'other';
  if (!pluralRules[locale]) pluralRules[locale] = new Intl.PluralRules(locale);
  const cat = pluralRules[locale]!.select(n) as PluralCategory;
  return cat;
}

type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`
  );
}

export type TFunc = (key: TranslationKey, params?: Params) => string;

export function getT(locale: Locale): TFunc {
  const dict = translations[locale];
  const fallback = translations.uz;
  return (key, params) => {
    let resolvedKey: string = key;
    // Plural: if params.count is present and a `${key}_<cat>` form exists, use it.
    if (params && typeof params.count === 'number') {
      const cat = pluralCategory(locale, params.count);
      const candidates = [`${key}_${cat}`, `${key}_other`];
      for (const c of candidates) {
        if (dict[c] != null || fallback[c] != null) { resolvedKey = c; break; }
      }
    }
    const template = dict[resolvedKey] ?? fallback[resolvedKey] ?? dict[key] ?? fallback[key] ?? key;
    return interpolate(template, params);
  };
}
