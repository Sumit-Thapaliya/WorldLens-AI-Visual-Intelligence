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

    // Native module exists; wrap it.
    let nativeConfig = { ...config };
    let lastStats: PerformanceStats = {
      fps: 0,
      inferenceTimeMs: 0,
      frameProcessingMs: 0,
      modelName: config.modelName,
    };

    return {
      async initialize() {
        // THIS is what actually loads the .onnx session in Kotlin. Until it runs the native
        // module discards every camera frame (analyzeFrame() returns early), so nothing may be
        // decided before this promise resolves and reports whether a model loaded.
        const ok = await NativeInference.initialize(nativeConfig);
        return ok === true;
      },
      async detectOnFrame(frameData: FrameData) {
        // Kotlin already ran inference on the CameraX analysis thread; we only poll the latest
        // result here. Everything is normalised so the UI always receives plain data.
        const raw = await NativeInference.getLatestDetections(frameData);
        const objects: DetectedObject[] = Array.isArray(raw?.objects) ? raw.objects : [];
        const inferenceTimeMs =
          typeof raw?.inferenceTimeMs === 'number' ? raw.inferenceTimeMs : 0;
        const fps = typeof raw?.fps === 'number' ? raw.fps : 0;

        lastStats = {
          fps,
          inferenceTimeMs,
          frameProcessingMs: inferenceTimeMs,
          modelName: nativeConfig.modelName,
        };

        return {
          objects,
          trackedObjects: [],
          counts: [],
          inferenceTimeMs,
          timestamp: frameData.timestamp,
        };
      },
      updateConfig(partial: Partial<DetectorConfig>) {
        nativeConfig = { ...nativeConfig, ...partial };
        NativeInference.updateConfig(nativeConfig);
      },
      getConfig() {
        return { ...nativeConfig };
      },
      getStats() {
        // MUST stay synchronous: useDetection() assigns this straight into React state, and
        // the native getStats() is promise-based. Returning that promise made every stats
        // field undefined. We serve the values captured on the last frame instead.
        return { ...lastStats };
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
 * Kept for API compatibility. The detector no longer switches on this flag.
 */
export const NATIVE_MODEL_AVAILABLE = true;

/**
 * Dev-only switch for the SIMULATED detector. It must stay false.
 *
 * Why this exists at all: the mock used to be the automatic fallback whenever the native model
 * had not been loaded *yet*. Because `isModelLoaded()` is only ever true after initialize()
 * has run, that check was always false at selection time - so the app picked the mock, never
 * initialised the real model, and showed invented objects forever. Simulated detections are
 * now produced only when this flag is explicitly turned on.
 */
export const ENABLE_MOCK_DETECTOR = false;

/**
 * Synchronous probe: "has the native module already loaded an .onnx model?".
 *
 * Only meaningful AFTER initialize() has resolved. Never use this to choose between the native
 * and the mock detector - that is exactly what broke real detections. Status/diagnostics only.
 */
export function nativeModelLoaded(): boolean {
  try {
    const { NativeModules } = require('react-native');
    const mod = NativeModules?.InferenceModule;
    if (!mod || typeof mod.isModelLoaded !== 'function') return false;
    return mod.isModelLoaded() === true;
  } catch {
    return false;
  }
}

/**
 * Human-readable model status ("loaded:model.quant.onnx" / "not_loaded"), or null when the
 * native module is not present at all. Useful for on-screen diagnostics.
 */
export function nativeModelStatus(): string | null {
  try {
    const { NativeModules } = require('react-native');
    const mod = NativeModules?.InferenceModule;
    if (!mod || typeof mod.getModelStatus !== 'function') return null;
    return mod.getModelStatus();
  } catch {
    return null;
  }
}

/**
 * True when nothing can produce real detections: no native module, or a native module with no
 * usable .onnx model in assets/models/object_detector/.
 */
export function isModelMissing(): boolean {
  const native = createNativeDetector();
  if (!native) return true;
  return !nativeModelLoaded();
}

/**
 * Honest empty detector: a complete DetectorHandle that reports ZERO objects.
 *
 * Used when no real model is available and the mock flag is off. It reports nothing rather
 * than inventing something, so a broken or missing model can never masquerade as a working one.
 */
export function createEmptyDetector(
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG
): DetectorHandle {
  let currentConfig = { ...config };

  return {
    async initialize() {
      console.warn(
        '[WorldLens] no .onnx model in assets/models/object_detector - reporting zero objects ' +
          '(no simulated data). Run ai/setup_model.bat and rebuild.'
      );
      return false;
    },
    async detectOnFrame(frameData: FrameData): Promise<DetectionResult> {
      return {
        objects: [],
        trackedObjects: [],
        counts: [],
        inferenceTimeMs: 0,
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
        fps: 0,
        inferenceTimeMs: 0,
        frameProcessingMs: 0,
        modelName: currentConfig.modelName,
      };
    },
    async release() {},
    isNativeAvailable() {
      return false;
    },
  };
}

/**
 * Choose the detector to run.
 *
 * Order is deliberately simple now:
 *   1. the native ONNX module whenever the native module is present - it loads the model
 *      itself and reports honestly whether that worked;
 *   2. simulated detections ONLY when ENABLE_MOCK_DETECTOR is explicitly true;
 *   3. otherwise an empty detector that reports nothing.
 *
 * Step 1 must NOT be gated on nativeModelLoaded(): that value is false until initialize() has
 * run, so gating on it meant the real model never got a chance to load.
 */
export function createDetector(config: DetectorConfig = DEFAULT_DETECTOR_CONFIG): DetectorHandle {
  const native = createNativeDetector(config);
  if (native) {
    console.log('[WorldLens] detector: native ONNX inference');
    return native;
  }

  if (ENABLE_MOCK_DETECTOR) {
    console.warn('[WorldLens] detector: MOCK - simulated data, dev flag is ON');
    return createMockDetector(config);
  }

  console.warn('[WorldLens] detector: native InferenceModule missing - reporting zero objects.');
  return createEmptyDetector(config);
}
