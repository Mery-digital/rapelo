import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RepairsListScreen from './RepairsListScreen';
import NewRepairScreen from './NewRepairScreen';
import WorkshopScreen from './WorkshopScreen';
import RepairDetailScreen from './RepairDetailScreen';
import BottomTabBar from '../components/BottomTabBar';
import {
  NavigationProvider,
  useNavigation,
} from '../context/NavigationContext';
import { useTheme } from '../context/ThemeContext';
import { fetchRepairs, isDemoMode } from '../lib/repairs';
import { digitsOnly, formatPhoneDisplay } from '../lib/messaging';

function MainScreenContent({ atelier, onAtelierUpdated, onLogout }) {
  const { theme, isDark } = useTheme();
  const { currentRoute, activeTab, switchTab, navigate, slideAnim } = useNavigation();

  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRepairs(atelier.phone);
      setRepairs(data);
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement des réparations');
    } finally {
      setLoading(false);
    }
  }, [atelier.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = (item) => {
    setRepairs((prev) => [item, ...prev]);
    switchTab('repairs');
  };

  const handleUpdated = (item) => {
    setRepairs((prev) => prev.map((f) => (f.id === item.id ? item : f)));
  };

  const handleRemoved = (id) => {
    setRepairs((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRemovedMany = (ids = []) => {
    setRepairs((prev) => prev.filter((f) => !ids.includes(f.id)));
  };

  const activeCount = repairs.filter((r) => r.statut !== 'livre').length;

  // Detail screen slide-in translation
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 320],
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      {/* 1. TOP NATIVE APP BAR (si sur tabs) */}
      {currentRoute.name === 'tabs' ? (
        <LinearGradient
          colors={isDark ? ['#09090B', '#18181B'] : ['#0B1120', '#1E3A8A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerBrand}>
            <Image
              source={require('../../assets/logo.jpg')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.statusRow}>
              <View style={styles.liveDot} />
              <Text style={styles.statusLabel}>ATELIER CONNECTÉ</Text>
            </View>
            <Text style={styles.atelierName} numberOfLines={1}>
              {atelier.atelierNom}
            </Text>
            <Text style={styles.atelierSub} numberOfLines={1}>
              {atelier.localisation} · {formatPhoneDisplay(atelier.phone, atelier.indicatif)}
            </Text>
          </View>
        </LinearGradient>
      ) : null}

      {/* 2. BODY CONTENT (STACK OU TABS) */}
      <View style={styles.body}>
        {isDemoMode && currentRoute.name === 'tabs' && (
          <View style={[styles.demoBanner, { backgroundColor: theme.warningSoft }]}>
            <Ionicons name="phone-portrait-outline" size={14} color={theme.warningDark} />
            <Text style={[styles.demoText, { color: theme.warningDark }]}>
              Mode local actif sur ce téléphone (WhatsApp & SMS opérationnels).
            </Text>
          </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {currentRoute.name === 'detail' ? (
            <Animated.View style={[styles.flex, { transform: [{ translateX }] }]}>
              <RepairDetailScreen
                atelier={atelier}
                fiche={currentRoute.params.fiche}
                onUpdated={handleUpdated}
                onRemoved={handleRemoved}
              />
            </Animated.View>
          ) : (
            <>
              {activeTab === 'repairs' ? (
                <RepairsListScreen
                  atelier={atelier}
                  repairs={repairs}
                  loading={loading}
                  error={error}
                  onRefresh={load}
                  onUpdated={handleUpdated}
                  onRemoved={handleRemoved}
                  onRemovedMany={handleRemovedMany}
                  onSelectRepair={(fiche) => navigate('detail', { fiche })}
                />
              ) : activeTab === 'new' ? (
                <NewRepairScreen atelier={atelier} onCreated={handleCreated} />
              ) : (
                <WorkshopScreen
                  atelier={atelier}
                  repairs={repairs}
                  onAtelierUpdated={onAtelierUpdated}
                  onLogout={onLogout}
                />
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </View>

      {/* 3. NATIVE BOTTOM TAB BAR (uniquement visible sur les tabs racine) */}
      {currentRoute.name === 'tabs' ? (
        <BottomTabBar activeCount={activeCount} />
      ) : null}
    </SafeAreaView>
  );
}

export default function MainScreen(props) {
  return (
    <NavigationProvider initialTab="repairs">
      <MainScreenContent {...props} />
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBrand: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    padding: 3,
    overflow: 'hidden',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#93C5FD',
    letterSpacing: 0.5,
  },
  atelierName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  atelierSub: {
    fontSize: 11,
    color: '#93C5FD',
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  demoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
});
