import { useState, useCallback } from 'react';
import { Search, MapPin, X } from 'lucide-react';

export default function AddressSearch({ value, onChange, onClear, placeholder = 'Search address (street, city)' }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&addressdetails=1&limit=8`,
        { headers: { 'Accept-Language': 'he,en', 'User-Agent': 'ISA-Express-Address-Search/1.0' } }
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError('Search error');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const selectResult = (item) => {
    const addr = item.address || {};
    onChange({
      displayAddress: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      city: addr.city || addr.town || addr.village || addr.municipality || '',
      street: addr.road || addr.street || addr.pedestrian || '',
      houseNumber: addr.house_number || '',
    });
    setQuery('');
    setResults([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value ? value.displayAddress : query}
          onChange={(e) => {
            if (value) return;
            setQuery(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder={placeholder}
          readOnly={!!value}
          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500"
        />
        {value ? (
          <button
            type="button"
            onClick={() => { onClear?.(); onChange(null); }}
            className="p-2 border rounded-lg hover:bg-slate-50"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {searching ? '...' : 'Search'}
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {results.length > 0 && !value && (
        <ul className="border rounded-lg shadow-lg bg-white max-h-48 overflow-y-auto">
          {results.map((item) => (
            <li
              key={item.place_id}
              onClick={() => selectResult(item)}
              className="px-4 py-2.5 cursor-pointer text-sm hover:bg-slate-50 border-b last:border-0 flex items-center gap-2"
            >
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
