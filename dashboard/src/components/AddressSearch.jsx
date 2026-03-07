import { useState, useCallback } from 'react';
import { Search, MapPin, X } from 'lucide-react';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query.trim())}&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      if (data.status === 'OK' && Array.isArray(data.results)) {
        setResults(data.results.slice(0, 8));
      } else {
        setResults([]);
      }
    } catch {
      setError('Search error');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const parseComponents = (components = []) => {
    const get = (type) => components.find((c) => c.types.includes(type))?.long_name || '';
    return {
      city: get('locality') || get('administrative_area_level_2') || get('administrative_area_level_1') || '',
      street: get('route') || '',
      houseNumber: get('street_number') || '',
    };
  };

  const selectResult = (item) => {
    const { city, street, houseNumber } = parseComponents(item.address_components);
    onChange({
      displayAddress: item.formatted_address,
      lat: item.geometry.location.lat,
      lng: item.geometry.location.lng,
      city,
      street,
      houseNumber,
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
          {results.map((item, i) => (
            <li
              key={i}
              onClick={() => selectResult(item)}
              className="px-4 py-2.5 cursor-pointer text-sm hover:bg-slate-50 border-b last:border-0 flex items-center gap-2"
            >
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              {item.formatted_address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
