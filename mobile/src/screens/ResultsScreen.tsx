/**
 * ResultsScreen - Shows details about a detected/selected object.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';

interface ResultsScreenProps {
  result: {
    label: string;
    confidence: string;
    position: string;
    distance: string;
  };
  onBack: () => void;
  onTrack: () => void;
  onFindAgain: () => void;
  onAskAI: () => void;
}

const OBJECT_INFO: Record<string, { description: string; emoji: string }> = {
  person: { emoji: '🧑', description: 'A human being. People are one of the most commonly detected object classes.' },
  bottle: { emoji: '🍶', description: 'A bottle — typically used for holding liquids such as water or drinks.' },
  cup: { emoji: '☕', description: 'A cup or mug, usually for drinking beverages like coffee or tea.' },
  chair: { emoji: '🪑', description: 'A piece of furniture designed for sitting on, typically with a backrest.' },
  laptop: { emoji: '💻', description: 'A portable computer with an integrated screen and keyboard.' },
  'cell phone': { emoji: '📱', description: 'A mobile phone used for calls, messaging, and apps.' },
  book: { emoji: '📖', description: 'A bound set of pages containing text or images for reading.' },
  car: { emoji: '🚗', description: 'A four-wheeled motor vehicle used for transportation.' },
  dog: { emoji: '🐕', description: 'A domesticated canine mammal, often kept as a pet.' },
  cat: { emoji: '🐈', description: 'A small domesticated carnivorous mammal with soft fur.' },
  backpack: { emoji: '🎒', description: 'A bag carried on the back, typically with two shoulder straps.' },
  tv: { emoji: '📺', description: 'A television — an electronic device for viewing broadcast or streaming content.' },
  bicycle: { emoji: '🚲', description: 'A two-wheeled human-powered vehicle.' },
  motorcycle: { emoji: '🏍️', description: 'A two-wheeled motor vehicle.' },
  bus: { emoji: '🚌', description: 'A large motor vehicle carrying passengers by road.' },
  bird: { emoji: '🐦', description: 'A feathered, winged, egg-laying vertebrate animal.' },
  banana: { emoji: '🍌', description: 'A long curved fruit with a yellow skin and soft sweet flesh.' },
  apple: { emoji: '🍎', description: 'A round fruit with red, green, or yellow skin and crisp flesh.' },
};

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  result,
  onBack,
  onTrack,
  onFindAgain,
  onAskAI,
}) => {
  const info = OBJECT_INFO[result.label.toLowerCase()] ?? {
    emoji: '📦',
    description: `This is a ${result.label}. Detected using the on-device vision model.`,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Object Info</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.objectEmoji}>{info.emoji}</Text>
          <Text style={styles.objectLabel}>{result.label.toUpperCase()}</Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <InfoRow label="Confidence" value={result.confidence} color="#22C55E" />
          <InfoRow label="Position" value={capitalize(result.position)} />
          <InfoRow label="Distance" value={result.distance} />
          <InfoRow label="Detected in" value="Current camera view" />
        </View>

        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionTitle}>About this object</Text>
          <Text style={styles.descriptionText}>{info.description}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.primaryAction]} onPress={onTrack}>
            <Text style={styles.actionTextPrimary}>🎯  Track Object</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onFindAgain}>
            <Text style={styles.actionText}>🔎  Find Similar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onAskAI}>
            <Text style={styles.actionText}>🔊  Voice Explain</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, color ? { color } : null]}>{value}</Text>
  </View>
);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#FFFFFF', fontSize: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  heroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  objectEmoji: { fontSize: 72, marginBottom: 12 },
  objectLabel: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  descriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  descriptionTitle: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  descriptionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  primaryAction: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  actionTextPrimary: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
