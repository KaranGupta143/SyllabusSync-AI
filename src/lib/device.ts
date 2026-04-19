/**
 * Stable anonymous device id stored in localStorage.
 * Used to scope progress, syllabi, and history without auth.
 */
const KEY = "syllabussync_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
