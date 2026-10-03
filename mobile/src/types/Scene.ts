/**
 * Types for scene understanding in WorldLens.
 */

export type SceneCategory =
  | 'kitchen'
  | 'office'
  | 'classroom'
  | 'street'
  | 'bedroom'
  | 'park'
  | 'living_room'
  | 'restaurant'
  | 'bathroom'
  | 'store'
  | 'outdoor'
  | 'unknown';

export interface ScenePrediction {
  category: SceneCategory;
  /** Human-readable label */
  label: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** All category probabilities for top-N results */
  predictions: { category: SceneCategory; label: string; confidence: number }[];
}

/**
 * Scene classifier mapping - uses object co-occurrence heuristics as a fallback
 * when a dedicated scene-classification model is not immediately available.
 * A dedicated MobileNet scene classifier can be swapped in via the Kotlin ML layer.
 */
export const SCENE_HEURISTICS: Record<SceneCategory, { objects: string[]; label: string }> = {
  kitchen: {
    label: 'Kitchen',
    objects: ['bottle', 'cup', 'bowl', 'knife', 'spoon', 'fork', 'microwave', 'oven', 'sink', 'refrigerator'],
  },
  office: {
    label: 'Office',
    objects: ['laptop', 'keyboard', 'mouse', 'chair', 'tv', 'book', 'cell phone', 'desk'],
  },
  classroom: {
    label: 'Classroom',
    objects: ['chair', 'person', 'book', 'laptop', 'backpack'],
  },
  street: {
    label: 'Street',
    objects: ['car', 'bus', 'truck', 'traffic light', 'person', 'motorcycle', 'bicycle'],
  },
  bedroom: {
    label: 'Bedroom',
    objects: ['bed', 'chair', 'couch', 'tv', 'book'],
  },
  park: {
    label: 'Park',
    objects: ['person', 'dog', 'bird', 'bench', 'sports ball', 'kite'],
  },
  living_room: {
    label: 'Living Room',
    objects: ['couch', 'chair', 'tv', 'potted plant', 'book', 'remote'],
  },
  restaurant: {
    label: 'Restaurant',
    objects: ['bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'chair', 'dining table', 'person'],
  },
  bathroom: {
    label: 'Bathroom',
    objects: ['toilet', 'sink', 'hair drier', 'toothbrush'],
  },
  store: {
    label: 'Store',
    objects: ['bottle', 'backpack', 'handbag', 'person', 'umbrella'],
  },
  outdoor: {
    label: 'Outdoors',
    objects: ['car', 'person', 'bicycle', 'dog', 'bird', 'tree'],
  },
  unknown: {
    label: 'Analyzing Scene...',
    objects: [],
  },
};
