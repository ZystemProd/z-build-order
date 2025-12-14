// Broadcast/sync logic remains in tournament/index.js; placeholder module for future extraction.
export {};
import { broadcast, currentSlug } from "../state.js";

export function initBroadcastSync(syncFromRemote, getStorageKey, handlePopState) {
  if (broadcast) {
    broadcast.addEventListener("message", (event) => {
      const { slug, payload } = event.data || {};
      if (slug && slug !== currentSlug) return;
      syncFromRemote(payload || event.data);
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === getStorageKey() && event.newValue) {
        try {
          const incoming = JSON.parse(event.newValue);
          syncFromRemote(incoming);
        } catch (_) {
          // ignore invalid payloads
        }
      }
    });

    window.addEventListener("popstate", () => {
      handlePopState();
    });
  }

  return (payload) => {
    broadcast?.postMessage(payload);
  };
}
