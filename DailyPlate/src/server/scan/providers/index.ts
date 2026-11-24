import type { ScanProvider } from "../types";
import { createClaudeProvider } from "./claude";

/** Providers by SCAN_PROVIDER name. Add another model here without changing the app. */
const PROVIDERS: Record<string, (env: Record<string, string | undefined>) => ScanProvider> = {
  claude: (env) => createClaudeProvider({ model: env.SCAN_MODEL }),
};

export const DEFAULT_SCAN_PROVIDER = "claude";

/** The configured provider, or null for an unknown SCAN_PROVIDER (logged by the handler). */
export function providerFromEnv(env: Record<string, string | undefined>): ScanProvider | null {
  const name = (env.SCAN_PROVIDER?.trim() || DEFAULT_SCAN_PROVIDER).toLowerCase();
  const make = PROVIDERS[name];
  return make ? make(env) : null;
}
