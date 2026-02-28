export async function geocodeAddress({ city, street, houseNumber }) {
  const parts = [street, houseNumber, city, 'Israel'].filter(Boolean);
  const query = parts.join(', ');
  if (!query.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=il&limit=1`,
      {
        headers: {
          'Accept-Language': 'he,en',
          'User-Agent': 'ISA-Express-Address-Search/1.0',
        },
      }
    );
    const data = await res.json();
    if (data?.[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch {
    // ignore
  }
  return null;
}
