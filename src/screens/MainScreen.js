import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NewRepairScreen from './NewRepairScreen';
import RepairsListScreen from './RepairsListScreen';
import { colors, radius, shadowSoft } from '../theme';
import { fetchRepairs, isDemoMode } from '../lib/repairs';
import { digitsOnly } from '../lib/messaging';

export default function MainScreen({ atelier, onLogout }) {
  const [tab, setTab] = useState('list'); // 'new' | 'list'
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tabFade = useRef(new Animated.Value(1)).current;
  const tabSlide = useRef(new Animated.Value(0)).current;

  const switchTab = (nextTab) => {
    if (nextTab === tab) return;
    Haptics.selectionAsync().catch(() => {});
    tabFade.setValue(0.3);
    tabSlide.setValue(nextTab === 'new' ? 14 : -14);
    setTab(nextTab);
    Animated.parallel([
      Animated.timing(tabFade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(tabSlide, {
        toValue: 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 8,
      }),
    ]).start();
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRepairs(await fetchRepairs(digitsOnly(atelier.phone)));
    } catch (e) {
      setError(e?.message || 'Problème de connexion.');
    } finally {
      setLoading(false);
    }
  }, [atelier.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = (fiche) => {
    setRepairs((list) => [fiche, ...list]);
    switchTab('list');
  };
  const handleUpdated = (fiche) =>
    setRepairs((list) => list.map((r) => (r.id === fiche.id ? fiche : r)));
  const handleRemoved = (id) => setRepairs((list) => list.filter((r) => r.id !== id));

  const confirmLogout = () =>
    Alert.alert('Se déconnecter ?', '', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: onLogout },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0F172A', '#1E3A8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.brandBadge}>
          <Image
            source={require('../../assets/logo.jpg')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.atelier} numberOfLines={1}>
            {atelier.atelierNom}
          </Text>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color="#93C5FD" />
            <Text style={styles.location} numberOfLines={1}>
              {atelier.localisation} · {atelier.phone}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            confirmLogout();
          }}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
          <Text style={styles.logoutText}>Sortir</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.body}>
        {isDemoMode && (
          <View style={styles.demo}>
            <Ionicons name="phone-portrait-outline" size={14} color="#92400E" />
            <Text style={styles.demoText}>
              Mode local : fiches, photos, WhatsApp et SMS actifs sur ce téléphone.
            </Text>
          </View>
        )}

        <View style={styles.tabs}>
          <Tab
            icon="layers-outline"
            label={`Appareils (${repairs.length})`}
            active={tab === 'list'}
            onPress={() => switchTab('list')}
          />
          <Tab
            icon="add-circle-outline"
            label="Nouveau dépôt"
            active={tab === 'new'}
            onPress={() => switchTab('new')}
          />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Animated.View
            style={[
              styles.flex,
              { opacity: tabFade, transform: [{ translateX: tabSlide }] },
              tab !== 'list' && styles.hidden,
            ]}
          >
            <RepairsListScreen
              atelier={atelier}
              repairs={repairs}
              loading={loading}
              error={error}
              onRefresh={load}
              onUpdated={handleUpdated}
              onRemoved={handleRemoved}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.flex,
              { opacity: tabFade, transform: [{ translateX: tabSlide }] },
              tab !== 'new' && styles.hidden,
            ]}
          >
            <NewRepairScreen atelier={atelier} onCreated={handleCreated} />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

function Tab({ icon, label, active, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();

  return (
    <Animated.View style={[styles.tabWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => bounce(0.94)}
        onPressOut={() => bounce(1)}
        style={[styles.tab, active && styles.tabActive]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={active ? '#FFFFFF' : colors.muted}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  body: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  hidden: { display: 'none' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  brandBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    padding: 3,
    overflow: 'hidden',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  atelier: { color: '#fff', fontSize: 18, fontWeight: '800' },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  location: { color: '#CBD5E1', fontSize: 12, marginLeft: 4 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  demoText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: radius.md,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowSoft,
  },
  tabWrap: { flex: 1 },
  tab: {
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '800', color: colors.muted },
  tabTextActive: { color: '#fff' },
});
