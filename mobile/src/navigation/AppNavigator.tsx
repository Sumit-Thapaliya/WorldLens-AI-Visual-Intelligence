/**
 * AppNavigator - WorldLens root flow.
 * Splash (boot) → Dashboard (feature hub) → Scanner / Find / Results / Settings.
 */

import React, { useState, useCallback } from 'react';
import { SplashScreen } from '../screens/SplashScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { FindObjectScreen } from '../screens/FindObjectScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type ScreenName = 'splash' | 'home' | 'scanner' | 'find' | 'result' | 'settings';

interface ResultParams {
  label: string;
  confidence: string;
  position: string;
  distance: string;
}

interface NavigatorState {
  currentScreen: ScreenName;
  findLabel: string | null;
  result: ResultParams | null;
}

export const AppNavigator: React.FC = () => {
  const [state, setState] = useState<NavigatorState>({
    currentScreen: 'splash',
    findLabel: null,
    result: null,
  });

  const navigate = useCallback((screen: ScreenName, params?: Partial<NavigatorState>) => {
    setState((prev) => ({ ...prev, currentScreen: screen, ...params }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      switch (prev.currentScreen) {
        case 'scanner':
          return { ...prev, currentScreen: 'home', findLabel: null };
        case 'find':
          return { ...prev, currentScreen: 'scanner' };
        case 'result':
          return { ...prev, currentScreen: 'scanner', result: null };
        case 'settings':
          return { ...prev, currentScreen: 'home' };
        default:
          return prev;
      }
    });
  }, []);

  switch (state.currentScreen) {
    case 'splash':
      return <SplashScreen onComplete={() => navigate('home')} />;

    case 'home':
      return (
        <DashboardScreen
          onStartScanning={() => navigate('scanner')}
          onFindObject={() => navigate('find')}
          onSettings={() => navigate('settings')}
          onFeature={(name) => {
            // For now: voice/scan/find/count/scene/settings — only a few wired.
            if (name === 'voice' || name === 'count' || name === 'scene') {
              navigate('scanner');
            }
          }}
        />
      );

    case 'scanner':
      return (
        <ScannerScreen
          initialFindLabel={state.findLabel}
          onBack={goBack}
          onOpenFind={() => navigate('find')}
          onResult={(result) => navigate('result', { result })}
        />
      );

    case 'find':
      return (
        <FindObjectScreen
          onBack={goBack}
          onStartSearch={(label) => navigate('scanner', { findLabel: label })}
        />
      );

    case 'result':
      return (
        <ResultsScreen
          result={
            state.result ?? {
              label: 'Object',
              // `confidence` is a display string everywhere (ResultsScreen renders it
              // directly, ScannerScreen sends "87%"). A bare 0 here was a type error.
              confidence: '—',
              position: 'center',
              distance: '~2 m',
            }
          }
          onBack={goBack}
          onTrack={goBack}
          onFindAgain={() => navigate('find')}
          onAskAI={goBack}
        />
      );

    case 'settings':
      return <SettingsScreen onBack={goBack} />;

    default:
      return null;
  }
};
