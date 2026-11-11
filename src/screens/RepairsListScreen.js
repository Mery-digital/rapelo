import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RepairCard from '../components/RepairCard';
import { colors, radius, shadowSoft } from '../theme';
import { updateRepairStatus } from '../lib/repairs';
import { readyMessage, openWhatsApp, openSms, digitsOnly } from '../lib/messaging';

export default function RepairsListScreen({
  atelier,
  repairs,
  loading,
  error,
  onRefresh,
  onUpdated,
  onRemoved,
}) {
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'en_cours' | 'pret'
  const [busyId, setBusyId] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const stats = useMemo(() => {
    const enCours = repairs.filter((r) => r.statut !== 'pret').length;
    const prets = repairs.filter((r) => r.statut === 'pret').length;
    return { total: repairs.length, enCours, prets };
  }, [repairs]);

  // Instant filter on status + customer name or phone number
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digitsOnly(q);
    return repairs.filter((r) => {
      if (filterStatus === 'en_cours' && r.statut === 'pret') return false;
      if (filterStatus === 'pret' && r.statut !== 'pret') return false;
      if (!q) return true;
      const byName = (r.client_nom || '').toLowerCase().includes(q);
      const byDevice = (r.appareil || '').toLowerCase().includes(q);
      const byPhone = qDigits.length > 0 && digitsOnly(r.client_tel).includes(qDigits);
      return byName || byDevice || byPhone;
    });
  }, [repairs, query, filterStatus]);

  const handleQueryChange = (text) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuery(text);
  };

  const handleFilterChange = (next) => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilterStatus(next);
  };

  const notifyReady = async (fiche, channel) => {
    const message = readyMessage({
      clientNom: fiche.client_nom,
      appareil: fiche.appareil,
      prix: fiche.prix_estime,
      atelier,
    });
    const opened =
      channel === 'whatsapp'
        ? await openWhatsApp(fiche.client_tel, message, atelier.indicatif)
        : await openSms(fiche.client_tel, message);

    if (opened && fiche.statut !== 'pret') {
      setBusyId(fiche.id);
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onUpdated(await updateRepairStatus(fiche.id, 'pret'));
      } catch {
        // Message already sent; status will be updated next time.
      } finally {
        setBusyId(null);
      }
    }
  };

  const markDelivered = (fiche) => {
    Alert.alert(
      'Appareil récupéré ?',
      `${fiche.client_nom} a bien récupéré son ${fiche.appareil} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, livré',
          onPress: async () => {
            setBusyId(fiche.id);
            try {
              await updateRepairStatus(fiche.id, 'livre');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onRemoved(fiche.id);
            } catch (e) {
              Alert.alert('Erreur', e?.message || 'Problème de connexion.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const searchScale = scrollY.interpolate({
    inputRange: [-40, 0, 90],
    outputRange: [1.02, 1, 0.97],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Animated Search Bar */}
      <Animated.View style={[styles.searchWrap, { transform: [{ scale: searchScale }] }]}>
        <Ionicons name="search" size={19} color={colors.accent} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Chercher un client, numéro ou appareil..."
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={handleQueryChange}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              handleQueryChange('');
            }}
            hitSlop={10}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        {/* Interactive Status Filter Pills */}
        <View style={styles.statsRow}>
          <StatPill
            label="Tous"
            count={stats.total}
            active={filterStatus === 'all'}
            color={colors.primary}
            onPress={() => handleFilterChange('all')}
          />
          <View style={{ width: 8 }} />
          <StatPill
            label="En réparation"
            count={stats.enCours}
            active={filterStatus === 'en_cours'}
            color={colors.accent}
            onPress={() => handleFilterChange('en_cours')}
          />
          <View style={{ width: 8 }} />
          <StatPill
            label="Prêts"
            count={stats.prets}
            active={filterStatus === 'pret'}
            color={colors.success}
            onPress={() => handleFilterChange('pret')}
          />
        </View>

        {loading && repairs.length === 0 ? (
          <ActivityIndicator size="large" color={colors.sms} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
            <Text style={styles.emptyTitle}>Chargement impossible</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable onPress={onRefresh} style={styles.retry}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={query ? 'search-outline' : 'construct-outline'}
                size={34}
                color={colors.accent}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {query ? 'Aucun appareil trouvé' : 'Aucun appareil en cours'}
            </Text>
            <Text style={styles.emptyText}>
              {query
                ? 'Essaie avec un autre nom, numéro ou modèle.'
                : 'Touche l’onglet « Nouveau dépôt » pour enregistrer un téléphone, PC, TV ou autre appareil.'}
            </Text>
          </View>
        ) : (
          filtered.map((fiche, idx) => (
            <RepairCard
              key={fiche.id}
              fiche={fiche}
              index={idx}
              busy={busyId === fiche.id}
              onWhatsApp={() => notifyReady(fiche, 'whatsapp')}
              onSms={() => notifyReady(fiche, 'sms')}
              onDelivered={() => markDelivered(fiche)}
            />
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

function StatPill({ label, count, active, color, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => bounce(0.93)}
        onPressOut={() => bounce(1)}
        style={[
          styles.statPill,
          active && { backgroundColor: color, borderColor: color },
        ]}
      >
        <Text style={[styles.statCount, active && { color: '#FFFFFF' }]}>{count}</Text>
        <Text
          style={[styles.statLabel, active && { color: 'rgba(255,255,255,0.9)' }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadowSoft,
  },
  search: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 12, color: colors.text },
  clearBtn: { padding: 4 },
  scroll: { padding: 16, paddingBottom: 48 },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  statPill: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadowSoft,
  },
  statCount: { fontSize: 18, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 46, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  retry: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 11,
    backgroundColor: colors.sms,
    borderRadius: radius.md,
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
