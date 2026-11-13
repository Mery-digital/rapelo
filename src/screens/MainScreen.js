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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NewRepairScreen from './NewRepairScreen';
import RepairsListScreen from './RepairsListScreen';
import Field from '../components/Field';
import Button from '../components/Button';
import {
  HeroAvatar,
  HeroBottomSheet,
  HeroChip,
  HeroCloseButton,
  HeroDialog,
  HeroSeparator,
  HeroSurface,
  HeroSwitch,
  HeroTabs,
  useToast,
} from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';
import { fetchRepairs, syncAtelierRepairs, isDemoMode } from '../lib/repairs';
import { saveAtelier, hashPassword } from '../lib/storage';
import { COUNTRY_DIAL_CODES, digitsOnly } from '../lib/messaging';

export default function MainScreen({ atelier, onAtelierUpdated, onLogout }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [tab, setTab] = useState('list'); // 'list' | 'new'
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Atelier BottomSheet
  const [atelierModalOpen, setAtelierModalOpen] = useState(false);
  const [atelierStep, setAtelierStep] = useState('info'); // 'info' | 'unlock' | 'edit'
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRepairs(atelier.phone);
      setRepairs(data);
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement des réparations');
    } finally {
      setLoading(false);
    }
  }, [atelier.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const switchTab = (nextTab) => {
    if (nextTab === tab) return;
    Haptics.selectionAsync().catch(() => {});

    Animated.parallel([
      Animated.timing(tabFade, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(tabSlide, {
        toValue: nextTab === 'new' ? -12 : 12,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTab(nextTab);
      tabSlide.setValue(nextTab === 'new' ? 12 : -12);
      Animated.parallel([
        Animated.timing(tabFade, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(tabSlide, {
          toValue: 0,
          useNativeDriver: true,
          speed: 28,
          bounciness: 6,
        }),
      ]).start();
    });
  };

  const handleCreated = (item) => {
    setRepairs((prev) => [item, ...prev]);
    switchTab('list');
    showToast({
      title: 'Dépôt enregistré',
      message: `${item.appareil} pour ${item.client_nom}`,
      type: 'success',
    });
  };

  const handleUpdated = (item) => {
    setRepairs((prev) => prev.map((f) => (f.id === item.id ? item : f)));
  };

  const handleRemoved = (id) => {
    setRepairs((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRemovedMany = (ids = []) => {
    setRepairs((prev) => prev.filter((f) => !ids.includes(f.id)));
  };

  const openAtelierModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAtelierStep('info');
    setCurrentPassword('');
    setPasswordError('');
    setConfirmLogout(false);
    setOwnerForm({
      atelierNom: atelier.atelierNom || '',
      localisation: atelier.localisation || '',
      phone: atelier.phone || '',
      indicatif: digitsOnly(atelier.indicatif) || '225',
      newPassword: '',
    });
    setAtelierModalOpen(true);
  };

  const handleVerifyPassword = async () => {
    if (!currentPassword) {
      setPasswordError('Veuillez entrer votre mot de passe.');
      return;
    }
    setVerifyingPwd(true);
    setPasswordError('');
    try {
      const cleanPhone = digitsOnly(atelier.phone);
      const hash = await hashPassword(cleanPhone, currentPassword);
      if (hash === atelier.passwordHash) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setAtelierStep('edit');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setPasswordError('Mot de passe incorrect.');
      }
    } catch {
      setPasswordError('Erreur de vérification.');
    } finally {
      setVerifyingPwd(false);
    }
  };

  const handleSaveOwner = async () => {
    const cleanNom = ownerForm.atelierNom.trim();
    const cleanLoc = ownerForm.localisation.trim();
    const cleanPhone = ownerForm.phone.trim();
    const cleanIndicatif = digitsOnly(ownerForm.indicatif) || '225';

    if (!cleanNom || !cleanLoc || !cleanPhone) {
      Alert.alert('Champs requis', "Remplis le nom de l'atelier, l'adresse et le téléphone.");
      return;
    }

    setSavingOwner(true);
    try {
      const oldTel = digitsOnly(atelier.phone);
      const newTel = digitsOnly(cleanPhone);
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
      showToast({
        title: 'Atelier mis à jour',
        message: 'Modifications enregistrées avec succès.',
        type: 'success',
      });
    } catch (e) {
      Alert.alert('Erreur', e?.message || "Impossible d'enregistrer.");
    } finally {
      setSavingOwner(false);
    }
  };

  const activeCount = repairs.filter((r) => r.statut !== 'livre').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* 1. HERO HEADER */}
      <LinearGradient
        colors={isDark ? ['#09090B', '#18181B'] : ['#0B1120', '#1E3A8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerBrand}>
          <Image
            source={require('../../assets/logo.jpg')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.statusLabel}>ATELIER CONNECTÉ</Text>
          </View>
          <Text style={styles.atelierName} numberOfLines={1}>
            {atelier.atelierNom}
          </Text>
          <Text style={styles.atelierSub} numberOfLines={1}>
            {atelier.localisation}
          </Text>
        </View>

        {/* Action button Atelier */}
        <Button
          size="sm"
          variant="outline"
          icon="settings-outline"
          title="Atelier"
          onPress={openAtelierModal}
          style={{ alignSelf: 'center' }}
        />
      </LinearGradient>

      {/* 2. MAIN APP CONTENT */}
      <View style={[styles.body, { backgroundColor: theme.bg }]}>
        {isDemoMode && (
          <View style={[styles.demoBanner, { backgroundColor: theme.warningSoft }]}>
            <Ionicons name="phone-portrait-outline" size={14} color={theme.warningDark} />
            <Text style={[styles.demoText, { color: theme.warningDark }]}>
              Mode local actif sur ce téléphone (WhatsApp & SMS opérationnels).
            </Text>
          </View>
        )}

        {/* 3. HERO TABS */}
        <HeroTabs
          activeKey={tab}
          onChange={switchTab}
          items={[
            {
              key: 'list',
              icon: 'construct-outline',
              label: `Banc d’atelier (${activeCount})`,
            },
            {
              key: 'new',
              icon: 'add-circle-outline',
              label: 'Nouveau dépôt',
            },
          ]}
        />

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
          4. HERO BOTTOM SHEET : ESPACE ATELIER
         ===================================================================== */}
      <HeroBottomSheet
        visible={atelierModalOpen}
        onClose={() => setAtelierModalOpen(false)}
        maxWidth={500}
      >
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              Espace Atelier · RAPELO
            </Text>
            <Text style={[styles.sheetSub, { color: theme.muted }]}>
              {atelier.atelierNom}
            </Text>
          </View>

          <HeroCloseButton
            size="sm"
            variant="default"
            onPress={() => setAtelierModalOpen(false)}
          />
        </View>

        <HeroSeparator />

        <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
          {/* Theme Mode Switch Card */}
          <HeroSurface style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                {isDark ? 'Mode Nuit (Sombre)' : 'Mode Jour (Clair)'}
              </Text>
              <Text style={[styles.settingSub, { color: theme.muted }]}>
                Basculer l’apparence de l’application
              </Text>
            </View>
            <HeroSwitch
              value={isDark}
              onValueChange={toggleTheme}
            />
          </HeroSurface>

          {/* ÉTAPE 1 : INFOS ATELIER */}
          {atelierStep === 'info' ? (
            <View style={{ marginTop: 8 }}>
              <HeroSurface style={styles.infoSurface}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.muted }]}>Nom de l’atelier</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>{atelier.atelierNom}</Text>
                </View>
                <HeroSeparator style={{ marginVertical: 8 }} />
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.muted }]}>Localisation</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>{atelier.localisation}</Text>
                </View>
                <HeroSeparator style={{ marginVertical: 8 }} />
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.muted }]}>Numéro Infoline</Text>
                  <Text style={[styles.infoVal, { color: theme.text }]}>
                    +{digitsOnly(atelier.indicatif) || '225'} {atelier.phone}
                  </Text>
                </View>
              </HeroSurface>

              <View style={styles.actionRowBtn}>
                <Button
                  title="Modifier les coordonnées"
                  icon="lock-closed-outline"
                  variant="primary"
                  onPress={() => setAtelierStep('unlock')}
                />
              </View>

              <View style={{ marginTop: 10 }}>
                <Button
                  title="Se déconnecter de l’atelier"
                  icon="power-outline"
                  variant="danger-soft"
                  onPress={() => setConfirmLogout(true)}
                />
              </View>
            </View>
          ) : null}

          {/* ÉTAPE 2 : DÉVERROUILLAGE PAR MOT DE PASSE */}
          {atelierStep === 'unlock' ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.unlockNotice, { color: theme.textSecondary }]}>
                Entre ton mot de passe administrateur pour modifier les informations de l’atelier :
              </Text>

              <Field
                label="Mot de passe actuel"
                icon="lock-closed-outline"
                secureTextEntry
                placeholder="Tape ton mot de passe..."
                value={currentPassword}
                onChangeText={(v) => {
                  setCurrentPassword(v);
                  if (passwordError) setPasswordError('');
                }}
                error={passwordError}
              />

              <View style={styles.actionRowBtn}>
                <Button
                  title="Retour"
                  variant="outline"
                  onPress={() => setAtelierStep('info')}
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

          {/* ÉTAPE 3 : FORMULAIRE DÉVERROUILLÉ */}
          {atelierStep === 'edit' ? (
            <View style={{ marginTop: 8 }}>
              <Field
                label="Nom de l’atelier"
                icon="business-outline"
                value={ownerForm.atelierNom}
                onChangeText={(v) => setOwnerForm((f) => ({ ...f, atelierNom: v }))}
              />

              <Field
                label="Localisation / Adresse"
                icon="location-outline"
                value={ownerForm.localisation}
                onChangeText={(v) => setOwnerForm((f) => ({ ...f, localisation: v }))}
              />

              <Field
                label="Numéro Infoline"
                icon="call-outline"
                keyboardType="phone-pad"
                value={ownerForm.phone}
                onChangeText={(v) => setOwnerForm((f) => ({ ...f, phone: v }))}
              />

              <Field
                label="Nouveau mot de passe (optionnel)"
                icon="key-outline"
                secureTextEntry
                placeholder="Laisse vide pour conserver l’actuel"
                value={ownerForm.newPassword}
                onChangeText={(v) => setOwnerForm((f) => ({ ...f, newPassword: v }))}
              />

              <View style={styles.actionRowBtn}>
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
            </View>
          ) : null}
        </ScrollView>
      </HeroBottomSheet>

      {/* =====================================================================
          5. HERO DIALOG : CONFIRMATION DE DÉCONNEXION
         ===================================================================== */}
      <HeroDialog
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        icon="power"
        iconColor={theme.danger}
        iconBg={theme.dangerSoft}
        title="Fermer la session de l’atelier ?"
        description={`Tu devras saisir à nouveau ton mot de passe pour rouvrir l’atelier ${atelier.atelierNom}.`}
      >
        <View style={styles.dialogButtons}>
          <Button
            size="sm"
            title="Annuler"
            variant="tertiary"
            onPress={() => setConfirmLogout(false)}
          />
          <View style={{ width: 10 }} />
          <Button
            size="sm"
            variant="danger"
            title="Oui, me déconnecter"
            onPress={() => {
              setConfirmLogout(false);
              setAtelierModalOpen(false);
              onLogout?.();
            }}
          />
        </View>
      </HeroDialog>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBrand: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 3,
    overflow: 'hidden',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#93C5FD',
    letterSpacing: 0.5,
  },
  atelierName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  atelierSub: {
    fontSize: 11.5,
    color: '#93C5FD',
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  demoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetScroll: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 10,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  settingSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  infoSurface: {
    padding: 14,
    marginBottom: 14,
  },
  infoItem: {
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  actionRowBtn: {
    flexDirection: 'row',
  },
  unlockNotice: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  dialogButtons: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 8,
  },
});
