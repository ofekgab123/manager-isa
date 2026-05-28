/** Must match server whitelist + customer app (`isa-express-web` emptyBoxDestinations) */
export const SHIPPING_DESTINATIONS = [
  { id: 'india', label: 'India' },
  { id: 'thailand', label: 'Thailand' },
];

export function shippingDestinationLabel(id) {
  if (id == null || id === '') return '';
  return SHIPPING_DESTINATIONS.find((d) => d.id === id)?.label || String(id);
}

/** india | thailand | null — Ship to / LionWheel region (shippingDestination mirrors country once saved). */
export function missionLwRegionId(mission) {
  if (!mission) return null;
  const raw = mission.shippingDestination ?? mission.country;
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().toLowerCase();
  return s === 'india' || s === 'thailand' ? s : null;
}

export const PAYMENT_LOCATIONS = [
  { id: 'israel', label: 'Israel' },
  { id: 'thailand', label: 'Thailand' },
];

export function paymentLocationLabel(id) {
  if (id == null || id === '') return '';
  return PAYMENT_LOCATIONS.find((p) => p.id === id)?.label || String(id);
}

export function isMissingThailandPayment(mission) {
  return mission?.type === 'pickup'
    && missionLwRegionId(mission) === 'thailand'
    && !mission.paymentLocation;
}
