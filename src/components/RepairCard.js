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
import {
  HeroAvatar,
  HeroCard,
  HeroChip,
  HeroCloseButton,
  HeroSeparator,
  HeroSurface,
} from './HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, shadowSoft } from '../theme';
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

function getStatusMeta(statut, theme) {
  if (statut === 'pret') {
    return {
      label: 'Prêt à livrer',
      icon: 'checkmark-circle',
      color: theme.success,
      variant: 'flat',
    };
  }
  if (statut === 'non_repare') {
    return {
      label: 'Non réparé',
      icon: 'close-circle',
      color: theme.danger,
      variant: 'flat',
    };
  }
  if (statut === 'livre') {
    return {
      label: 'Remis au client',
      icon: 'bag-check',
      color: theme.muted,
      variant: 'bordered',
    };
  }
  return {
    label: 'En réparation',
    icon: 'construct',
    color: theme.accent,
    variant: 'solid',
  };
}

export default function RepairCard({
  fiche,
  onPress,
  onWhatsApp,
  onSms,
  onDelivered,
  onEdit,
  onDelete,
  busy = false,
}) {
  const { theme } = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const doneScale = useRef(new Animated.Value(1)).current;

  const statusMeta = getStatusMeta(fiche.statut, theme);
  const { total, paid, reste } = computeBalance(fiche.prix, fiche.avance);
  const isDelivered = fiche.statut === 'livre';
  const days = daysSince(fiche.created_at);

  const bounce = (anim, to) =>
    Animated.spring(anim, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();

  return (
    <HeroCard
      isPressable={Boolean(onPress)}
      onPress={onPress}
      style={styles.cardContainer}
    >
      {/* 1. CARD HEADER */}
      <HeroCard.Header style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <HeroAvatar
            uri={fiche.photo_url}
            name={fiche.client_nom}
            fallbackIcon={getDeviceIcon(fiche.appareil)}
            size={50}
            ringColor={statusMeta.color}
            statusColor={statusMeta.color}
            onPress={fiche.photo_url ? () => setViewerOpen(true) : undefined}
          />

          <View style={styles.headerTextGroup}>
            <View style={styles.nameRow}>
              <Text style={[styles.clientName, { color: theme.text }]} numberOfLines={1}>
                {fiche.client_nom}
              </Text>
              {days > 0 ? (
                <Text style={[styles.daysTag, { color: theme.muted }]}>
                  {days === 1 ? 'Hier' : `Il y a ${days} j`}
                </Text>
              ) : null}
            </View>

            <View style={styles.deviceRow}>
              <Ionicons
                name={getDeviceIcon(fiche.appareil)}
                size={14}
                color={theme.accent}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.deviceText, { color: theme.textSecondary }]} numberOfLines={1}>
                {fiche.appareil}
              </Text>
            </View>

            {fiche.client_tel ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  callCustomer(fiche.client_tel);
                }}
                hitSlop={6}
                style={styles.phonePill}
              >
                <Ionicons name="call" size={12} color={theme.whatsapp} />
                <Text style={[styles.phoneText, { color: theme.textSecondary }]}>
                  {fiche.client_tel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          <HeroChip
            label={statusMeta.label}
            icon={statusMeta.icon}
            color={statusMeta.color}
            variant={statusMeta.variant}
            pulse={fiche.statut === 'en_cours'}
            size="sm"
          />

          {onEdit ? (
            <Button
              size="sm"
              variant="tertiary"
              isIconOnly
              accessibilityLabel="Modifier"
              onPress={() => onEdit(fiche)}
              style={styles.editIconBtn}
            >
              <Ionicons name="pencil" size={14} color={theme.text} />
            </Button>
          ) : null}
        </View>
      </HeroCard.Header>

      <HeroSeparator style={{ marginVertical: 0 }} />

      {/* 2. CARD BODY */}
      <HeroCard.Body style={styles.cardBody}>
        {/* Diagnostic Surface */}
        <HeroSurface style={styles.diagnosticBox}>
          <View style={styles.diagnosticRow}>
            <View style={[styles.diagIconWrap, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="construct" size={14} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.diagLabel, { color: theme.muted }]}>
                PANNE / DIAGNOSTIC
              </Text>
              <Text style={[styles.diagValue, { color: theme.text }]}>
                {fiche.probleme || 'Aucune description détaillée'}
              </Text>
            </View>
          </View>
        </HeroSurface>

        {/* Financial Strip */}
        <View style={[styles.financeGrid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.financeCol}>
            <Text style={[styles.financeLabel, { color: theme.muted }]}>Total</Text>
            <Text style={[styles.financeTotal, { color: theme.accent }]}>
              {formatPrice(total)}
            </Text>
          </View>

          <View style={[styles.financeDivider, { backgroundColor: theme.border }]} />

          <View style={styles.financeCol}>
            <Text style={[styles.financeLabel, { color: theme.muted }]}>Avance</Text>
            <Text style={[styles.financePaid, { color: theme.whatsapp }]}>
              {formatPrice(paid)}
            </Text>
          </View>

          <View style={[styles.financeDivider, { backgroundColor: theme.border }]} />

          <View style={styles.financeCol}>
            <Text style={[styles.financeLabel, { color: theme.muted }]}>Reste</Text>
            <Text
              style={[
                styles.financeBalance,
                { color: total > 0 && reste === 0 ? theme.whatsapp : theme.danger },
              ]}
            >
              {total > 0 && reste === 0 ? 'Soldé' : formatPrice(reste)}
            </Text>
          </View>
        </View>
      </HeroCard.Body>

      {/* 3. CARD FOOTER */}
      <HeroCard.Footer style={styles.cardFooter}>
        <View style={styles.notifyRow}>
          <Button
            size="sm"
            title="WhatsApp"
            icon="logo-whatsapp"
            variant="whatsapp"
            feedbackVariant="scale-ripple"
            onPress={onWhatsApp}
            disabled={busy}
          />
          <View style={{ width: 10 }} />
          <Button
            size="sm"
            title="SMS Direct"
            icon="chatbubble-ellipses"
            variant="sms"
            feedbackVariant="scale-ripple"
            onPress={onSms}
            disabled={busy}
          />
        </View>

        <View style={styles.managementRow}>
          <Animated.View style={{ flex: 1, transform: [{ scale: doneScale }] }}>
            <Button
              size="sm"
              variant={isDelivered ? 'secondary' : 'outline'}
              icon={isDelivered ? 'bag-check' : 'checkmark-done-circle-outline'}
              title={
                isDelivered
                  ? 'Appareil récupéré (Remettre en cours)'
                  : 'Client a récupéré l’appareil'
              }
              onPress={() => onDelivered?.(fiche)}
              onPressIn={() => bounce(doneScale, 0.96)}
              onPressOut={() => bounce(doneScale, 1)}
              disabled={busy}
            />
          </Animated.View>

          {onDelete ? (
            <Button
              size="sm"
              variant="danger-soft"
              isIconOnly
              accessibilityLabel="Supprimer"
              onPress={() => onDelete(fiche)}
              disabled={busy}
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="trash-outline" size={17} color={theme.danger} />
            </Button>
          ) : null}
        </View>
      </HeroCard.Footer>

      {/* Fullscreen Photo Viewer */}
      {fiche.photo_url ? (
        <Modal
          visible={viewerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerOpen(false)}
        >
          <Pressable style={styles.modalBg} onPress={() => setViewerOpen(false)}>
            <View style={styles.modalCard}>
              <HeroCloseButton
                variant="overlay"
                size="lg"
                accessibilityLabel="Fermer l'image"
                onPress={() => setViewerOpen(false)}
                style={styles.modalCloseTop}
              />
              <Image
                source={{ uri: fiche.photo_url }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <Text style={styles.modalCaption}>
                {fiche.appareil} — {fiche.client_nom}
              </Text>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerTextGroup: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '900',
    flexShrink: 1,
  },
  daysTag: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  deviceText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  editIconBtn: {
    marginTop: 4,
  },
  cardBody: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  diagnosticBox: {
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  diagnosticRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  diagIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  diagLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  diagValue: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
  },
  financeGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  financeCol: {
    flex: 1,
    alignItems: 'center',
  },
  financeDivider: {
    width: 1,
    height: 26,
  },
  financeLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  financeTotal: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  financePaid: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  financeBalance: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  cardFooter: {
    paddingTop: 10,
  },
  notifyRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  managementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    alignItems: 'center',
  },
  modalCloseTop: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  modalImage: {
    width: '100%',
    height: 420,
    borderRadius: radius.lg,
  },
  modalCaption: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
});
