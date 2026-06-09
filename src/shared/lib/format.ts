import type { Locale } from '@shared/i18n';

// Curated weekday short labels, index 0 = Sunday (matches Date.getDay()).
const WEEKDAY_SHORT: Record<Locale, string[]> = {
  uz: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
};

export function formatWeekdayShort(locale: Locale, date: Date): string {
  return WEEKDAY_SHORT[locale][date.getDay()];
}

const timeFmt: Partial<Record<Locale, Intl.DateTimeFormat>> = {};
export function formatTime(locale: Locale, date: Date): string {
  if (!timeFmt[locale]) {
    timeFmt[locale] = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return timeFmt[locale]!.format(date);
}
