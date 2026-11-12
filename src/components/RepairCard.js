import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
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
      shortStage: 'Tests OK · Prêt',
      icon: 'checkmark-circle',
      fg: colors.success,
      bg: colors.badgeGreen,
      accent: '#16A34A',
      step: 3,
    };
  }
  if (statut === 'non_repare') {
    return {
      label: 'Non réparé · À récupérer',
      shortStage: 'Non réparé',
      icon: 'close-circle',
      fg: colors.dangerDark || colors.danger,
      bg: colors.badgeRed || colors.dangerSoft,
      accent: '#EF4444',
      step: 3,
    };
  }
  if (statut === 'livre') {
    return {
      label: 'Récupéré par le client',
      shortStage: 'Remis au client',
      icon: 'bag-check-outline',
      fg: colors.textSecondary,
      bg: '#E2E8F0',
      accent: '#64748B',
      step: 3,
    };
  }
  return {
    label: 'Sur le banc de réparation',
    shortStage: 'En cours',
    icon: 'construct',
    fg: colors.sms,
    bg: colors.badgeBlue,
    accent: '#2563EB',
    step: 2,
  };
}

export default function RepairCard({
  fiche,
  index = 0,
  onWhatsApp,
  onSms,
  onDelivered,
  onEdit,
  onDelete,
  busy,
}) {
  const statusMeta = getStatusMeta(fiche.statut);
  const isDelivered = fiche.statut === 'livre';
  const isInProgress = fiche.statut === 'en_cours' || !fiche.statut;
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

  // Live workshop animations (pulsing LED + animated tool when repairing)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toolAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (isDelivered) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    let toolLoop;
    if (isInProgress) {
      toolLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(toolAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(toolAnim, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      toolLoop.start();
    }

    return () => {
      pulseLoop.stop();
      toolLoop?.stop();
    };
  }, [isDelivered, isInProgress, pulseAnim, toolAnim]);

  const toolRotate = toolAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-14deg', '14deg'],
  });

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
      {/* Bande supérieure colorée selon l'état de l'atelier */}
      <View
        style={[styles.topAccentStrip, { backgroundColor: statusMeta.accent }]}
      />

      <View style={styles.cardInner}>
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
            <View
              style={[
                styles.noThumb,
                { borderColor: `${statusMeta.accent}33` },
              ]}
            >
              <Ionicons
                name={getDeviceIcon(fiche.appareil)}
                size={26}
                color={statusMeta.accent}
              />
              <View
                style={[
                  styles.noThumbCorner,
                  { backgroundColor: statusMeta.accent },
                ]}
              >
                <Ionicons name="construct" size={9} color="#FFFFFF" />
              </View>
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
                  <Ionicons name="create-outline" size={14} color={colors.accent} />
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
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
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
                {!isDelivered ? (
                  <Animated.View
                    style={[
                      styles.statusPulseDot,
                      {
                        backgroundColor: statusMeta.fg,
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  />
                ) : null}
                <Animated.View
                  style={
                    isInProgress
                      ? { transform: [{ rotate: toolRotate }] }
                      : undefined
                  }
                >
                  <Ionicons name={statusMeta.icon} size={13} color={statusMeta.fg} />
                </Animated.View>
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

        {/* BARRE DE PROGRESSION VISUELLE DE L'ATELIER (3 ÉTAPES) */}
        <WorkshopProgressSteps statut={fiche.statut} accent={statusMeta.accent} />

        {/* FICHE TECHNIQUE : APPAREIL & DIAGNOSTIC PANNE */}
        <View style={styles.techDiagnosticBox}>
          <View style={styles.techRow}>
            <View style={styles.techIconBadge}>
              <Ionicons
                name={getDeviceIcon(fiche.appareil)}
                size={16}
                color={colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.techLabel}>APPAREIL DÉPOSÉ</Text>
              <Text style={styles.techDeviceValue}>{fiche.appareil}</Text>
            </View>
            <View style={styles.datePill}>
              <Ionicons name="calendar-outline" size={11} color={colors.muted} />
              <Text style={styles.datePillText}>{formatDate(fiche.created_at)}</Text>
            </View>
          </View>

          <View style={styles.techDivider} />

          <View style={styles.techRow}>
            <View style={[styles.techIconBadge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="construct" size={15} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.techLabel}>DIAGNOSTIC / PANNE SIGNALÉE</Text>
              <Text style={styles.techProblemValue}>{fiche.probleme}</Text>
            </View>
          </View>
        </View>

        {/* BANDEAU FINANCIER EN 3 COLONNES : TOTAL · AVANCE · RESTE À PAYER */}
        <View style={styles.financeStrip}>
          <View style={styles.financeCol}>
            <Text style={styles.financeLabel}>Total réparation</Text>
            <Text style={styles.financeTotal}>{formatPrice(total)}</Text>
          </View>
          <View style={styles.financeSep} />
          <View style={styles.financeCol}>
            <Text style={styles.financeLabel}>Avance payée</Text>
            <Text style={[styles.financeVal, { color: colors.success }]}>
              {formatPrice(paid)}
            </Text>
          </View>
          <View style={styles.financeSep} />
          <View style={styles.financeCol}>
            <Text style={styles.financeLabel}>Reste à payer</Text>
            <Text
              style={[
                styles.financeVal,
                {
                  color:
                    total > 0 && reste === 0 ? colors.success : colors.danger,
                },
              ]}
            >
              {total > 0 && reste === 0 ? 'Soldé (0 FCFA)' : formatPrice(reste)}
            </Text>
          </View>
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

/**
 * Barre de progression d'atelier en 3 étapes :
 * 1. Réception & Diagnostic -> 2. Banc de réparation -> 3. Prêt / Récupéré
 */
function WorkshopProgressSteps({ statut, accent }) {
  const isUnrepaired = statut === 'non_repare';
  const isReady = statut === 'pret';
  const isDelivered = statut === 'livre';
  const step3Reached = isReady || isUnrepaired || isDelivered;

  const steps = [
    {
      num: 1,
      label: 'Diagnostic',
      icon: 'hardware-chip-outline',
      done: true,
      color: colors.accent,
    },
    {
      num: 2,
      label: 'Banc réparation',
      icon: 'construct-outline',
      done: true,
      active: !step3Reached,
      color: accent,
    },
    {
      num: 3,
      label: isDelivered
        ? 'Remis au client'
        : isUnrepaired
        ? 'Non réparé'
        : 'Prêt à livrer',
      icon: isUnrepaired
        ? 'close-circle-outline'
        : isDelivered
        ? 'bag-check-outline'
        : 'checkmark-done-circle-outline',
      done: step3Reached,
      active: step3Reached,
      color: step3Reached ? accent : '#94A3B8',
    },
  ];

  return (
    <View style={styles.stepsContainer}>
      {steps.map((s, idx) => (
        <React.Fragment key={s.num}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                s.done
                  ? { backgroundColor: s.color, borderColor: s.color }
                  : { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={12}
                color={s.done ? '#FFFFFF' : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.stepLabel,
                s.done && { color: colors.text, fontWeight: '800' },
                s.active && { color: s.color, fontWeight: '900' },
              ]}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </View>
          {idx < steps.length - 1 ? (
            <View
              style={[
                styles.stepLine,
                idx === 0 || step3Reached
                  ? { backgroundColor: accent }
                  : { backgroundColor: '#CBD5E1' },
              ]}
            />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...shadow,
  },
  topAccentStrip: {
    height: 5,
    width: '100%',
  },
  cardInner: {
    padding: 15,
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noThumbCorner: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
  statusPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
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

  // Workshop 3-step bar
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    borderRadius: 2,
  },

  // Technical Diagnostic Box
  techDiagnosticBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  techLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.5,
  },
  techDeviceValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 1,
  },
  techProblemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 1,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  datePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginLeft: 4,
  },
  techDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },

  // 3-Column Financial Strip
  financeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginTop: 9,
  },
  financeCol: {
    flex: 1,
    alignItems: 'center',
  },
  financeSep: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },
  financeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  financeTotal: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.accent,
    marginTop: 2,
  },
  financeVal: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },

  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    marginTop: 12,
    marginBottom: 8,
  },
  actions: { flexDirection: 'row' },
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
