import { MAX_MEAL_PHOTO_LENGTH } from "@/lib/log";

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

/** Tiny JPEG data URL (~160px long edge) for meal-log entries. */
export async function makeThumbnail(source: Blob, longEdge = 160): Promise<string> {
  return makeJpegDataUrl(source, longEdge, 0.7);
}

async function makeJpegDataUrl(source: Blob, longEdge: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Display-sized JPEG for a logged meal. Step down until the encoded value is
 * comfortably inside the 1 MB Server Action request limit.
 */
export async function makeMealPhoto(source: Blob): Promise<string> {
  const attempts = [
    [1024, 0.82],
    [900, 0.78],
    [768, 0.72],
  ] as const;
  for (const [longEdge, quality] of attempts) {
    const dataUrl = await makeJpegDataUrl(source, longEdge, quality);
    if (dataUrl.length <= MAX_MEAL_PHOTO_LENGTH) return dataUrl;
  }
  throw new Error("The prepared photo is still too large to save.");
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
