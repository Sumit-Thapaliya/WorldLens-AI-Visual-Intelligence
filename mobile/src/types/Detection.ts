/**
 * Core types for object detection in WorldLens.
 */

export interface BoundingBox {
  /** Normalized coordinates (0-1) relative to the camera frame */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  /** Unique detection identifier (per frame) */
  id: string;
  /** COCO class label (e.g., "person", "bottle", "car") */
  label: string;
  /** Detection confidence score (0-1) */
  confidence: number;
  /** Bounding box in normalized coordinates */
  boundingBox: BoundingBox;
}

export interface TrackedObject extends DetectedObject {
  /** Stable tracking ID that persists across frames */
  trackingId: number;
  /** Number of consecutive frames this object has been tracked */
  age: number;
  /** Number of frames since this object was last seen */
  framesSinceSeen: number;
  /** Whether the object is currently visible */
  isActive: boolean;
  /** History of previous positions for movement analysis */
  positionHistory: BoundingBox[];
  /** First time this object was detected (ms since epoch) */
  firstDetectedAt: number;
  /** Last time this object was detected (ms since epoch) */
  lastDetectedAt: number;
}

export interface SpatialInfo {
  /** Horizontal position in frame: 'left', 'center', or 'right' */
  horizontalPosition: 'left' | 'center' | 'right';
  /** Vertical position in frame: 'top', 'middle', or 'bottom' */
  verticalPosition: 'top' | 'middle' | 'bottom';
  /** Approximate distance estimate: 'close', 'medium', or 'far' */
  distance: 'close' | 'medium' | 'far';
  /** Distance estimate in meters (approximate) */
  distanceMeters?: number;
  /** Direction relative to camera center, in degrees (-45 to 45) */
  angleDegrees?: number;
}

export interface ObjectCount {
  label: string;
  count: number;
}

export interface DetectionResult {
  /** Detected objects in the current frame */
  objects: DetectedObject[];
  /** Tracked objects with stable IDs */
  trackedObjects: TrackedObject[];
  /** Per-class object counts (from tracking) */
  counts: ObjectCount[];
  /** Inference time in milliseconds */
  inferenceTimeMs: number;
  /** Frame timestamp */
  timestamp: number;
}

export type FindModeStatus = 'idle' | 'searching' | 'found' | 'not_found';

export interface FindModeState {
  isActive: boolean;
  targetLabel: string | null;
  status: FindModeStatus;
  foundObject: TrackedObject | null;
  message: string | null;
}

export interface PerformanceStats {
  fps: number;
  inferenceTimeMs: number;
  frameProcessingMs: number;
  modelName: string;
  memoryUsageMB?: number;
}
