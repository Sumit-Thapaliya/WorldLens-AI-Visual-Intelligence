/**
 * ObjectLabel - Standalone AR-style label component for detected objects.
 * Can be used with anchor positioning independent of bounding box rendering.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface ObjectLabelProps {
  label: string;
  confidence: number;
  color?: string;
  showDirection?: boolean;
  direction?: string;
  distance?: string;
  compact?: boolean;
}

export const ObjectLabel: React.FC<ObjectLabelProps> = ({
  label,
  confidence,
  color = '#22C55E',
  showDirection = false,
  direction,
  distance,
  compact = false,
}) => {
  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: color }]}>
        <Text style={styles.compactLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.arrow, { borderBottomColor: color }]} />
      <View style={[styles.bubble, { backgroundColor: color }]}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.confidence}>{Math.round(confidence * 100)}%</Text>
        {showDirection && direction && (
          <Text style={styles.detail}>{direction}</Text>
        )}
        {distance && <Text style={styles.detail}>{distance}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  confidence: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 10,
    fontWeight: '700',
  },
  detail: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  compactContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
