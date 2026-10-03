/**
 * CameraOverlay - Premium HUD over the camera preview.
 * Includes: corner brackets, scan line, live status pill, stat chips,
 * tiered detection boxes, off-screen arrows, radar dots, mode bar, object chips.
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { TrackedObject, FindModeState, PerformanceStats } from '../types/Detection';
import { ScenePrediction } from '../types/Scene';
import { theme } from '../theme/theme';

interface Props {
  trackedObjects: TrackedObject[];
  scene: ScenePrediction | null;
  objectCount: number;
  findMode: FindModeState;
  stats: PerformanceStats;
  mode?: string;
  zoom?: number;
  lockedId?: number | null;
  onChangeMode?: (m: string) => void;
  onChangeZoom?: (z: number) => void;
  onObjectPress?: (obj: TrackedObject) => void;
}

const { width: W, height: H } = Dimensions.get('window');

const tierColor = (t: 'hi' | 'med' | 'lo') =>
  t === 'hi' ? theme.colors.cyan : t === 'med' ? theme.colors.violet : theme.colors.red;

export const CameraOverlay: React.FC<Props> = ({
  trackedObjects, scene, objectCount, findMode, stats, mode = 'all',
  zoom = 1, lockedId, onChangeMode, onChangeZoom, onObjectPress,
}) => {
  const scanY = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(scanY, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [scanY, sweep, livePulse]);

  const active = trackedObjects.filter((t) => t.isActive && t.framesSinceSeen <= 2);
  const sceneLabel = scene && scene.category !== 'unknown' ? scene.label : 'Scanning…';

  const fpsColor = stats.fps < 25 ? theme.colors.red : stats.fps < 28 ? theme.colors.brass : theme.colors.cyan;
  const liveLabel = lockedId != null ? 'LOCKED' : findMode.isActive ? 'SEARCH' : 'LIVE';
  const liveColor = lockedId != null ? theme.colors.brass : theme.colors.cyan;

  const sweepRot = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* touchable children must use pointerEvents="auto" */}
      {/* Brackets */}
      <View style={[styles.bracket, styles.tl]} />
      <View style={[styles.bracket, styles.tr]} />
      <View style={[styles.bracket, styles.bl]} />
      <View style={[styles.bracket, styles.br]} />

      {/* Scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            top: scanY.interpolate({ inputRange: [0, 1], outputRange: [120, H - 280] }),
          },
        ]}
      />

      {/* Top HUD */}
      <View style={styles.topHud} pointerEvents="box-none">
        <View style={styles.liveRow}>
          <View style={[styles.livePill, { borderColor: liveColor + '40' }]}>
            <Animated.View
              style={[
                styles.liveDot,
                { backgroundColor: liveColor, transform: [{ scale: livePulse }] },
              ]}
            />
            <Text style={[styles.liveLabel, { color: liveColor }]}>{liveLabel}</Text>
            <View style={styles.sep} />
            <Text style={styles.sceneText}>{sceneLabel}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <Chip ic="⚡" value={Math.round(stats.fps)} label="FPS" color={fpsColor} />
          <Chip ic="◔" value={Math.round(stats.inferenceTimeMs)} label="MS" color={theme.colors.cyan} />
          <Chip ic="◇" value={objectCount} label="OBJS" color={theme.colors.cyan} />
        </View>
      </View>

      {/* Radar */}
      <View style={styles.radar}>
        <View style={[styles.radarCircle, { width: 72, height: 72, borderRadius: 36 }]} />
        <View style={[styles.radarCircle, { width: 36, height: 36, borderRadius: 18 }]} />
        <View style={styles.radarH} />
        <View style={styles.radarV} />
        <Animated.View
          style={{
            position: 'absolute', left: 0, top: 0, width: 110, height: 110,
            transform: [{ rotate: sweepRot }],
          }}
          pointerEvents="none"
        >
          <View style={{ position: 'absolute', left: 55, top: 54, width: 55, height: 2, backgroundColor: theme.colors.cyan }} />
        </Animated.View>
        {active.slice(0, 8).map((o) => {
          const bx = o.boundingBox.x + o.boundingBox.width / 2;
          const by = o.boundingBox.y + o.boundingBox.height / 2;
          const t = o.confidence > 0.8 ? 'hi' : o.confidence > 0.65 ? 'med' : 'lo';
          const col = o.trackingId === lockedId ? theme.colors.brass : tierColor(t);
          return (
            <View
              key={o.trackingId}
              style={{
                position: 'absolute',
                left: 55 + (bx - 0.5) * 80 - 4,
                top: 55 + (by - 0.5) * 80 - 4,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: col,
                shadowColor: col, shadowOpacity: 0.8, shadowRadius: 6,
              }}
            />
          );
        })}
        <Text style={styles.radarN}>N</Text>
        <Text style={styles.radarLabel}>RADAR</Text>
      </View>

      {/* Zoom */}
      <View style={styles.zoom} pointerEvents="box-none">
        {[2, 1, 0.5].map((z) => (
          <TouchableOpacity key={z} onPress={() => onChangeZoom?.(z)} style={[styles.zoomBtn, zoom === z && styles.zoomBtnActive]}>
            <Text style={[styles.zoomText, zoom === z && { color: '#05181a' }]}>
              {z === 0.5 ? '½×' : `${z}×`}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.zoomLbl}>ZOOM</Text>
      </View>

      {/* Mode bar */}
      <View style={styles.modeBar} pointerEvents="box-none">
        {[
          { k: 'all', l: 'ALL' },
          { k: 'person', l: 'PEOPLE' },
          { k: 'near', l: 'NEAR' },
          { k: 'high', l: 'HI-CONF' },
          { k: 'voice', l: 'VOICE' },
        ].map((m) => (
          <TouchableOpacity
            key={m.k}
            onPress={() => onChangeMode?.(m.k)}
            style={[styles.modeBtn, mode === m.k && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, mode === m.k && { color: theme.colors.cyan }]}>{m.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Find-mode banner */}
      {findMode.isActive && findMode.status === 'searching' && (
        <View style={styles.findBanner}>
          <Text style={styles.findBannerText}>⌕  SEARCHING "{findMode.targetLabel?.toUpperCase()}"</Text>
        </View>
      )}
    </View>
  );
};

const Chip: React.FC<{ ic: string; value: number | string; label: string; color: string }> = ({ ic, value, label, color }) => (
  <View style={styles.chip}>
    <Text style={styles.chipIcon}>{ic}</Text>
    <Text style={[styles.chipVal, { color }]}>{value}</Text>
    <Text style={styles.chipLbl}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
  bracket: { position: 'absolute', width: 28, height: 28, borderWidth: 2, borderColor: theme.colors.cyan, opacity: 0.8 },
  tl: { top: 110, left: 22, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 110, right: 22, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 260, left: 22, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 260, right: 22, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute', left: 22, right: 22, height: 2,
    backgroundColor: theme.colors.cyan,
    shadowColor: theme.colors.cyan, shadowOpacity: 0.7, shadowRadius: 10,
  },
  topHud: { position: 'absolute', top: 0, left: 0, right: 0, padding: 14, paddingTop: 50 },
  liveRow: { alignItems: 'center' },
  livePill: {
    alignSelf: 'stretch', height: 40, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: theme.colors.borderCyan,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, fontFamily: 'Courier' },
  sep: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  sceneText: { fontSize: 12, fontWeight: '600', color: theme.colors.metal, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    flex: 1, height: 34, borderRadius: 10, paddingHorizontal: 10,
    backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: theme.colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipIcon: { fontSize: 12, color: theme.colors.steel },
  chipVal: { fontSize: 13, fontWeight: '800', fontFamily: 'Courier' },
  chipLbl: { fontSize: 9, letterSpacing: 1, color: theme.colors.steel, fontFamily: 'Courier', textTransform: 'uppercase', marginLeft: 'auto' },
  radar: {
    position: 'absolute', top: 160, right: 16, width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(11,17,24,0.85)', borderWidth: 1, borderColor: theme.colors.borderCyan,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16,
  },
  radarCircle: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(79,209,197,0.2)' },
  radarH: { position: 'absolute', width: 100, height: 1, backgroundColor: 'rgba(79,209,197,0.15)' },
  radarV: { position: 'absolute', width: 1, height: 100, backgroundColor: 'rgba(79,209,197,0.15)' },
  radarN: { position: 'absolute', top: 4, left: 55 - 4, color: theme.colors.cyan, fontSize: 8, fontFamily: 'Courier', fontWeight: '800' },
  radarLabel: { position: 'absolute', bottom: -16, left: 0, right: 0, textAlign: 'center', color: theme.colors.steel, fontSize: 9, letterSpacing: 2, fontFamily: 'Courier', textTransform: 'uppercase' },
  zoom: { position: 'absolute', top: 290, left: 16, width: 44, borderRadius: 22, paddingVertical: 6, backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 2 },
  zoomBtn: { width: 32, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  zoomBtnActive: { backgroundColor: theme.colors.cyan },
  zoomText: { fontSize: 11, fontWeight: '800', color: theme.colors.steel, fontFamily: 'Courier' },
  zoomLbl: { fontSize: 8, letterSpacing: 1, color: theme.colors.steel, fontFamily: 'Courier', marginTop: 4 },
  modeBar: { position: 'absolute', top: 290, left: 72, right: 130, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: theme.colors.border },
  modeBtnActive: { backgroundColor: 'rgba(79,209,197,0.12)', borderColor: theme.colors.cyan },
  modeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: theme.colors.steel, fontFamily: 'Courier', textTransform: 'uppercase' },
  findBanner: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(79,209,197,0.9)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  findBannerText: { color: '#05181a', fontSize: 13, fontWeight: '800', letterSpacing: 1, fontFamily: 'Courier' },
});
