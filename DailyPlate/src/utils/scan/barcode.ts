/**
 * Barcode reading on the device. The browser's BarcodeDetector where it exists (Android Chrome);
 * otherwise ZXing compiled to WebAssembly (iPhone and most desktops), loaded only when needed and
 * served from this site. The service worker caches the .wasm the first time it's fetched, so
 * reading keeps working offline afterwards.
 */
import { normalizeGtin } from "@/utils/gtin";

/** Retail formats only: what food packaging carries. */
export const ZXING_FORMATS = ["EAN13", "EAN8", "UPCA", "UPCE"] as const;
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

type ZxingReader = typeof import("zxing-wasm/reader");

let zxingPromise: Promise<ZxingReader> | null = null;

/** Loads the ZXing reader with its .wasm from this site (never a CDN). */
async function loadZxing(): Promise<ZxingReader> {
  zxingPromise ??= (async () => {
    const [mod, wasm] = await Promise.all([
      import("zxing-wasm/reader"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);
    mod.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasm.default : prefix + path),
      },
    });
    return mod;
  })();
  try {
    return await zxingPromise;
  } catch (e) {
    zxingPromise = null; // let a later attempt retry (e.g. after coming back online)
    throw e;
  }
}

type NativeDetector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type NativeDetectorCtor = {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

function nativeDetectorCtor(): NativeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

async function nativeSupportsRetail(ctor: NativeDetectorCtor): Promise<boolean> {
  try {
    const formats = (await ctor.getSupportedFormats?.()) ?? NATIVE_FORMATS;
    return NATIVE_FORMATS.some((f) => formats.includes(f));
  } catch {
    return false;
  }
}

/** First valid retail barcode in a list of raw values, normalized (UPC-E → UPC-A). */
export function firstValidCode(rawValues: string[]): string | null {
  for (const raw of rawValues) {
    const code = normalizeGtin(raw);
    if (code) return code;
  }
  return null;
}

/** ZXing over pixels (also used by tests in Node with an ImageData-shaped object). */
export async function readWithZxing(
  input: Blob | ImageData,
  reader?: Pick<ZxingReader, "readBarcodes">,
): Promise<string | null> {
  const mod = reader ?? (await loadZxing());
  const results = await mod.readBarcodes(input, {
    formats: [...ZXING_FORMATS],
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    maxNumberOfSymbols: 4,
  });
  return firstValidCode(results.filter((r) => r.isValid).map((r) => r.text));
}

/** A retail barcode in the photo, or null. Never throws: a failure just means "no barcode found". */
export async function readBarcode(photo: Blob): Promise<string | null> {
  const ctor = nativeDetectorCtor();
  if (ctor && (await nativeSupportsRetail(ctor))) {
    try {
      const bitmap = await createImageBitmap(photo);
      try {
        const found = await new ctor({ formats: NATIVE_FORMATS }).detect(bitmap);
        const code = firstValidCode(found.map((f) => f.rawValue));
        if (code) return code;
      } finally {
        bitmap.close();
      }
    } catch {
      /* fall through to ZXing */
    }
  }
  try {
    return await readWithZxing(photo);
  } catch {
    return null;
  }
}

/** Fetch the ZXing reader ahead of time (online), so the service worker caches it for offline use. */
export function warmBarcodeReader(): void {
  const ctor = nativeDetectorCtor();
  if (ctor) return;
  void loadZxing().catch(() => undefined);
}
