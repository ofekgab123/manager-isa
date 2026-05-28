import { useState, useRef } from 'react';
import { Image, Upload, Trash2 } from 'lucide-react';
import { imageFileToDataUrl } from '../imageDataUrl';

export function AddressVerificationImageField({ imageUrl, onImageUrlChange, className = '' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [enlarged, setEnlarged] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      if (dataUrl) onImageUrlChange?.(dataUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <label className="label flex items-center gap-2">
        <Image className="w-4 h-4" />
        Address photo (optional)
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 text-sm transition-colors">
          <Upload className="w-4 h-4 shrink-0" />
          {uploading ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Upload photo'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
        {imageUrl && (
          <>
            <button
              type="button"
              onClick={() => setEnlarged(imageUrl)}
              className="block rounded-xl border border-slate-200 overflow-hidden hover:ring-2 hover:ring-indigo-400 transition-shadow"
            >
              <img
                src={imageUrl}
                alt="Address verification"
                className="w-20 h-20 object-cover"
              />
            </button>
            <button
              type="button"
              onClick={() => onImageUrlChange?.(null)}
              className="action-btn text-red-400 hover:text-red-600 hover:bg-red-50"
              title="Remove photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {enlarged && (
        <div
          className="modal-overlay z-[70] bg-black/70"
          onClick={() => setEnlarged(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setEnlarged(null)}
        >
          <img
            src={enlarged}
            alt="Enlarged"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function AddressVerificationImagePreview({ imageUrl }) {
  const [enlarged, setEnlarged] = useState(null);
  if (!imageUrl) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
        <Image className="w-4 h-4" />
        Address photo
      </div>
      <button
        type="button"
        onClick={() => setEnlarged(imageUrl)}
        className="block"
      >
        <img
          src={imageUrl}
          alt="Address verification"
          className="max-w-xs max-h-40 rounded-xl border object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
        />
      </button>
      {enlarged && (
        <div
          className="modal-overlay z-[70] bg-black/70"
          onClick={() => setEnlarged(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setEnlarged(null)}
        >
          <img
            src={enlarged}
            alt="Enlarged"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
