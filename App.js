import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SetupScreen from './src/screens/SetupScreen';
import MainScreen from './src/screens/MainScreen';
import { loadAtelier } from './src/services/storageService';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ToastProvider } from './src/components/HeroUI';

function AppContent() {
  const { theme, isDark } = useTheme();
  const [booting, setBooting] = useState(true);
  const [savedAtelier, setSavedAtelier] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    loadAtelier().then((profile) => {
      setSavedAtelier(profile);
      setBooting(false);
    });
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
  },
});
