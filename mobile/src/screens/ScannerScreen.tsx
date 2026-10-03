/**
 * ScannerScreen - Premium scanner dashboard.
 * Top HUD (live pill + stats) | Radar | Zoom | Mode bar | Object chips |
 * Detection list | Bottom dock (search / shutter / mic) | Detail sheet.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { CameraOverlay } from '../components/CameraOverlay';
import { DetectionBox } from '../components/DetectionBox';
import { useCamera } from '../hooks/useCamera';
import { useDetection } from '../hooks/useDetection';
import { useVoice } from '../hooks/useVoice';
import { useTracking } from '../hooks/useTracking';
import { classifySceneFromObjects, SceneSmoother } from '../services/scene/sceneClassifier';
import { ScenePrediction } from '../types/Scene';
import { FindModeState, TrackedObject } from '../types/Detection';
import { estimateSpatialInfo } from '../utils/spatial';
import { theme } from '../theme/theme';

interface Props {
  initialFindLabel?: string | null;
  onBack: () => void;
  onOpenFind: () => void;
  onResult: (obj: { label: string; confidence: number; position: string; distance: string }) => void;
}

const { width: W, height: H } = Dimensions.get('window');

const EMOJI: Record<string, string> = {
  person:'🧍',bicycle:'🚲',car:'🚗',motorcycle:'🏍',chair:'🪑',bottle:'🍾',cup:'☕',
  cellphone:'📱',book:'📖',tv:'📺',laptop:'💻',mouse:'🖱',keyboard:'⌨',backpack:'🎒',
  umbrella:'☂',handbag:'👜',tie:'👔',suitcase:'🧳',sportsball:'⚽',dog:'🐕',cat:'🐈',
  bird:'🐦',horse:'🐎',
};
const emoj = (l: string) => EMOJI[l.replace(/\s+/g, '').toLowerCase()] || '◆';

export const ScannerScreen: React.FC<Props> = ({ initialFindLabel, onBack, onOpenFind, onResult }) => {
  const sceneSmootherRef = useRef(new SceneSmoother());
  const frameLoopRef = useRef<number | null>(null);

  const [scene, setScene] = useState<ScenePrediction | null>(null);
  const [mode, setMode] = useState<string>('all');
  const [zoom, setZoom] = useState<number>(1);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetObj, setSheetObj] = useState<TrackedObject | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const shutterScale = useRef(new Animated.Value(1)).current;

  const [findMode, setFindMode] = useState<FindModeState>({
    isActive: !!initialFindLabel,
    targetLabel: initialFindLabel ?? null,
    status: initialFindLabel ? 'searching' : 'idle',
    foundObject: null,
    message: null,
  });

  const { permission, isCameraActive, facing, startCamera, stopCamera, switchCamera, handleFrame, error: cameraError } =
    useCamera({ autoStart: false });
  const {
    isInitialized, isRunning, currentDetections, trackedObjects, objectCounts, stats,
    startDetection, stopDetection, processFrame,
  } = useDetection({ enabled: false });

  const voice = useVoice({
    trackedObjects, objectCounts, scene,
    onFindObject: (label: string) => setFindMode({ isActive: true, targetLabel: label, status: 'searching', foundObject: null, message: `Searching for ${label}...` }),
    onStopFind: () => setFindMode({ isActive: false, targetLabel: null, status: 'idle', foundObject: null, message: null }),
  });
  const tracking = useTracking(trackedObjects);

  useEffect(() => {
    startCamera().then(() => startDetection());
    return () => { stopDetection(); stopCamera(); if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const now = Date.now();
      handleFrame({ timestamp: now, width: W, height: H, rotation: 90 });
      processFrame(now, W, H, 90);
      frameLoopRef.current = requestAnimationFrame(tick);
    };
    frameLoopRef.current = requestAnimationFrame(tick);
    return () => { mounted = false; if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current); };
  }, [isRunning, handleFrame, processFrame]);

  useEffect(() => {
    const rawScene = classifySceneFromObjects(trackedObjects);
    const smoothedCategory = sceneSmootherRef.current.push(rawScene.category);
    setScene({ ...rawScene, category: smoothedCategory, label: rawScene.label });
  }, [trackedObjects]);

  useEffect(() => {
    if (!findMode.isActive || !findMode.targetLabel) return;
    const found = tracking.findObjectByLabel(findMode.targetLabel);
    if (found && found.confidence >= 0.55) {
      setFindMode((p) => ({ ...p, status: 'found', foundObject: found }));
    } else {
      setFindMode((p) => p.status === 'found' ? { ...p, status: 'searching', foundObject: null } : p);
    }
  }, [trackedObjects, findMode.isActive, findMode.targetLabel, tracking]);

  const active = trackedObjects.filter((t) => t.isActive && t.framesSinceSeen <= 2);
  const filtered = active.filter((d) => {
    if (mode === 'person') return d.label === 'person';
    if (mode === 'near') return d.boundingBox.width > 0.16;
    if (mode === 'high') return d.confidence > 0.8;
    return true;
  });
  const counts: Record<string, number> = {};
  filtered.forEach((d) => { counts[d.label] = (counts[d.label] || 0) + 1; });

  const openSheet = (obj: TrackedObject) => {
    setSheetObj(obj);
    setSheetOpen(true);
  };
  const closeSheet = () => { setSheetOpen(false); setTimeout(() => setSheetObj(null), 400); };
  const lockTarget = () => {
    if (sheetObj) { setLockedId(sheetObj.trackingId); showToast('TARGET LOCKED'); closeSheet(); }
  };
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const onCapture = () => {
    Animated.sequence([
      Animated.spring(shutterScale, { toValue: 0.9, damping: 6, stiffness: 200, useNativeDriver: true }),
      Animated.spring(shutterScale, { toValue: 1, damping: 10, stiffness: 180, useNativeDriver: true }),
    ]).start();
    const closest = tracking.getClosestObject();
    if (closest) {
      const sp = estimateSpatialInfo(closest.boundingBox);
      onResult({
        label: closest.label,
        confidence: `${Math.round(closest.confidence * 100)}%`,
        position: sp.horizontalPosition,
        distance: sp.distanceMeters ? `~${sp.distanceMeters}m` : sp.distance,
      });
      showToast('◉ CAPTURED');
    } else {
      showToast('No objects in view');
    }
  };

  const toggleMic = (force?: boolean) => {
    const next = typeof force === 'boolean' ? force : !listening;
    setListening(next);
    if (next) { voice.startListening(); showToast('🎙  LISTENING'); } else { voice.stopListening(); }
  };

  const confPercent = sheetObj ? Math.round(sheetObj.confidence * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Camera background placeholder */}
      <View style={styles.camBg}>
        <View style={styles.camGrid} />
        <View style={styles.centerCross} />
      </View>

      {/* Detection boxes layer */}
      <View style={styles.boxLayer} pointerEvents="box-none">
        {filtered.map((obj) => {
          const isLocked = obj.trackingId === lockedId;
          const isFindTarget = findMode.isActive && findMode.targetLabel === obj.label;
          return (
            <DetectionBox
              key={obj.trackingId}
              detection={obj}
              screenWidth={W}
              screenHeight={H}
              highlighted={isLocked || isFindTarget}
              showTrackingId={false}
              trackingId={obj.trackingId}
              onTap={() => openSheet(obj)}
            />
          );
        })}
      </View>

      <CameraOverlay
        trackedObjects={trackedObjects}
        scene={scene}
        objectCount={filtered.length}
        findMode={findMode}
        stats={stats}
        mode={mode}
        zoom={zoom}
        lockedId={lockedId}
        onChangeMode={(m) => {
          setMode(m);
          if (m === 'voice') toggleMic(true); else if (listening && mode === 'voice') toggleMic(false);
        }}
        onChangeZoom={setZoom}
      />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={styles.backTxt}>←</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.switchBtn} onPress={switchCamera} activeOpacity={0.8}>
        <Text style={styles.backTxt}>⟲</Text>
      </TouchableOpacity>

      {/* Object chips (horizontal) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={{ paddingHorizontal: 72, gap: 6 }}
        pointerEvents="box-none"
      >
        {Object.entries(counts).slice(0, 8).map(([l, n]) => {
          const obj = filtered.find((d) => d.label === l);
          return (
            <TouchableOpacity
              key={l}
              style={styles.objChip}
              activeOpacity={0.8}
              onPress={() => obj && openSheet(obj)}
            >
              <Text style={styles.objEmj}>{emoj(l)}</Text>
              <Text style={styles.objName}>{l}</Text>
              <Text style={styles.objCount}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Detection list */}
      <View style={styles.detList}>
        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {filtered.slice(0, 4).map((obj) => {
            const sp = estimateSpatialInfo(obj.boundingBox);
            const col = obj.confidence > 0.8 ? theme.colors.cyan : obj.confidence > 0.65 ? theme.colors.violet : theme.colors.red;
            return (
              <TouchableOpacity key={obj.trackingId} style={styles.detItem} activeOpacity={0.8} onPress={() => openSheet(obj)}>
                <View style={styles.detRow1}>
                  <Text style={styles.detName}>{obj.label}</Text>
                  <Text style={[styles.detConf, { color: col }]}>{Math.round(obj.confidence * 100)}%</Text>
                </View>
                <View style={styles.detBar}><View style={[styles.detBarF, { width: `${obj.confidence * 100}%`, backgroundColor: col }]} /></View>
                <Text style={styles.detMeta}>{sp.horizontalPosition.toUpperCase()} · {sp.distance.toUpperCase()} · #{String(obj.trackingId).padStart(3, '0')}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Bottom dock */}
      <View style={styles.dock}>
        <TouchableOpacity style={styles.dockSearch} onPress={onOpenFind} activeOpacity={0.8}>
          <Text style={styles.dockSearchTxt}>SEARCH</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.9} onPress={onCapture}>
          <Animated.View style={[styles.shutter, { transform: [{ scale: shutterScale }] }]}>
            <View style={styles.shutterRing1} />
            <View style={styles.shutterRing2} />
            <View style={styles.shutterCore}>
              <View style={styles.shutterLens} />
            </View>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dockMic, listening && styles.dockMicActive]}
          onPress={() => toggleMic()}
          activeOpacity={0.8}
        >
          {listening ? (
            <View style={styles.waves}>
              {[8, 14, 18, 10].map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h }]} />
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 20 }}>🎙</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Mic bubble */}
      {listening && (
        <View style={styles.micBubble}>
          <Text style={styles.micLbl}>●  LISTENING</Text>
          <Text style={styles.micTxt}>"What do you see?"</Text>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      )}

      {/* Detail sheet */}
      {sheetObj && (
        <>
          <TouchableOpacity
            style={[styles.sheetBackdrop, { opacity: sheetOpen ? 1 : 0 }]}
            activeOpacity={1}
            onPress={closeSheet}
          />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetOpen ? 0 : 400 }] }]}>
            <View style={styles.sheetCard}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHead}>
                <ConfidenceGauge percent={confPercent} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.sheetName}>{sheetObj.label}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <TagPill text={sheetObj.confidence > 0.8 ? 'HI' : sheetObj.confidence > 0.65 ? 'MED' : 'LO'} color={sheetObj.confidence > 0.8 ? theme.colors.cyan : sheetObj.confidence > 0.65 ? theme.colors.violet : theme.colors.red} />
                    <TagPill text={estimateSpatialInfo(sheetObj.boundingBox).horizontalPosition.toUpperCase()} color={theme.colors.cyan} />
                    <TagPill text={(() => { const s = estimateSpatialInfo(sheetObj.boundingBox); return s.distanceMeters ? `~${Math.round(s.distanceMeters)}m` : s.distance.toUpperCase(); })()} color={theme.colors.brass} gold />
                  </View>
                </View>
              </View>
              <View style={styles.intel}>
                <Text style={styles.intelHdr}>◆ INTELLIGENCE</Text>
                <View style={styles.intelGrid}>
                  <IntelItem label="LIGHTING" value={['Mixed','Bright','Dim','Natural','Indoor'][Math.floor(Math.random()*5)]} />
                  <IntelItem label="DEPTH" value={sheetObj.boundingBox.width > 0.2 ? 'Close' : sheetObj.boundingBox.width > 0.12 ? 'Medium' : 'Far'} />
                  <IntelItem label="TYPICAL" value={['Common','Typical','Recognized'][Math.floor(Math.random()*3)]} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.btnLock} onPress={lockTarget} activeOpacity={0.85}>
                  <Text style={styles.btnLockTxt}>◆ LOCK TARGET</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnAn} onPress={() => showToast('Analyzing…')} activeOpacity={0.85}>
                  <Text style={styles.btnAnTxt}>✧ ANALYZE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </>
      )}

      {cameraError && (
        <View style={styles.errorBanner}><Text style={styles.errorText}>{cameraError}</Text></View>
      )}
    </View>
  );
};

