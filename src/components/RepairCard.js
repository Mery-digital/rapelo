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
import { HeroAvatar, HeroChip, HeroCloseButton } from './HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../theme';
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
      label: 'Réparé · Prêt à récupérer',
      icon: 'checkmark-circle',
      chipColor: 'success',
      accent: theme.success,
    };
  }
  if (statut === 'non_repare') {
    return {
      label: 'Non réparé · À récupérer',
      icon: 'close-circle',
      chipColor: 'danger',
      accent: theme.danger,
    };
  }
  if (statut === 'livre') {
    return {
      label: 'Récupéré par le client',
      icon: 'bag-check-outline',
      chipColor: 'neutral',
      accent: theme.muted,
    };
  }
  return {
    label: 'Sur le banc de réparation',
    icon: 'construct',
    chipColor: 'primary',
    accent: theme.accent,
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
  const { theme } = useTheme();
  const statusMeta = getStatusMeta(fiche.statut, theme);
  const isDelivered = fiche.statut === 'livre';
  const isInProgress = fiche.statut === 'en_cours' || !fiche.statut;
  const waitDays = daysSince(fiche.pret_le || fiche.created_at);
  const { total, paid, reste } = computeBalance(
    fiche.prix_estime,
    fiche.avance_payee
  );
  const [viewerOpen, setViewerOpen] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const doneScale = useRef(new Animated.Value(1)).current;
  const toolAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index, 6) * 55;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
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
    if (!isInProgress) return;
    const toolLoop = Animated.loop(
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
    return () => toolLoop.stop();
  }, [isInProgress, toolAnim]);

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
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: fade,
          transform: [{ translateY: slide }],
        },
        shadow,
      ]}
    >
      {/* Bande supérieure HeroUI colorée selon le statut */}
      <View
        style={[styles.topAccentStrip, { backgroundColor: statusMeta.accent }]}
      />

      <View style={styles.cardInner}>
        {/* CARD HEADER : HeroAvatar + Client + Actions + HeroChip Statut */}
        <View style={styles.headerRow}>
          <HeroAvatar
            uri={fiche.photo_url}
            name={fiche.client_nom}
            fallbackIcon={getDeviceIcon(fiche.appareil)}
            size={62}
            ringColor={statusMeta.accent}
            statusColor={statusMeta.accent}
            onPress={
              fiche.photo_url
                ? () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => {}
                    );
                    setViewerOpen(true);
                  }
                : undefined
            }
          />

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {fiche.client_nom}
              </Text>
              <View style={styles.cardActionsTop}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => {}
                    );
                    onEdit?.(fiche);
                  }}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.iconActionBtn,
                    {
                      backgroundColor: theme.accentSoft,
                      borderColor: `${theme.accent}40`,
                      marginRight: 6,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Ionicons name="create-outline" size={14} color={theme.accent} />
                  <Text style={[styles.editActionText, { color: theme.accent }]}>
                    Modifier
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                      () => {}
                    );
                    onDelete?.(fiche);
                  }}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.iconActionBtn,
                    {
                      backgroundColor: theme.dangerSoft,
                      borderColor: `${theme.danger}40`,
                      paddingHorizontal: 7,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={14} color={theme.danger} />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {}
                );
                callCustomer(fiche.client_tel);
              }}
              style={({ pressed }) => [
                styles.phoneRow,
                pressed && { opacity: 0.72 },
              ]}
            >
              <Ionicons name="call" size={13} color={theme.success} />
              <Text style={[styles.phone, { color: theme.textSecondary }]}>
                {fiche.client_tel}
              </Text>
              <View style={[styles.callBadge, { backgroundColor: theme.whatsapp }]}>
                <Ionicons name="call-outline" size={10} color="#FFFFFF" />
                <Text style={styles.callBadgeText}>Appeler</Text>
              </View>
            </Pressable>

            <View style={styles.statusBadgesRow}>
              <HeroChip
                label={statusMeta.label}
                icon={statusMeta.icon}
                color={statusMeta.chipColor}
                pulse={!isDelivered}
                animatedIcon={
                  isInProgress ? { transform: [{ rotate: toolRotate }] } : null
                }
              />
              {!isDelivered && waitDays >= 1 ? (
                <HeroChip
                  label={`${waitDays} j`}
                  icon="hourglass-outline"
                  color={waitDays >= 5 ? 'danger' : 'warning'}
                  style={{ marginLeft: 6 }}
                />
              ) : null}
            </View>
          </View>
        </View>

        {/* CARD BODY : Parcours 3 étapes + Diagnostic + Bandeau Financier */}
        <WorkshopProgressSteps statut={fiche.statut} accent={statusMeta.accent} />

        <View
          style={[
            styles.techDiagnosticBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.techRow}>
            <View
              style={[styles.techIconBadge, { backgroundColor: theme.accentSoft }]}
            >
              <Ionicons
                name={getDeviceIcon(fiche.appareil)}
                size={16}
                color={theme.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.techLabel, { color: theme.muted }]}>
                APPAREIL DÉPOSÉ
              </Text>
              <Text style={[styles.techDeviceValue, { color: theme.text }]}>
                {fiche.appareil}
              </Text>
            </View>
            <View
              style={[
                styles.datePill,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons name="calendar-outline" size={11} color={theme.muted} />
              <Text style={[styles.datePillText, { color: theme.muted }]}>
                {formatDate(fiche.created_at)}
              </Text>
            </View>
          </View>

          <View style={[styles.techDivider, { backgroundColor: theme.border }]} />

          <View style={styles.techRow}>
            <View
              style={[styles.techIconBadge, { backgroundColor: theme.warningSoft }]}
            >
              <Ionicons name="construct" size={15} color={theme.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.techLabel, { color: theme.muted }]}>
                DIAGNOSTIC / PANNE SIGNALÉE
              </Text>
              <Text
                style={[styles.techProblemValue, { color: theme.textSecondary }]}
              >
                {fiche.probleme}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.financeStrip,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.financeCol}>
            <Text style={[styles.financeLabel, { color: theme.muted }]}>
              Total réparation
            </Text>
            <Text style={[styles.financeTotal, { color: theme.accent }]}>
              {formatPrice(total)}
            </Text>
          </View>
          <View style={[styles.financeSep, { backgroundColor: theme.border }]} />
          <View style={styles.financeCol}>
            <Text style={[styles.financeLabel, { color: theme.muted }]}>
              Avance payée
            </Text>
            <Text style={[styles.financeVal, { color: theme.success }]}>
              {formatPrice(paid)}
            </Text>
          </View>
          <View style={[styles.financeSep, { backgroundColor: theme.border }]} />
          <View style={styles.financeCol}>
            <Text style={[styles.financeLabel, { color: theme.muted }]}>
              Reste à payer
            </Text>
            <Text
              style={[
                styles.financeVal,
                {
                  color:
                    total > 0 && reste === 0 ? theme.success : theme.danger,
                },
              ]}
            >
              {total > 0 && reste === 0 ? 'Soldé (0 FCFA)' : formatPrice(reste)}
            </Text>
          </View>
        </View>

        {/* CARD FOOTER : Boutons WhatsApp / SMS + Récupéré / Supprimer */}
        <Text style={[styles.actionTitle, { color: theme.muted }]}>
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

        <View style={styles.bottomActionsRow}>
          <Animated.View style={{ flex: 1, transform: [{ scale: doneScale }] }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                  () => {}
                );
                onDelivered?.(fiche);
              }}
              onPressIn={() => bounce(doneScale, 0.96)}
              onPressOut={() => bounce(doneScale, 1)}
              disabled={busy}
              style={[
                styles.deliveredBtn,
                {
                  backgroundColor: isDelivered ? theme.badgeGreen : theme.surface,
                  borderColor: isDelivered ? `${theme.success}55` : theme.border,
                },
              ]}
            >
              <Ionicons
                name={isDelivered ? 'bag-check' : 'checkmark-done-circle-outline'}
                size={18}
                color={isDelivered ? theme.success : theme.textSecondary}
              />
              <Text
                style={[
                  styles.deliveredText,
                  { color: isDelivered ? theme.success : theme.textSecondary },
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {}
              );
              onDelete?.(fiche);
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.deleteCardBtn,
              {
                backgroundColor: theme.dangerSoft,
                borderColor: `${theme.danger}44`,
              },
              pressed && { opacity: 0.78 },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={theme.danger} />
            <Text style={[styles.deleteCardBtnText, { color: theme.danger }]}>
              Supprimer
            </Text>
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
    </Animated.View>
  );
}

