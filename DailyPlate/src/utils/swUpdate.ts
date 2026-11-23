import { registerSW } from "virtual:pwa-register";

export const UPDATE_AVAILABLE_EVENT = "dailyplate:update-available";
/** If a new version is installed but hasn't taken over by then, ask the user to reload. */
const PROMPT_AFTER_MS = 8000;
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Register the service worker. New deploys take over on their own (skipWaiting + clientsClaim,
 * and the page reloads when the new worker controls it). The app also checks for a new version
 * every 30 minutes and when it comes back to the foreground. If a new version is installed but
 * still not in control after a few seconds, a "New version available. Reload." banner appears.
 */
export function registerServiceWorker() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state !== "installed" || !navigator.serviceWorker.controller) return;
          let tookOver = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            tookOver = true;
          });
          setTimeout(() => {
            if (!tookOver) window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
          }, PROMPT_AFTER_MS);
        });
      });
    },
  });
  return updateSW;
}

/** Activate a waiting worker (if any) and reload onto the new version. */
export async function reloadToNewVersion() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
  } finally {
    window.location.reload();
  }
}
