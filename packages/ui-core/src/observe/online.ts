/** Current connectivity; `true` where the platform cannot tell (SSR). */
export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Calls `callback` on every online/offline change. Returns the unsubscribe function. */
export function observeOnline(callback: (online: boolean) => void): () => void {
  const online = () => callback(true);
  const offline = () => callback(false);
  addEventListener("online", online);
  addEventListener("offline", offline);
  return () => {
    removeEventListener("online", online);
    removeEventListener("offline", offline);
  };
}
