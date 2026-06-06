/**
 * Lokal kalendar bo'yicha 'YYYY-MM-DD' kalit qaytaradi.
 *
 * MUHIM: bu yagona sana-kalit manbai. `toISOString()` (UTC) ishlatmang —
 * u yozuvchi (lokal) bilan o'quvchi orasida nomuvofiqlik keltirib chiqaradi
 * va streak hisobini buzadi.
 */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
