/** Must match server whitelist + customer app (`isa-express-web` emptyBoxDestinations) */
export const SHIPPING_DESTINATIONS = [
  { id: 'india', label: 'India' },
  { id: 'thailand', label: 'Thailand' },
];

export function shippingDestinationLabel(id) {
  if (id == null || id === '') return '';
  return SHIPPING_DESTINATIONS.find((d) => d.id === id)?.label || String(id);
}
