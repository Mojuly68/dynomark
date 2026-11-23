/**
 * Turns a picked photo into a small square JPEG data URL (centre crop), so it fits in local storage.
 * A full-size phone photo would be several MB; this is about 15–30 KB.
 */
export async function squarePhoto(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  const img = await load(file);
  const w = img.naturalWidth || (img as unknown as ImageBitmap).width;
  const h = img.naturalHeight || (img as unknown as ImageBitmap).height;
  const side = Math.min(w, h);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('no-canvas');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img as CanvasImageSource, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Decode with EXIF rotation applied (modern browsers do this for <img> by default). */
function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
