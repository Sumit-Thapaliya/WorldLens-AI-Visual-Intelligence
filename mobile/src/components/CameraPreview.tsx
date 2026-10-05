import React from 'react';
import { requireNativeComponent, ViewProps, Platform, View, StyleSheet } from 'react-native';

interface NativeCameraPreviewProps extends ViewProps {
  facing?: 'back' | 'front';
}

// requireNativeComponent throws when the view is not registered (e.g. an APK built before
// CameraPreviewViewManager existed). Degrade to a plain view instead of a red screen.
let NativeCameraPreview: React.ComponentType<NativeCameraPreviewProps> | null = null;
if (Platform.OS === 'android') {
  try {
    NativeCameraPreview = requireNativeComponent<NativeCameraPreviewProps>('CameraPreviewView');
  } catch (e) {
    console.warn('[WorldLens] CameraPreviewView not available in this build:', e);
    NativeCameraPreview = null;
  }
}

interface CameraPreviewProps extends ViewProps {
  facing?: 'back' | 'front';
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({ facing = 'back', style, ...props }) => {
  if (NativeCameraPreview) {
    return (
      <NativeCameraPreview
        style={[StyleSheet.absoluteFill, style]}
        facing={facing}
        // MUST stay false. This view paints its own content instead of holding React children,
        // so React Native's "layout only" optimisation is free to collapse it out of the native
        // hierarchy - the view is then never attached, the camera is never bound, and the screen
        // stays black with no error anywhere.
        collapsable={false}
        {...props}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, style, { backgroundColor: '#0e161d' }]} {...props} />;
};
