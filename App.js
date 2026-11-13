import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SetupScreen from './src/screens/SetupScreen';
import MainScreen from './src/screens/MainScreen';
import { loadAtelier } from './src/lib/storage';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ToastProvider } from './src/components/HeroUI';

function AppContent() {
  const { theme, isDark } = useTheme();
  const [booting, setBooting] = useState(true);
  const [savedAtelier, setSavedAtelier] = useState(null); // stored on the phone
  const [session, setSession] = useState(null); // logged-in workshop

  useEffect(() => {
    loadAtelier().then((profile) => {
      setSavedAtelier(profile);
      setBooting(false);
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (typeof document !== 'undefined' && !document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
      }
    }
  }, []);

  if (booting) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#09090B' : '#E4E4E7' }]}>
      <View
        style={[
          styles.mobileContainer,
          {
            backgroundColor: theme.bg,
            borderColor: isDark ? '#27272A' : '#D4D4D8',
          },
        ]}
      >
        <StatusBar style={session ? 'light' : isDark ? 'light' : 'dark'} />

        {session ? (
          <MainScreen
            atelier={session}
            onAtelierUpdated={(updatedProfile) => {
              setSavedAtelier(updatedProfile);
              setSession(updatedProfile);
            }}
            onLogout={() => setSession(null)}
          />
        ) : (
          <SetupScreen
            key={savedAtelier ? 'login' : 'setup'}
            mode={savedAtelier ? 'login' : 'setup'}
            savedAtelier={savedAtelier}
            onDone={(profile) => {
              setSavedAtelier(profile);
              setSession(profile);
            }}
            onReset={() => setSavedAtelier(null)}
          />
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    height: '100%',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        shadowColor: '#000000',
        shadowOpacity: 0.16,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 6 },
      },
      default: {},
    }),
  },
});
