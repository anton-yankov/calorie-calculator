const MAX_LONG_EDGE = 1024; // bump to 1568–2048 if we ever need label text readable
const JPEG_QUALITY = 0.85;

const HEIC_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

function isHeic(file: File): boolean {
  return HEIC_TYPES.includes(file.type.toLowerCase()) || /\.hei[cf]$/i.test(file.name);
}

/**
 * Load a blob into an <img> via load/error events. Deliberately NOT img.decode():
 * Chromium defers decode() indefinitely for hidden tabs (e.g. the user switches
 * apps mid-analysis on a phone), while the load event always fires.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = url;
  });
}

async function canDecode(blob: Blob): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    return img.naturalWidth > 0;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Return a blob the current browser can decode and display.
 * Safari decodes HEIC natively; Chrome/Firefox/Edge don't, so for HEIC files
 * we lazily load a WASM converter (heic-to, current libheif — handles the
 * 10-bit HDR HEICs recent iPhones shoot) and transcode to JPEG once.
 * The converter is only fetched when actually needed.
 */
export async function toDisplayableBlob(file: File): Promise<Blob> {
  if (!isHeic(file) || (await canDecode(file))) return file;
  const { heicTo } = await import("heic-to/next");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
}

/** Long edge of the full-size meal photo kept for the viewer. */
export const MEAL_PHOTO_EDGE = 800;
/** Long edge of a product image in the library. */
export const PRODUCT_IMAGE_EDGE = 640;
/** Long edge of the product image copy that travels with a food into a meal. */
export const FOOD_IMAGE_EDGE = 320;

/**
 * JPEG data URL at most `longEdge` px on its long side. The source may be a
 * Blob or an existing data URL (same-origin, so canvas can read it); a data
 * URL that's already small enough is returned as is.
 */
export async function makeThumbnail(source: Blob | string, longEdge = 160): Promise<string> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    if (typeof source === "string" && Math.max(img.naturalWidth, img.naturalHeight) <= longEdge) {
      return source;
    }
    const scale = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", longEdge > 320 ? 0.75 : 0.7);
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/**
 * Downscale a photo to MAX_LONG_EDGE px on its long side and re-encode as JPEG.
 * Browsers apply EXIF orientation during decode, and re-encoding strips
 * EXIF/GPS metadata.
 */
export async function resizeToJpeg(source: Blob, maxLongEdge = MAX_LONG_EDGE): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);

    const scale = Math.min(1, maxLongEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("Image re-encoding failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
