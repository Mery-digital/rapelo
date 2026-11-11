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
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RepairCard from '../components/RepairCard';
import Field from '../components/Field';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { colors, radius, shadow, shadowSoft } from '../theme';
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
  openWhatsApp,
  openSms,
  digitsOnly,
  toInternational,
  formatPrice,
} from '../lib/messaging';

const STATUS_OPTIONS = [
  { id: 'en_cours', label: 'En réparation', icon: 'time-outline', color: colors.accent },
  { id: 'pret', label: 'Réparé / Prêt', icon: 'checkmark-circle-outline', color: colors.success },
  { id: 'non_repare', label: 'Non réparé', icon: 'close-circle-outline', color: colors.danger },
  { id: 'livre', label: 'Récupéré', icon: 'bag-check-outline', color: colors.textSecondary },
];

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
  const [query, setQuery] = useState('');
  // 'all' (en atelier) | 'en_cours' | 'pret' | 'non_repare' | 'livre'
  const [filterStatus, setFilterStatus] = useState('all');
  const [busyId, setBusyId] = useState(null);

  // Modal state when clicking WhatsApp, SMS Direct, or "Ça n'a pas marché"
  // { fiche, mode: 'whatsapp' | 'sms' | 'unrepaired' }
  const [notifyModal, setNotifyModal] = useState(null);

  // Modal state for editing a client/device repair card
  const [editModal, setEditModal] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal state for confirming deletion or delivery (works on Android, iOS & Web)
  // { type: 'delete_one' | 'delete_many' | 'delivered', fiche?, ids?, label? }
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

  // Instant filter on status + customer name, device, or phone number
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digitsOnly(q);
    return repairs.filter((r) => {
      if (filterStatus === 'all' && r.statut === 'livre') return false;
      if (filterStatus === 'en_cours' && r.statut !== 'en_cours') return false;
      if (filterStatus === 'pret' && r.statut !== 'pret') return false;
      if (filterStatus === 'non_repare' && r.statut !== 'non_repare') return false;
      if (filterStatus === 'livre' && r.statut !== 'livre') return false;
      if (!q) return true;
      const byName = (r.client_nom || '').toLowerCase().includes(q);
      const byDevice = (r.appareil || '').toLowerCase().includes(q);
      const byProblem = (r.probleme || '').toLowerCase().includes(q);
      const byPhone = qDigits.length > 0 && digitsOnly(r.client_tel).includes(qDigits);
      return byName || byDevice || byProblem || byPhone;
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

  // Send either "Réparé / Prêt" or "Non réparé (Venez chercher l'appareil)" via WhatsApp or SMS
  const handleSendOutcome = async (fiche, channel, outcome) => {
    setNotifyModal(null);
    const targetStatut = outcome === 'non_repare' ? 'non_repare' : 'pret';
    const message =
      outcome === 'non_repare'
        ? unrepairedMessage({
            clientNom: fiche.client_nom,
            appareil: fiche.appareil,
            atelier,
          })
        : readyMessage({
            clientNom: fiche.client_nom,
            appareil: fiche.appareil,
            prix: fiche.prix_estime,
            atelier,
          });

    let opened = true;
    if (channel === 'whatsapp') {
      opened = await openWhatsApp(fiche.client_tel, message, atelier.indicatif);
    } else if (channel === 'sms') {
      opened = await openSms(fiche.client_tel, message);
    }

    if (opened && fiche.statut !== targetStatut) {
      setBusyId(fiche.id);
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const updated = await updateRepairStatus(fiche.id, targetStatut);
        onUpdated(updated);
      } catch {
        // Message already opened; status will update on next try
      } finally {
        setBusyId(null);
      }
    }
  };

  // Open the Edit modal for a repair card
  const openEditModal = (fiche) => {
    const defaultDial = digitsOnly(atelier?.indicatif) || '225';
    setEditModal({
      id: fiche.id,
      clientNom: fiche.client_nom || '',
      clientTel: fiche.client_tel || '',
      dialCode: defaultDial,
      appareil: fiche.appareil || '',
      probleme: fiche.probleme || '',
      prix: String(fiche.prix_estime ?? 0),
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
      Alert.alert(
        'Infos manquantes',
        'Remplis le nom du client, son numéro, l’appareil et la panne.'
      );
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
        finalPhotoUrl = await persistPhotoUri(
          editModal.photoUri,
          digitsOnly(atelier.phone)
        );
      }

      const patch = {
        client_nom: editModal.clientNom.trim(),
        client_tel: storedPhone,
        appareil: editModal.appareil.trim(),
        probleme: editModal.probleme.trim(),
        prix_estime: parseInt(digitsOnly(editModal.prix), 10) || 0,
        statut: editModal.statut,
        photo_url: finalPhotoUrl || null,
      };
      if (editModal.statut === 'pret') {
        patch.pret_le = new Date().toISOString();
      } else if (editModal.statut === 'livre') {
        patch.livre_le = new Date().toISOString();
      }

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
      } catch (e) {
        Alert.alert('Erreur', e?.message || 'Problème de connexion.');
      } finally {
        setBusyId(null);
      }
    }
  };

  const searchScale = scrollY.interpolate({
    inputRange: [-40, 0, 90],
    outputRange: [1.02, 1, 0.97],
    extrapolate: 'clamp',
  });

  // Allow bulk deleting repaired / unrepaired / delivered items
  const canBulkDelete =
    ['pret', 'non_repare', 'livre'].includes(filterStatus) && filtered.length > 0;

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatPill
            label="En atelier"
            count={stats.actifs}
            active={filterStatus === 'all'}
            color={colors.primary}
            onPress={() => handleFilterChange('all')}
          />
          <StatPill
            label="En cours"
            count={stats.enCours}
            active={filterStatus === 'en_cours'}
            color={colors.accent}
            onPress={() => handleFilterChange('en_cours')}
          />
          <StatPill
            label="Réparés (Prêts)"
            count={stats.prets}
            active={filterStatus === 'pret'}
            color={colors.success}
            onPress={() => handleFilterChange('pret')}
          />
          <StatPill
            label="Non réparés"
            count={stats.nonRepares}
            active={filterStatus === 'non_repare'}
            color={colors.danger}
            onPress={() => handleFilterChange('non_repare')}
          />
          <StatPill
            label="Récupérés"
            count={stats.livres}
            active={filterStatus === 'livre'}
            color={colors.textSecondary}
            onPress={() => handleFilterChange('livre')}
          />
        </ScrollView>

        {/* Bulk delete bar when viewing already-repaired, unrepaired, or delivered items */}
        {canBulkDelete ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setConfirmModal({
                type: 'delete_many',
                ids: filtered.map((f) => f.id),
                label:
                  filterStatus === 'pret'
                    ? `les ${filtered.length} appareil(s) déjà réparés`
                    : filterStatus === 'non_repare'
                    ? `les ${filtered.length} appareil(s) non réparés`
                    : `les ${filtered.length} appareil(s) récupérés`,
              });
            }}
            style={styles.bulkDeleteBar}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.bulkDeleteText}>
              Tout supprimer dans cet onglet ({filtered.length})
            </Text>
          </Pressable>
        ) : null}

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
              {query ? 'Aucun appareil trouvé' : 'Aucun appareil dans cette liste'}
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
              onWhatsApp={() => setNotifyModal({ fiche, mode: 'whatsapp' })}
              onSms={() => setNotifyModal({ fiche, mode: 'sms' })}
              onUnrepaired={() => setNotifyModal({ fiche, mode: 'unrepaired' })}
              onEdit={(f) => openEditModal(f)}
              onDelete={(f) =>
                setConfirmModal({
                  type: 'delete_one',
                  fiche: f,
                })
              }
              onDelivered={(f) =>
                setConfirmModal({
                  type: 'delivered',
                  fiche: f,
                })
              }
            />
          ))
        )}
      </Animated.ScrollView>

      {/* =====================================================================
          1. MODAL : CHOIX PROPRE / PRÊT (RÉPARÉ) OU NON RÉPARÉ (WHATSAPP / SMS)
         ===================================================================== */}
      <Modal
        visible={!!notifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifyModal(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setNotifyModal(null)}>
          <Pressable style={styles.choiceSheet} onPress={(e) => e.stopPropagation()}>
            {notifyModal ? (
              <>
                <LinearGradient
                  colors={
                    notifyModal.mode === 'whatsapp'
                      ? ['#16A34A', '#15803D']
                      : notifyModal.mode === 'sms'
                      ? ['#2563EB', '#1E40AF']
                      : ['#DC2626', '#991B1B']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.choiceHeader}
                >
                  <View style={styles.choiceHeaderIcon}>
                    <Ionicons
                      name={
                        notifyModal.mode === 'whatsapp'
                          ? 'logo-whatsapp'
                          : notifyModal.mode === 'sms'
                          ? 'chatbubble-ellipses'
                          : 'close-circle'
                      }
                      size={26}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceBadgeText}>
                      {notifyModal.mode === 'whatsapp'
                        ? 'RAPELO · MESSAGE WHATSAPP'
                        : notifyModal.mode === 'sms'
                        ? 'RAPELO · SMS DIRECT'
                        : 'RAPELO · APPAREIL NON RÉPARÉ'}
                    </Text>
                    <Text style={styles.choiceClientName} numberOfLines={1}>
                      {notifyModal.fiche.client_nom}
                    </Text>
                    <Text style={styles.choiceDeviceSub} numberOfLines={1}>
                      {notifyModal.fiche.appareil} · {notifyModal.fiche.client_tel}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setNotifyModal(null)}
                    style={styles.choiceCloseIcon}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
                </LinearGradient>

                <View style={styles.choiceBody}>
                  {notifyModal.mode === 'unrepaired' ? (
                    <>
                      <Text style={styles.choiceQuestion}>
                        Ça n'a pas marché ? Préviens {notifyModal.fiche.client_nom} de venir chercher son appareil :
                      </Text>

                      <View style={[styles.outcomeCard, styles.outcomeCardUnrepaired]}>
                        <View style={styles.outcomeTopRow}>
                          <View style={[styles.outcomeIconWrap, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="close-circle" size={24} color={colors.danger} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.outcomeTitle, { color: '#991B1B' }]}>
                              Non réparé · Venez récupérer l'appareil
                            </Text>
                            <Text style={styles.outcomePreview}>
                              « RAPELO — Bonjour {notifyModal.fiche.client_nom}, concernant votre{' '}
                              {notifyModal.fiche.appareil} : malheureusement la réparation n'a pas pu
                              aboutir. Vous pouvez venir récupérer votre appareil à l'atelier. »
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', marginTop: 12 }}>
                          <Button
                            small
                            title="WhatsApp"
                            icon="logo-whatsapp"
                            variant="whatsapp"
                            onPress={() =>
                              handleSendOutcome(notifyModal.fiche, 'whatsapp', 'non_repare')
                            }
                          />
                          <View style={{ width: 10 }} />
                          <Button
                            small
                            title="SMS Direct"
                            icon="chatbubble-ellipses"
                            variant="sms"
                            onPress={() =>
                              handleSendOutcome(notifyModal.fiche, 'sms', 'non_repare')
                            }
                          />
                        </View>

                        <Pressable
                          onPress={() =>
                            handleSendOutcome(notifyModal.fiche, 'none', 'non_repare')
                          }
                          style={styles.markOnlyBtn}
                        >
                          <Text style={styles.markOnlyText}>
                            Marquer « Non réparé » sans envoyer de message
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.choiceQuestion}>
                        Quel est le résultat pour l'appareil de {notifyModal.fiche.client_nom} ?
                      </Text>

                      {/* OPTION 1 : PROPRE / PRÊT (RÉPARÉ) */}
                      <Pressable
                        onPress={() =>
                          handleSendOutcome(notifyModal.fiche, notifyModal.mode, 'pret')
                        }
                        style={({ pressed }) => [
                          styles.outcomeCard,
                          styles.outcomeCardReady,
                          pressed && { transform: [{ scale: 0.985 }] },
                        ]}
                      >
                        <View style={styles.outcomeTopRow}>
                          <View style={[styles.outcomeIconWrap, { backgroundColor: '#DCFCE7' }]}>
                            <Ionicons name="checkmark-done-circle" size={26} color="#15803D" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.outcomePillReady}>
                              <Text style={styles.outcomePillReadyText}>
                                OUI · PROPRE / RÉPARÉ (PRÊT)
                              </Text>
                            </View>
                            <Text style={[styles.outcomeTitle, { color: '#14532D' }]}>
                              L'appareil est prêt ! Venez le récupérer
                            </Text>
                            <Text style={styles.outcomePreview}>
                              « RAPELO — Bonjour {notifyModal.fiche.client_nom}, bonne nouvelle !
                              Votre {notifyModal.fiche.appareil} est prêt (
                              {formatPrice(notifyModal.fiche.prix_estime)}). »
                            </Text>
                          </View>
                        </View>
                        <View style={styles.outcomeActionBtnReady}>
                          <Ionicons
                            name={
                              notifyModal.mode === 'whatsapp'
                                ? 'logo-whatsapp'
                                : 'chatbubble-ellipses'
                            }
                            size={17}
                            color="#FFFFFF"
                          />
                          <Text style={styles.outcomeActionBtnText}>
                            Envoyer « Appareil Prêt » à {notifyModal.fiche.client_nom}
                          </Text>
                        </View>
                      </Pressable>

                      {/* OPTION 2 : NON RÉPARÉ (ÇA N'A PAS MARCHÉ — VENEZ CHERCHER) */}
                      <Pressable
                        onPress={() =>
                          handleSendOutcome(
                            notifyModal.fiche,
                            notifyModal.mode,
                            'non_repare'
                          )
                        }
                        style={({ pressed }) => [
                          styles.outcomeCard,
                          styles.outcomeCardUnrepaired,
                          pressed && { transform: [{ scale: 0.985 }] },
                        ]}
                      >
                        <View style={styles.outcomeTopRow}>
                          <View style={[styles.outcomeIconWrap, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="close-circle" size={26} color="#DC2626" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.outcomePillUnrepaired}>
                              <Text style={styles.outcomePillUnrepairedText}>
                                NON · ÇA N'A PAS MARCHÉ (NON RÉPARÉ)
                              </Text>
                            </View>
                            <Text style={[styles.outcomeTitle, { color: '#7F1D1D' }]}>
                              Non réparé — Venez chercher votre appareil
                            </Text>
                            <Text style={styles.outcomePreview}>
                              « RAPELO — Bonjour {notifyModal.fiche.client_nom}, la réparation de
                              votre {notifyModal.fiche.appareil} n'a pas pu aboutir. Venez le
                              récupérer à l'atelier. »
                            </Text>
                          </View>
                        </View>
                        <View style={styles.outcomeActionBtnUnrepaired}>
                          <Ionicons
                            name={
                              notifyModal.mode === 'whatsapp'
                                ? 'logo-whatsapp'
                                : 'chatbubble-ellipses'
                            }
                            size={17}
                            color="#FFFFFF"
                          />
                          <Text style={styles.outcomeActionBtnText}>
                            Envoyer « Venez chercher l'appareil »
                          </Text>
                        </View>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    onPress={() => setNotifyModal(null)}
                    style={styles.cancelSheetBtn}
                  >
                    <Text style={styles.cancelSheetText}>Fermer</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* =====================================================================
          2. MODAL : MODIFIER LA FICHE DU CLIENT & DE L'APPAREIL
         ===================================================================== */}
      <Modal
        visible={!!editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <View style={styles.editHeaderLeft}>
                <View style={styles.editHeaderBadge}>
                  <Ionicons name="create" size={18} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.editHeaderTitle}>Modifier la fiche client</Text>
                  <Text style={styles.editHeaderSub}>
                    Modifie le client, l'appareil, le prix ou le statut
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setEditModal(null)} style={styles.editCloseBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            {editModal ? (
              <ScrollView
                contentContainerStyle={styles.editScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.sectionLabel}>ÉTAT DE LA RÉPARATION</Text>
                <View style={styles.statusGrid}>
                  {STATUS_OPTIONS.map((st) => {
                    const active = editModal.statut === st.id;
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() =>
                          setEditModal((m) => ({ ...m, statut: st.id }))
                        }
                        style={[
                          styles.statusChoiceChip,
                          active && {
                            backgroundColor: st.color,
                            borderColor: st.color,
                          },
                        ]}
                      >
                        <Ionicons
                          name={st.icon}
                          size={15}
                          color={active ? '#FFFFFF' : st.color}
                        />
                        <Text
                          style={[
                            styles.statusChoiceText,
                            active && { color: '#FFFFFF' },
                          ]}
                        >
                          {st.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <PhotoPicker
                  uri={editModal.photoUri}
                  onChange={(uri) => setEditModal((m) => ({ ...m, photoUri: uri }))}
                />

                <Field
                  label="Nom du client"
                  icon="person-outline"
                  placeholder="Ex : Konan Yao"
                  value={editModal.clientNom}
                  onChangeText={(v) => setEditModal((m) => ({ ...m, clientNom: v }))}
                />

                <Text style={styles.sectionLabel}>INDICATIF PAYS DU CLIENT</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 10 }}
                >
                  {COUNTRY_DIAL_CODES.map((c) => {
                    const active = editModal.dialCode === c.code;
                    return (
                      <Pressable
                        key={c.code}
                        onPress={() =>
                          setEditModal((m) => ({ ...m, dialCode: c.code }))
                        }
                        style={[styles.dialChip, active && styles.dialChipActive]}
                      >
                        <Text style={styles.dialFlag}>{c.flag}</Text>
                        <Text style={[styles.dialText, active && styles.dialTextActive]}>
                          +{c.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Field
                  label="Numéro du client (WhatsApp / SMS)"
                  icon="call-outline"
                  placeholder="Ex : 07 07 07 07 07"
                  keyboardType="phone-pad"
                  value={editModal.clientTel}
                  onChangeText={(v) => setEditModal((m) => ({ ...m, clientTel: v }))}
                />

                <Field
                  label="Appareil (Marque & Modèle)"
                  icon="phone-portrait-outline"
                  placeholder="Ex : iPhone 13, PC HP, TV Samsung..."
                  value={editModal.appareil}
                  onChangeText={(v) => setEditModal((m) => ({ ...m, appareil: v }))}
                />

                <Field
                  label="Panne / Problème"
                  icon="construct-outline"
                  placeholder="Décris la panne..."
                  multiline
                  value={editModal.probleme}
                  onChangeText={(v) => setEditModal((m) => ({ ...m, probleme: v }))}
                />

                <Field
                  label="Montant / Prix (FCFA)"
                  icon="cash-outline"
                  rightSuffix="FCFA"
                  placeholder="Ex : 15000"
                  keyboardType="number-pad"
                  value={editModal.prix}
                  onChangeText={(v) =>
                    setEditModal((m) => ({ ...m, prix: digitsOnly(v) }))
                  }
                />

                <View style={styles.editFooterRow}>
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
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =====================================================================
          3. MODAL : CONFIRMATION DE SUPPRESSION OU DE RÉCUPÉRATION
         ===================================================================== */}
      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmModal(null)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            {confirmModal ? (
              <>
                <View
                  style={[
                    styles.confirmIconCircle,
                    confirmModal.type === 'delivered'
                      ? { backgroundColor: colors.badgeGreen }
                      : { backgroundColor: colors.dangerSoft },
                  ]}
                >
                  <Ionicons
                    name={
                      confirmModal.type === 'delivered'
                        ? 'checkmark-done-circle'
                        : 'trash'
                    }
                    size={30}
                    color={
                      confirmModal.type === 'delivered'
                        ? colors.success
                        : colors.danger
                    }
                  />
                </View>

                <Text style={styles.confirmTitle}>
                  {confirmModal.type === 'delete_one'
                    ? 'Supprimer cet appareil ?'
                    : confirmModal.type === 'delete_many'
                    ? 'Tout supprimer ?'
                    : confirmModal.fiche?.statut === 'livre'
                    ? 'Remettre cet appareil en atelier ?'
                    : 'Appareil récupéré par le client ?'}
                </Text>

                <Text style={styles.confirmMessage}>
                  {confirmModal.type === 'delete_one'
                    ? `Veux-tu supprimer définitivement la fiche de ${confirmModal.fiche?.client_nom} (${confirmModal.fiche?.appareil}) ?`
                    : confirmModal.type === 'delete_many'
                    ? `Veux-tu supprimer définitivement ${confirmModal.label} ?`
                    : confirmModal.fiche?.statut === 'livre'
                    ? `La fiche de ${confirmModal.fiche?.client_nom} (${confirmModal.fiche?.appareil}) reviendra dans les appareils en cours.`
                    : `${confirmModal.fiche?.client_nom} a bien récupéré son ${confirmModal.fiche?.appareil} ? La fiche sera classée dans l'onglet « Récupérés ».`}
                </Text>

                <View style={styles.confirmBtnRow}>
                  <Pressable
                    onPress={() => setConfirmModal(null)}
                    style={[styles.confirmBtn, styles.confirmBtnCancel]}
                  >
                    <Text style={styles.confirmBtnCancelText}>Annuler</Text>
                  </Pressable>
                  <View style={{ width: 10 }} />
                  <Pressable
                    onPress={executeConfirmAction}
                    style={[
                      styles.confirmBtn,
                      confirmModal.type === 'delivered'
                        ? styles.confirmBtnSuccess
                        : styles.confirmBtnDanger,
                    ]}
                  >
                    <Text style={styles.confirmBtnActionText}>
                      {confirmModal.type === 'delivered'
                        ? confirmModal.fiche?.statut === 'livre'
                          ? 'Oui, remettre'
                          : 'Oui, récupéré'
                        : 'Oui, supprimer'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
    <Animated.View style={{ marginRight: 8, transform: [{ scale }] }}>
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
          style={[styles.statLabel, active && { color: 'rgba(255,255,255,0.92)' }]}
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
    paddingBottom: 14,
  },
  statPill: {
    minWidth: 92,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadowSoft,
  },
  statCount: { fontSize: 17, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 2 },
  bulkDeleteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  bulkDeleteText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 6,
  },
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

  // Shared modal backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  // Choice modal ("Prêt / Propre ou Non réparé")
  choiceSheet: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow,
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  choiceHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  choiceBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
  },
  choiceClientName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  choiceDeviceSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },
  choiceCloseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  choiceBody: {
    padding: 18,
  },
  choiceQuestion: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  outcomeCard: {
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
  },
  outcomeCardReady: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  outcomeCardUnrepaired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  outcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  outcomeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  outcomePillReady: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  outcomePillReadyText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  outcomePillUnrepaired: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  outcomePillUnrepairedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B91C1C',
    letterSpacing: 0.4,
  },
  outcomeTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  outcomePreview: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  outcomeActionBtnReady: {
    marginTop: 12,
    backgroundColor: '#16A34A',
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeActionBtnUnrepaired: {
    marginTop: 12,
    backgroundColor: '#DC2626',
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
  markOnlyBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  markOnlyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    textDecorationLine: 'underline',
  },
  cancelSheetBtn: {
    marginTop: 2,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelSheetText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },

  // Edit Repair Modal
  editSheet: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  editHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editHeaderBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  editHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  editHeaderSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  editCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editScroll: {
    padding: 18,
    paddingBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  statusChoiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  statusChoiceText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 5,
  },
  dialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 7,
  },
  dialChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: colors.whatsappDark,
  },
  dialFlag: { fontSize: 14, marginRight: 5 },
  dialText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  dialTextActive: { color: colors.whatsappDark },
  editFooterRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  // Confirmation modal
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    ...shadow,
  },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 18,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  confirmBtnCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  confirmBtnDanger: {
    backgroundColor: colors.danger,
  },
  confirmBtnSuccess: {
    backgroundColor: colors.success,
  },
  confirmBtnActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
