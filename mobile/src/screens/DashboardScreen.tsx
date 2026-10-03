/**
 * DashboardScreen - Premium feature hub after boot.
 * Hero card + status strip + 6 feature modules (Scanner, Find, Count, Scene, Voice, Settings).
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { ApertureLogo } from '../components/ApertureLogo';
import { theme } from '../theme/theme';

interface Props {
  onStartScanning: () => void;
  onFindObject: () => void;
  onSettings: () => void;
  onFeature?: (name: string) => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - 44 - CARD_GAP) / 2; // 22 padding * 2 + gap

interface Feat {
  key: string;
  icon: string;
  title: string;
  desc: string;
  primary?: boolean;
  badge?: string;
  badgeHot?: boolean;
  tint: string; // icon background tint (cyan/brass/etc)
  tintBorder: string;
}

const FEATURES: Feat[] = [
  { key: 'scan', icon: '◎', title: 'Live Scanner', desc: 'Real-time object detection with tracking & spatial awareness.', primary: true, badge: 'CORE', badgeHot: true, tint: 'rgba(79,209,197,0.15)', tintBorder: 'rgba(79,209,197,0.35)' },
  { key: 'find', icon: '⌕', title: 'Find Object', desc: 'Voice/text search with directional guidance.', badge: 'BETA', tint: 'rgba(201,164,92,0.18)', tintBorder: 'rgba(201,164,92,0.35)' },
  { key: 'count', icon: '#', title: 'Counting', desc: 'IoU-based stable per-class counts.', tint: 'rgba(167,139,250,0.15)', tintBorder: 'rgba(167,139,250,0.3)' },
  { key: 'scene', icon: '⬡', title: 'Scene IQ', desc: 'Understand context: street, office, home.', tint: 'rgba(93,211,158,0.15)', tintBorder: 'rgba(93,211,158,0.3)' },
  { key: 'voice', icon: '🎙', title: 'Voice', desc: '"Find keys", "What\'s that?", "Count people".', tint: 'rgba(239,90,90,0.15)', tintBorder: 'rgba(239,90,90,0.3)' },
  { key: 'settings', icon: '⚙', title: 'Settings', desc: 'Model precision, voice, haptics, privacy.', tint: 'rgba(139,146,154,0.15)', tintBorder: 'rgba(139,146,154,0.25)' },
];

export const DashboardScreen: React.FC<Props> = ({ onStartScanning, onFindObject, onSettings, onFeature }) => {
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-14)).current;
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(20)).current;
  const statusOp = useRef(new Animated.Value(0)).current;
  const statusY = useRef(new Animated.Value(20)).current;
  const secOp = useRef(new Animated.Value(0)).current;
  const secY = useRef(new Animated.Value(20)).current;
  const statsOp = useRef(new Animated.Value(0)).current;
  const statsY = useRef(new Animated.Value(20)).current;
  const cardA = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  const cardS = useRef(FEATURES.map(() => new Animated.Value(0.96))).current;

  useEffect(() => {
    const spring = (o: Animated.Value, y: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(o, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(y, { toValue: 0, delay, damping: 14, stiffness: 140, mass: 0.8, useNativeDriver: true }),
      ]);
    spring(headerOp, headerY, 100).start();
    spring(heroOp, heroY, 250).start();
    spring(statusOp, statusY, 400).start();
    spring(secOp, secY, 550).start();
    FEATURES.forEach((_, i) => {
      const delay = 650 + i * 80;
      Animated.parallel([
        Animated.timing(cardA[i], { toValue: 1, duration: 500, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(cardS[i], { toValue: 1, delay, damping: 14, stiffness: 150, mass: 0.8, useNativeDriver: true }),
      ]).start();
    });
    spring(statsOp, statsY, 1250).start();
  }, [headerOp, headerY, heroOp, heroY, statusOp, statusY, secOp, secY, statsOp, statsY, cardA, cardS]);

  const handlePress = (f: Feat) => {
    if (f.key === 'scan') onStartScanning();
    else if (f.key === 'find') onFindObject();
    else if (f.key === 'settings') onSettings();
    else onFeature?.(f.key);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1118" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
          <View style={styles.logoRow}>
            <ApertureLogo size={36} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.title}>
                WORLD<Text style={[styles.title, { color: theme.colors.cyan }]}>LENS</Text>
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.avatar} activeOpacity={0.8}>
            <Text style={{ color: theme.colors.cyan, fontSize: 16 }}>◉</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          <Text style={styles.heroGreet}>{'//'} SYSTEM ONLINE</Text>
          <Text style={styles.heroTitle}>Ready to see{'\n'}the world differently.</Text>
          <Text style={styles.heroSub}>On-device AI is active. Point your camera to identify, track, and understand objects around you in real time.</Text>
          <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onStartScanning}>
            <Text style={styles.ctaText}>BEGIN SCANNING</Text>
            <View style={styles.ctaArrow}><Text style={{ color: '#05181a', fontSize: 13, fontWeight: '800' }}>→</Text></View>
          </TouchableOpacity>
          <View style={styles.heroGlow} pointerEvents="none" />
        </Animated.View>

        {/* Status strip */}
        <Animated.View style={[styles.statusRow, { opacity: statusOp, transform: [{ translateY: statusY }] }]}>
          <StatusPill label="MODEL" value="SSDLite" highlight />
          <StatusPill label="LATENCY" value="28ms" />
          <StatusPill label="CLASSES" value="80" />
        </Animated.View>

        {/* Section title */}
        <Animated.View style={[styles.sectionHead, { opacity: secOp, transform: [{ translateY: secY }] }]}>
          <Text style={styles.sectionTitle}>FEATURES</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionCount}>06 MODULES</Text>
        </Animated.View>

        {/* Feature grid */}
        <View style={styles.grid}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={f.key}
              style={{
                opacity: cardA[i],
                transform: [{ translateY: cardA[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: cardS[i] }],
                width: f.primary ? '100%' : CARD_W,
                marginBottom: CARD_GAP,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePress(f)}
                style={[
                  styles.card,
                  f.primary && styles.cardPrimary,
                  { borderColor: f.primary ? 'rgba(79,209,197,0.3)' : theme.colors.border },
                ]}
              >
                {f.badge && (
                  <View style={[styles.badge, f.badgeHot && styles.badgeHot]}>
                    <Text style={[styles.badgeText, f.badgeHot && styles.badgeTextHot]}>{f.badge}</Text>
                  </View>
                )}
                <View style={[styles.iconBox, { backgroundColor: f.tint, borderColor: f.tintBorder }]}>
                  <Text style={[styles.iconText, { color: theme.colors.cyan }]}>{f.icon}</Text>
                </View>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardDesc}>{f.desc}</Text>
                {f.primary && <View style={styles.arrowBig}><Text style={{ color: theme.colors.steel, fontSize: 22 }}>→</Text></View>}
                {!f.primary && <Text style={styles.arrowSmall}>→</Text>}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Stats row */}
        <Animated.View style={[styles.statsRow, { opacity: statsOp, transform: [{ translateY: statsY }] }]}>
          <StatPill label="TODAY'S SCANS" value="247" suffix=" objs" />
          <StatPill label="AVG CONF" value="87" suffix="%" />
          <StatPill label="BATTERY" value="72" suffix="%" />
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const StatusPill: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={styles.pill}>
    <Text style={styles.pillLabel}>{label}</Text>
    <Text style={[styles.pillValue, highlight && { color: theme.colors.cyan }]}>{value}</Text>
  </View>
);

