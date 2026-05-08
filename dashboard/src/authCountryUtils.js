/**
 * Auth user `country` (DB / UsersPanel) -> shipping destination id on missions (server whitelist).
 * Must match `VALID_SHIPPING_DESTINATIONS` in server and `SHIPPING_DESTINATIONS` in shippingDestinations.js.
 */
const AUTH_COUNTRY = {
  india: { shippingDestination: 'india', defaultPhoneCode: '+91' },
  thailand: { shippingDestination: 'thailand', defaultPhoneCode: '+66' },
};

function normalizeAuthCountryKey(country) {
  if (country == null || String(country).trim() === '') return null;
  const k = String(country).trim().toLowerCase();
  if (k === 'india') return 'india';
  if (k === 'thailand' || k === 'th') return 'thailand';
  return null;
}

/** @returns {'india' | 'thailand' | null} */
export function authCountryToShippingDestination(country) {
  const n = normalizeAuthCountryKey(country);
  return n ? AUTH_COUNTRY[n].shippingDestination : null;
}

/** Default international dial code for UIs (receiver overseas); Israeli sender flows keep +972. */
export function authCountryToDefaultPhoneCode(country) {
  const n = normalizeAuthCountryKey(country);
  return n ? AUTH_COUNTRY[n].defaultPhoneCode : '+972';
}
