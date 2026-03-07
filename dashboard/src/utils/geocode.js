const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function geocodeAddress({ city, street, houseNumber }) {
  const parts = [street, houseNumber, city].filter(Boolean);
  const query = parts.join(', ');
  if (!query.trim()) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`
    );
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {
    // ignore
  }
  return null;
}
