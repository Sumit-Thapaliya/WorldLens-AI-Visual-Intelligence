/**
 * SplashScreen - Game-style boot / loading intro.
 *
 * Sequence (~3.8s):
 *   1. Corner brackets lock in
 *   2. Aperture logo zooms in with blur-free scale; concentric rings appear
 *   3. WORLDLENS wordmark + "AI Reality Scanner" sub fade in
 *   4. Progress bar fills while boot steps cycle
 *   5. Shutter flash, transition to dashboard
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  StatusBar,
  Easing,
  Animated,
} from 'react-native';
import { ApertureLogo } from '../components/ApertureLogo';
import { theme } from '../theme/theme';

interface Props {
  onComplete: () => void;
}

const BOOT_STEPS = [
  'INITIALIZING NEURAL CORE',
  'LOADING ONNX RUNTIME',
  'MOUNTING CAMERA STACK',
  'LOADING LABELS (80)',
  'CALIBRATING SENSORS',
  'WARMING INFERENCE ENGINE',
  'SYSTEM READY',
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.2)).current;
  const logoRotate = useRef(new Animated.Value(-40)).current;
  const wordY = useRef(new Animated.Value(20)).current;
  const wordOp = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(20)).current;
  const subOp = useRef(new Animated.Value(0)).current;
  const barOp = useRef(new Animated.Value(0)).current;
  const barFill = useRef(new Animated.Value(0)).current;
  const ringOp = useRef(new Animated.Value(0)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;
  const ring2Spin = useRef(new Animated.Value(0)).current;
  const cornersOp = useRef(new Animated.Value(0)).current;
  const flashOp = useRef(new Animated.Value(0)).current;
  const flashScale = useRef(new Animated.Value(0.3)).current;
  const completed = useRef(false);

  useEffect(() => {
    // Fade-in master
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    // Corners
    Animated.timing(cornersOp, {
      toValue: 1,
      duration: 500,
      delay: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();

    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        delay: 300,
        damping: 12,
        stiffness: 150,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 0,
        delay: 300,
        duration: 1000,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Rings
      Animated.timing(ringOp, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      Animated.loop(
        Animated.timing(ringSpin, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
      Animated.loop(
        Animated.timing(ring2Spin, {
          toValue: 1,
          duration: 5000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    });

    // Wordmark
    Animated.parallel([
      Animated.timing(wordOp, {
        toValue: 1,
        delay: 900,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(wordY, {
        toValue: 0,
        delay: 900,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(subOp, {
        toValue: 1,
        delay: 1200,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(subY, {
        toValue: 0,
        delay: 1200,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(barOp, {
        toValue: 1,
        delay: 1400,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar fill
    Animated.timing(barFill, {
      toValue: 100,
      delay: 1600,
      duration: 3200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Boot steps
    let i = 0;
    const stepIv = setInterval(() => {
      i++;
      if (i >= BOOT_STEPS.length) {
        clearInterval(stepIv);
        setTimeout(flashAndOut, 300);
        return;
      }
      setStepIdx(i);
    }, 500);

    const flashAndOut = () => {
      if (completed.current) return;
      completed.current = true;
      Animated.parallel([
        Animated.timing(flashOp, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(flashScale, {
          toValue: 1.8,
          damping: 10,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => onComplete(), 350);
      });
    };
  }, [fade, logoScale, logoRotate, wordOp, wordY, subOp, subY, barOp, barFill, ringOp, ringSpin, ring2Spin, cornersOp, flashOp, flashScale, onComplete]);

  const ring1Rot = ringSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ring2Rot = ring2Spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const logoRotDeg = logoRotate.interpolate({ inputRange: [-40, 0], outputRange: ['-40deg', '0deg'] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#06090d" />

      {/* Vignette / dark background */}
      <View style={styles.bg} />

      {/* Corner brackets */}
      <Animated.View style={[styles.corner, styles.tl, { opacity: cornersOp }]} />
      <Animated.View style={[styles.corner, styles.tr, { opacity: cornersOp }]} />
      <Animated.View style={[styles.corner, styles.bl, { opacity: cornersOp }]} />
      <Animated.View style={[styles.corner, styles.br, { opacity: cornersOp }]} />

      {/* Logo + rings */}
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.ring,
              styles.ringOuter,
              { opacity: ringOp, transform: [{ rotate: ring2Rot }] },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.ringInner,
              { opacity: ringOp, transform: [{ rotate: ring1Rot }] },
            ]}
          />
          <Animated.View
            style={{
              transform: [{ scale: logoScale }, { rotate: logoRotDeg }],
            }}
          >
            <ApertureLogo size={180} />
          </Animated.View>
          <Animated.View
            style={[
              styles.flash,
              {
                opacity: flashOp,
                transform: [{ scale: flashScale }],
              },
            ]}
          />
        </View>

        <Animated.Text
          style={[
            styles.wordmark,
            { opacity: wordOp, transform: [{ translateY: wordY }] },
          ]}
        >
          WORLD<Text style={styles.logoO}>
            {'\u00A0'}
            <Text style={styles.oIn}>◉</Text>
            {'\u00A0'}
          </Text>LENS
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            { opacity: subOp, transform: [{ translateY: subY }] },
          ]}
        >
          AI REALITY SCANNER
        </Animated.Text>
      </View>

      {/* Progress bar */}
      <Animated.View style={[styles.barWrap, { opacity: barOp }]}>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              { width: barFill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </Animated.View>

      {/* Boot step text */}
      <Animated.View style={[styles.stepWrap, { opacity: barOp }]}>
        <Text style={styles.stepOk}>✓</Text>
        <Text style={styles.stepText}>{BOOT_STEPS[stepIdx]}</Text>
      </Animated.View>

      <Text style={styles.version}>v1.0.0 // ONNX // INT8</Text>
    </View>
  );
};

