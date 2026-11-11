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
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NewRepairScreen from './NewRepairScreen';
import RepairsListScreen from './RepairsListScreen';
import Field from '../components/Field';
import Button from '../components/Button';
import { colors, radius, shadow, shadowSoft } from '../theme';
import { fetchRepairs, syncAtelierRepairs, isDemoMode } from '../lib/repairs';
import { saveAtelier, hashPassword } from '../lib/storage';
import { COUNTRY_DIAL_CODES, digitsOnly } from '../lib/messaging';

export default function MainScreen({ atelier, onAtelierUpdated, onLogout }) {
  const [tab, setTab] = useState('list'); // 'new' | 'list'
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOwnerOpen, setEditOwnerOpen] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    atelierNom: atelier.atelierNom || '',
    localisation: atelier.localisation || '',
    phone: atelier.phone || '',
    indicatif: digitsOnly(atelier.indicatif) || '225',
    newPassword: '',
  });
  const [savingOwner, setSavingOwner] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

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
  const handleRemoved = (id) =>
    setRepairs((list) => list.filter((r) => r.id !== id));
  const handleRemovedMany = (ids = []) => {
    const idSet = new Set(ids);
    setRepairs((list) => list.filter((r) => !idSet.has(r.id)));
  };

  const openOwnerEditor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOwnerForm({
      atelierNom: atelier.atelierNom || '',
      localisation: atelier.localisation || '',
      phone: atelier.phone || '',
      indicatif: digitsOnly(atelier.indicatif) || '225',
      newPassword: '',
    });
    setEditOwnerOpen(true);
  };

  const handleSaveOwner = async () => {
    const cleanNom = ownerForm.atelierNom.trim();
    const cleanLoc = ownerForm.localisation.trim();
    const cleanPhone = ownerForm.phone.trim();
    const cleanIndicatif = digitsOnly(ownerForm.indicatif) || '225';

    if (!cleanNom || !cleanLoc || !cleanPhone) {
      Alert.alert(
        'Infos manquantes',
        "Remplis le nom de l'atelier, l'adresse et le numéro Infoline."
      );
      return;
    }
    if (digitsOnly(cleanPhone).length < 8) {
      Alert.alert('Numéro invalide', "Vérifie le numéro de téléphone de l'atelier.");
      return;
    }
    if (ownerForm.newPassword && ownerForm.newPassword.length < 4) {
      Alert.alert('Mot de passe trop court', 'Mets au moins 4 caractères.');
      return;
    }

    setSavingOwner(true);
    try {
      const oldTel = digitsOnly(atelier.phone);
      const newTel = digitsOnly(cleanPhone);

      let passwordHash = atelier.passwordHash;
      if (ownerForm.newPassword) {
        passwordHash = await hashPassword(newTel, ownerForm.newPassword);
      }

      const updatedProfile = {
        ...atelier,
        atelierNom: cleanNom,
        localisation: cleanLoc,
        phone: cleanPhone,
        indicatif: cleanIndicatif,
        passwordHash,
      };

      await saveAtelier(updatedProfile);
      await syncAtelierRepairs(oldTel, newTel, cleanNom);

      setRepairs((list) =>
        list.map((r) => ({
          ...r,
          atelier_tel: newTel,
          atelier_nom: cleanNom,
        }))
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onAtelierUpdated?.(updatedProfile);
      setEditOwnerOpen(false);
    } catch (e) {
      Alert.alert('Erreur', e?.message || "Impossible d'enregistrer les modifications.");
    } finally {
      setSavingOwner(false);
    }
  };

  const activeCount = repairs.filter((r) => r.statut !== 'livre').length;

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
        <Pressable onPress={openOwnerEditor} style={{ flex: 1 }}>
          <Text style={styles.atelier} numberOfLines={1}>
            {atelier.atelierNom}
          </Text>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color="#93C5FD" />
            <Text style={styles.location} numberOfLines={1}>
              {atelier.localisation} · {atelier.phone}
            </Text>
          </View>
        </Pressable>

        {/* Bouton Modifier la fiche propriétaire / atelier */}
        <Pressable
          onPress={openOwnerEditor}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text style={styles.headerBtnText}>Atelier</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setLogoutModalOpen(true);
          }}
          style={({ pressed }) => [
            styles.headerBtn,
            { marginLeft: 7 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
          <Text style={styles.headerBtnText}>Sortir</Text>
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
            label={`Appareils (${activeCount})`}
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
              onRemovedMany={handleRemovedMany}
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

      {/* =====================================================================
          MODAL : MODIFIER LA FICHE DU PROPRIÉTAIRE / ATELIER
         ===================================================================== */}
      <Modal
        visible={editOwnerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditOwnerOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.ownerSheet}>
            <View style={styles.ownerHeader}>
              <View style={styles.ownerHeaderLeft}>
                <View style={styles.ownerBadge}>
                  <Ionicons name="storefront" size={18} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.ownerTitle}>Modifier mon atelier</Text>
                  <Text style={styles.ownerSub}>
                    Fiche du propriétaire (affichée dans les messages RAPELO)
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setEditOwnerOpen(false)}
                style={styles.ownerCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.ownerScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Field
                label="Nom de l'atelier / Propriétaire"
                icon="storefront-outline"
                placeholder="Ex : Chez H et M Électronique"
                value={ownerForm.atelierNom}
                onChangeText={(v) =>
                  setOwnerForm((f) => ({ ...f, atelierNom: v }))
                }
              />

              <Field
                label="Adresse / Quartier / Localisation"
                icon="location-outline"
                placeholder="Ex : Lakota, près du marché"
                value={ownerForm.localisation}
                onChangeText={(v) =>
                  setOwnerForm((f) => ({ ...f, localisation: v }))
                }
              />

              <Field
                label="Numéro de téléphone (Infoline)"
                icon="call-outline"
                placeholder="Ex : 07 07 07 07 07"
                keyboardType="phone-pad"
                value={ownerForm.phone}
                onChangeText={(v) => setOwnerForm((f) => ({ ...f, phone: v }))}
              />

              <Text style={styles.sectionLabel}>INDICATIF PAYS DE L'ATELIER</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                {COUNTRY_DIAL_CODES.map((c) => {
                  const active = ownerForm.indicatif === c.code;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() =>
                        setOwnerForm((f) => ({ ...f, indicatif: c.code }))
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
                label="Nouveau mot de passe (optionnel)"
                icon="lock-closed-outline"
                placeholder="Laisse vide pour garder ton mot de passe actuel"
                secureTextEntry
                value={ownerForm.newPassword}
                onChangeText={(v) =>
                  setOwnerForm((f) => ({ ...f, newPassword: v }))
                }
              />

              <View style={styles.ownerFooterRow}>
                <Button
                  title="Annuler"
                  variant="outline"
                  onPress={() => setEditOwnerOpen(false)}
                  disabled={savingOwner}
                />
                <View style={{ width: 10 }} />
                <Button
                  title="Enregistrer"
                  icon="checkmark-circle"
                  variant="primary"
                  loading={savingOwner}
                  onPress={handleSaveOwner}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =====================================================================
          MODAL : CONFIRMATION DE DÉCONNEXION
         ===================================================================== */}
      <Modal
        visible={logoutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setLogoutModalOpen(false)}
        >
          <Pressable style={styles.logoutCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.logoutIconCircle}>
              <Ionicons name="log-out-outline" size={28} color={colors.danger} />
            </View>
            <Text style={styles.logoutModalTitle}>Fermer la session ?</Text>
            <Text style={styles.logoutModalText}>
              Tu pourras te reconnecter à tout moment avec ton numéro et ton mot de passe.
            </Text>
            <View style={{ flexDirection: 'row', width: '100%', marginTop: 16 }}>
              <Pressable
                onPress={() => setLogoutModalOpen(false)}
                style={[styles.logoutModalBtn, styles.logoutModalCancel]}
              >
                <Text style={styles.logoutModalCancelText}>Annuler</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                onPress={() => {
                  setLogoutModalOpen(false);
                  onLogout?.();
                }}
                style={[styles.logoutModalBtn, styles.logoutModalConfirm]}
              >
                <Text style={styles.logoutModalConfirmText}>Se déconnecter</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  brandBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    padding: 3,
    overflow: 'hidden',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  atelier: { color: '#fff', fontSize: 17, fontWeight: '800' },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  location: { color: '#CBD5E1', fontSize: 12, marginLeft: 4 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  ownerSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  ownerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ownerBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ownerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  ownerSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  ownerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerScroll: {
    padding: 18,
    paddingBottom: 26,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
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
  ownerFooterRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  logoutCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    ...shadow,
  },
  logoutIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoutModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  logoutModalText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  logoutModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutModalCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logoutModalCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  logoutModalConfirm: {
    backgroundColor: colors.danger,
  },
  logoutModalConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