const ConfidenceGauge: React.FC<{ percent: number }> = ({ percent }) => {
  // Pure-View circular gauge: two concentric rings; foreground is a thin
  // cyan arc simulated via rotation + overflow (simple, no SVG).
  return (
    <View style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: 'rgba(255,255,255,0.08)' }} />
      <View
        style={{
          position: 'absolute',
          width: 60,
          height: 60,
          borderRadius: 30,
          borderWidth: 4,
          borderColor: 'transparent',
          borderTopColor: theme.colors.cyan,
          borderRightColor: percent > 50 ? theme.colors.cyan : 'transparent',
          borderBottomColor: percent > 75 ? theme.colors.brass : 'transparent',
        }}
      />
      <Text style={{ position: 'absolute', color: theme.colors.cyan, fontSize: 16, fontWeight: '800', fontFamily: 'Courier' }}>{percent}%</Text>
    </View>
  );
};

const TagPill: React.FC<{ text: string; color: string; gold?: boolean }> = ({ text, color, gold }) => (
  <View style={[styles.tagPill, { backgroundColor: (gold ? theme.colors.brass : color) + '20', borderColor: color + '60' }]}>
    <Text style={[styles.tagPillText, { color }]}>{text}</Text>
  </View>
);

const IntelItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flex: 1 }}>
    <Text style={styles.intelLbl}>{label}</Text>
    <Text style={styles.intelVal}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0e161d',
  },
  camGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  centerCross: {
    position: 'absolute', top: '40%', left: '45%', width: 36, height: 36, marginLeft: -18, marginTop: -18,
    borderWidth: 1, borderColor: 'rgba(79,209,197,0.2)', borderRadius: 18,
  },
  boxLayer: { ...StyleSheet.absoluteFillObject },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, left: 16, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  switchBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 16, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: theme.colors.metal, fontSize: 20 },
  chipsRow: { position: 'absolute', top: 330, left: 0, right: 0, maxHeight: 60 },
  objChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(11,17,24,0.7)', borderWidth: 1, borderColor: theme.colors.border },
  objEmj: { fontSize: 13 },
  objName: { color: theme.colors.metal, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  objCount: { color: theme.colors.cyan, fontSize: 12, fontWeight: '800', fontFamily: 'Courier' },
  detList: { position: 'absolute', right: 16, top: 400, width: 190, maxHeight: 220 },
  detItem: { padding: 10, borderRadius: 10, backgroundColor: 'rgba(11,17,24,0.75)', borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6 },
  detRow1: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detName: { color: theme.colors.metal, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  detConf: { fontSize: 11, fontFamily: 'Courier', fontWeight: '800' },
  detBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 4, overflow: 'hidden' },
  detBarF: { height: 3, borderRadius: 2 },
  detMeta: { fontSize: 9, color: theme.colors.steel, fontFamily: 'Courier', letterSpacing: 0.5 },
  dock: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  dockSearch: {
    height: 52, paddingHorizontal: 18, borderRadius: 26,
    backgroundColor: 'rgba(11,17,24,0.75)', borderWidth: 1, borderColor: theme.colors.borderCyan,
    alignItems: 'center', justifyContent: 'center',
  },
  dockSearchTxt: { color: theme.colors.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 2, fontFamily: 'Courier' },
  dockMic: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,17,24,0.75)', borderWidth: 1, borderColor: theme.colors.borderBrass,
  },
  dockMicActive: { backgroundColor: 'rgba(201,164,92,0.2)', borderColor: theme.colors.brass },
  waves: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 20 },
  waveBar: { width: 3, backgroundColor: theme.colors.brass, borderRadius: 2 },
  shutter: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center' },
  shutterRing1: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: theme.colors.cyan + '60', top: -9, left: -9 },
  shutterRing2: { position: 'absolute', width: 114, height: 114, borderRadius: 57, borderWidth: 1, borderColor: theme.colors.brass + '60', top: -16, left: -16 },
  shutterCore: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.colors.metal,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    alignItems: 'center', justifyContent: 'center',
  },
  shutterLens: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.cyan, shadowColor: theme.colors.cyan, shadowOpacity: 0.8, shadowRadius: 8 },
  micBubble: { position: 'absolute', bottom: 120, left: 22, right: 22, padding: 14, borderRadius: 16, backgroundColor: 'rgba(201,164,92,0.15)', borderWidth: 1, borderColor: theme.colors.borderBrass },
  micLbl: { color: theme.colors.brass, fontSize: 9, letterSpacing: 2, fontFamily: 'Courier', fontWeight: '800', marginBottom: 6 },
  micTxt: { color: theme.colors.metal, fontSize: 16, fontStyle: 'italic' },
  toast: { position: 'absolute', top: Platform.OS === 'ios' ? 120 : 90, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(11,17,24,0.9)', borderWidth: 1, borderColor: theme.colors.borderCyan },
  toastTxt: { color: theme.colors.cyan, fontSize: 12, fontWeight: '700', fontFamily: 'Courier', letterSpacing: 1 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  sheetCard: {
    borderRadius: 24, padding: 20,
    backgroundColor: '#121b24', borderWidth: 1, borderColor: theme.colors.borderCyan,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: -10 },
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sheetName: { color: theme.colors.white, fontSize: 20, fontWeight: '800', textTransform: 'capitalize', letterSpacing: -0.3 },
  tagPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  tagPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, fontFamily: 'Courier' },
  intel: { padding: 12, borderRadius: 14, backgroundColor: 'rgba(79,209,197,0.06)', borderWidth: 1, borderColor: 'rgba(79,209,197,0.2)', marginBottom: 16 },
  intelHdr: { color: theme.colors.cyan, fontSize: 9, letterSpacing: 2, fontFamily: 'Courier', fontWeight: '800', marginBottom: 8 },
  intelGrid: { flexDirection: 'row', gap: 8 },
  intelLbl: { color: theme.colors.steel, fontSize: 9, letterSpacing: 1, fontFamily: 'Courier', marginBottom: 3 },
  intelVal: { color: theme.colors.metal, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  btnLock: { flex: 1, height: 48, borderRadius: 14, backgroundColor: theme.colors.brass, alignItems: 'center', justifyContent: 'center' },
  btnLockTxt: { color: '#0b1118', fontSize: 12, fontWeight: '800', letterSpacing: 1, fontFamily: 'Courier' },
  btnAn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: 'rgba(79,209,197,0.1)', borderWidth: 1, borderColor: 'rgba(79,209,197,0.4)', alignItems: 'center', justifyContent: 'center' },
  btnAnTxt: { color: theme.colors.cyan, fontSize: 12, fontWeight: '800', letterSpacing: 1, fontFamily: 'Courier' },
  errorBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.red, padding: 12 },
  errorText: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
