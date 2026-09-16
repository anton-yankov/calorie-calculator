"use client";

import { createContext, useContext } from "react";

/**
 * Whether the logged-in user tracks water. Filled in once by the (app) layout
 * from the profile, so any component on a tracker page can hide its water
 * details without the setting being passed down through every prop. Off unless
 * a provider says otherwise, matching "water tracking is off by default".
 */
const WaterTrackingContext = createContext(false);

export function WaterTrackingProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <WaterTrackingContext value={enabled}>{children}</WaterTrackingContext>;
}

export function useWaterTracking(): boolean {
  return useContext(WaterTrackingContext);
}
