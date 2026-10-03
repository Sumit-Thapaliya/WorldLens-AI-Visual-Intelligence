/**
 * React hook for camera management in WorldLens.
 * Handles camera permission, preview lifecycle, and frame callbacks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type CameraPermission = 'not_determined' | 'granted' | 'denied' | 'restricted';
export type CameraFacing = 'back' | 'front';

interface CameraFrame {
  timestamp: number;
  width: number;
  height: number;
  rotation: number;
}

interface UseCameraOptions {
  /** Callback invoked for each frame (throttled by detection FPS) */
  onFrame?: (frame: CameraFrame) => void;
  /** Auto-start camera on mount */
  autoStart?: boolean;
}

interface UseCameraResult {
  permission: CameraPermission;
  isCameraActive: boolean;
  facing: CameraFacing;
  previewDimensions: { width: number; height: number };
  lastFrame: CameraFrame | null;
  error: string | null;
  requestPermission: () => Promise<CameraPermission>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => void;
  /** Called by the camera view when it produces a frame */
  handleFrame: (frame: CameraFrame) => void;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { onFrame, autoStart = false } = options;

  const [permission, setPermission] = useState<CameraPermission>('not_determined');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [previewDimensions, setPreviewDimensions] = useState({ width: 0, height: 0 });
  const [lastFrame, setLastFrame] = useState<CameraFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const requestPermission = useCallback(async (): Promise<CameraPermission> => {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const { PermissionsAndroid } = require('react-native');
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'WorldLens Camera Permission',
              message: 'WorldLens needs camera access to see and identify objects around you.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            }
          );
          const result = granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
          setPermission(result);
          return result;
        }
      }
      // In web/development, assume granted
      setPermission('granted');
      return 'granted';
    } catch (err: any) {
      setError(err?.message ?? 'Camera permission error');
      setPermission('denied');
      return 'denied';
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (permission !== 'granted') {
      const result = await requestPermission();
      if (result !== 'granted') return;
    }
    setError(null);
    setIsCameraActive(true);
  }, [permission, requestPermission]);

  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
  }, []);

  const switchCamera = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const handleFrame = useCallback((frame: CameraFrame) => {
    setLastFrame(frame);
    setPreviewDimensions({ width: frame.width, height: frame.height });
    onFrameRef.current?.(frame);
  }, []);

  useEffect(() => {
    if (autoStart) {
      requestPermission().then((p) => {
        if (p === 'granted') setIsCameraActive(true);
      });
    }
  }, [autoStart, requestPermission]);

  return {
    permission,
    isCameraActive,
    facing,
    previewDimensions,
    lastFrame,
    error,
    requestPermission,
    startCamera,
    stopCamera,
    switchCamera,
    handleFrame,
  };
}
