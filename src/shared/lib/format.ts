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

// Curated month short labels, index 0 = January (matches Date.getMonth()).
const MONTH_SHORT: Record<Locale, string[]> = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

export function formatMonthShort(locale: Locale, date: Date): string {
  return MONTH_SHORT[locale][date.getMonth()];
}

// e.g. "5 Iyn" — curated, no Intl (avoids WebKitGTK uz uncertainty).
export function formatDateShort(locale: Locale, date: Date): string {
  return `${date.getDate()} ${formatMonthShort(locale, date)}`;
}
