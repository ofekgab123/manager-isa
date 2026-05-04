/** Must match server whitelist + customer app (`isa-express-web` emptyBoxDestinations) */
export const SHIPPING_DESTINATIONS = [
  { id: 'india', label: 'India' },
  { id: 'thailand', label: 'Thailand' },
];

export function shippingDestinationLabel(id) {
  if (id == null || id === '') return '';
  return SHIPPING_DESTINATIONS.find((d) => d.id === id)?.label || String(id);
}

/** india | thailand | null — LionWheel region from mission (shippingDestination legacy or country). */
export function missionLwRegionId(mission) {
  if (!mission) return null;
  const raw = mission.shippingDestination ?? mission.country;
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().toLowerCase();
  return s === 'india' || s === 'thailand' ? s : null;
}
