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

  // Atelier profile modal state
  const [atelierModalOpen, setAtelierModalOpen] = useState(false);
  // 'info' (view details + logout) | 'unlock' (enter password) | 'edit' (unlocked form)
  const [atelierStep, setAtelierStep] = useState('info');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPwd, setVerifyingPwd] = useState(false);

  const [ownerForm, setOwnerForm] = useState({
    atelierNom: atelier.atelierNom || '',
    localisation: atelier.localisation || '',
    phone: atelier.phone || '',
    indicatif: digitsOnly(atelier.indicatif) || '225',
    newPassword: '',
  });
  const [savingOwner, setSavingOwner] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const tabFade = useRef(new Animated.Value(1)).current;
  const tabSlide = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;
  const toolSwing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1.3,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(toolSwing, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(toolSwing, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [livePulse, toolSwing]);

  const toolRotate = toolSwing.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '10deg'],
  });

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

  const openAtelierModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOwnerForm({
      atelierNom: atelier.atelierNom || '',
      localisation: atelier.localisation || '',
      phone: atelier.phone || '',
      indicatif: digitsOnly(atelier.indicatif) || '225',
      newPassword: '',
    });
    setCurrentPassword('');
    setPasswordError('');
    setConfirmLogout(false);
    setAtelierStep('info');
    setAtelierModalOpen(true);
  };

  const handleVerifyPassword = async () => {
    if (!currentPassword) {
      setPasswordError('Entre ton mot de passe actuel pour pouvoir modifier.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    setVerifyingPwd(true);
    setPasswordError('');
    try {
      const enteredHash = await hashPassword(
        digitsOnly(atelier.phone),
        currentPassword
      );
      if (enteredHash !== atelier.passwordHash) {
        setPasswordError('Mot de passe incorrect. Modification refusée.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAtelierStep('edit');
    } catch {
      setPasswordError('Impossible de vérifier le mot de passe.');
    } finally {
      setVerifyingPwd(false);
    }
  };

  const handleSaveOwner = async () => {
    const cleanNom = ownerForm.atelierNom.trim();
    const cleanLoc = ownerForm.localisation.trim();
    const cleanPhone = ownerForm.phone.trim();
    const cleanIndicatif = digitsOnly(ownerForm.indicatif) || '225';

    if (!currentPassword) {
      setPasswordError('Mot de passe obligatoire pour modifier le compte.');
      setAtelierStep('unlock');
      return;
    }

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

      // Re-verify current password before saving any change
      const checkHash = await hashPassword(oldTel, currentPassword);
      if (checkHash !== atelier.passwordHash) {
        setPasswordError('Mot de passe incorrect. Modification refusée.');
        setAtelierStep('unlock');
        return;
      }

      // If phone changed or a new password was provided, compute the new passwordHash
      const passwordToKeep = ownerForm.newPassword || currentPassword;
      const passwordHash = await hashPassword(newTel, passwordToKeep);

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
      setAtelierModalOpen(false);
    } catch (e) {
      Alert.alert('Erreur', e?.message || "Impossible d'enregistrer les modifications.");
    } finally {
      setSavingOwner(false);
    }
  };

  const activeCount = repairs.filter((r) => r.statut !== 'livre').length;
  const countryInfo = COUNTRY_DIAL_CODES.find(
    (c) => c.code === (digitsOnly(atelier.indicatif) || '225')
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0B1120', '#1E3A8A', '#1D4ED8']}
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
          <Animated.View
            style={[
              styles.toolCornerBadge,
              { transform: [{ rotate: toolRotate }] },
            ]}
          >
            <Ionicons name="construct" size={10} color="#FFFFFF" />
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.liveStatusRow}>
            <Animated.View
              style={[styles.liveDot, { transform: [{ scale: livePulse }] }]}
            />
            <Text style={styles.liveStatusLabel}>ATELIER DE RÉPARATION</Text>
          </View>
          <Text style={styles.atelier} numberOfLines={1}>
            {atelier.atelierNom}
          </Text>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color="#93C5FD" />
            <Text style={styles.location} numberOfLines={1}>
              {atelier.localisation} · {atelier.phone}
            </Text>
          </View>
        </View>

        {/* Seul bouton en haut à droite : Atelier (contient infos, modification protégée & déconnexion) */}
        <Pressable
          onPress={openAtelierModal}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="construct-outline" size={16} color="#93C5FD" />
          <Text style={styles.headerBtnText}>Atelier</Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color="#93C5FD"
            style={{ marginLeft: 4 }}
          />
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
            icon="construct-outline"
            label={`Banc d'atelier (${activeCount})`}
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
          MODAL ATELIER : INFOS DU RÉPARATEUR + MODIFICATION (AVEC MOT DE PASSE)
                          + PETIT COIN DE DÉCONNEXION
         ===================================================================== */}
      <Modal
        visible={atelierModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAtelierModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.ownerSheet}>
            {/* Bandeau supérieur de l'atelier avec petit coin de déconnexion */}
            <LinearGradient
              colors={['#0F172A', '#1E3A8A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ownerHero}
            >
              <View style={styles.ownerHeroLogoWrap}>
                <Image
                  source={require('../../assets/logo.jpg')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerHeroTag}>ESPACE ATELIER · RAPELO</Text>
                <Text style={styles.ownerHeroTitle} numberOfLines={1}>
                  {atelier.atelierNom}
                </Text>
              </View>

              {/* Petit coin de déconnexion en haut à droite */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setConfirmLogout(true);
                }}
                style={({ pressed }) => [
                  styles.logoutCornerBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="power" size={14} color="#FCA5A5" />
                <Text style={styles.logoutCornerText}>Déconnexion</Text>
              </Pressable>

              <Pressable
                onPress={() => setAtelierModalOpen(false)}
                style={styles.ownerHeroClose}
              >
                <Ionicons name="close" size={19} color="#FFFFFF" />
              </Pressable>
            </LinearGradient>

            <ScrollView
              contentContainerStyle={styles.ownerScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Confirmation de déconnexion si activée */}
              {confirmLogout ? (
                <View style={styles.logoutConfirmBox}>
                  <View style={styles.logoutIconCircle}>
                    <Ionicons name="log-out-outline" size={26} color={colors.danger} />
                  </View>
                  <Text style={styles.logoutModalTitle}>
                    Se déconnecter de l'atelier ?
                  </Text>
                  <Text style={styles.logoutModalText}>
                    Tu devras remettre ton numéro et ton mot de passe pour rouvrir la session.
                  </Text>
                  <View style={{ flexDirection: 'row', width: '100%', marginTop: 14 }}>
                    <Pressable
                      onPress={() => setConfirmLogout(false)}
                      style={[styles.logoutModalBtn, styles.logoutModalCancel]}
                    >
                      <Text style={styles.logoutModalCancelText}>Annuler</Text>
                    </Pressable>
                    <View style={{ width: 10 }} />
                    <Pressable
                      onPress={() => {
                        setAtelierModalOpen(false);
                        onLogout?.();
                      }}
                      style={[styles.logoutModalBtn, styles.logoutModalConfirm]}
                    >
                      <Text style={styles.logoutModalConfirmText}>
                        Oui, me déconnecter
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* ÉTAPE 1 : AFFICHAGE DES INFORMATIONS DU RÉPARATEUR */}
              {atelierStep === 'info' ? (
                <>
                  <Text style={styles.sectionLabel}>
                    COORDONNÉES ACTUELLES DU RÉPARATEUR
                  </Text>
                  <View style={styles.infoCard}>
                    <OwnerInfoRow
                      icon="storefront-outline"
                      label="Nom de l'atelier"
                      value={atelier.atelierNom}
                    />
                    <OwnerInfoRow
                      icon="location-outline"
                      label="Localisation"
                      value={atelier.localisation}
                    />
                    <OwnerInfoRow
                      icon="call-outline"
                      label="Numéro Infoline"
                      value={atelier.phone}
                    />
                    <OwnerInfoRow
                      icon="globe-outline"
                      label="Indicatif WhatsApp"
                      value={`${countryInfo ? `${countryInfo.flag} ` : ''}+${
                        digitsOnly(atelier.indicatif) || '225'
                      }`}
                      last
                    />
                  </View>

                  <View style={styles.securityNotice}>
                    <Ionicons name="lock-closed" size={16} color={colors.accent} />
                    <Text style={styles.securityNoticeText}>
                      La modification des coordonnées de l'atelier est protégée par ton mot de passe.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    <Button
                      title="Modifier mes coordonnées"
                      subtitle="Mot de passe requis"
                      icon="key-outline"
                      variant="primary"
                      onPress={() => {
                        setPasswordError('');
                        setCurrentPassword('');
                        setAtelierStep('unlock');
                      }}
                    />
                  </View>
                </>
              ) : null}

              {/* ÉTAPE 2 : VÉRIFICATION OBLIGATOIRE DU MOT DE PASSE */}
              {atelierStep === 'unlock' ? (
                <View style={styles.unlockBox}>
                  <View style={styles.unlockIconCircle}>
                    <Ionicons name="lock-closed" size={28} color={colors.accent} />
                  </View>
                  <Text style={styles.unlockTitle}>
                    Vérification du mot de passe
                  </Text>
                  <Text style={styles.unlockSub}>
                    Entre le mot de passe actuel de{' '}
                    <Text style={{ fontWeight: '800', color: colors.text }}>
                      {atelier.atelierNom}
                    </Text>{' '}
                    pour débloquer la modification des coordonnées.
                  </Text>

                  <View style={{ width: '100%', marginTop: 14 }}>
                    <Field
                      label="Mot de passe actuel (obligatoire)"
                      icon="lock-closed-outline"
                      placeholder="Tape ton mot de passe actuel..."
                      secureTextEntry
                      value={currentPassword}
                      onChangeText={(v) => {
                        setCurrentPassword(v);
                        if (passwordError) setPasswordError('');
                      }}
                    />
                  </View>

                  {passwordError ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color={colors.danger} />
                      <Text style={styles.errorBannerText}>{passwordError}</Text>
                    </View>
                  ) : null}

                  <View style={styles.ownerFooterRow}>
                    <Button
                      title="Retour"
                      variant="outline"
                      onPress={() => {
                        setPasswordError('');
                        setAtelierStep('info');
                      }}
                      disabled={verifyingPwd}
                    />
                    <View style={{ width: 10 }} />
                    <Button
                      title="Déverrouiller"
                      icon="lock-open-outline"
                      variant="primary"
                      loading={verifyingPwd}
                      onPress={handleVerifyPassword}
                    />
                  </View>
                </View>
              ) : null}

              {/* ÉTAPE 3 : FORMULAIRE DE MODIFICATION DÉVERROUILLÉ */}
              {atelierStep === 'edit' ? (
                <>
                  <View style={styles.unlockedBanner}>
                    <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                    <Text style={styles.unlockedBannerText}>
                      Mot de passe vérifié — tu peux modifier tes coordonnées.
                    </Text>
                  </View>

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
                      onPress={() => setAtelierStep('info')}
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
                </>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function OwnerInfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconBox}>
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    padding: 3,
  },
  toolCornerBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
    marginRight: 5,
  },
  liveStatusLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#93C5FD',
    letterSpacing: 0.7,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 5 },
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
    backgroundColor: 'rgba(15, 23, 42, 0.74)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  ownerSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow,
  },
  ownerHero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  ownerHeroLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 3,
    marginRight: 10,
    overflow: 'hidden',
  },
  ownerHeroTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#93C5FD',
    letterSpacing: 0.7,
  },
  ownerHeroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  logoutCornerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  logoutCornerText: {
    color: '#FECACA',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  ownerHeroClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerScroll: {
    padding: 18,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 10,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentDark,
    marginLeft: 8,
    lineHeight: 17,
  },
  bottomLogoutWrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  bottomLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.dangerSoft,
  },
  bottomLogoutText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 6,
  },
  unlockBox: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  unlockIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  unlockTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  unlockSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 19,
  },
  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 7,
  },
  unlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.badgeGreen,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  unlockedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    marginLeft: 7,
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
    width: '100%',
    marginTop: 8,
  },
  logoutConfirmBox: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoutModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  logoutModalText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  logoutModalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutModalCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logoutModalCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  logoutModalConfirm: {
    backgroundColor: colors.danger,
  },
  logoutModalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
