/** Default unit value (₪) for a parcel content type, matched by label. */
export function valueIlsForTypeLabel(parcelContentTypes, label) {
  if (!label || !Array.isArray(parcelContentTypes)) return 0;
  const t = parcelContentTypes.find((x) => x.label === label);
  if (!t) return 0;
  const v = t.valueIls;
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Sum qty × price for one delivery's boxContents (nested arrays). */
export function sumBoxContentsIls(boxContents) {
  if (!Array.isArray(boxContents)) return 0;
  let sum = 0;
  for (const box of boxContents) {
    if (!Array.isArray(box)) continue;
    for (const it of box) {
      const qty = Math.max(0, Number(it?.qty) || 0);
      const price = Math.max(0, Number(it?.price) || 0);
      sum += qty * price;
    }
  }
  return sum;
}

export function sumAllDeliveriesContentsIls(deliveries) {
  if (!Array.isArray(deliveries)) return 0;
  return deliveries.reduce((acc, d) => acc + sumBoxContentsIls(d?.boxContents), 0);
}

export function formatIls(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
