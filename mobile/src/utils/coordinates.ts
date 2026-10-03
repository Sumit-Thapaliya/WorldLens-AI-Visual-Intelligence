/**
 * Coordinate conversion utilities for WorldLens.
 * Converts between normalized model coordinates and screen coordinates.
 */

import { BoundingBox } from '../types/Detection';

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Convert normalized bounding box (0-1) to screen pixel coordinates.
 * Accounts for camera preview aspect ratio and rotation.
 */
export function normalizedToScreen(
  box: BoundingBox,
  screenWidth: number,
  screenHeight: number,
  rotation: number = 0
): { x: number; y: number; width: number; height: number } {
  // Handle rotation - swap dimensions if needed
  const isPortrait = rotation === 90 || rotation === 270;
  const effectiveWidth = isPortrait ? screenHeight : screenWidth;
  const effectiveHeight = isPortrait ? screenWidth : screenHeight;

  return {
    x: box.x * effectiveWidth,
    y: box.y * effectiveHeight,
    width: box.width * effectiveWidth,
    height: box.height * effectiveHeight,
  };
}

/**
 * Scale a normalized box to a specific resolution.
 */
export function scaleNormalizedBox(
  box: BoundingBox,
  width: number,
  height: number
): BoundingBox {
  return {
    x: box.x * width,
    y: box.y * height,
    width: box.width * width,
    height: box.height * height,
  };
}

/**
 * Clamp a bounding box to stay within [0,1] normalized space.
 */
export function clampNormalizedBox(box: BoundingBox): BoundingBox {
  const x = Math.max(0, Math.min(1, box.x));
  const y = Math.max(0, Math.min(1, box.y));
  const width = Math.max(0, Math.min(1 - x, box.width));
  const height = Math.max(0, Math.min(1 - y, box.height));
  return { x, y, width, height };
}

/**
 * Get center point of a bounding box in normalized coordinates.
 */
export function getBoxCenter(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Calculate the area of a bounding box.
 */
export function boxArea(box: BoundingBox): number {
  return box.width * box.height;
}
