/**
 * React hook exposing tracking-related utilities.
 * Most tracking state is maintained inside useDetection, but this hook provides
 * additional queries: finding specific objects, finding nearest objects, etc.
 */

import { useMemo } from 'react';
import { TrackedObject } from '../types/Detection';
import { estimateSpatialInfo } from '../utils/spatial';

interface UseTrackingResult {
  findObjectByLabel: (label: string) => TrackedObject | null;
  findAllByLabel: (label: string) => TrackedObject[];
  getClosestObject: () => TrackedObject | null;
  getActiveCount: (label?: string) => number;
}

export function useTracking(trackedObjects: TrackedObject[]): UseTrackingResult {
  const active = useMemo(
    () => trackedObjects.filter((t) => t.isActive && t.framesSinceSeen <= 2),
    [trackedObjects]
  );

  const findObjectByLabel = (label: string): TrackedObject | null => {
    const matches = active.filter((t) => t.label.toLowerCase() === label.toLowerCase());
    if (matches.length === 0) return null;
    // Return highest confidence match
    return matches.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best), matches[0]);
  };

  const findAllByLabel = (label: string): TrackedObject[] => {
    return active.filter((t) => t.label.toLowerCase() === label.toLowerCase());
  };

  const getClosestObject = (): TrackedObject | null => {
    if (active.length === 0) return null;
    // Largest bounding box area -> closest
    return active.reduce((closest, cur) => {
      const curArea = cur.boundingBox.width * cur.boundingBox.height;
      const closestArea = closest.boundingBox.width * closest.boundingBox.height;
      return curArea > closestArea ? cur : closest;
    }, active[0]);
  };

  const getActiveCount = (label?: string): number => {
    if (!label) return active.length;
    return active.filter((t) => t.label.toLowerCase() === label.toLowerCase()).length;
  };

  return {
    findObjectByLabel,
    findAllByLabel,
    getClosestObject,
    getActiveCount,
  };
}

/**
 * Hook that returns direction/distance info for a specific tracked object.
 */
export function useObjectSpatialInfo(obj: TrackedObject | null) {
  return useMemo(() => {
    if (!obj) return null;
    return estimateSpatialInfo(obj.boundingBox);
  }, [obj?.trackingId, obj?.boundingBox.x, obj?.boundingBox.y, obj?.boundingBox.width, obj?.boundingBox.height]);
}
