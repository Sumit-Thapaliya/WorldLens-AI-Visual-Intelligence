/**
 * HomeScreen - Welcome screen with primary actions.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';

interface HomeScreenProps {
  onStartScanning: () => void;
  onFindObject: () => void;
  onSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartScanning,
  onFindObject,
  onSettings,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.content}>
        {/* Logo / Hero */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>👁️</Text>
          </View>
          <Text style={styles.title}>WorldLens</Text>
          <Text style={styles.subtitle}>AI Reality Scanner</Text>
          <Text style={styles.tagline}>
            See the world through AI. Point your camera to detect, identify, count,
            and find objects around you — entirely on-device.
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          <FeatureRow icon="🎯" text="Real-time object detection" />
          <FeatureRow icon="🔢" text="Smart counting & tracking" />
          <FeatureRow icon="🔎" text="Find objects with voice" />
          <FeatureRow icon="📍" text="Direction & distance" />
          <FeatureRow icon="🏠" text="Scene understanding" />
          <FeatureRow icon="📴" text="Works offline" />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onStartScanning}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>📷  Start Scanning</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onFindObject}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>🔎  Find Object</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsLink}
            onPress={onSettings}
            activeOpacity={0.6}
          >
            <Text style={styles.settingsLinkText}>⚙️  Settings</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Recognizes 80+ common objects using on-device AI
        </Text>
      </View>
    </SafeAreaView>
  );
};

const FeatureRow: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.featureRow}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    maxWidth: 300,
  },
  features: {
    marginVertical: 20,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    gap: 12,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  secondaryButtonText: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingsLinkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
});
