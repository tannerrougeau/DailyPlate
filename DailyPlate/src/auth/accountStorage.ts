import type { StoredAccount } from "./types";

const STORAGE_KEY = "dailyplate-accounts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readAll(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredAccount>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(accounts: Record<string, StoredAccount>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function getAccount(email: string): StoredAccount | null {
  const key = normalizeEmail(email);
  return readAll()[key] ?? null;
}

export function saveAccount(account: StoredAccount): void {
  const key = normalizeEmail(account.email);
  const all = readAll();
  all[key] = { ...account, email: key };
  writeAll(all);
}

export function accountExists(email: string): boolean {
  return getAccount(email) != null;
}

export async function verifyPassword(
  account: StoredAccount,
  password: string,
): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === account.passwordHash;
}
