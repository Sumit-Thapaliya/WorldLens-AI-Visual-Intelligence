/**
 * WorldLens - AI Reality Scanner
 * Entry point for the React Native application.
 *
 * The app uses a custom navigator to avoid a hard dependency on React Navigation
 * for this demo build; swap AppNavigator for a @react-navigation/native stack
 * in production.
 */

import React from 'react';
import { StatusBar, View, StyleSheet, Text } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';

interface AppState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, AppState> {
  state: AppState = { hasError: false };

  static getDerivedStateFromError(error: Error): AppState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('WorldLens error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <AppNavigator />
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06090d',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default App;
