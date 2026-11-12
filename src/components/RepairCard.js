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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Button from './Button';
import { colors, radius, shadow } from '../theme';
import {
  formatPrice,
  formatDate,
  daysSince,
  computeBalance,
  callCustomer,
} from '../lib/messaging';

/** Pick a fitting Ionicon based on the device name (phone, PC, TV, console, etc.) */
function getDeviceIcon(appareil = '') {
  const s = appareil.toLowerCase();
  if (
    s.includes('pc') ||
    s.includes('hp') ||
    s.includes('dell') ||
    s.includes('mac') ||
    s.includes('lenovo') ||
    s.includes('ordinateur') ||
    s.includes('laptop')
  ) {
    return 'laptop-outline';
  }
  if (
    s.includes('tv') ||
    s.includes('télé') ||
    s.includes('tele') ||
    s.includes('écran') ||
    s.includes('ecran')
  ) {
    return 'tv-outline';
  }
  if (
    s.includes('ps4') ||
    s.includes('ps5') ||
    s.includes('xbox') ||
    s.includes('switch') ||
    s.includes('console')
  ) {
    return 'game-controller-outline';
  }
  if (s.includes('ipad') || s.includes('tab') || s.includes('tablette')) {
    return 'tablet-portrait-outline';
  }
  if (
    s.includes('jbl') ||
    s.includes('baffe') ||
    s.includes('ampli') ||
    s.includes('enceinte') ||
    s.includes('radio')
  ) {
    return 'volume-high-outline';
  }
  if (
    s.includes('micro') ||
    s.includes('ventil') ||
    s.includes('fer') ||
    s.includes('frigo') ||
    s.includes('clim')
  ) {
    return 'flash-outline';
  }
  return 'phone-portrait-outline';
}

function getStatusMeta(statut) {
  if (statut === 'pret') {
    return {
      label: 'Réparé · Prêt à récupérer',
      icon: 'checkmark-circle',
      fg: colors.success,
      bg: colors.badgeGreen,
    };
  }
  if (statut === 'non_repare') {
    return {
      label: 'Non réparé · À récupérer',
      icon: 'close-circle',
      fg: colors.dangerDark || colors.danger,
      bg: colors.badgeRed || colors.dangerSoft,
    };
  }
  if (statut === 'livre') {
    return {
      label: 'Récupéré par le client',
      icon: 'bag-check-outline',
      fg: colors.textSecondary,
      bg: '#E2E8F0',
    };
  }
  return {
    label: 'En cours de réparation',
    icon: 'time-outline',
    fg: colors.sms,
    bg: colors.badgeBlue,
  };
}

