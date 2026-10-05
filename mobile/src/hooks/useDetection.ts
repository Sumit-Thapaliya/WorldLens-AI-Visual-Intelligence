/**
 * React hook for running object detection on camera frames.
 * Manages detector lifecycle, frame loop, and detection state.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { DetectedObject, TrackedObject, ObjectCount, DetectionResult, PerformanceStats } from '../types/Detection';
import { DetectorHandle, DetectorConfig, DEFAULT_DETECTOR_CONFIG, createDetector } from '../services/detection/detector';
import { createTracker, updateTracker, computeObjectCounts, resetTracker } from '../services/tracking/sortTracker';

interface UseDetectionOptions {
  enabled?: boolean;
  config?: Partial<DetectorConfig>;
  /** Target FPS for detection loop */
  targetFps?: number;
}

interface UseDetectionResult {
  isInitialized: boolean;
  /** True when no usable .onnx model is available: detections will be empty by design. */
  modelMissing: boolean;
  isRunning: boolean;
  currentDetections: DetectedObject[];
  trackedObjects: TrackedObject[];
  objectCounts: ObjectCount[];
  stats: PerformanceStats;
  startDetection: () => void;
  stopDetection: () => void;
  setConfidenceThreshold: (threshold: number) => void;
  reset: () => void;
  /** Process a frame - called externally from the camera hook */
  processFrame: (timestamp: number, width: number, height: number, rotation: number) => Promise<void>;
}

export function useDetection(options: UseDetectionOptions = {}): UseDetectionResult {
  const { enabled = false, config = {}, targetFps = 20 } = options;

  const detectorRef = useRef<DetectorHandle | null>(null);
  const trackerRef = useRef(createTracker());
  const frameIntervalRef = useRef<number | null>(null);
  const lastProcessedRef = useRef<number>(0);

  const [isInitialized, setIsInitialized] = useState(false);
  const [modelMissing, setModelMissing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDetections, setCurrentDetections] = useState<DetectedObject[]>([]);
  const [trackedObjects, setTrackedObjects] = useState<TrackedObject[]>([]);
  const [objectCounts, setObjectCounts] = useState<ObjectCount[]>([]);
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    inferenceTimeMs: 0,
    frameProcessingMs: 0,
    modelName: config.modelName ?? DEFAULT_DETECTOR_CONFIG.modelName,
  });

  // Initialize detector
  useEffect(() => {
    let mounted = true;
    const detector = createDetector({ ...DEFAULT_DETECTOR_CONFIG, ...config });
    detectorRef.current = detector;

    detector.initialize().then((ok) => {
      if (!mounted) return;
      setIsInitialized(ok);
      // No usable model -> there is genuinely nothing to detect with. Surface that to the UI
      // instead of quietly showing an empty (or, worse, invented) screen.
      setModelMissing(!ok);
    });

    return () => {
      mounted = false;
      detector.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processFrame = useCallback(
    async (timestamp: number, width: number, height: number, rotation: number) => {
      const detector = detectorRef.current;
      if (!detector) return;

      // Throttle to target FPS
      const now = performance.now();
      const minInterval = 1000 / targetFps;
      if (now - lastProcessedRef.current < minInterval) return;
      lastProcessedRef.current = now;

      try {
        const result: DetectionResult = await detector.detectOnFrame({
          width,
          height,
          rotation,
          timestamp,
        });

        // Update tracker
        const tracked = updateTracker(trackerRef.current, result.objects, timestamp);
        const counts = computeObjectCounts(tracked);

        setCurrentDetections(result.objects);
        setTrackedObjects(tracked);
        setObjectCounts(counts);
        setStats(detector.getStats());
      } catch (err) {
        console.warn('Detection frame error:', err);
      }
    },
    [targetFps]
  );

  const startDetection = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stopDetection = useCallback(() => {
    setIsRunning(false);
    if (frameIntervalRef.current !== null) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  const setConfidenceThreshold = useCallback((threshold: number) => {
    detectorRef.current?.updateConfig({ confidenceThreshold: threshold });
  }, []);

  const reset = useCallback(() => {
    resetTracker(trackerRef.current);
    setCurrentDetections([]);
    setTrackedObjects([]);
    setObjectCounts([]);
  }, []);

  // Auto-start when the enabled flag changes.
  //
  // The previous `else stopDetection()` branch also fired while `enabled` was false, so
  // ScannerScreen - which starts the loop itself - had its frame loop killed the moment
  // initialize() resolved. We now only stop a loop that this effect itself started.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (enabled && isInitialized) {
      autoStartedRef.current = true;
      startDetection();
    } else if (autoStartedRef.current) {
      autoStartedRef.current = false;
      stopDetection();
    }
  }, [enabled, isInitialized, startDetection, stopDetection]);

  return {
    isInitialized,
    modelMissing,
    isRunning,
    currentDetections,
    trackedObjects,
    objectCounts,
    stats,
    startDetection,
    stopDetection,
    setConfidenceThreshold,
    reset,
    processFrame,
  };
}
