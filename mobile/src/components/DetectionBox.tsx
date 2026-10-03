/**
 * DetectionBox - Renders a premium tiered bounding box with label/confidence.
 * Supports press to open detail. Tier colors: cyan (hi), violet (med), red (lo), brass (lock).
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ViewStyle, TouchableOpacity } from 'react-native';
import { DetectedObject } from '../types/Detection';
import { normalizedToScreen } from '../utils/coordinates';
import { theme } from '../theme/theme';

interface DetectionBoxProps {
  detection: DetectedObject;
  screenWidth: number;
  screenHeight: number;
  rotation?: number;
  highlighted?: boolean;
  showTrackingId?: boolean;
  trackingId?: number;
  label?: string;
  style?: ViewStyle;
  onTap?: () => void;
}

export const DetectionBox: React.FC<DetectionBoxProps> = ({
  detection, screenWidth, screenHeight, rotation = 0, highlighted = false,
  showTrackingId = false, trackingId, label, style, onTap,
}) => {
  const screenBox = useMemo(
    () => normalizedToScreen(detection.boundingBox, screenWidth, screenHeight, rotation),
    [detection.boundingBox, screenWidth, screenHeight, rotation]
  );

  let tier: 'hi' | 'med' | 'lo' = detection.confidence > 0.8 ? 'hi' : detection.confidence > 0.65 ? 'med' : 'lo';
  const borderColor = highlighted ? theme.colors.brass : tier === 'hi' ? theme.colors.cyan : tier === 'med' ? theme.colors.violet : theme.colors.red;
  const glow = highlighted ? 'rgba(201,164,92,0.5)' : tier === 'hi' ? 'rgba(79,209,197,0.45)' : tier === 'med' ? 'rgba(167,139,250,0.4)' : 'rgba(239,90,90,0.3)';
  const displayLabel = label ?? detection.label;

  const content = (
    <View
      style={[
        styles.box,
        {
          left: screenBox.x,
          top: screenBox.y,
          width: screenBox.width,
          height: screenBox.height,
          borderColor,
          borderWidth: highlighted ? 2.5 : 1.5,
          shadowColor: borderColor,
          shadowOpacity: 0.8,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
      pointerEvents={onTap ? 'auto' : 'none'}
    >
      <View style={[styles.labelContainer, { backgroundColor: borderColor }]}>
        <Text style={styles.labelText}>
          {displayLabel.toUpperCase()} · {Math.round(detection.confidence * 100)}%
          {showTrackingId && trackingId != null ? `  #${trackingId}` : ''}
        </Text>
      </View>
      {highlighted && (
        <View style={[styles.halo, { borderColor: glow }]} pointerEvents="none" />
      )}
    </View>
  );

  if (onTap) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onTap}
        style={{
          position: 'absolute',
          left: screenBox.x,
          top: screenBox.y,
          width: screenBox.width,
          height: screenBox.height,
        }}
        hitSlop={{ top: 22, left: 8, right: 8, bottom: 8 }}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

const styles = StyleSheet.create({
  box: { position: 'absolute', borderRadius: 4 },
  labelContainer: {
    position: 'absolute', top: -22, left: -1,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  labelText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, fontFamily: 'Courier' },
  halo: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, borderRadius: 20, borderWidth: 1, opacity: 0.6 },
});