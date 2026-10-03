/**
 * ApertureLogo - The WorldLens shutter-aperture icon.
 * Pure React Native View implementation (no SVG dependency) using
 * layered rotated views to simulate brass shutter blades + cyan lens core.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

interface Props {
  size?: number;
}

// 5 triangular blades via rotated View tricks is hard in pure View without SVG polygons.
// Instead we render a polished circular metallic badge with concentric rings + lens center.
// This is a clean placeholder that matches the brass/cyan color scheme.
// The real aperture image (assets/logo.jpg) can be added back with <Image> later.
export const ApertureLogo: React.FC<Props> = ({ size = 40 }) => {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.outer, { borderRadius: size / 2 }]} />
      <View style={[styles.rim, { width: size * 0.9, height: size * 0.9, borderRadius: (size * 0.9) / 2 }]} />
      <View style={[styles.inner, { width: size * 0.7, height: size * 0.7, borderRadius: (size * 0.7) / 2 }]} />
      <View style={[styles.bladeRing, { width: size * 0.55, height: size * 0.55, borderRadius: (size * 0.55) / 2 }]} />
      <View style={[styles.lens, { width: size * 0.28, height: size * 0.28, borderRadius: (size * 0.28) / 2 }]} />
      <View style={[styles.highlight, { width: size * 0.12, height: size * 0.12, borderRadius: (size * 0.12) / 2, top: size * 0.24, left: size * 0.28 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#151e26',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4a5560',
  },
  outer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#232e38',
    borderWidth: 0.8,
    borderColor: theme.colors.brass,
  },
  rim: {
    position: 'absolute',
    backgroundColor: '#2a353f',
    borderWidth: 0.7,
    borderColor: '#8a6d32',
  },
  inner: {
    position: 'absolute',
    backgroundColor: '#1a232c',
    borderWidth: 0.5,
    borderColor: theme.colors.brass,
  },
  bladeRing: {
    position: 'absolute',
    backgroundColor: '#2b3842',
    borderWidth: 0.5,
    borderColor: theme.colors.brass,
    opacity: 0.85,
  },
  lens: {
    backgroundColor: theme.colors.cyan,
    shadowColor: theme.colors.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  highlight: {
    position: 'absolute',
    backgroundColor: '#c7fff5',
    opacity: 0.8,
  },
});
