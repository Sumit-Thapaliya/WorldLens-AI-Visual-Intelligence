/**
 * Confidence threshold utilities for WorldLens.
 */

/** Default confidence threshold for displaying detections */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.45;

/** Minimum confidence for search mode (higher to reduce false positives) */
export const SEARCH_CONFIDENCE_THRESHOLD = 0.55;

/** Minimum confidence for tracking persistence */
export const TRACKING_CONFIDENCE_THRESHOLD = 0.35;

/**
 * Format a confidence score as a percentage string.
 * @example formatConfidence(0.94) -> "94%"
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Determine a confidence tier for UI coloring.
 */
export function getConfidenceTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get a color for a confidence tier.
 */
export function getConfidenceColor(confidence: number): string {
  const tier = getConfidenceTier(confidence);
  switch (tier) {
    case 'high':
      return '#22C55E'; // green
    case 'medium':
      return '#EAB308'; // yellow
    case 'low':
      return '#F97316'; // orange
  }
}

/**
 * Apply simple exponential smoothing to confidence scores across frames.
 */
export function smoothConfidence(
  previousConfidence: number,
  currentConfidence: number,
  alpha: number = 0.4
): number {
  return previousConfidence * (1 - alpha) + currentConfidence * alpha;
}
