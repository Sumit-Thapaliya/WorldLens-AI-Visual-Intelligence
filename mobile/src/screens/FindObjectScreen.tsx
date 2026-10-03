/**
 * FindObjectScreen - Search for a specific object by name or voice.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

const QUICK_OBJECTS = [
  { label: 'Person', icon: '🧑' },
  { label: 'Bottle', icon: '🍶' },
  { label: 'Cup', icon: '☕' },
  { label: 'Chair', icon: '🪑' },
  { label: 'Laptop', icon: '💻' },
  { label: 'Cell phone', icon: '📱' },
  { label: 'Book', icon: '📖' },
  { label: 'Car', icon: '🚗' },
  { label: 'Dog', icon: '🐕' },
  { label: 'Cat', icon: '🐈' },
  { label: 'Backpack', icon: '🎒' },
  { label: 'TV', icon: '📺' },
];

interface FindObjectScreenProps {
  onBack: () => void;
  onStartSearch: (label: string) => void;
}

export const FindObjectScreen: React.FC<FindObjectScreenProps> = ({ onBack, onStartSearch }) => {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleSelect = (label: string) => {
    onStartSearch(label.toLowerCase());
  };

  const handleSearch = () => {
    if (query.trim()) {
      onStartSearch(query.trim().toLowerCase());
    }
  };

  const simulateVoiceInput = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      // Demo: pick a random object
      const random = QUICK_OBJECTS[Math.floor(Math.random() * QUICK_OBJECTS.length)];
      setQuery(random.label.toLowerCase());
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Object</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <Text style={styles.prompt}>What do you want to find?</Text>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Type object name..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
              onPress={simulateVoiceInput}
            >
              <Text style={styles.voiceIcon}>{isListening ? '⏳' : '🎤'}</Text>
            </TouchableOpacity>
          </View>

          {isListening && (
            <View style={styles.listeningIndicator}>
              <Text style={styles.listeningText}>🎤 Listening... Say the object name</Text>
              <View style={styles.waveBar}>
                {[...Array(5)].map((_, i) => (
                  <View key={i} style={[styles.wavePip, { animationDelay: `${i * 0.1}s` }]} />
                ))}
              </View>
            </View>
          )}

          {query.trim().length > 0 && (
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.85}>
              <Text style={styles.searchButtonText}>🔎  Start Searching for "{query}"</Text>
            </TouchableOpacity>
          )}

          {/* Quick select */}
          <Text style={styles.sectionLabel}>Quick select</Text>
          <View style={styles.grid}>
            {QUICK_OBJECTS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.gridItem}
                onPress={() => handleSelect(item.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.gridIcon}>{item.icon}</Text>
                <Text style={styles.gridLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.disclaimer}>
            WorldLens can find objects supported by its pretrained vision model.
            It does not recognize every possible object.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
  backText: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  prompt: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  voiceButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#22C55E',
  },
  voiceIcon: {
    fontSize: 22,
  },
  listeningIndicator: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    marginBottom: 16,
    gap: 10,
  },
  listeningText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },
  waveBar: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    height: 20,
  },
  wavePip: {
    width: 4,
    height: 10,
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gridIcon: {
    fontSize: 28,
  },
  gridLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 16,
  },
});
