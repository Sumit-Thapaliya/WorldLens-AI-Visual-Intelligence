/**
 * React hook for voice interaction.
 * Wraps native speech recognition / TTS (Android SpeechRecognizer + TextToSpeech via Kotlin)
 * with robust error handling and fallback for emulators.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, DeviceEventEmitter } from 'react-native';
import {
  parseVoiceCommand,
  generateWhatDoYouSeeResponse,
  generateCountResponse,
  generateFoundResponse,
  generateSearchingResponse,
  generateSceneResponse,
  VoiceCommandType,
  ParsedVoiceCommand,
  getSupportedLabels,
} from '../services/voice/voiceCommands';
import { TrackedObject, ObjectCount } from '../types/Detection';
import { ScenePrediction } from '../types/Scene';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface UseVoiceOptions {
  trackedObjects: TrackedObject[];
  objectCounts: ObjectCount[];
  scene: ScenePrediction | null;
  onFindObject?: (label: string) => void;
  onStopFind?: () => void;
}

interface UseVoiceResult {
  status: VoiceStatus;
  isListening: boolean;
  lastCommand: ParsedVoiceCommand | null;
  lastResponse: string | null;
  transcript: string;
  supportedLabels: string[];
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string) => void;
  processCommand: (text: string) => string;
  /** Inject text as if spoken (for testing / typed input) */
  injectText: (text: string) => string;
}

export function useVoice(options: UseVoiceOptions): UseVoiceResult {
  const { trackedObjects, objectCounts, scene, onFindObject, onStopFind } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [lastCommand, setLastCommand] = useState<ParsedVoiceCommand | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const nativeRef = useRef<any>(null);

  useEffect(() => {
    try {
      const { NativeModules } = require('react-native');
      nativeRef.current = NativeModules?.VoiceModule ?? null;
    } catch {
      nativeRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string) => {
    setLastResponse(text);
    setStatus('speaking');
    if (nativeRef.current?.speak) {
      nativeRef.current.speak(text);
    }
    // Web TTS fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new (window as any).SpeechSynthesisUtterance(text);
        (window as any).speechSynthesis.speak(utterance);
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      setStatus((s) => (s === 'speaking' ? 'idle' : s));
    }, Math.max(1200, text.length * 65));
  }, []);

  const processCommand = useCallback(
    (text: string): string => {
      setStatus('processing');
      const cmd = parseVoiceCommand(text);
      setLastCommand(cmd);

      let response = '';
      switch (cmd.type) {
        case 'what_do_you_see':
          response = generateWhatDoYouSeeResponse(objectCounts);
          break;
        case 'how_many':
          response = generateCountResponse(cmd.targetLabel!, objectCounts);
          break;
        case 'find_object':
          if (cmd.targetLabel) {
            onFindObject?.(cmd.targetLabel);
            const found = trackedObjects.find(
              (t) => t.isActive && t.label === cmd.targetLabel && t.confidence >= 0.55
            );
            response = found
              ? generateFoundResponse(found)
              : generateSearchingResponse(cmd.targetLabel);
          } else {
            response = 'I can look for common objects like bottles, chairs, people, or cups. Just say "find" followed by the object name.';
          }
          break;
        case 'describe_scene':
          response = scene
            ? generateSceneResponse(scene)
            : "I'm still analyzing the scene.";
          break;
        case 'stop':
          onStopFind?.();
          response = 'Search stopped.';
          break;
        case 'unknown':
        default:
          response = `You said "${text}". I can tell you what I see, count objects, or search. Try saying "what do you see" or "find a cup".`;
      }

      speak(response);
      return response;
    },
    [objectCounts, trackedObjects, scene, onFindObject, onStopFind, speak]
  );

  // Setup native event listeners
  useEffect(() => {
    const resultSub = DeviceEventEmitter.addListener('voice_result', (text: string) => {
      if (text) {
        setTranscript(text);
        processCommand(text);
      }
    });

    const partialSub = DeviceEventEmitter.addListener('voice_partial', (text: string) => {
      if (text) {
        setTranscript(text);
      }
    });

    const stateSub = DeviceEventEmitter.addListener('voice_state', (state: string) => {
      if (state === 'listening' || state === 'processing' || state === 'speaking' || state === 'idle') {
        setStatus(state as VoiceStatus);
      }
    });

    const errorSub = DeviceEventEmitter.addListener('voice_error', (event: any) => {
      const errMsg = typeof event === 'string' ? event : event?.error || 'Voice recognition error';
      setError(errMsg);
      setStatus('idle');
    });

    return () => {
      resultSub.remove();
      partialSub.remove();
      stateSub.remove();
      errorSub.remove();
    };
  }, [processCommand]);

  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'WorldLens needs microphone access to understand voice commands.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');

    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      setError('Microphone permission denied. Enable it in app settings.');
      setStatus('idle');
      return;
    }

    setStatus('listening');
    if (nativeRef.current?.startListening) {
      try {
        nativeRef.current.startListening();
      } catch (err: any) {
        setError(err?.message ?? 'Failed to start speech recognition');
        setStatus('idle');
      }
    } else {
      console.log('[Voice] Native speech recognition unavailable - use injectText() for testing');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (nativeRef.current?.stopListening) {
      try {
        nativeRef.current.stopListening();
      } catch {}
    }
    setStatus('idle');
  }, []);

  const injectText = useCallback((text: string): string => {
    setTranscript(text);
    return processCommand(text);
  }, [processCommand]);

  return {
    status,
    isListening: status === 'listening',
    lastCommand,
    lastResponse,
    transcript,
    supportedLabels: getSupportedLabels(),
    error,
    startListening,
    stopListening,
    speak,
    processCommand,
    injectText,
  };
}
