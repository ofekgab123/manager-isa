/**
 * מפתח אחד להשוואת מספרי נייד ישראליים: 0542562586, 542562586, +972-54-256-25-86, 972542562586
 * @returns {string} בדרך כלל 9 ספרות (מנוי), או '' אם ריק
 */
export function israeliMobileKey(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('972')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  if (d.length > 9) d = d.slice(-9);
  return d;
}
