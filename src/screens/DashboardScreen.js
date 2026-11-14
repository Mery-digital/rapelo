import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  HeroCard,
  HeroSurface,
  HeroChip,
  HeroSeparator,
} from '../components/HeroUI';
import Button from '../components/Button';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '../navigation/AppNavigator';
import { radius } from '../theme';
import { RETARD_SEUIL_JOURS } from '../types';
import {
  formatPrice,
  daysSince,
  computeBalance,
  openWhatsApp,
  callCustomer,
  readyMessage,
  reminderMessage,
} from '../services/messagingService';

export default function DashboardScreen({
  atelier,
  repairs = [],
  loading = false,
  onRefresh,
}) {
  const { theme } = useTheme();
  const { switchTab, navigate } = useNavigation();

  const stats = useMemo(() => {
    const enCours = repairs.filter((r) => r.statut === 'en_cours');
    const prets = repairs.filter((r) => r.statut === 'pret');
    const livres = repairs.filter((r) => r.statut === 'livre');
    const retards = repairs.filter(
      (r) =>
        (r.statut === 'en_cours' || r.statut === 'pret') &&
        daysSince(r.created_at) >= RETARD_SEUIL_JOURS
    );

    let totalCa = 0;
    let totalEncaisse = 0;
    let totalReste = 0;

    repairs.forEach((r) => {
      const { total, paid, reste } = computeBalance(r.prix_estime, r.avance_payee);
      totalCa += total;
      totalEncaisse += r.statut === 'livre' ? total : paid;
      if (r.statut !== 'livre') {
        totalReste += reste;
      }
    });

    const collectionRate =
      totalCa > 0 ? Math.min(100, Math.round((totalEncaisse / totalCa) * 100)) : 0;

    return {
      total: repairs.length,
      enCoursCount: enCours.length,
      pretsCount: prets.length,
      livresCount: livres.length,
      retardsCount: retards.length,
      totalCa,
      totalEncaisse,
      totalReste,
      collectionRate,
    };
  }, [repairs]);

  const priorityRepairs = useMemo(() => {
    return repairs
      .filter((r) => r.statut === 'en_cours' || r.statut === 'pret')
      .slice(0, 5);
  }, [repairs]);

  const handleQuickNotify = (fiche) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const days = daysSince(fiche.created_at);
    const msg =
      days >= RETARD_SEUIL_JOURS
        ? reminderMessage({
            clientNom: fiche.client_nom,
            appareil: fiche.appareil,
            statut: fiche.statut,
            days,
            prix: fiche.prix_estime,
            avance: fiche.avance_payee,
            atelier,
          })
        : readyMessage({
            clientNom: fiche.client_nom,
            appareil: fiche.appareil,
            prix: fiche.prix_estime,
            avance: fiche.avance_payee,
            atelier,
          });
    openWhatsApp(fiche.client_tel, msg, atelier.indicatif);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
    >
      {/* 1. GRILLE INDICATEURS CLÉS (KPIs) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeaderTitle, { color: theme.muted }]}>
          INDICATEURS CLÉS DE L’ATELIER
        </Text>
        <HeroChip
          label={`${stats.total} dossier${stats.total > 1 ? 's' : ''}`}
          icon="analytics-outline"
          color={theme.accent}
          variant="flat"
          size="sm"
        />
      </View>

      <View style={styles.kpiGrid}>
        <Pressable
          onPress={() => switchTab('repairs')}
          style={[
            styles.kpiCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.kpiIconBox, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="construct" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.kpiValue, { color: theme.text }]}>
            {stats.enCoursCount}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.muted }]}>
            Sur le banc
          </Text>
        </Pressable>

        <Pressable
          onPress={() => switchTab('repairs')}
          style={[
            styles.kpiCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.kpiIconBox, { backgroundColor: theme.whatsappSoft }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.whatsapp} />
          </View>
          <Text style={[styles.kpiValue, { color: theme.whatsapp }]}>
            {stats.pretsCount}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.muted }]}>
            Prêts à livrer
          </Text>
        </Pressable>

        <Pressable
          onPress={() => switchTab('repairs')}
          style={[
            styles.kpiCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.kpiIconBox, { backgroundColor: theme.surface }]}>
            <Ionicons name="bag-check-outline" size={18} color={theme.textSecondary} />
          </View>
          <Text style={[styles.kpiValue, { color: theme.text }]}>
            {stats.livresCount}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.muted }]}>
            Remis client
          </Text>
        </Pressable>

        <Pressable
          onPress={() => switchTab('repairs')}
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.card,
              borderColor: stats.retardsCount > 0 ? theme.danger : theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.kpiIconBox,
              {
                backgroundColor:
                  stats.retardsCount > 0 ? theme.dangerSoft : theme.surface,
              },
            ]}
          >
            <Ionicons
              name="flame-outline"
              size={18}
              color={stats.retardsCount > 0 ? theme.danger : theme.muted}
            />
          </View>
          <Text
            style={[
              styles.kpiValue,
              { color: stats.retardsCount > 0 ? theme.danger : theme.text },
            ]}
          >
            {stats.retardsCount}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.muted }]}>
            Retards (+7j)
          </Text>
        </Pressable>
      </View>

      {/* 2. BILAN FINANCIER TEMPS RÉEL */}
      <HeroCard style={styles.financeCard}>
        <HeroCard.Header>
          <View style={styles.financeHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardSectionTag, { color: theme.muted }]}>
                TRÉSORERIE & CHIFFRE D’AFFAIRES
              </Text>
              <Text style={[styles.totalCaBig, { color: theme.text }]}>
                {formatPrice(stats.totalCa)}
              </Text>
            </View>
            <HeroChip
              label={`${stats.collectionRate}% encaissé`}
              icon="trending-up"
              color={theme.whatsapp}
              variant="flat"
              size="sm"
            />
          </View>
        </HeroCard.Header>

        <HeroCard.Body style={{ paddingTop: 4 }}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${stats.collectionRate}%`,
                  backgroundColor: theme.whatsapp,
                },
              ]}
            />
          </View>

          <View style={styles.financeSplitRow}>
            <HeroSurface style={styles.financeBox}>
              <Text style={[styles.financeSubLabel, { color: theme.muted }]}>
                Acomptes & Solde perçu
              </Text>
              <Text style={[styles.financeSubVal, { color: theme.whatsapp }]}>
                {formatPrice(stats.totalEncaisse)}
              </Text>
            </HeroSurface>

            <HeroSurface style={styles.financeBox}>
              <Text style={[styles.financeSubLabel, { color: theme.muted }]}>
                Reste à percevoir
              </Text>
              <Text style={[styles.financeSubVal, { color: theme.warningDark }]}>
                {formatPrice(stats.totalReste)}
              </Text>
            </HeroSurface>
          </View>
        </HeroCard.Body>
      </HeroCard>

      {/* 3. ACTIONS RAPIDES TACTILES */}
      <View style={styles.quickActionsRow}>
        <View style={{ flex: 1 }}>
          <Button
            variant="primary"
            icon="add-circle"
            title="Nouveau dépôt"
            onPress={() => switchTab('new')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            icon="list"
            title="Gérer le banc"
            onPress={() => switchTab('repairs')}
          />
        </View>
      </View>

      {/* 4. DOSSIERS ACTIFS / PRIORITAIRES */}
      <HeroCard style={styles.recentCard}>
        <HeroCard.Header>
          <View style={styles.financeHeaderRow}>
            <Text style={[styles.cardSectionTag, { color: theme.muted }]}>
              DOSSIERS ACTIFS SUR LE BANC ({priorityRepairs.length})
            </Text>
            {repairs.length > 0 ? (
              <Pressable onPress={() => switchTab('repairs')} hitSlop={8}>
                <Text style={[styles.seeAllLink, { color: theme.accent }]}>
                  Tout voir →
                </Text>
              </Pressable>
            ) : null}
          </View>
        </HeroCard.Header>

        <HeroSeparator style={{ marginVertical: 0 }} />

        <HeroCard.Body>
          {priorityRepairs.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="construct-outline" size={26} color={theme.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Aucun appareil en attente
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
                Enregistre un nouveau dépôt client pour démarrer le suivi et envoyer un reçu automatique.
              </Text>
              <View style={{ marginTop: 12 }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon="add-circle-outline"
                  title="Créer une fiche de réparation"
                  onPress={() => switchTab('new')}
                />
              </View>
            </View>
          ) : (
            priorityRepairs.map((item, idx) => {
              const days = daysSince(item.created_at);
              const isLate = days >= RETARD_SEUIL_JOURS;
              const isReady = item.statut === 'pret';
              const { reste } = computeBalance(item.prix_estime, item.avance_payee);

              return (
                <View key={item.id}>
                  {idx > 0 ? <HeroSeparator style={{ marginVertical: 10 }} /> : null}
                  <Pressable
                    onPress={() => navigate('detail', { fiche: item })}
                    style={styles.repairRow}
                  >
                    <View
                      style={[
                        styles.statusDotWrap,
                        {
                          backgroundColor: isLate
                            ? theme.dangerSoft
                            : isReady
                            ? theme.whatsappSoft
                            : theme.accentSoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          isLate
                            ? 'warning'
                            : isReady
                            ? 'checkmark-circle'
                            : 'construct'
                        }
                        size={18}
                        color={
                          isLate
                            ? theme.danger
                            : isReady
                            ? theme.whatsapp
                            : theme.accent
                        }
                      />
                    </View>

                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <View style={styles.rowTop}>
                        <Text
                          style={[styles.deviceTitle, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {item.appareil}
                        </Text>
                        {isLate ? (
                          <HeroChip
                            label={`${days}j`}
                            color={theme.danger}
                            variant="flat"
                            size="sm"
                          />
                        ) : null}
                      </View>

                      <Text
                        style={[styles.clientSub, { color: theme.muted }]}
                        numberOfLines={1}
                      >
                        {item.client_nom} · {item.probleme || item.panne_declaree || 'Diagnostic en cours'}
                      </Text>

                      {reste > 0 ? (
                        <Text style={[styles.resteTag, { color: theme.warningDark }]}>
                          Reste : {formatPrice(reste)}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => handleQuickNotify(item)}
                        hitSlop={6}
                        style={[
                          styles.iconActionBtn,
                          { backgroundColor: theme.whatsappSoft },
                        ]}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color={theme.whatsapp} />
                      </Pressable>

                      <Pressable
                        onPress={() => callCustomer(item.client_tel)}
                        hitSlop={6}
                        style={[
                          styles.iconActionBtn,
                          { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
                        ]}
                      >
                        <Ionicons name="call-outline" size={15} color={theme.text} />
                      </Pressable>

                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.muted}
                        style={{ marginLeft: 2 }}
                      />
                    </View>
                  </Pressable>
                </View>
              );
            })
          )}
        </HeroCard.Body>
      </HeroCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 36,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: '48.2%',
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  kpiIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  financeCard: {
    marginBottom: 14,
  },
  financeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionTag: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalCaBig: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  financeSplitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  financeBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  financeSubLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  financeSubVal: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  recentCard: {
    marginBottom: 14,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  repairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusDotWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceTitle: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  clientSub: {
    fontSize: 12,
    marginTop: 2,
  },
  resteTag: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
