/**
 * Photos are downscaled before upload: about 1,500 px on the long side, JPEG at quality 0.8
 * (usually 200–500 KB), well under the function's size limit.
 */

export const SCAN_MAX_EDGE = 1500;
export const SCAN_JPEG_QUALITY = 0.8;

export type ScanPhoto = { blob: Blob; base64: string; width: number; height: number };

/** Target size keeping the aspect ratio; never upscales. */
export function fitWithin(width: number, height: number, maxEdge = SCAN_MAX_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const f = maxEdge / long;
  return { width: Math.round(width * f), height: Math.round(height * f) };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decode (respecting the camera's orientation), downscale and re-encode as JPEG. */
export async function resizeForScan(file: Blob): Promise<ScanPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    let blob: Blob;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D canvas");
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: SCAN_JPEG_QUALITY });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D canvas");
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))), "image/jpeg", SCAN_JPEG_QUALITY),
      );
    }
    return { blob, base64: await blobToBase64(blob), width, height };
  } finally {
    bitmap.close();
  }
}
