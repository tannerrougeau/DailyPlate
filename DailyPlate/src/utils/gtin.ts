/**
 * Barcode numbers (GTIN): check digits and the forms one product can appear under.
 * UPC-A (12), EAN-13 (13, often UPC-A with a leading 0), GTIN-14, EAN-8 and UPC-E (8).
 */

/** Standard GTIN mod-10 check over every digit but the last. */
export function gtinCheckDigitOk(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Weights 3,1,3,1… from the right of the body.
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i]! * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E (8 digits, number system 0 or 1) expanded to UPC-A, or null when it isn't UPC-E shaped. */
export function upcEToUpcA(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0]!;
  const d = code.slice(1, 7);
  const check = code[7]!;
  const last = d[5]!;
  let body: string;
  if (last <= "2") body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === "3") body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === "4") body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  return `${ns}${body}${check}`;
}

/**
 * A scanned or typed code in a form to look up, or null when it isn't a valid barcode number.
 * UPC-E becomes UPC-A, and a zero-padded EAN-13 / GTIN-14 becomes its 12-digit UPC-A.
 */
export function normalizeGtin(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(code)) return null;
  if (code.length === 8) {
    const upcA = upcEToUpcA(code);
    if (upcA && gtinCheckDigitOk(upcA)) return upcA;
    return gtinCheckDigitOk(code) ? code : null;
  }
  if (![12, 13, 14].includes(code.length)) return null;
  if (!gtinCheckDigitOk(code)) return null;
  // EAN-13 / GTIN-14 with leading zeros is the same UPC-A product: keep the 12-digit form.
  let out = code;
  while (out.length > 12 && out.startsWith("0")) out = out.slice(1);
  return out;
}

/** Two codes for the same product: UPC-A 012345678905 = EAN-13 0012345678905 = GTIN-14 00012345678905. */
export function sameGtin(a: string, b: string): boolean {
  const strip = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "");
  return strip(a) !== "" && strip(a) === strip(b);
}
