/**
 * Scene classification service for WorldLens.
 *
 * Primary path: dedicated scene-classification model run via the Kotlin ML layer.
 * Fallback path: object co-occurrence heuristics to infer scene context from detections.
 *
 * The fallback is deterministic and works offline, matching the project's no-backend requirement.
 */

import { TrackedObject } from '../../types/Detection';
import { SceneCategory, ScenePrediction, SCENE_HEURISTICS } from '../../types/Scene';

/**
 * Classify a scene based on currently tracked objects using heuristic rules.
 * This runs on-device instantly and provides reasonable scene labels.
 *
 * Replace this with a dedicated MobileNet scene classifier (e.g., Places365) in the Kotlin
 * ML module when higher accuracy is needed; the TypeScript interface stays the same.
 */
export function classifySceneFromObjects(
  trackedObjects: TrackedObject[],
  historyWindow: number = 10
): ScenePrediction {
  // Count object labels present
  const labelCounts = new Map<string, number>();
  for (const obj of trackedObjects) {
    if (!obj.isActive || obj.framesSinceSeen > 5) continue;
    labelCounts.set(obj.label, (labelCounts.get(obj.label) ?? 0) + 1);
  }

  if (labelCounts.size === 0) {
    return {
      category: 'unknown',
      label: SCENE_HEURISTICS.unknown.label,
      confidence: 0,
      predictions: [],
    };
  }

  // Score each scene by weighted object matches
  const scores: { category: SceneCategory; score: number; matches: number }[] = [];
  let totalScore = 0;

  for (const [category, heuristic] of Object.entries(SCENE_HEURISTICS)) {
    if (category === 'unknown') continue;
    let score = 0;
    let matches = 0;
    for (const objLabel of labelCounts.keys()) {
      if (heuristic.objects.includes(objLabel)) {
        score += labelCounts.get(objLabel)!;
        matches += 1;
      }
    }
    if (score > 0) {
      scores.push({ category: category as SceneCategory, score, matches });
      totalScore += score;
    }
  }

  if (scores.length === 0) {
    return {
      category: 'unknown',
      label: 'General Environment',
      confidence: 0.3,
      predictions: [],
    };
  }

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  // Check for outdoor indicators
  const hasOutdoorObjects =
    labelCounts.has('car') || labelCounts.has('bus') || labelCounts.has('traffic light');
  const hasIndoorObjects = labelCounts.has('bed') || labelCounts.has('couch') || labelCounts.has('tv');

  let best = scores[0];
  // Boost outdoor if many vehicles and no furniture
  if (hasOutdoorObjects && !hasIndoorObjects && best.category !== 'street' && best.category !== 'park') {
    const streetScore = scores.find((s) => s.category === 'street');
    if (streetScore) best = streetScore;
    else {
      best = { category: 'outdoor', score: best.score, matches: best.matches };
    }
  }

  const predictions = scores.slice(0, 3).map((s) => ({
    category: s.category,
    label: SCENE_HEURISTICS[s.category]?.label ?? s.category,
    confidence: totalScore > 0 ? s.score / totalScore : 0,
  }));

  return {
    category: best.category,
    label: SCENE_HEURISTICS[best.category]?.label ?? 'Environment',
    confidence: totalScore > 0 ? best.score / totalScore : 0.5,
    predictions,
  };
}

/**
 * Smooth scene predictions across time to reduce flickering.
 */
export class SceneSmoother {
  private history: SceneCategory[] = [];
  private maxHistory = 15;

  push(prediction: SceneCategory): SceneCategory {
    this.history.push(prediction);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return this.getSmoothed();
  }

  getSmoothed(): SceneCategory {
    if (this.history.length === 0) return 'unknown';
    // Majority vote in recent window
    const counts = new Map<SceneCategory, number>();
    for (const cat of this.history) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    let best: SceneCategory = 'unknown';
    let bestCount = 0;
    for (const [cat, count] of counts.entries()) {
      if (count > bestCount) {
        best = cat;
        bestCount = count;
      }
    }
    return best;
  }

  reset(): void {
    this.history = [];
  }
}
