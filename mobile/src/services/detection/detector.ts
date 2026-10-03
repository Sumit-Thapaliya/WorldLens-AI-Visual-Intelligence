/**
 * Detection service interface for WorldLens.
 *
 * Defines the contract between React Native and the native (Kotlin) inference module.
 * In production, this calls the native module; for development and preview,
 * it provides a mock implementation using simulated detections so the UI can be tested.
 */

import { DetectedObject, DetectionResult, PerformanceStats } from '../../types/Detection';

export interface DetectorConfig {
  modelName: string;
  confidenceThreshold: number;
  maxDetections: number;
  inputSize: number;
  enableGPU: boolean;
  enableNNAPI: boolean;
  numThreads: number;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  modelName: 'ssdlite_mobilenet_v3',
  confidenceThreshold: 0.45,
  maxDetections: 20,
  inputSize: 320,
  enableGPU: true,
  enableNNAPI: true,
  numThreads: 4,
};

export interface DetectorHandle {
  /** Initialize the detector and load model */
  initialize: () => Promise<boolean>;
  /** Run detection on a frame; called from native frame processor */
  detectOnFrame: (frameData: FrameData) => Promise<DetectionResult>;
  /** Update configuration (e.g., change threshold) */
  updateConfig: (config: Partial<DetectorConfig>) => void;
  /** Get current config */
  getConfig: () => DetectorConfig;
  /** Get performance stats */
  getStats: () => PerformanceStats;
  /** Release resources */
  release: () => Promise<void>;
  /** Whether native module is available */
  isNativeAvailable: () => boolean;
}

export interface FrameData {
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Rotation (0, 90, 180, 270) */
  rotation: number;
  /** Frame timestamp */
  timestamp: number;
}

/**
 * Generates a simple ID for detections.
 */
function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Mock detector that returns simulated detections for UI development.
 * Replace with native module call in production (see Kotlin InferenceModule).
 */
export function createMockDetector(
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG
): DetectorHandle {
  let currentConfig = { ...config };
  let lastInferenceTime = 35;
  let frameCount = 0;
  let lastFpsUpdate = Date.now();
  let fps = 0;
  let frames = 0;

  const mockObjects = [
    { label: 'person', baseX: 0.15, baseY: 0.25, baseW: 0.25, baseH: 0.55 },
    { label: 'bottle', baseX: 0.65, baseY: 0.55, baseW: 0.1, baseH: 0.2 },
    { label: 'chair', baseX: 0.45, baseY: 0.6, baseW: 0.2, baseH: 0.3 },
    { label: 'laptop', baseX: 0.4, baseY: 0.45, baseW: 0.18, baseH: 0.15 },
    { label: 'cup', baseX: 0.72, baseY: 0.5, baseW: 0.06, baseH: 0.08 },
  ];

  function simulateDetections(timestamp: number): DetectedObject[] {
    // Simulate slight movement using sine waves
    const t = timestamp / 1000;
    const visible: DetectedObject[] = [];

    for (const m of mockObjects) {
      // Not all objects are visible every frame
      const visibilityNoise = Math.sin(t * 0.3 + m.baseX * 10);
      if (visibilityNoise < -0.3) continue;

      const jitterX = Math.sin(t * 0.5 + m.baseX * 7) * 0.02;
      const jitterY = Math.cos(t * 0.7 + m.baseY * 5) * 0.02;
      const jitterW = Math.sin(t * 0.4 + m.baseW * 11) * 0.01;

      const confidence = 0.7 + Math.sin(t * 2 + m.label.length) * 0.2;
      if (confidence < currentConfig.confidenceThreshold) continue;

      visible.push({
        id: genId(),
        label: m.label,
        confidence: Math.min(0.99, Math.max(0.5, confidence)),
        boundingBox: {
          x: Math.max(0, m.baseX + jitterX),
          y: Math.max(0, m.baseY + jitterY),
          width: Math.min(1 - m.baseX, Math.max(0.03, m.baseW + jitterW)),
          height: Math.min(1 - m.baseY, Math.max(0.03, m.baseH + jitterW * 2)),
        },
      });
    }
    return visible.slice(0, currentConfig.maxDetections);
  }

  return {
    async initialize() {
      // Simulate model loading
      await new Promise((r) => setTimeout(r, 500));
      return true;
    },

    async detectOnFrame(frameData: FrameData): Promise<DetectionResult> {
      const start = performance.now();

      // Simulate inference time
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 20));

      const objects = simulateDetections(frameData.timestamp);
      const inferenceTimeMs = performance.now() - start;

      // Update FPS counter
      frames++;
      const now = Date.now();
      if (now - lastFpsUpdate >= 1000) {
        fps = (frames * 1000) / (now - lastFpsUpdate);
        frames = 0;
        lastFpsUpdate = now;
      }
      lastInferenceTime = inferenceTimeMs;

      return {
        objects,
        trackedObjects: [], // filled in by tracking layer
        counts: [],
        inferenceTimeMs,
        timestamp: frameData.timestamp,
      };
    },

    updateConfig(partial: Partial<DetectorConfig>) {
      currentConfig = { ...currentConfig, ...partial };
    },

    getConfig() {
      return { ...currentConfig };
    },

    getStats(): PerformanceStats {
      return {
        fps,
        inferenceTimeMs: lastInferenceTime,
        frameProcessingMs: lastInferenceTime + 5,
        modelName: currentConfig.modelName,
      };
    },

    async release() {},

    isNativeAvailable() {
      // Check for NativeModules availability
      return typeof global !== 'undefined' && !!(global as any).__WorldLensNativeModule;
    },
  };
}

/**
 * Attempt to bind to the native Kotlin inference module.
 * Returns null if the native module is not loaded (e.g., running in pure JS mode).
 */
export function createNativeDetector(
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG
): DetectorHandle | null {
  // Try to access the native module exposed by Kotlin's NativeModulePackage
  try {
    const { NativeModules } = require('react-native');
    const NativeInference = NativeModules?.InferenceModule;
    if (!NativeInference) return null;

    // Native module exists; wrap it
    return {
      async initialize() {
        return NativeInference.initialize(config);
      },
      async detectOnFrame(frameData: FrameData) {
        // In real Android integration, frame bytes are passed via native view ref;
        // here we invoke the latest result from the native frame processor.
        return NativeInference.getLatestDetections(frameData);
      },
      updateConfig(partial: Partial<DetectorConfig>) {
        NativeInference.updateConfig({ ...config, ...partial });
      },
      getConfig() {
        return { ...config };
      },
      getStats() {
        return NativeInference.getStats();
      },
      async release() {
        return NativeInference.release();
      },
      isNativeAvailable() {
        return true;
      },
    };
  } catch {
    return null;
  }
}

/**
 * Create the best available detector (native first, mock fallback).
 */
export function createDetector(config: DetectorConfig = DEFAULT_DETECTOR_CONFIG): DetectorHandle {
  const native = createNativeDetector(config);
  if (native) return native;
  return createMockDetector(config);
}
