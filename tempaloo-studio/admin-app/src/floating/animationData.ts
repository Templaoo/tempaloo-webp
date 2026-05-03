/**
 * Module-level cache for animation data — fetched ONCE per page load
 * (prefetched on FloatingPanel mount, not on Animation tab click).
 *
 * Means when the user clicks the Animation tab, the data is already
 * in memory → wizard renders instantly with real content, never a
 * loading spinner. The skeleton UI handles the very-first-mount
 * window where the prefetch is still in flight.
 *
 * Public surface:
 *   • prefetchAnimationData()   — fire-and-forget, called on panel open
 *   • getCachedAnimationData()  — synchronous read (returns null if not ready)
 *   • useAnimationData()        — React hook that subscribes to the cache
 *   • invalidateAnimationData() — clears cache (e.g. after a Save)
 */

import { api, type AnimationLibrary, type AnimationProfile, type AnimationStateV2 } from '../api';
import { useEffect, useState } from 'react';

export interface AnimationData {
  lib:           AnimationLibrary;
  state:         AnimationStateV2;
  profiles:      AnimationProfile[];
  activeProfile: string;
}

let cache:    AnimationData | null = null;
let inFlight: Promise<AnimationData> | null = null;
const subscribers = new Set<(d: AnimationData | null) => void>();

function notify() {
  subscribers.forEach((fn) => { try { fn(cache); } catch {} });
}

/** Fire-and-forget — kicks off the 3 REST calls, dedupes if already in flight. */
export function prefetchAnimationData(): Promise<AnimationData> {
  if (cache)    return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = Promise.all([
    api.getAnimationLibrary(),
    api.getAnimationV2(),
    api.listProfiles(),
  ])
    .then(([lib, state, ps]) => {
      cache = { lib, state, profiles: ps.profiles, activeProfile: ps.active };
      notify();
      return cache;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function getCachedAnimationData(): AnimationData | null {
  return cache;
}

/** Update the cached state in place — used after Save/Apply round-trips. */
export function setCachedAnimationData(next: Partial<AnimationData>) {
  if (!cache) return;
  cache = { ...cache, ...next };
  notify();
}

export function invalidateAnimationData() {
  cache = null;
  notify();
}

/**
 * React hook — components subscribe to the cache. Re-renders when the
 * data changes (initial fetch, save round-trip, etc.). If the cache
 * is empty, hook returns null and the consumer can render a skeleton.
 */
export function useAnimationData(): AnimationData | null {
  const [data, setData] = useState<AnimationData | null>(getCachedAnimationData());
  useEffect(() => {
    subscribers.add(setData);
    // If we mounted before the prefetch completed, kick it off so the
    // hook gets data even if no one called prefetch first.
    if (!cache && !inFlight) prefetchAnimationData();
    return () => { subscribers.delete(setData); };
  }, []);
  return data;
}