const StatPill: React.FC<{ label: string; value: string; suffix: string }> = ({ label, value, suffix }) => (
  <View style={styles.statPill}>
    <Text style={styles.pillLabel}>{label}</Text>
    <Text style={styles.statValue}>
      {value}
      <Text style={styles.statSuffix}>{suffix}</Text>
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 22, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: theme.colors.metal, fontSize: 18, fontWeight: '800', letterSpacing: 4, marginLeft: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(30,41,52,0.9)', borderWidth: 1, borderColor: theme.colors.borderBrass,
    alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    borderRadius: 22, padding: 24, marginBottom: 20,
    backgroundColor: '#1a2530',
    borderWidth: 1, borderColor: 'rgba(79,209,197,0.2)',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: 130,
    backgroundColor: theme.colors.cyan, opacity: 0.15,
  },
  heroGreet: { color: theme.colors.cyan, fontSize: 11, letterSpacing: 3, fontWeight: '700', fontFamily: 'Courier', marginBottom: 8 },
  heroTitle: { color: theme.colors.white, fontSize: 24, fontWeight: '800', lineHeight: 30, letterSpacing: -0.3, marginBottom: 8 },
  heroSub: { color: theme.colors.steel, fontSize: 13, lineHeight: 20, marginBottom: 20, maxWidth: 280 },
  cta: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14,
    backgroundColor: theme.colors.cyan,
    shadowColor: theme.colors.cyan, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  ctaText: { color: '#05181a', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  ctaArrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(5,24,26,0.2)', alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  pill: {
    flex: 1, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(22,32,42,0.7)', borderWidth: 1, borderColor: theme.colors.border,
  },
  pillLabel: { color: theme.colors.steel, fontSize: 9, letterSpacing: 2, fontWeight: '700', fontFamily: 'Courier', textTransform: 'uppercase', marginBottom: 4 },
  pillValue: { color: theme.colors.metal, fontSize: 16, fontWeight: '700', fontFamily: 'Courier' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: theme.colors.metal, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(79,209,197,0.25)', marginHorizontal: 12 },
  sectionCount: { color: theme.colors.brass, fontSize: 11, fontFamily: 'Courier' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, marginBottom: 20 },
  card: {
    minHeight: CARD_W * 1.0, borderRadius: 18, padding: 16,
    backgroundColor: '#16202a', borderWidth: 1, borderColor: theme.colors.border,
    justifyContent: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  cardPrimary: {
    minHeight: 160, padding: 20,
    backgroundColor: '#192530', borderColor: 'rgba(79,209,197,0.3)',
  },
  badge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(79,209,197,0.12)', borderWidth: 1, borderColor: 'rgba(79,209,197,0.3)' },
  badgeHot: { backgroundColor: 'rgba(201,164,92,0.15)', borderColor: 'rgba(201,164,92,0.3)' },
  badgeText: { color: theme.colors.cyan, fontSize: 9, fontWeight: '800', letterSpacing: 1, fontFamily: 'Courier' },
  badgeTextHot: { color: theme.colors.brass },
  iconBox: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  iconText: { fontSize: 22 },
  cardTitle: { color: theme.colors.white, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: theme.colors.steel, fontSize: 11, lineHeight: 16 },
  arrowSmall: { position: 'absolute', right: 14, bottom: 14, color: theme.colors.steel, fontSize: 18 },
  arrowBig: { position: 'absolute', right: 20, bottom: 22 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statPill: {
    flex: 1, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(22,32,42,0.7)', borderWidth: 1, borderColor: theme.colors.border,
  },
  statValue: { color: theme.colors.gold, fontSize: 20, fontWeight: '800', fontFamily: 'Courier', marginTop: 4 },
  statSuffix: { color: theme.colors.steel, fontSize: 11, fontWeight: '500' },
});