export default function RepairCard({
  fiche,
  index = 0,
  onWhatsApp,
  onSms,
  onUnrepaired,
  onReminder,
  onDelivered,
  onEdit,
  onDelete,
  busy,
}) {
  const statusMeta = getStatusMeta(fiche.statut);
  const isDelivered = fiche.statut === 'livre';
  const isWaitingPickup =
    fiche.statut === 'pret' || fiche.statut === 'non_repare';
  const waitDays = daysSince(fiche.pret_le || fiche.created_at);
  const { total, paid, reste } = computeBalance(
    fiche.prix_estime,
    fiche.avance_payee
  );
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
      {/* Top row: thumbnail + customer + status badge + Edit/Delete buttons */}
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
            <View style={styles.cardActionsTop}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onEdit?.(fiche);
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.iconActionBtn,
                  styles.editActionBtn,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="create-outline" size={15} color={colors.accent} />
                <Text style={styles.editActionText}>Modifier</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  onDelete?.(fiche);
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.iconActionBtn,
                  styles.deleteActionBtn,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              callCustomer(fiche.client_tel);
            }}
            style={({ pressed }) => [
              styles.phoneRow,
              pressed && { opacity: 0.72 },
            ]}
          >
            <Ionicons name="call" size={13} color={colors.success} />
            <Text style={styles.phone}>{fiche.client_tel}</Text>
            <View style={styles.callBadge}>
              <Ionicons name="call-outline" size={11} color="#FFFFFF" />
              <Text style={styles.callBadgeText}>Appeler</Text>
            </View>
          </Pressable>

          <View style={styles.statusBadgesRow}>
            <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
              <Ionicons name={statusMeta.icon} size={13} color={statusMeta.fg} />
              <Text style={[styles.badgeText, { color: statusMeta.fg }]}>
                {statusMeta.label}
              </Text>
            </View>
            {!isDelivered && waitDays >= 1 ? (
              <View
                style={[
                  styles.waitBadge,
                  waitDays >= 5 && styles.waitBadgeUrgent,
                ]}
              >
                <Ionicons
                  name="hourglass-outline"
                  size={11}
                  color={waitDays >= 5 ? colors.danger : colors.warningDark}
                />
                <Text
                  style={[
                    styles.waitBadgeText,
                    { color: waitDays >= 5 ? colors.danger : colors.warningDark },
                  ]}
                >
                  {waitDays} j
                </Text>
              </View>
            ) : null}
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
          label="Total"
          value={formatPrice(total)}
          bold
          highlight
        />
        {paid > 0 ? (
          <InfoRow
            icon="wallet-outline"
            label="Avance"
            value={formatPrice(paid)}
            valueColor={colors.success}
            bold
          />
        ) : null}
        {total > 0 ? (
          <InfoRow
            icon="card-outline"
            label="Reste à payer"
            value={reste === 0 ? 'Soldé (0 FCFA)' : formatPrice(reste)}
            valueColor={reste === 0 ? colors.success : colors.danger}
            bold
          />
        ) : null}
        <InfoRow
          icon="calendar-outline"
          label="Déposé"
          value={formatDate(fiche.created_at)}
          last
        />
      </View>

      <Text style={styles.actionTitle}>
        Prévenir {fiche.client_nom} :
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

      {/* Bottom row: Delivered + Delete */}
      <View style={styles.bottomActionsRow}>
        <Animated.View style={{ flex: 1, transform: [{ scale: doneScale }] }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onDelivered?.(fiche);
            }}
            onPressIn={() => bounce(doneScale, 0.96)}
            onPressOut={() => bounce(doneScale, 1)}
            disabled={busy}
            style={[
              styles.deliveredBtn,
              isDelivered && styles.deliveredBtnDone,
            ]}
          >
            <Ionicons
              name={isDelivered ? 'bag-check' : 'checkmark-done-circle-outline'}
              size={18}
              color={isDelivered ? colors.success : colors.textSecondary}
            />
            <Text
              style={[
                styles.deliveredText,
                isDelivered && { color: colors.success },
              ]}
            >
              {isDelivered
                ? 'Appareil récupéré (Remettre en atelier)'
                : 'Le client a récupéré son appareil'}
            </Text>
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onDelete?.(fiche);
          }}
          disabled={busy}
          style={({ pressed }) => [
            styles.deleteCardBtn,
            pressed && { opacity: 0.78 },
          ]}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteCardBtnText}>Supprimer</Text>
        </Pressable>
      </View>

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

function InfoRow({ icon, label, value, bold, highlight, valueColor, last }) {
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
          valueColor && { color: valueColor },
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text, marginRight: 6 },
  cardActionsTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  editActionBtn: {
    backgroundColor: colors.accentSoft,
    borderColor: '#BFDBFE',
    marginRight: 6,
  },
  editActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    marginLeft: 3,
  },
  deleteActionBtn: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECACA',
    paddingHorizontal: 7,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  phone: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginLeft: 5 },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 8,
  },
  callBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 3,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 7,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  waitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  waitBadgeUrgent: {
    backgroundColor: colors.dangerSoft,
  },
  waitBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 3,
  },
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
  unrepairedBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF1F2',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  unrepairedBtnActive: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FB7185',
  },
  unrepairedBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.dangerDark || colors.danger,
    marginLeft: 6,
  },
  reminderBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reminderBtnHighlight: {
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  reminderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.warningDark || '#B45309',
    marginLeft: 6,
  },
  bottomActionsRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deliveredBtnDone: {
    backgroundColor: colors.badgeGreen,
    borderColor: '#BBF7D0',
  },
  deliveredText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    marginLeft: 6,
  },
  deleteCardBtn: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteCardBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 4,
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
