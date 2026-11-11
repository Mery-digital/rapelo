import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Button from './Button';
import { colors, radius, shadow } from '../theme';
import { formatPrice, formatDate } from '../lib/messaging';

/** Pick a fitting Ionicon based on the device name (phone, PC, TV, console, etc.) */
function getDeviceIcon(appareil = '') {
  const s = appareil.toLowerCase();
  if (s.includes('pc') || s.includes('hp') || s.includes('dell') || s.includes('mac') || s.includes('lenovo') || s.includes('ordinateur') || s.includes('laptop')) {
    return 'laptop-outline';
  }
  if (s.includes('tv') || s.includes('télé') || s.includes('tele') || s.includes('écran') || s.includes('ecran')) {
    return 'tv-outline';
  }
  if (s.includes('ps4') || s.includes('ps5') || s.includes('xbox') || s.includes('switch') || s.includes('console')) {
    return 'game-controller-outline';
  }
  if (s.includes('ipad') || s.includes('tab') || s.includes('tablette')) {
    return 'tablet-portrait-outline';
  }
  if (s.includes('jbl') || s.includes('baffe') || s.includes('ampli') || s.includes('enceinte') || s.includes('radio')) {
    return 'volume-high-outline';
  }
  if (s.includes('micro') || s.includes('ventil') || s.includes('fer') || s.includes('frigo') || s.includes('clim')) {
    return 'flash-outline';
  }
  return 'hardware-chip-outline';
}

export default function RepairCard({
  fiche,
  index = 0,
  onWhatsApp,
  onSms,
  onDelivered,
  busy,
}) {
  const isReady = fiche.statut === 'pret';
  const [viewerOpen, setViewerOpen] = useState(false);

  // Staggered entrance animation when cards appear / scroll into view
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(26)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const doneScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index, 6) * 60;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }),
    ]).start();
  }, [fade, slide, index]);

  const bounce = (anim, toValue) =>
    Animated.spring(anim, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fade,
          transform: [{ translateY: slide }, { scale: cardScale }],
        },
      ]}
    >
      {/* Top row: thumbnail + customer + status badge */}
      <View style={styles.headerRow}>
        {fiche.photo_url ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setViewerOpen(true);
            }}
            onPressIn={() => bounce(cardScale, 0.97)}
            onPressOut={() => bounce(cardScale, 1)}
            style={styles.thumbWrap}
          >
            <Image source={{ uri: fiche.photo_url }} style={styles.thumb} />
            <View style={styles.zoomBadge}>
              <Ionicons name="expand" size={11} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : (
          <View style={styles.noThumb}>
            <Ionicons
              name={getDeviceIcon(fiche.appareil)}
              size={26}
              color={colors.accent}
            />
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {fiche.client_nom}
            </Text>
          </View>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={13} color={colors.muted} />
            <Text style={styles.phone}>{fiche.client_tel}</Text>
          </View>
          <View style={[styles.badge, isReady ? styles.badgeReady : styles.badgeWip]}>
            <Ionicons
              name={isReady ? 'checkmark-circle' : 'time-outline'}
              size={13}
              color={isReady ? colors.success : colors.sms}
            />
            <Text
              style={[
                styles.badgeText,
                { color: isReady ? colors.success : colors.sms },
              ]}
            >
              {isReady ? 'Client prévenu (Prêt)' : 'En cours de réparation'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Device details box */}
      <View style={styles.infoBox}>
        <InfoRow
          icon={getDeviceIcon(fiche.appareil)}
          label="Appareil"
          value={fiche.appareil}
          bold
        />
        <InfoRow
          icon="construct-outline"
          label="Panne"
          value={fiche.probleme}
        />
        <InfoRow
          icon="cash-outline"
          label="Montant"
          value={formatPrice(fiche.prix_estime)}
          bold
          highlight
        />
        <InfoRow
          icon="calendar-outline"
          label="Déposé"
          value={formatDate(fiche.created_at)}
          last
        />
      </View>

      <Text style={styles.actionTitle}>
        Appareil terminé ? Préviens le client en un clic :
      </Text>
      <View style={styles.actions}>
        <Button
          small
          title="WhatsApp"
          icon="logo-whatsapp"
          variant="whatsapp"
          onPress={onWhatsApp}
          disabled={busy}
        />
        <View style={{ width: 10 }} />
        <Button
          small
          title="SMS Direct"
          icon="chatbubble-ellipses"
          variant="sms"
          onPress={onSms}
          disabled={busy}
        />
      </View>

      <Animated.View style={{ transform: [{ scale: doneScale }] }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onDelivered?.();
          }}
          onPressIn={() => bounce(doneScale, 0.96)}
          onPressOut={() => bounce(doneScale, 1)}
          disabled={busy}
          style={styles.deliveredBtn}
        >
          <Ionicons name="checkmark-done-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.deliveredText}>
            Le client a récupéré son appareil
          </Text>
        </Pressable>
      </Animated.View>

      {/* Fullscreen photo viewer */}
      {fiche.photo_url ? (
        <Modal
          visible={viewerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerOpen(false)}
        >
          <Pressable style={styles.modalBg} onPress={() => setViewerOpen(false)}>
            <View style={styles.modalCard}>
              <Image
                source={{ uri: fiche.photo_url }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <Text style={styles.modalCaption}>
                {fiche.appareil} — {fiche.client_nom}
              </Text>
              <Pressable onPress={() => setViewerOpen(false)} style={styles.modalClose}>
                <Ionicons name="close-circle" size={18} color={colors.primary} />
                <Text style={styles.modalCloseText}>Fermer l'image</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </Animated.View>
  );
}

function InfoRow({ icon, label, value, bold, highlight, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowLabelWrap}>
        <Ionicons name={icon} size={15} color={colors.muted} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.rowValue,
          bold && styles.rowBold,
          highlight && { color: colors.accent },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  thumb: { width: '100%', height: '100%' },
  zoomBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 99,
    padding: 4,
  },
  noThumb: {
    width: 66,
    height: 66,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  phone: { fontSize: 13, fontWeight: '600', color: colors.muted, marginLeft: 5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 7,
  },
  badgeWip: { backgroundColor: colors.badgeBlue },
  badgeReady: { backgroundColor: colors.badgeGreen },
  badgeText: { fontSize: 12, fontWeight: '800', marginLeft: 5 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E8EEF6',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF6',
  },
  rowLabelWrap: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 13, fontWeight: '600', color: colors.muted, marginLeft: 6 },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  rowBold: { fontWeight: '800', fontSize: 15 },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    marginTop: 12,
    marginBottom: 8,
  },
  actions: { flexDirection: 'row' },
  deliveredBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deliveredText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
    marginLeft: 6,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', alignItems: 'center' },
  modalImage: { width: '100%', height: 420, borderRadius: radius.lg },
  modalCaption: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 14 },
  modalClose: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
});