const CORNER = 40;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06090d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06090d',
  },
  center: {
    alignItems: 'center',
    marginTop: -40,
  },
  logoWrap: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ring: {
    position: 'absolute',
    borderRadius: 200,
    borderWidth: 1,
  },
  ringInner: {
    width: 220,
    height: 220,
    borderColor: theme.colors.cyan,
    borderTopColor: theme.colors.cyan,
    shadowColor: theme.colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  ringOuter: {
    width: 270,
    height: 270,
    borderColor: theme.colors.brass,
    borderTopColor: theme.colors.cyan,
    borderRightColor: theme.colors.brass,
    opacity: 0.5,
  },
  flash: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 200,
    borderWidth: 3,
    borderColor: theme.colors.cyan,
    shadowColor: theme.colors.cyan,
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  wordmark: {
    color: theme.colors.metal,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 10,
    marginLeft: 10,
  },
  logoO: {
    color: theme.colors.brass,
    fontSize: 24,
    fontWeight: '700',
  },
  oIn: {
    color: theme.colors.cyan,
  },
  subtitle: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 10,
    fontFamily: 'Courier',
  },
  barWrap: {
    position: 'absolute',
    bottom: 140,
    width: 280,
  },
  barTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 2,
    backgroundColor: theme.colors.cyan,
    shadowColor: theme.colors.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  stepWrap: {
    position: 'absolute',
    bottom: 90,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepOk: {
    color: theme.colors.green,
    marginRight: 8,
    fontSize: 11,
    fontFamily: 'Courier',
  },
  stepText: {
    color: theme.colors.steel,
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Courier',
  },
  version: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    color: 'rgba(139,146,154,0.4)',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Courier',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: theme.colors.cyan,
    borderWidth: 1,
    opacity: 0.5,
  },
  tl: { top: 60, left: 24, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 60, right: 24, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 50, left: 24, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 50, right: 24, borderLeftWidth: 0, borderTopWidth: 0 },
});
