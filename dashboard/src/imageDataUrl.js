const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;

function compressImageBlob(blob) {
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
}

/** Read an image file as a compressed data URL (for JSON storage). */
export async function imageFileToDataUrl(file) {
  if (!file?.type?.startsWith('image/')) return null;
  if (file.size > MAX_PAYLOAD_BYTES) {
    const compressed = await compressImageBlob(file);
    return compressed || null;
  }
  const compressed = await compressImageBlob(file);
  if (compressed) return compressed;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
