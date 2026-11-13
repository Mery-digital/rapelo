import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
  Animated,
  LayoutAnimation,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RepairCard from '../components/RepairCard';
import Field, { HeroTextArea } from '../components/Field';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import {
  HeroAlert,
  HeroBottomSheet,
  HeroCard,
  HeroChip,
  HeroCloseButton,
  HeroDialog,
  HeroSearchField,
  HeroSeparator,
  HeroSurface,
  RepairCardSkeleton,
  useToast,
} from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';
import {
  updateRepairStatus,
  updateRepair,
  deleteRepair,
  deleteRepairsByIds,
} from '../lib/repairs';
import { persistPhotoUri } from '../lib/photos';
import {
  COUNTRY_DIAL_CODES,
  readyMessage,
  unrepairedMessage,
  reminderMessage,
  openWhatsApp,
  openSms,
  callCustomer,
  digitsOnly,
  toInternational,
  computeBalance,
  formatPrice,
} from '../lib/messaging';

export default function RepairsListScreen({
  atelier,
  repairs,
  loading,
  error,
  onRefresh,
  onUpdated,
  onRemoved,
  onRemovedMany,
}) {
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();

  const STATUS_OPTIONS = [
    { id: 'en_cours', label: 'En réparation', icon: 'construct', color: theme.accent },
    { id: 'pret', label: 'Prêt à livrer', icon: 'checkmark-circle', color: theme.success },
    { id: 'non_repare', label: 'Non réparé', icon: 'close-circle', color: theme.danger },
    { id: 'livre', label: 'Remis au client', icon: 'bag-check', color: theme.muted },
  ];

  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [busyId, setBusyId] = useState(null);

  // BottomSheet message state
  const [notifyModal, setNotifyModal] = useState(null);

  // BottomSheet edit state
  const [editModal, setEditModal] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Dialog confirmation state
  const [confirmModal, setConfirmModal] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const stats = useMemo(() => {
    const enCours = repairs.filter((r) => r.statut === 'en_cours').length;
    const prets = repairs.filter((r) => r.statut === 'pret').length;
    const nonRepares = repairs.filter((r) => r.statut === 'non_repare').length;
    const livres = repairs.filter((r) => r.statut === 'livre').length;
    const actifs = enCours + prets + nonRepares;
    return { actifs, enCours, prets, nonRepares, livres };
  }, [repairs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digitsOnly(q);
    return repairs.filter((r) => {
      if (filterStatus === 'all' && r.statut === 'livre') return false;
      if (filterStatus !== 'all' && r.statut !== filterStatus) return false;
      if (!q) return true;
      const nom = (r.client_nom || '').toLowerCase();
      const appareil = (r.appareil || '').toLowerCase();
      const tel = digitsOnly(r.client_tel || '');
      const prob = (r.probleme || '').toLowerCase();
      return (
        nom.includes(q) ||
        appareil.includes(q) ||
        prob.includes(q) ||
        (qDigits && tel.includes(qDigits))
      );
    });
  }, [repairs, query, filterStatus]);

  const handleFilterChange = (id) => {
    Haptics.selectionAsync().catch(() => {});
    setFilterStatus(id);
  };

  const handleSendOutcome = (fiche, channel, outcome) => {
    setNotifyModal(null);
    let msg = '';
    if (outcome === 'ready') msg = readyMessage(fiche, atelier);
    else if (outcome === 'unrepaired') msg = unrepairedMessage(fiche, atelier);
    else if (outcome === 'reminder') msg = reminderMessage(fiche, atelier);

    if (channel === 'whatsapp') {
      const defaultDial = digitsOnly(atelier?.indicatif) || '225';
      openWhatsApp(fiche.client_tel, msg, defaultDial);
    } else {
      openSms(fiche.client_tel, msg);
    }
  };

  const openEditModal = (fiche) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const defaultDial = digitsOnly(atelier?.indicatif) || '225';
    setEditModal({
      id: fiche.id,
      clientNom: fiche.client_nom || '',
      clientTel: fiche.client_tel || '',
      dialCode: defaultDial,
      appareil: fiche.appareil || '',
      probleme: fiche.probleme || '',
      prix: String(fiche.prix_estime ?? 0),
      avance: String(fiche.avance_payee ?? 0),
      statut: fiche.statut || 'en_cours',
      photoUri: fiche.photo_url || null,
      originalPhotoUri: fiche.photo_url || null,
    });
  };

  const saveEditedRepair = async () => {
    if (!editModal) return;
    if (
      !editModal.clientNom.trim() ||
      !editModal.clientTel.trim() ||
      !editModal.appareil.trim() ||
      !editModal.probleme.trim()
    ) {
      Alert.alert('Champs requis', 'Remplis le nom du client, son numéro, l’appareil et la panne.');
      return;
    }

    setSavingEdit(true);
    try {
      const rawTel = editModal.clientTel.trim();
      const dialCode = editModal.dialCode || digitsOnly(atelier?.indicatif) || '225';
      const intlDigits = toInternational(rawTel, dialCode);
      const storedPhone = rawTel.startsWith('+') ? rawTel : `+${intlDigits}`;

      let finalPhotoUrl = editModal.photoUri;
      if (editModal.photoUri && editModal.photoUri !== editModal.originalPhotoUri) {
        finalPhotoUrl = await persistPhotoUri(editModal.photoUri, digitsOnly(atelier.phone));
      }

      const patch = {
        client_nom: editModal.clientNom.trim(),
        client_tel: storedPhone,
        appareil: editModal.appareil.trim(),
        probleme: editModal.probleme.trim(),
        prix_estime: parseInt(digitsOnly(editModal.prix), 10) || 0,
        avance_payee: parseInt(digitsOnly(editModal.avance), 10) || 0,
        statut: editModal.statut,
        photo_url: finalPhotoUrl || null,
      };
      if (editModal.statut === 'pret') patch.pret_le = new Date().toISOString();
      else if (editModal.statut === 'livre') patch.livre_le = new Date().toISOString();

      let updated;
      try {
        updated = await updateRepair(editModal.id, patch);
      } catch (dbErr) {
        if (String(dbErr?.message || '').includes('photo_url')) {
          const { photo_url, ...withoutPhoto } = patch;
          updated = await updateRepair(editModal.id, withoutPhoto);
          updated = { ...updated, photo_url: finalPhotoUrl };
        } else {
          throw dbErr;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onUpdated(updated);
      setEditModal(null);
      showToast({
        title: 'Fiche modifiée',
        message: `${updated.appareil} (${updated.client_nom}) mis à jour.`,
        type: 'success',
      });
    } catch (e) {
      Alert.alert('Erreur', e?.message || 'Impossible de modifier la fiche.');
    } finally {
      setSavingEdit(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmModal) return;
    const current = confirmModal;
    setConfirmModal(null);

    if (current.type === 'delete_one' && current.fiche) {
      const fiche = current.fiche;
      setBusyId(fiche.id);
      try {
        await deleteRepair(fiche.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onRemoved(fiche.id);
        showToast({
          title: 'Fiche supprimée',
          message: `${fiche.appareil} a été retiré de la liste.`,
          type: 'danger',
        });
      } catch (e) {
        Alert.alert('Erreur', e?.message || 'Impossible de supprimer cette fiche.');
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (current.type === 'delete_many' && current.ids?.length) {
      try {
        await deleteRepairsByIds(current.ids);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onRemovedMany?.(current.ids);
        showToast({
          title: 'Nettoyage effectué',
          message: `${current.ids.length} fiche(s) supprimée(s).`,
          type: 'danger',
        });
      } catch (e) {
        Alert.alert('Erreur', e?.message || 'Impossible de supprimer ces fiches.');
      }
      return;
    }

    if (current.type === 'delivered' && current.fiche) {
      const fiche = current.fiche;
      const nextStatus = fiche.statut === 'livre' ? 'en_cours' : 'livre';
      setBusyId(fiche.id);
      try {
        const updated = await updateRepairStatus(fiche.id, nextStatus);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onUpdated(updated);
        showToast({
          title: nextStatus === 'livre' ? 'Appareil récupéré' : 'Remis en atelier',
          message: `${fiche.appareil} (${fiche.client_nom})`,
          type: 'success',
        });
      } catch (e) {
        Alert.alert('Erreur', e?.message || 'Problème de connexion.');
      } finally {
        setBusyId(null);
      }
    }
  };

  const canBulkDelete = ['pret', 'non_repare', 'livre'].includes(filterStatus) && filtered.length > 0;

  return (
    <View style={{ flex: 1 }}>
      {/* 1. HERO SEARCH FIELD */}
      <HeroSearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher client, téléphone ou modèle..."
      />

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        {/* 2. STAT SUMMARY CARD (HeroUI Metric Strip) */}
        <HeroCard style={styles.metricCard}>
          <HeroCard.Body style={styles.metricBody}>
            <View style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>En cours</Text>
              <Text style={[styles.metricValue, { color: theme.accent }]}>
                {stats.enCours}
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
            <View style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Prêts</Text>
              <Text style={[styles.metricValue, { color: theme.whatsapp }]}>
                {stats.prets}
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
            <View style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Total atelier</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {stats.actifs}
              </Text>
            </View>
          </HeroCard.Body>
        </HeroCard>

        {/* 3. HERO FILTER CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <Pressable onPress={() => handleFilterChange('all')}>
            <HeroChip
              label={`Tous (${stats.actifs})`}
              variant={filterStatus === 'all' ? 'solid' : 'flat'}
              color={theme.accent}
              size="md"
              style={styles.filterChipItem}
            />
          </Pressable>

          <Pressable onPress={() => handleFilterChange('en_cours')}>
            <HeroChip
              icon="construct"
              label={`En cours (${stats.enCours})`}
              variant={filterStatus === 'en_cours' ? 'solid' : 'flat'}
              color={theme.accent}
              size="md"
              style={styles.filterChipItem}
            />
          </Pressable>

          <Pressable onPress={() => handleFilterChange('pret')}>
            <HeroChip
              icon="checkmark-circle"
              label={`Prêts (${stats.prets})`}
              variant={filterStatus === 'pret' ? 'solid' : 'flat'}
              color={theme.whatsapp}
              size="md"
              style={styles.filterChipItem}
            />
          </Pressable>

          <Pressable onPress={() => handleFilterChange('non_repare')}>
            <HeroChip
              icon="close-circle"
              label={`Non réparés (${stats.nonRepares})`}
              variant={filterStatus === 'non_repare' ? 'solid' : 'flat'}
              color={theme.danger}
              size="md"
              style={styles.filterChipItem}
            />
          </Pressable>

          <Pressable onPress={() => handleFilterChange('livre')}>
            <HeroChip
              icon="bag-check"
              label={`Récupérés (${stats.livres})`}
              variant={filterStatus === 'livre' ? 'solid' : 'flat'}
              color={theme.muted}
              size="md"
              style={styles.filterChipItem}
            />
          </Pressable>
        </ScrollView>

        {canBulkDelete ? (
          <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
            <Button
              size="sm"
              variant="danger-soft"
              icon="trash-outline"
              title={`Tout supprimer dans cet onglet (${filtered.length})`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setConfirmModal({
                  type: 'delete_many',
                  ids: filtered.map((f) => f.id),
                  label: `${filtered.length} appareil(s)`,
                });
              }}
            />
          </View>
        ) : null}

        {/* 4. REPAIR CARDS LIST */}
        {loading && repairs.length === 0 ? (
          <>
            <RepairCardSkeleton />
            <RepairCardSkeleton />
            <RepairCardSkeleton />
          </>
        ) : error ? (
          <HeroAlert
            variant="danger"
            title="Connexion impossible"
            description={error}
            style={{ marginHorizontal: 16 }}
          />
        ) : filtered.length === 0 ? (
          <HeroSurface style={styles.emptySurface}>
            <Ionicons
              name={query ? 'search-outline' : 'construct-outline'}
              size={36}
              color={theme.muted}
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query ? 'Aucun résultat' : 'Aucun appareil dans cette liste'}
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.muted }]}>
              {query
                ? 'Vérifie l’orthographe du client ou de l’appareil.'
                : 'Passe à l’onglet « Nouveau dépôt » pour enregistrer une nouvelle fiche.'}
            </Text>
          </HeroSurface>
        ) : (
          filtered.map((fiche) => (
            <RepairCard
              key={fiche.id}
              fiche={fiche}
              busy={busyId === fiche.id}
              onWhatsApp={() => setNotifyModal({ fiche, mode: 'whatsapp' })}
              onSms={() => setNotifyModal({ fiche, mode: 'sms' })}
              onEdit={openEditModal}
              onDelete={(f) => setConfirmModal({ type: 'delete_one', fiche: f })}
              onDelivered={(f) => setConfirmModal({ type: 'delivered', fiche: f })}
            />
          ))
        )}
      </Animated.ScrollView>

      {/* =====================================================================
          5. HERO BOTTOM SHEET : CHOIX PROPRE / PRÊT (RÉPARÉ) OU NON RÉPARÉ
         ===================================================================== */}
      <HeroBottomSheet
        visible={!!notifyModal}
        onClose={() => setNotifyModal(null)}
        maxWidth={480}
      >
        {notifyModal ? (
          <View style={styles.sheetWrap}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {notifyModal.mode === 'whatsapp' ? 'Message WhatsApp' : 'SMS Direct'}
                </Text>
                <Text style={[styles.sheetSub, { color: theme.muted }]}>
                  {notifyModal.fiche.appareil} · {notifyModal.fiche.client_nom}
                </Text>
              </View>
              <HeroCloseButton
                size="sm"
                variant="default"
                onPress={() => setNotifyModal(null)}
              />
            </View>

            <HeroSeparator />

            <ScrollView contentContainerStyle={styles.sheetScroll}>
              <Text style={[styles.choiceHeading, { color: theme.textSecondary }]}>
                Sélectionne le message à envoyer :
              </Text>

              {/* Option 1 : Appareil prêt */}
              <Pressable
                onPress={() => handleSendOutcome(notifyModal.fiche, notifyModal.mode, 'ready')}
                style={[styles.messageOption, { backgroundColor: theme.surface, borderColor: theme.whatsapp }]}
              >
                <View style={[styles.optionBadge, { backgroundColor: theme.whatsappSoft }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.whatsapp} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.whatsapp }]}>
                    Appareil réparé et prêt
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.muted }]} numberOfLines={2}>
                    Prévient le client que son appareil est réparé avec le solde à régler.
                  </Text>
                </View>
                <Ionicons name="send" size={16} color={theme.whatsapp} />
              </Pressable>

              {/* Option 2 : Non réparé */}
              <Pressable
                onPress={() => handleSendOutcome(notifyModal.fiche, notifyModal.mode, 'unrepaired')}
                style={[styles.messageOption, { backgroundColor: theme.surface, borderColor: theme.danger }]}
              >
                <View style={[styles.optionBadge, { backgroundColor: theme.dangerSoft }]}>
                  <Ionicons name="close-circle" size={20} color={theme.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.danger }]}>
                    Non réparable / À récupérer
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.muted }]} numberOfLines={2}>
                    Informe le client qu’il peut venir chercher son appareil.
                  </Text>
                </View>
                <Ionicons name="send" size={16} color={theme.danger} />
              </Pressable>

              {/* Option 3 : Relance */}
              <Pressable
                onPress={() => handleSendOutcome(notifyModal.fiche, notifyModal.mode, 'reminder')}
                style={[styles.messageOption, { backgroundColor: theme.surface, borderColor: theme.warning }]}
              >
                <View style={[styles.optionBadge, { backgroundColor: theme.warningSoft }]}>
                  <Ionicons name="notifications" size={20} color={theme.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.warning }]}>
                    Relance client
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.muted }]} numberOfLines={2}>
                    Rappel amical pour inviter le client à passer à l’atelier.
                  </Text>
                </View>
                <Ionicons name="send" size={16} color={theme.warning} />
              </Pressable>

              {/* Appel direct */}
              <Button
                size="sm"
                variant="tertiary"
                icon="call-outline"
                title={`Appeler ${notifyModal.fiche.client_nom}`}
                onPress={() => {
                  const tel = notifyModal.fiche.client_tel;
                  setNotifyModal(null);
                  callCustomer(tel);
                }}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        ) : null}
      </HeroBottomSheet>

      {/* =====================================================================
          6. HERO BOTTOM SHEET : MODIFICATION DE FICHE CLIENT
         ===================================================================== */}
      <HeroBottomSheet
        visible={!!editModal}
        onClose={() => setEditModal(null)}
        maxWidth={520}
      >
        {editModal ? (
          <View style={styles.sheetWrap}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Modifier la fiche
                </Text>
                <Text style={[styles.sheetSub, { color: theme.muted }]}>
                  {editModal.appareil} · {editModal.clientNom}
                </Text>
              </View>
              <HeroCloseButton
                size="sm"
                variant="default"
                onPress={() => setEditModal(null)}
              />
            </View>

            <HeroSeparator />

            <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              {/* Statut Selector */}
              <Text style={[styles.inputSectionLabel, { color: theme.muted }]}>
                STATUT ACTUEL :
              </Text>
              <View style={styles.statusChipsRow}>
                {STATUS_OPTIONS.map((st) => {
                  const active = editModal.statut === st.id;
                  return (
                    <Pressable
                      key={st.id}
                      onPress={() => setEditModal((m) => ({ ...m, statut: st.id }))}
                    >
                      <HeroChip
                        icon={st.icon}
                        label={st.label}
                        color={st.color}
                        variant={active ? 'solid' : 'flat'}
                        size="md"
                        style={styles.statusChipItem}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {/* Photo */}
              <PhotoPicker
                uri={editModal.photoUri}
                onChange={(uri) => setEditModal((m) => ({ ...m, photoUri: uri }))}
              />

              {/* Form Fields */}
              <Field
                label="Nom du client"
                icon="person-outline"
                value={editModal.clientNom}
                onChangeText={(v) => setEditModal((m) => ({ ...m, clientNom: v }))}
              />

              <Field
                label="Téléphone du client"
                icon="call-outline"
                keyboardType="phone-pad"
                value={editModal.clientTel}
                onChangeText={(v) => setEditModal((m) => ({ ...m, clientTel: v }))}
              />

              <Field
                label="Appareil (Modèle / Marque)"
                icon="phone-portrait-outline"
                value={editModal.appareil}
                onChangeText={(v) => setEditModal((m) => ({ ...m, appareil: v }))}
              />

              <HeroTextArea
                label="Panne / Problème constaté"
                icon="construct-outline"
                value={editModal.probleme}
                onChangeText={(v) => setEditModal((m) => ({ ...m, probleme: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Field
                  label="Prix total (FCFA)"
                  icon="cash-outline"
                  keyboardType="numeric"
                  value={editModal.prix}
                  onChangeText={(v) => setEditModal((m) => ({ ...m, prix: digitsOnly(v) }))}
                  style={{ flex: 1 }}
                />
                <Field
                  label="Avance payée (FCFA)"
                  icon="wallet-outline"
                  keyboardType="numeric"
                  value={editModal.avance}
                  onChangeText={(v) => setEditModal((m) => ({ ...m, avance: digitsOnly(v) }))}
                  style={{ flex: 1 }}
                />
              </View>

              <HeroSurface style={styles.balancePreview}>
                <Text style={[styles.balancePreviewLabel, { color: theme.textSecondary }]}>
                  Reste à payer :
                </Text>
                <Text style={[styles.balancePreviewVal, { color: theme.danger }]}>
                  {formatPrice(computeBalance(editModal.prix, editModal.avance).reste)}
                </Text>
              </HeroSurface>

              <View style={styles.editActions}>
                <Button
                  title="Annuler"
                  variant="outline"
                  onPress={() => setEditModal(null)}
                  disabled={savingEdit}
                />
                <View style={{ width: 10 }} />
                <Button
                  title="Enregistrer"
                  icon="checkmark-circle"
                  variant="primary"
                  loading={savingEdit}
                  onPress={saveEditedRepair}
                />
              </View>
            </ScrollView>
          </View>
        ) : null}
      </HeroBottomSheet>

      {/* =====================================================================
          7. HERO DIALOG : CONFIRMATIONS (SUPPRESSION OU RÉCUPÉRATION)
         ===================================================================== */}
      <HeroDialog
        visible={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        icon={confirmModal?.type === 'delivered' ? 'checkmark-circle' : 'trash'}
        iconColor={confirmModal?.type === 'delivered' ? theme.whatsapp : theme.danger}
        iconBg={confirmModal?.type === 'delivered' ? theme.whatsappSoft : theme.dangerSoft}
        title={
          confirmModal?.type === 'delete_one'
            ? 'Supprimer cette fiche ?'
            : confirmModal?.type === 'delete_many'
            ? 'Suppression groupée'
            : confirmModal?.fiche?.statut === 'livre'
            ? 'Remettre en atelier ?'
            : 'Appareil récupéré ?'
        }
        description={
          confirmModal?.type === 'delete_one'
            ? `Supprimer définitivement la fiche de ${confirmModal?.fiche?.client_nom} (${confirmModal?.fiche?.appareil}) ?`
            : confirmModal?.type === 'delete_many'
            ? `Supprimer définitivement ${confirmModal?.label} ?`
            : confirmModal?.fiche?.statut === 'livre'
            ? `La fiche de ${confirmModal?.fiche?.client_nom} reviendra dans les appareils en cours.`
            : `Confirmer que ${confirmModal?.fiche?.client_nom} a récupéré son ${confirmModal?.fiche?.appareil} ?`
        }
      >
        <View style={styles.dialogActions}>
          <Button
            size="sm"
            title="Annuler"
            variant="tertiary"
            onPress={() => setConfirmModal(null)}
          />
          <View style={{ width: 10 }} />
          <Button
            size="sm"
            variant={confirmModal?.type === 'delivered' ? 'whatsapp' : 'danger'}
            title={
              confirmModal?.type === 'delivered'
                ? confirmModal?.fiche?.statut === 'livre'
                  ? 'Remettre'
                  : 'Oui, récupéré'
                : 'Oui, supprimer'
            }
            onPress={executeConfirmAction}
          />
        </View>
      </HeroDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 8,
    paddingBottom: 36,
  },
  metricCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  metricBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  filterChipItem: {
    marginRight: 6,
  },
  emptySurface: {
    marginHorizontal: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  sheetWrap: {
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetScroll: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  choiceHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  messageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
  },
  optionBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  inputSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  statusChipItem: {
    marginRight: 6,
    marginBottom: 6,
  },
  balancePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 14,
  },
  balancePreviewLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  balancePreviewVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  editActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  dialogActions: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 6,
  },
});
