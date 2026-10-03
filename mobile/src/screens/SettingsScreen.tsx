/**
 * SettingsScreen - App settings and model info.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, ScrollView, Switch } from 'react-native';

interface SettingsScreenProps {
  onBack: () => void;
}

interface SettingItemProps {
  label: string;
  description?: string;
  value?: string;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
}

const SettingItem: React.FC<SettingItemProps> = ({ label, description, value, toggle, onToggle }) => (
  <View style={styles.settingItem}>
    <View style={styles.settingTextWrap}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
    </View>
    {toggle !== undefined ? (
      <Switch value={toggle} onValueChange={onToggle} trackColor={{ true: '#3B82F6', false: '#475569' }} />
    ) : (
      <Text style={styles.settingValue}>{value}</Text>
    )}
  </View>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [gpuEnabled, setGpuEnabled] = useState(true);
  const [nnapiEnabled, setNnapiEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [devStats, setDevStats] = useState(__DEV__);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.45);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {/* Model info */}
        <Text style={styles.sectionHeader}>AI Model</Text>
        <View style={styles.section}>
          <SettingItem label="Model" value="SSDLite MobileNetV3" />
          <SettingItem label="Input size" value="320 × 320" />
          <SettingItem label="Classes" value="80 (COCO)" />
          <SettingItem label="Runtime" value="ONNX Runtime Mobile" />
          <SettingItem label="Model size" value="~12 MB" />
        </View>

        {/* Inference */}
        <Text style={styles.sectionHeader}>Inference</Text>
        <View style={styles.section}>
          <SettingItem
            label="GPU Acceleration"
            description="Use GPU delegate when available"
            toggle={gpuEnabled}
            onToggle={setGpuEnabled}
          />
          <SettingItem
            label="NNAPI"
            description="Android Neural Networks API"
            toggle={nnapiEnabled}
            onToggle={setNnapiEnabled}
          />
          <SettingItem
            label="Object Tracking"
            description="Maintain object identities across frames"
            toggle={trackingEnabled}
            onToggle={setTrackingEnabled}
          />
        </View>

        {/* Confidence threshold */}
        <Text style={styles.sectionHeader}>Detection</Text>
        <View style={styles.section}>
          <SettingItem
            label="Confidence threshold"
            value={`${Math.round(confidenceThreshold * 100)}%`}
          />
          <View style={styles.thresholdButtons}>
            {[0.3, 0.45, 0.6, 0.75].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.presetBtn, confidenceThreshold === t && styles.presetBtnActive]}
                onPress={() => setConfidenceThreshold(t)}
              >
                <Text style={[styles.presetText, confidenceThreshold === t && styles.presetTextActive]}>
                  {Math.round(t * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voice */}
        <Text style={styles.sectionHeader}>Voice</Text>
        <View style={styles.section}>
          <SettingItem
            label="Voice interaction"
            description="Voice commands and spoken responses"
            toggle={voiceEnabled}
            onToggle={setVoiceEnabled}
          />
        </View>

        {/* Developer */}
        <Text style={styles.sectionHeader}>Developer</Text>
        <View style={styles.section}>
          <SettingItem
            label="Performance overlay"
            description="Show FPS, inference time"
            toggle={devStats}
            onToggle={setDevStats}
          />
        </View>

        {/* About */}
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>WorldLens</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>
            On-device AI reality scanner. Object detection runs entirely on your phone —
            no camera data leaves your device.
          </Text>
          <Text style={styles.aboutSubtext}>
            Pretrained model: SSDLite MobileNetV3-Large (COCO)
            {'\n'}Works offline · No account required · No backend
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
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
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#FFFFFF', fontSize: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 8 },
  sectionHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  settingTextWrap: { flex: 1, paddingRight: 12 },
  settingLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  settingDescription: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  settingValue: { color: '#3B82F6', fontSize: 14, fontWeight: '600' },
  thresholdButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  presetBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  presetText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  presetTextActive: { color: '#FFFFFF' },
  about: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 20,
    gap: 4,
  },
  aboutTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  aboutVersion: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 },
  aboutText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  aboutSubtext: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
