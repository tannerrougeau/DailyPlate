/**
 * "Help improve scanning" (opt-in): the downscaled photo, the AI's result with its confidence
 * values, and what the user finally chose, kept in IndexedDB on this device only. The Dev panel
 * exports them as a zip (scan-corrections.json + photos/) to build an evaluation set.
 */
import { strToU8, zipSync } from "fflate";
import type { ScanResult } from "@/server/scan/types";
import { confidencesOf, type ScanConfidences, type ScanFinal } from "./scanFlow";

const DB_NAME = "dailyplate-scan-corrections";
const STORE = "corrections";

export type ScanCorrection = {
  id: string;
  at: string;
  slot: string;
  plannedMealName: string | null;
  photo: Blob;
  /** How the photo was handled: on-device barcode, or the AI scan. */
  path: "barcode" | "ai";
  aiResult: ScanResult | null;
  aiMeta: { provider: string; model: string; ms: number } | null;
  confidences: ScanConfidences | null;
  final: ScanFinal;
};

function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  factory?: IDBFactory,
): Promise<T> {
  const db = await openDb(factory);
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function newCorrection(input: Omit<ScanCorrection, "id" | "at" | "confidences">): ScanCorrection {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { ...input, id, at: new Date().toISOString(), confidences: confidencesOf(input.aiResult) };
}

export async function saveCorrection(c: ScanCorrection, factory?: IDBFactory): Promise<void> {
  await withStore("readwrite", (s) => s.put(c), factory);
}

export async function listCorrections(factory?: IDBFactory): Promise<ScanCorrection[]> {
  const all = await withStore<ScanCorrection[]>("readonly", (s) => s.getAll() as IDBRequest<ScanCorrection[]>, factory);
  return all.sort((a, b) => a.at.localeCompare(b.at));
}

export async function countCorrections(factory?: IDBFactory): Promise<number> {
  try {
    return await withStore<number>("readonly", (s) => s.count(), factory);
  } catch {
    return 0;
  }
}

export async function clearCorrections(factory?: IDBFactory): Promise<void> {
  await withStore("readwrite", (s) => s.clear(), factory);
}

/** Zip: scan-corrections.json (everything but the photos) and photos/<id>.jpg. */
export async function exportCorrectionsZip(factory?: IDBFactory): Promise<{ zip: Uint8Array; count: number }> {
  const all = await listCorrections(factory);
  const files: Record<string, Uint8Array> = {};
  const records = [];
  for (const c of all) {
    const photoPath = `photos/${c.id}.jpg`;
    files[photoPath] = new Uint8Array(await c.photo.arrayBuffer());
    const { photo: _photo, ...rest } = c;
    records.push({ ...rest, photo: photoPath });
  }
  files["scan-corrections.json"] = strToU8(
    JSON.stringify({ exportedAt: new Date().toISOString(), count: all.length, corrections: records }, null, 2),
  );
  return { zip: zipSync(files, { level: 0 }), count: all.length };
}

/** Browser download of the export. */
export async function downloadCorrections(): Promise<number> {
  const { zip, count } = await exportCorrectionsZip();
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dailyplate-scan-corrections-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return count;
}
