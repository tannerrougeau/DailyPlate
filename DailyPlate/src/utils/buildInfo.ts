/** Build info for Settings and the Dev panel. Falls back when the build-time values aren't defined (tests). */
export const BUILD_INFO = {
  version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
  commit: typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : "unknown",
  date: typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "",
};
