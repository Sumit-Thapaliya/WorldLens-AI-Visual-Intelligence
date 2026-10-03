/**
 * Types for object tracking in WorldLens.
 */

import { BoundingBox, TrackedObject } from './Detection';

export interface TrackingConfig {
  /** Maximum IoU distance for matching across frames */
  iouThreshold: number;
  /** Minimum age before an object is considered confirmed */
  minHits: number;
  /** Maximum frames an object can be missing before removal */
  maxAge: number;
  /** Maximum number of tracked objects simultaneously */
  maxObjects: number;
}

export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  iouThreshold: 0.3,
  minHits: 2,
  maxAge: 15,
  maxObjects: 30,
};

export interface TrackedObjectState {
  trackedObjects: TrackedObject[];
  nextTrackingId: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface MovementVector {
  dx: number;
  dy: number;
  magnitude: number;
  direction: 'left' | 'right' | 'up' | 'down' | 'stationary';
}

/** Calculate center point of a bounding box */
export function getBoxCenter(box: BoundingBox): Position {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/** Calculate Intersection over Union between two boxes */
export function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const ax1 = boxA.x;
  const ay1 = boxA.y;
  const ax2 = boxA.x + boxA.width;
  const ay2 = boxA.y + boxA.height;

  const bx1 = boxB.x;
  const by1 = boxB.y;
  const bx2 = boxB.x + boxB.width;
  const by2 = boxB.y + boxB.height;

  const interX1 = Math.max(ax1, bx1);
  const interY1 = Math.max(ay1, by1);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const intersection = interWidth * interHeight;

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const union = areaA + areaB - intersection;

  return union === 0 ? 0 : intersection / union;
}

/** Calculate movement vector between two positions */
export function calculateMovement(prev: Position, current: Position): MovementVector {
  const dx = current.x - prev.x;
  const dy = current.y - prev.y;
  const magnitude = Math.sqrt(dx * dx + dy * dy);

  let direction: MovementVector['direction'] = 'stationary';
  if (magnitude > 0.01) {
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }
  }

  return { dx, dy, magnitude, direction };
}
