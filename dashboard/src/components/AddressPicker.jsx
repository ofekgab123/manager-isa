import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, useMap } from 'react-leaflet';
import { X, Search, Video, Square, RotateCcw, Camera, Upload } from 'lucide-react';

const MAP_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong)';

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
}

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function AddressPicker({ isOpen, onClose, onSelect, initialPosition }) {
  const [position, setPosition] = useState(initialPosition || [32.0853, 34.7818]);
  const [addressText, setAddressText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showVideo, setShowVideo] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mediaProof, setMediaProof] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [addressDetails, setAddressDetails] = useState(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mediaProofRef = useRef(null);
  const fileInputImageRef = useRef(null);
  const fileInputVideoRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMapReady(false);
      const t = setTimeout(() => setMapReady(true), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const parseStructuredQuery = useCallback((query) => {
    const commaIdx = query.lastIndexOf(',');
    if (commaIdx > 0) {
      const street = query.slice(0, commaIdx).trim();
      const city = query.slice(commaIdx + 1).trim();
      if (street && city) return { street, city };
    }
    // e.g. "Herzl 12 Haifa" – split after the last digit block
    const numMatch = query.match(/^(.+?\d+)\s+(.+)$/);
    if (numMatch) {
      const street = numMatch[1].trim();
      const city = numMatch[2].trim();
      if (street && city) return { street, city };
    }
    return null;
  }, []);

  // Extract house number typed by user, to fill in when Nominatim doesn't return one
  const extractHouseNumberFromQuery = useCallback((query) => {
    const m = query.match(/\b(\d+)\b/);
    return m ? m[1] : '';
  }, []);

  const NOMINATIM_HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'ISA-Express-Address-Search/1.0' };

  const nominatimFetch = useCallback(async (url) => {
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  // ArcGIS World Geocoder – better house-level accuracy for Israel.
  // Results are normalized to the same shape as Nominatim items so the rest of the code is unchanged.
  const arcgisSearch = useCallback(async (query) => {
    try {
      const params = new URLSearchParams({
        SingleLine: query,
        f: 'json',
        maxLocations: '6',
        countryCode: 'ISR',
        outFields: 'StAddr,City',
      });
      const res = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      const candidates = (data.candidates || []).filter((c) => c.score >= 70);
      return candidates.map((c) => {
        const stAddr = c.attributes?.StAddr || '';
        const numFirst = stAddr.match(/^(\d+)\s+(.+)$/);
        const numLast  = stAddr.match(/^(.+?)\s+(\d+)$/);
        const houseNumber = numFirst ? numFirst[1] : numLast ? numLast[2] : '';
        const street      = numFirst ? numFirst[2].trim() : numLast ? numLast[1].trim() : stAddr.trim();
        return {
          place_id: `arcgis_${c.location.x}_${c.location.y}`,
          lat: String(c.location.y),
          lon: String(c.location.x),
          display_name: c.address,
          address: { road: street, house_number: houseNumber, city: c.attributes?.City || '' },
        };
      });
    } catch {
      return [];
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const query = searchQuery.trim();
      let items = [];

      const structured = parseStructuredQuery(query);
      if (structured) {
        const params = new URLSearchParams({
          format: 'json',
          street: structured.street,
          city: structured.city,
          countrycodes: 'il',
          addressdetails: '1',
          limit: '6',
        });
        items = await nominatimFetch(`https://nominatim.openstreetmap.org/search?${params}`);
      }

      if (items.length === 0) {
        items = await nominatimFetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=il&addressdetails=1&limit=6`
        );
      }

      // If Nominatim didn't return a house number and query contains a digit, try ArcGIS
      // which has better house-level data for Israel
      const nominatimHasHouse = items.some((i) => i.address?.house_number);
      if (/\d/.test(query) && !nominatimHasHouse) {
        const arcgisItems = await arcgisSearch(query);
        if (arcgisItems.length > 0) items = arcgisItems;
      }

      if (items.length > 0) {
        setSearchResults(items);
        const { lat, lon, display_name, address } = items[0];
        setPosition([parseFloat(lat), parseFloat(lon)]);
        setAddressText(display_name);
        const addr = address || {};
        setAddressDetails({
          city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
          street: addr.road || addr.street || addr.pedestrian || '',
          houseNumber: addr.house_number || extractHouseNumberFromQuery(query),
        });
      } else {
        setSearchError('No results found');
        setAddressDetails(null);
      }
    } catch {
      setSearchError('Search error');
      setAddressDetails(null);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, parseStructuredQuery, nominatimFetch, arcgisSearch, extractHouseNumberFromQuery]);

  const selectSearchResult = useCallback((item) => {
    const { lat, lon, display_name, address } = item;
    setPosition([parseFloat(lat), parseFloat(lon)]);
    setAddressText(display_name);
    const addr = address || {};
    setAddressDetails({
      city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
      street: addr.road || addr.street || addr.pedestrian || '',
      houseNumber: addr.house_number || extractHouseNumberFromQuery(searchQuery),
    });
    setSearchResults([]);
  }, [searchQuery, extractHouseNumberFromQuery]);

  const handleMapClick = useCallback(async (latlng) => {
    setPosition([latlng.lat, latlng.lng]);
    setAddressText('Loading...');
    setAddressDetails(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&addressdetails=1`,
        { headers: NOMINATIM_HEADERS }
      );
      const data = await res.json();
      setAddressText(data.display_name || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
      const addr = data.address || {};
      setAddressDetails({
        city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
        street: addr.road || addr.street || addr.pedestrian || '',
        houseNumber: addr.house_number || '',
      });
    } catch {
      setAddressText(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    }
  }, []);

  const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;

  const compressImage = useCallback((blob) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 800;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => {
          if (!b) return resolve(null);
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(b);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }, []);

  const blobToDataUrl = useCallback((blobUrl, options = {}) => {
    return fetch(blobUrl)
      .then((r) => r.blob())
      .then(async (blob) => {
        if (options.compressImage && blob.type.startsWith('image/')) {
          return compressImage(blob);
        }
        if (blob.size > MAX_PAYLOAD_BYTES) return null;
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .catch(() => null);
  }, [compressImage]);

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    try {
      let videoUrl = mediaProof?.type === 'video' ? mediaProof.url : undefined;
      let imageUrl = mediaProof?.type === 'image' ? mediaProof.url : undefined;
      if (videoUrl && videoUrl.startsWith('blob:')) {
        const data = await blobToDataUrl(videoUrl);
        videoUrl = data || undefined;
      }
      if (imageUrl && imageUrl.startsWith('blob:')) {
        const data = await blobToDataUrl(imageUrl, { compressImage: true });
        imageUrl = data || undefined;
      }
      onSelect({
        lat: position[0],
        lng: position[1],
        displayAddress: addressText || `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`,
        videoUrl,
        imageUrl,
        city: addressDetails?.city || '',
        street: addressDetails?.street || '',
        houseNumber: addressDetails?.houseNumber || '',
      });
      onClose();
    } finally {
      setConfirming(false);
    }
  }, [position, addressText, mediaProof, addressDetails, onSelect, onClose, blobToDataUrl]);

  const startVideoRecording = useCallback(async () => {
    setVideoError('');
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      mediaProofRef.current = null;
      setShowVideo(true);
      setMediaProof(null);
    } catch (err) {
      setVideoError('Cannot access camera. Check browser permissions.');
    }
  }, []);

  useEffect(() => {
    if (showVideo && streamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
    }
  }, [showVideo]);

  const startRecord = useCallback(() => {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      if (mediaProofRef.current) URL.revokeObjectURL(mediaProofRef.current);
      mediaProofRef.current = url;
      setMediaProof({ type: 'video', url });
      setShowVideo(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    recorder.start();
    setVideoRecording(true);
  }, []);

  const stopRecord = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setVideoRecording(false);
    }
  }, []);

  const cancelVideo = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowVideo(false);
    setVideoRecording(false);
    setVideoError('');
  }, []);

  const removeMediaProof = useCallback(() => {
    if (mediaProofRef.current) {
      URL.revokeObjectURL(mediaProofRef.current);
      mediaProofRef.current = null;
    }
    setMediaProof(null);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoPreviewRef.current || !streamRef.current) return;
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      if (mediaProofRef.current) URL.revokeObjectURL(mediaProofRef.current);
      mediaProofRef.current = url;
      setMediaProof({ type: 'image', url });
      setShowVideo(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }, 'image/jpeg', 0.9);
  }, []);

  const handleFileUpload = useCallback((e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (mediaProofRef.current) URL.revokeObjectURL(mediaProofRef.current);
    mediaProofRef.current = url;
    setMediaProof({ type, url });
    e.target.value = '';
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (mediaProofRef.current) URL.revokeObjectURL(mediaProofRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-4">
      {showVideo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-2 sm:p-4">
          <div className="bg-white rounded-xl overflow-hidden max-w-lg w-full max-h-[95vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Video verification recording</h3>
              <button onClick={cancelVideo} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video bg-black relative">
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3">
                {!videoRecording ? (
                  <>
                    <button
                      onClick={startRecord}
                      className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium"
                    >
                      <Video className="w-5 h-5" />
                      Start recording
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium"
                    >
                      <Camera className="w-5 h-5" />
                      Take photo
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopRecord}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium animate-pulse"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    Stop recording
                  </button>
                )}
                <button
                  onClick={cancelVideo}
                  className="px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-full"
                >
                  Cancel
                </button>
              </div>
            </div>
            <p className="p-3 text-sm text-slate-500 text-center">
              Show the building entrance or house number on camera
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">Select address on map</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 border-b bg-slate-50 relative overflow-visible">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError('');
                setSearchResults([]);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search address (street, house number, city – e.g. Herzl 12 Haifa)"
              className="flex-1 px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {searchError && (
            <p className="text-red-500 text-sm mt-2">{searchError}</p>
          )}
          {searchResults.length > 1 && (
            <ul className="absolute left-3 right-3 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((item) => (
                <li
                  key={item.place_id}
                  onClick={() => selectSearchResult(item)}
                  className="px-4 py-2.5 cursor-pointer text-sm text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  {item.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative" style={{ minHeight: 250, height: 'min(50vh, 350px)' }}>
          {showVideo ? null : !mapReady ? (
            <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500">
              Loading map...
            </div>
          ) : (
            <MapContainer
              center={position}
              zoom={13}
              className="h-full w-full"
              style={{ minHeight: 250, height: 'min(50vh, 350px)', width: '100%' }}
              scrollWheelZoom={true}
              whenCreated={(map) => {
                setTimeout(() => map.invalidateSize(), 50);
              }}
            >
              <ChangeView center={position} zoom={13} />
              <TileLayer
                attribution={MAP_ATTRIBUTION}
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              <MapClickHandler onSelect={handleMapClick} />
              <Marker position={position}>
                <Popup>Click on the map to select location</Popup>
              </Marker>
            </MapContainer>
          )}
        </div>

        <div className="p-3 sm:p-4 space-y-4 border-t overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Selected address / Notes</label>
            <input
              type="text"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="Enter address or additional details..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Address verification – photo or video</p>
            {!mediaProof ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startVideoRecording}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-500 hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition"
                >
                  <Video className="w-5 h-5" />
                  Record video
                </button>
                <button
                  type="button"
                  onClick={() => fileInputImageRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-500 hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition"
                >
                  <Upload className="w-5 h-5" />
                  Upload photo
                </button>
                <input
                  ref={fileInputImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'image')}
                />
                <button
                  type="button"
                  onClick={() => fileInputVideoRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-500 hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition"
                >
                  <Video className="w-5 h-5" />
                  Upload video
                </button>
                <input
                  ref={fileInputVideoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'video')}
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start gap-2">
                {mediaProof.type === 'image' ? (
                  <img src={mediaProof.url} alt="Verification" className="w-full max-w-xs max-h-32 object-contain rounded-lg border" />
                ) : (
                  <video src={mediaProof.url} controls className="w-full max-w-xs max-h-32 rounded-lg border" />
                )}
                <button
                  type="button"
                  onClick={removeMediaProof}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Replace
                </button>
              </div>
            )}
            {videoError && <p className="text-red-500 text-sm mt-2">{videoError}</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 font-medium disabled:opacity-50"
            >
              {confirming ? 'Saving...' : 'Confirm address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
