/**
 * Spatial analysis utilities for WorldLens.
 * Estimates position, direction, and approximate distance of detected objects.
 */

import { BoundingBox, SpatialInfo } from '../types/Detection';
import { getBoxCenter } from './coordinates';

// Thresholds for horizontal/vertical zone classification
const CENTER_HORIZONTAL_THRESHOLD = 0.15; // 15% around center is "center"
const CENTER_VERTICAL_THRESHOLD = 0.15;

/**
 * Estimate spatial information (position, approximate distance) from a bounding box.
 * Uses box position and size as simple cues since we don't have depth hardware.
 *
 * Distance heuristic: larger apparent object size -> closer.
 * This is approximate and calibrated for common COCO objects at typical viewing ranges.
 */
export function estimateSpatialInfo(box: BoundingBox): SpatialInfo {
  const center = getBoxCenter(box);
  const area = box.width * box.height;

  // Horizontal position
  let horizontalPosition: SpatialInfo['horizontalPosition'] = 'center';
  if (center.x < 0.5 - CENTER_HORIZONTAL_THRESHOLD) {
    horizontalPosition = 'left';
  } else if (center.x > 0.5 + CENTER_HORIZONTAL_THRESHOLD) {
    horizontalPosition = 'right';
  }

  // Vertical position
  let verticalPosition: SpatialInfo['verticalPosition'] = 'middle';
  if (center.y < 0.33) {
    verticalPosition = 'top';
  } else if (center.y > 0.66) {
    verticalPosition = 'bottom';
  }

  // Approximate distance based on bounding box area.
  // Calibration: a "close" phone-held object might occupy ~20%+ of frame area,
  // a far object < 2% area. These are rough estimates.
  let distance: SpatialInfo['distance'] = 'medium';
  let distanceMeters: number | undefined;

  if (area > 0.15) {
    distance = 'close';
    distanceMeters = 0.5 + Math.random() * 0.5; // ~0.5-1.0m
  } else if (area > 0.05) {
    distance = 'medium';
    distanceMeters = 1.5 + Math.random() * 1.0; // ~1.5-2.5m
  } else if (area > 0.01) {
    distance = 'medium';
    distanceMeters = 2.5 + Math.random() * 1.5; // ~2.5-4.0m
  } else {
    distance = 'far';
    distanceMeters = 4.0 + Math.random() * 2.0; // ~4-6m
  }

  // Angle relative to camera center (in degrees, -45 to 45)
  const angleDegrees = (center.x - 0.5) * 60; // Rough FOV ~60 degrees

  return {
    horizontalPosition,
    verticalPosition,
    distance,
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    angleDegrees: Math.round(angleDegrees),
  };
}

/**
 * Get a human-readable direction string for voice feedback.
 */
export function getDirectionText(spatial: SpatialInfo): string {
  const parts: string[] = [];

  if (spatial.horizontalPosition === 'left') parts.push('to your left');
  else if (spatial.horizontalPosition === 'right') parts.push('to your right');
  else parts.push('in front of you');

  if (spatial.distance === 'close') parts.push('very close');
  else if (spatial.distance === 'far') parts.push('farther away');

  return parts.join(', ');
}

/**
 * Format distance for display.
 */
export function formatDistance(spatial: SpatialInfo): string {
  if (spatial.distanceMeters) {
    return `~${spatial.distanceMeters.toFixed(1)} m`;
  }
  switch (spatial.distance) {
    case 'close': return '~1 m';
    case 'medium': return '~2-3 m';
    case 'far': return '~5+ m';
  }
}