function WorkshopProgressSteps({ statut, accent }) {
  const { theme } = useTheme();
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
      color: theme.accent,
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
      color: step3Reached ? accent : theme.muted,
    },
  ];

  return (
    <View
      style={[
        styles.stepsContainer,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {steps.map((s, idx) => (
        <React.Fragment key={s.num}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                s.done
                  ? { backgroundColor: s.color, borderColor: s.color }
                  : { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={12}
                color={s.done ? '#FFFFFF' : theme.muted}
              />
            </View>
            <Text
              style={[
                styles.stepLabel,
                { color: theme.muted },
                s.done && { color: theme.text, fontWeight: '800' },
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
                {
                  backgroundColor:
                    idx === 0 || step3Reached ? accent : theme.border,
                },
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
    borderRadius: radius.lg,
    marginBottom: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topAccentStrip: {
    height: 4,
    width: '100%',
  },
  cardInner: {
    padding: 15,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { flex: 1, fontSize: 17, fontWeight: '800', marginRight: 6 },
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
  editActionText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 3,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  phone: { fontSize: 13, fontWeight: '700', marginLeft: 5 },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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

  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
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
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    borderRadius: 2,
  },

  techDiagnosticBox: {
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  techLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  techDeviceValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  techProblemValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  datePillText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  techDivider: {
    height: 1,
    marginVertical: 8,
  },

  financeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
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
  },
  financeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  financeTotal: {
    fontSize: 13,
    fontWeight: '900',
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
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  deliveredText: {
    fontSize: 12,
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
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  deleteCardBtnText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', alignItems: 'center' },
  modalCloseTop: { alignSelf: 'flex-end', marginBottom: 10 },
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
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
});
