/**
 * Voice command parsing and response generation for WorldLens.
 *
 * Converts speech recognition text into structured commands and generates
 * natural language responses from the current detection state.
 */

import { TrackedObject, ObjectCount } from '../../types/Detection';
import { estimateSpatialInfo, getDirectionText } from '../../utils/spatial';
import { ScenePrediction } from '../../types/Scene';

export type VoiceCommandType =
  | 'what_do_you_see'
  | 'count_objects'
  | 'find_object'
  | 'describe_scene'
  | 'how_many'
  | 'stop'
  | 'unknown';

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  /** Target object label for 'find_object' or 'how_many' */
  targetLabel?: string;
  /** Raw recognized text */
  rawText: string;
}

/**
 * Map of common synonyms to canonical COCO labels.
 */
const LABEL_SYNONYMS: Record<string, string> = {
  people: 'person',
  man: 'person',
  woman: 'person',
  guy: 'person',
  kid: 'person',
  child: 'person',
  automobiles: 'car',
  automobile: 'car',
  vehicle: 'car',
  cup: 'cup',
  glass: 'cup',
  mug: 'cup',
  chair: 'chair',
  seats: 'chair',
  seat: 'chair',
  phone: 'cell phone',
  mobile: 'cell phone',
  cellphone: 'cell phone',
  tv: 'tv',
  television: 'tv',
  laptop: 'laptop',
  computer: 'laptop',
  bottle: 'bottle',
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  backpack: 'backpack',
  bag: 'backpack',
  book: 'book',
  table: 'dining table',
  desk: 'dining table',
  bike: 'bicycle',
  bicycle: 'bicycle',
  motorbike: 'motorcycle',
  bus: 'bus',
  truck: 'truck',
};

/** Known COCO labels for validation */
const KNOWN_LABELS = new Set([
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush',
]);

/**
 * Normalize a spoken label to a canonical COCO class if possible.
 */
export function normalizeLabel(spoken: string): string | null {
  const cleaned = spoken.toLowerCase().trim();
  if (LABEL_SYNONYMS[cleaned]) return LABEL_SYNONYMS[cleaned];
  if (KNOWN_LABELS.has(cleaned)) return cleaned;
  // Try prefix/substring match
  for (const label of KNOWN_LABELS) {
    if (label.includes(cleaned) || cleaned.includes(label)) {
      return label;
    }
  }
  return null;
}

/**
 * Parse recognized speech text into a structured command.
 */
export function parseVoiceCommand(text: string): ParsedVoiceCommand {
  const lower = text.toLowerCase().trim();

  // Stop command
  if (/\b(stop|cancel|done|exit|quit)\b/.test(lower)) {
    return { type: 'stop', rawText: text };
  }

  // Find object: "find bottle", "where is the bottle", "look for a chair"
  const findMatch = lower.match(
    /\b(?:find|locate|where(?:'s| is| are)|search for|look for|spot|find me|can you find|help me find)(?: a| an| the| my)?\s+([a-z ]+?)(?:\?|$|\.)/
  );
  if (findMatch) {
    const label = normalizeLabel(findMatch[1].trim());
    if (label) {
      return { type: 'find_object', targetLabel: label, rawText: text };
    }
  }

  // How many: "how many people", "count the cars"
  const countMatch = lower.match(
    /\b(?:how many|count|number of)(?: a| an| the| are there)?\s+([a-z ]+?)(?:\?|$|\.)/
  );
  if (countMatch) {
    const label = normalizeLabel(countMatch[1].trim());
    if (label) {
      return { type: 'how_many', targetLabel: label, rawText: text };
    }
  }

  // What do you see / what's around / describe
  if (
    /\b(?:what (?:do|can|are) you see|what(?:'s| is) (?:around|here|in front|this)|describe|tell me what you see|what am i looking at|objects around|list objects)\b/.test(
      lower
    )
  ) {
    return { type: 'what_do_you_see', rawText: text };
  }

  // Scene: "where am I", "what is this place", "scene"
  if (
    /\b(?:where am i|what (?:is|kind of) (?:place|room|scene|area)|describe (?:the )?(?:scene|place|room)|am i (?:in|at|on))\b/.test(
      lower
    )
  ) {
    return { type: 'describe_scene', rawText: text };
  }

  return { type: 'unknown', rawText: text };
}

/**
 * Generate a spoken response for "what do you see?"
 */
export function generateWhatDoYouSeeResponse(counts: ObjectCount[]): string {
  if (counts.length === 0) {
    return "I don't see any recognizable objects right now. Try pointing the camera at your surroundings.";
  }

  const parts: string[] = [];
  for (const c of counts.slice(0, 6)) {
    const noun = c.count === 1 ? c.label : pluralize(c.label);
    parts.push(c.count === 1 ? `a ${noun}` : `${c.count} ${noun}`);
  }

  if (parts.length === 1) {
    return `I see ${parts[0]}.`;
  }
  const last = parts.pop();
  return `I see ${parts.join(', ')}, and ${last}.`;
}

/**
 * Generate response for "how many X are there?"
 */
export function generateCountResponse(label: string, counts: ObjectCount[]): string {
  const count = counts.find((c) => c.label === label)?.count ?? 0;
  const noun = count === 1 ? label : pluralize(label);
  if (count === 0) {
    return `I don't see any ${pluralize(label)} in view.`;
  }
  return `I see ${count} ${noun}.`;
}

/**
 * Generate response when a target object is found.
 */
export function generateFoundResponse(obj: TrackedObject): string {
  const spatial = estimateSpatialInfo(obj.boundingBox);
  const direction = getDirectionText(spatial);
  const confidence = Math.round(obj.confidence * 100);
  return `${articleFor(obj.label)} ${obj.label} detected ${direction}. Confidence: ${confidence} percent.`;
}

/**
 * Generate response when searching for an object not in view.
 */
export function generateSearchingResponse(label: string): string {
  return `Searching for ${articleFor(label)} ${label}. Move the camera around to scan your surroundings.`;
}

/**
 * Generate scene description response.
 */
export function generateSceneResponse(scene: ScenePrediction): string {
  if (scene.category === 'unknown' || scene.confidence < 0.2) {
    return "I'm still analyzing the scene. Try pointing at more objects.";
  }
  return `This looks like a ${scene.label.toLowerCase()}.`;
}

/**
 * Pluralize common COCO labels.
 */
function pluralize(label: string): string {
  const irregular: Record<string, string> = {
    person: 'people',
    chair: 'chairs',
    'teddy bear': 'teddy bears',
    scissors: 'scissors',
  };
  if (irregular[label]) return irregular[label];
  if (label.endsWith('s') || label.endsWith('sh') || label.endsWith('ch')) return `${label}es`;
  if (label.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(label[label.length - 2])) {
    return `${label.slice(0, -1)}ies`;
  }
  return `${label}s`;
}

/**
 * Get appropriate article ("a" or "an") for a label.
 */
function articleFor(label: string): string {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

/**
 * List all supported searchable labels for "what can you find?" queries.
 */
export function getSupportedLabels(): string[] {
  return Array.from(KNOWN_LABELS);
}
