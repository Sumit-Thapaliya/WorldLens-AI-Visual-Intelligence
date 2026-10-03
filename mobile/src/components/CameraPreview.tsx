import React from 'react';
import { requireNativeComponent, ViewProps, Platform, View, StyleSheet } from 'react-native';

interface NativeCameraPreviewProps extends ViewProps {
  facing?: 'back' | 'front';
}

const NativeCameraPreview = Platform.OS === 'android'
  ? requireNativeComponent<NativeCameraPreviewProps>('CameraPreviewView')
  : null;

interface CameraPreviewProps extends ViewProps {
  facing?: 'back' | 'front';
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({ facing = 'back', style, ...props }) => {
  if (NativeCameraPreview) {
    return <NativeCameraPreview style={[StyleSheet.absoluteFill, style]} facing={facing} {...props} />;
  }
  return <View style={[StyleSheet.absoluteFill, style, { backgroundColor: '#0e161d' }]} {...props} />;
};
