/**
 * Simple online realtime tracking (SORT-like) implementation for WorldLens.
 * Associates detections across frames using IoU matching and maintains object identities.
 *
 * This is a lightweight IoU-based tracker suitable for on-device real-time use.
 */

import { DetectedObject, TrackedObject, ObjectCount } from '../../types/Detection';
import {
  TrackingConfig,
  DEFAULT_TRACKING_CONFIG,
  calculateIoU,
  getBoxCenter,
} from '../../types/Tracking';

let nextId = 1;

/**
 * Tracker state maintained between frames.
 */
interface TrackerState {
  tracked: TrackedObject[];
  config: TrackingConfig;
}

/**
 * Create a new tracker state.
 */
export function createTracker(config: Partial<TrackingConfig> = {}): TrackerState {
  return {
    tracked: [],
    config: { ...DEFAULT_TRACKING_CONFIG, ...config },
  };
}

/**
 * Create a new tracked object from a detection.
 */
function createTrackedObject(detection: DetectedObject, now: number): TrackedObject {
  return {
    ...detection,
    trackingId: nextId++,
    age: 1,
    framesSinceSeen: 0,
    isActive: false,
    positionHistory: [detection.boundingBox],
    firstDetectedAt: now,
    lastDetectedAt: now,
  };
}

/**
 * Update a tracked object with a new matched detection.
 */
function updateTrackedObject(
  tracked: TrackedObject,
  detection: DetectedObject,
  now: number
): TrackedObject {
  const newHistory = [...tracked.positionHistory, detection.boundingBox].slice(-30);
  const newAge = tracked.age + 1;
  return {
    ...tracked,
    ...detection,
    trackingId: tracked.trackingId,
    age: newAge,
    framesSinceSeen: 0,
    isActive: newAge >= 2,
    positionHistory: newHistory,
    lastDetectedAt: now,
  };
}

/**
 * Mark a tracked object as not seen in this frame.
 */
function markTrackedObjectMissing(tracked: TrackedObject): TrackedObject {
  return {
    ...tracked,
    framesSinceSeen: tracked.framesSinceSeen + 1,
    isActive: false,
  };
}

/**
 * Match new detections to existing tracked objects using IoU.
 * Uses greedy highest-IoU matching.
 */
function matchDetectionsToTracks(
  detections: DetectedObject[],
  tracked: TrackedObject[],
  iouThreshold: number
): {
  matches: Array<{ detIdx: number; trkIdx: number; iou: number }>;
  unmatchedDetections: number[];
  unmatchedTracks: number[];
} {
  const matches: Array<{ detIdx: number; trkIdx: number; iou: number }> = [];
  const unmatchedDetections: number[] = [];
  const unmatchedTracks: number[] = [];

  // Build IoU matrix and find all pairs above threshold
  const pairs: Array<{ detIdx: number; trkIdx: number; iou: number }> = [];
  for (let di = 0; di < detections.length; di++) {
    for (let ti = 0; ti < tracked.length; ti++) {
      // Only match same class
      if (detections[di].label !== tracked[ti].label) continue;
      const iou = calculateIoU(detections[di].boundingBox, tracked[ti].boundingBox);
      if (iou >= iouThreshold) {
        pairs.push({ detIdx: di, trkIdx: ti, iou });
      }
    }
  }

  // Greedy matching: sort by IoU descending and accept best matches first
  pairs.sort((a, b) => b.iou - a.iou);

  const usedDetections = new Set<number>();
  const usedTracks = new Set<number>();
  for (const pair of pairs) {
    if (usedDetections.has(pair.detIdx) || usedTracks.has(pair.trkIdx)) continue;
    matches.push(pair);
    usedDetections.add(pair.detIdx);
    usedTracks.add(pair.trkIdx);
  }

  for (let di = 0; di < detections.length; di++) {
    if (!usedDetections.has(di)) unmatchedDetections.push(di);
  }
  for (let ti = 0; ti < tracked.length; ti++) {
    if (!usedTracks.has(ti)) unmatchedTracks.push(ti);
  }

  return { matches, unmatchedDetections, unmatchedTracks };
}

/**
 * Run one tracker update step.
 * Takes new detections and updates tracker state.
 * Returns the currently active tracked objects.
 */
export function updateTracker(
  state: TrackerState,
  detections: DetectedObject[],
  timestamp?: number
): TrackedObject[] {
  const now = timestamp ?? Date.now();
  const { config } = state;

  // 1. Match
  const { matches, unmatchedDetections, unmatchedTracks } = matchDetectionsToTracks(
    detections,
    state.tracked,
    config.iouThreshold
  );

  const newTracked: TrackedObject[] = [];

  // 2. Update matched tracks
  for (const { detIdx, trkIdx } of matches) {
    const updated = updateTrackedObject(state.tracked[trkIdx], detections[detIdx], now);
    newTracked.push(updated);
  }

  // 3. Handle unmatched tracks (mark missing, remove if too old)
  for (const trkIdx of unmatchedTracks) {
    const t = state.tracked[trkIdx];
    if (t.framesSinceSeen + 1 < config.maxAge) {
      newTracked.push(markTrackedObjectMissing(t));
    }
  }

  // 4. Create new tracks for unmatched detections
  for (const detIdx of unmatchedDetections) {
    if (newTracked.length < config.maxObjects) {
      newTracked.push(createTrackedObject(detections[detIdx], now));
    }
  }

  state.tracked = newTracked;

  // Return only "active" objects (those seen in recent frames with min hits)
  return newTracked.filter(
    (t) => t.framesSinceSeen <= 2 && (t.isActive || t.age >= config.minHits)
  );
}

/**
 * Compute object counts from active tracked objects.
 * Uses unique tracking IDs to avoid double-counting.
 */
export function computeObjectCounts(trackedObjects: TrackedObject[]): ObjectCount[] {
  const counts = new Map<string, number>();
  const seenIds = new Set<number>();

  for (const obj of trackedObjects) {
    if (!obj.isActive || obj.framesSinceSeen > 2) continue;
    if (seenIds.has(obj.trackingId)) continue;
    seenIds.add(obj.trackingId);
    counts.set(obj.label, (counts.get(obj.label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Reset tracker state (e.g., when switching camera sources).
 */
export function resetTracker(state: TrackerState): void {
  state.tracked = [];
  nextId = 1;
}
