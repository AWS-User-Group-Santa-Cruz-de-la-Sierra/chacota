/** Alpha above this counts as part of the drawing (below it: antialiasing, soft glows). */
const OPAQUE = 40;
const SAMPLE = 64;

/** Where the visible drawing ends, as a fraction of the image height; null for an empty image. */
export function visibleBottom(rgba: Uint8ClampedArray, width: number, height: number): number | null {
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3]! > OPAQUE) return (y + 1) / height;
  }
  return null;
}

/** Where the visible drawing starts, as a fraction of the image height; null for an empty image. */
export function visibleTop(rgba: Uint8ClampedArray, width: number, height: number): number | null {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3]! > OPAQUE) return y / height;
  }
  return null;
}

const cache = new WeakMap<HTMLImageElement, { top: number; bottom: number }>();

function boundsOf(img: HTMLImageElement): { top: number; bottom: number } | null {
  const known = cache.get(img);
  if (known) return known;
  if (!img.complete || img.naturalWidth === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  const top = visibleTop(data, SAMPLE, SAMPLE);
  const bottom = visibleBottom(data, SAMPLE, SAMPLE);
  if (top === null || bottom === null) return null;
  const bounds = { top, bottom };
  cache.set(img, bounds);
  return bounds;
}

/**
 * Where a picture's feet are, so every drawing stands on the ground whatever margin the artist
 * left (the fallen pose usually ends higher than the running one). Measured once per image.
 */
export function feetOf(img: HTMLImageElement, fallback: number): number {
  return boundsOf(img)?.bottom ?? fallback;
}

/** Where a picture's head is (its visible top), to put the name right above it. */
export function headOf(img: HTMLImageElement, fallback: number): number {
  return boundsOf(img)?.top ?? fallback;
}
