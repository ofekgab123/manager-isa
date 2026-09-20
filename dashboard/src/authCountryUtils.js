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

/** Default international dial code from the logged-in user's country (Thailand → +66, India → +91). */
export function authCountryToDefaultPhoneCode(country) {
  const n = normalizeAuthCountryKey(country);
  return n ? AUTH_COUNTRY[n].defaultPhoneCode : '+972';
}

/** Prefer the staff user's country, then the mission/region country. */
export function defaultPhoneCode(authCountry, fallbackCountry = null) {
  const n = normalizeAuthCountryKey(authCountry) || normalizeAuthCountryKey(fallbackCountry);
  return n ? AUTH_COUNTRY[n].defaultPhoneCode : '+972';
}

/** Leads tab: available to every authenticated user; the API scopes data by country. */
export function canAccessLeads(authUser) {
  return !!authUser;
}
