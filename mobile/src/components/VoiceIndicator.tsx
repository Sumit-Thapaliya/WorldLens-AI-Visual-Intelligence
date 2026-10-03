/**
 * VoiceIndicator - Visual indicator for voice recognition state.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceIndicatorProps {
  state: VoiceState;
  transcript?: string;
  response?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  state,
  transcript,
  response,
  onPress,
  disabled = false,
}) => {
  const isActive = state === 'listening' || state === 'processing' || state === 'speaking';

  return (
    <View style={styles.wrapper}>
      {response && state === 'speaking' && (
        <View style={styles.responseBubble}>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      )}
      {transcript && state === 'listening' && (
        <View style={styles.transcriptBubble}>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.button,
          isActive && styles.buttonActive,
          state === 'error' && styles.buttonError,
          disabled && styles.buttonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {state === 'processing' ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.micIcon}>{state === 'speaking' ? '🔊' : '🎤'}</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        {state === 'listening' && 'Listening...'}
        {state === 'processing' && 'Processing...'}
        {state === 'speaking' && 'Speaking...'}
        {state === 'idle' && 'Ask'}
        {state === 'error' && 'Try again'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonActive: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    transform: [{ scale: 1.1 }],
  },
  buttonError: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
    shadowOpacity: 0,
  },
  micIcon: {
    fontSize: 28,
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  responseBubble: {
    position: 'absolute',
    bottom: 84,
    backgroundColor: '#22C55E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  responseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  transcriptBubble: {
    position: 'absolute',
    bottom: 84,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  transcriptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
