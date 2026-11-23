/**
 * Shrinks an image in the browser before it is uploaded, so the longest side is at most maxSide.
 * Any format the browser can draw (SVG included) comes out as WebP, or PNG/JPEG where the browser
 * can't encode WebP (PNG keeps transparency).
 */
export async function prepareImage(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const webp = await toBlob(canvas, 'image/webp', 0.88);
  if (webp?.type === 'image/webp') return webp;
  const type = hasTransparency(ctx, width, height) ? 'image/png' : 'image/jpeg';
  const blob = await toBlob(canvas, type, 0.9);
  if (!blob) throw new Error('Could not encode the image');
  return blob;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not_an_image'));
    };
    img.src = url;
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) return true;
  return false;
}
