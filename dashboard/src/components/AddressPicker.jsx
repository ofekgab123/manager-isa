import { useState, useCallback, useEffect, useRef } from 'react';
import { useJsApiLoader, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import { X, Video, Square, RotateCcw, Camera, Upload, Search } from 'lucide-react';

const LIBRARIES = ['places'];
const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControlOptions: { position: 7 },
};

function parseAddressComponents(components = []) {
  const get = (type) => components.find((c) => c.types.includes(type))?.long_name || '';
  return {
    city: get('locality') || get('administrative_area_level_2') || get('administrative_area_level_1') || '',
    street: get('route') || '',
    houseNumber: get('street_number') || '',
  };
}

export default function AddressPicker({ isOpen, onClose, onSelect, initialPosition }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [position, setPosition] = useState(
    initialPosition ? { lat: initialPosition[0], lng: initialPosition[1] } : DEFAULT_CENTER
  );
  const [addressText, setAddressText] = useState('');
  const [addressDetails, setAddressDetails] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [mediaProof, setMediaProof] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mediaProofRef = useRef(null);
  const fileInputImageRef = useRef(null);
  const fileInputVideoRef = useRef(null);

  const reverseGeocode = useCallback((lat, lng) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setAddressText(results[0].formatted_address);
        setAddressDetails(parseAddressComponents(results[0].address_components));
      } else {
        setAddressText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setAddressDetails(null);
      }
    });
  }, []);

  const handleMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPosition({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const handleMarkerDragEnd = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPosition({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const onPlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place.geometry) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setPosition({ lat, lng });
    setAddressText(place.formatted_address || '');
    setAddressDetails(parseAddressComponents(place.address_components));
    setSearchQuery('');
    setSearchError('');
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(16);
    }
  }, []);

  const handleSearchAddress = useCallback(() => {
    const q = searchQuery.trim();
    if (!q || !window.google) return;
    setSearching(true);
    setSearchError('');
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: q }, (results, status) => {
      setSearching(false);
      if (status === 'OK' && results[0]) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setPosition({ lat, lng });
        setAddressText(results[0].formatted_address);
        setAddressDetails(parseAddressComponents(results[0].address_components));
        setSearchQuery('');
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(16);
        }
      } else {
        setSearchError('Address not found. Try a more specific search.');
      }
    });
  }, [searchQuery]);

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
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }, []);

  const blobToDataUrl = useCallback((blobUrl, options = {}) => {
    return fetch(blobUrl)
      .then((r) => r.blob())
      .then(async (blob) => {
        if (options.compressImage && blob.type.startsWith('image/')) return compressImage(blob);
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
      if (videoUrl?.startsWith('blob:')) {
        const data = await blobToDataUrl(videoUrl);
        videoUrl = data || undefined;
      }
      if (imageUrl?.startsWith('blob:')) {
        const data = await blobToDataUrl(imageUrl, { compressImage: true });
        imageUrl = data || undefined;
      }
      onSelect({
        lat: position.lat,
        lng: position.lng,
        displayAddress: addressText || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
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
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      mediaProofRef.current = null;
      setShowVideo(true);
      setMediaProof(null);
    } catch {
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
              <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3">
                {!videoRecording ? (
                  <>
                    <button onClick={startRecord} className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium">
                      <Video className="w-5 h-5" />
                      Start recording
                    </button>
                    <button onClick={capturePhoto} className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium">
                      <Camera className="w-5 h-5" />
                      Take photo
                    </button>
                  </>
                ) : (
                  <button onClick={stopRecord} className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium animate-pulse">
                    <Square className="w-5 h-5 fill-current" />
                    Stop recording
                  </button>
                )}
                <button onClick={cancelVideo} className="px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-full">
                  Cancel
                </button>
              </div>
            </div>
            <p className="p-3 text-sm text-slate-500 text-center">Show the building entrance or house number on camera</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">Select address on map</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 border-b bg-slate-50 space-y-2">
          {isLoaded ? (
            <>
              <div className="flex gap-2">
                <Autocomplete
                  onLoad={(ac) => { autocompleteRef.current = ac; }}
                  onPlaceChanged={onPlaceChanged}
                  options={{}}
                  className="flex-1"
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchAddress())}
                    placeholder="Type an address and click Find…"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </Autocomplete>
                <button
                  type="button"
                  onClick={handleSearchAddress}
                  disabled={searching || !searchQuery.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  {searching ? '...' : 'Find'}
                </button>
              </div>
              {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
            </>
          ) : (
            <input
              type="text"
              placeholder="Loading Google Maps..."
              disabled
              className="w-full px-3 py-2.5 border rounded-lg bg-slate-100 text-slate-400"
            />
          )}
          {loadError && <p className="text-red-500 text-sm mt-2">Failed to load Google Maps</p>}
        </div>

        <div className="relative" style={{ minHeight: 250, height: 'min(50vh, 350px)' }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={position}
              zoom={14}
              onClick={handleMapClick}
              onLoad={(map) => { mapRef.current = map; }}
              options={MAP_OPTIONS}
            >
              <Marker position={position} draggable onDragEnd={handleMarkerDragEnd} />
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500">
              Loading map...
            </div>
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
                <button type="button" onClick={startVideoRecording} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-500 hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition">
                  <Video className="w-5 h-5" />
                  Record video
                </button>
                <button type="button" onClick={() => fileInputImageRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-500 hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition">
                  <Upload className="w-5 h-5" />
                  Upload photo
                </button>
                <input ref={fileInputImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
                <button type="button" onClick={() => fileInputVideoRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-500 hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition">
                  <Video className="w-5 h-5" />
                  Upload video
                </button>
                <input ref={fileInputVideoRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start gap-2">
                {mediaProof.type === 'image' ? (
                  <img src={mediaProof.url} alt="Verification" className="w-full max-w-xs max-h-32 object-contain rounded-lg border" />
                ) : (
                  <video src={mediaProof.url} controls className="w-full max-w-xs max-h-32 rounded-lg border" />
                )}
                <button type="button" onClick={removeMediaProof} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm">
                  <RotateCcw className="w-4 h-4" />
                  Replace
                </button>
              </div>
            )}
            {videoError && <p className="text-red-500 text-sm mt-2">{videoError}</p>}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 px-4 border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={confirming} className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 font-medium disabled:opacity-50">
              {confirming ? 'Saving...' : 'Confirm address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
