/**
 * React hook for voice interaction.
 * Wraps native speech recognition / TTS (Android SpeechRecognizer + TextToSpeech via Kotlin)
 * with a JS fallback for development.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { TrackedObject, ObjectCount, FindModeState } from '../types/Detection';
import { ScenePrediction } from '../types/Scene';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

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
  startListening: () => void;
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
    // Bind to native voice module if available (Kotlin VoiceModule)
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
    // Browser TTS fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new (window as any).SpeechSynthesisUtterance(text);
        (window as any).speechSynthesis.speak(utterance);
      } catch {
        // ignore
      }
    }
    setTimeout(() => setStatus('idle'), Math.max(1000, text.length * 60));
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
            response = `I can look for common objects like bottles, chairs, people, or cars. Just say "find" followed by the object name.`;
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
          response = `You said "${text}". I can tell you what I see, count objects, find things, or describe the scene. Try saying "what do you see" or "find a bottle".`;
      }

      speak(response);
      return response;
    },
    [objectCounts, trackedObjects, scene, onFindObject, onStopFind, speak]
  );

  const startListening = useCallback(() => {
    setError(null);
    setStatus('listening');
    setTranscript('');
    if (nativeRef.current?.startListening) {
      nativeRef.current.startListening((text: string) => {
        setTranscript(text);
        processCommand(text);
      });
    } else {
      // Fallback - will wait for injectText
      console.log('[Voice] Native speech recognition unavailable - use injectText() for testing');
    }
  }, [processCommand]);

  const stopListening = useCallback(() => {
    if (nativeRef.current?.stopListening) {
      nativeRef.current.stopListening();
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
