import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SetupScreen from './src/screens/SetupScreen';
import MainScreen from './src/screens/MainScreen';
import { loadAtelier } from './src/lib/storage';
import { colors } from './src/theme';

export default function App() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.sms} />
      </View>
    );
  }

  if (session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <MainScreen
          atelier={session}
          onAtelierUpdated={(updatedProfile) => {
            setSavedAtelier(updatedProfile);
            setSession(updatedProfile);
          }}
          onLogout={() => setSession(null)}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
