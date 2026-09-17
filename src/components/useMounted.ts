import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while rendering on the server and during hydration, true afterwards.
 * Anything that depends on the viewer's clock or timezone ("today", meal times)
 * waits for true: the server runs in UTC, so rendering it there would produce
 * text that doesn't match the browser's and break hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
