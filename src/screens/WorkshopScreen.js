import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Field from '../components/Field';
import Button from '../components/Button';
import {
  HeroCard,
  HeroChip,
  HeroDialog,
  HeroSeparator,
  HeroSurface,
  HeroSwitch,
  useToast,
} from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';
import { saveAtelier, hashPassword } from '../lib/storage';
import { syncAtelierRepairs } from '../lib/repairs';
import { digitsOnly, formatPrice } from '../lib/messaging';

export default function WorkshopScreen({
  atelier,
  repairs = [],
  onAtelierUpdated,
  onLogout,
}) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pwdError, setPwdError] = useState('');

  const [form, setForm] = useState({
    atelierNom: atelier.atelierNom || '',
    localisation: atelier.localisation || '',
    phone: atelier.phone || '',
    indicatif: digitsOnly(atelier.indicatif) || '225',
    newPassword: '',
  });
  const [saving, setSaving] = useState(false);

  // Computations
  const totalRepairs = repairs.length;
  const enCours = repairs.filter((r) => r.statut === 'en_cours').length;
  const prets = repairs.filter((r) => r.statut === 'pret').length;
  const livres = repairs.filter((r) => r.statut === 'livre').length;
  const totalCa = repairs.reduce((acc, r) => acc + (Number(r.prix_estime) || 0), 0);
  const totalEncaisse = repairs.reduce((acc, r) => acc + (Number(r.avance_payee) || 0), 0);

  const handleUnlock = async () => {
    if (!unlockPassword) {
      setPwdError('Saisis ton mot de passe.');
      return;
    }
    const cleanPhone = digitsOnly(atelier.phone);
    const hash = await hashPassword(cleanPhone, unlockPassword);
    if (hash === atelier.passwordHash) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsUnlocked(true);
      setPwdError('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPwdError('Mot de passe incorrect.');
    }
  };

  const handleSave = async () => {
    const cleanNom = form.atelierNom.trim();
    const cleanLoc = form.localisation.trim();
    const cleanPhone = form.phone.trim();
    const cleanIndicatif = digitsOnly(form.indicatif) || '225';

    if (!cleanNom || !cleanLoc || !cleanPhone) {
      Alert.alert('Champs requis', 'Renseigne le nom, la localisation et le téléphone.');
      return;
    }

    setSaving(true);
    try {
      const oldTel = digitsOnly(atelier.phone);
      const newTel = digitsOnly(cleanPhone);
      const passwordToKeep = form.newPassword || unlockPassword;
      const passwordHash = await hashPassword(newTel, passwordToKeep);

      const updated = {
        ...atelier,
        atelierNom: cleanNom,
        localisation: cleanLoc,
        phone: cleanPhone,
        indicatif: cleanIndicatif,
        passwordHash,
      };

      await saveAtelier(updated);
      await syncAtelierRepairs(oldTel, newTel, cleanNom);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onAtelierUpdated?.(updated);
      setIsUnlocked(false);
      setUnlockPassword('');
      showToast({
        title: 'Atelier mis à jour',
        message: 'Tes coordonnées ont été actualisées.',
        type: 'success',
      });
    } catch (e) {
      Alert.alert('Erreur', e?.message || "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* 1. ATELIER IDENTITY CARD */}
      <HeroCard style={styles.identityCard}>
        <HeroCard.Header style={styles.identityHeader}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/logo.jpg')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={styles.badgeRow}>
              <View style={styles.liveDot} />
              <Text style={[styles.badgeTag, { color: theme.accent }]}>
                ATELIER ACTIF
              </Text>
            </View>
            <Text style={[styles.atelierName, { color: theme.text }]} numberOfLines={1}>
              {atelier.atelierNom}
            </Text>
            <Text style={[styles.atelierLoc, { color: theme.muted }]} numberOfLines={1}>
              {atelier.localisation}
            </Text>
            <Text style={[styles.atelierTel, { color: theme.textSecondary }]}>
              +{digitsOnly(atelier.indicatif) || '225'} {atelier.phone}
            </Text>
          </View>
        </HeroCard.Header>
      </HeroCard>

      {/* 2. STATISTIQUES ATELIER */}
      <HeroCard style={styles.sectionCard}>
        <HeroCard.Header>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            PERFORMANCES DE L’ATELIER :
          </Text>
        </HeroCard.Header>
        <HeroCard.Body>
          <View style={styles.metricsRow}>
            <HeroSurface style={styles.metricItem}>
              <Text style={[styles.metricCount, { color: theme.accent }]}>{enCours}</Text>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Sur le banc</Text>
            </HeroSurface>
            <HeroSurface style={styles.metricItem}>
              <Text style={[styles.metricCount, { color: theme.whatsapp }]}>{prets}</Text>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Prêts à livrer</Text>
            </HeroSurface>
            <HeroSurface style={styles.metricItem}>
              <Text style={[styles.metricCount, { color: theme.text }]}>{livres}</Text>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Remis client</Text>
            </HeroSurface>
          </View>

          <View style={[styles.caCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.caLabel, { color: theme.muted }]}>Volume total d’affaires</Text>
              <Text style={[styles.caValue, { color: theme.text }]}>{formatPrice(totalCa)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.caLabel, { color: theme.muted }]}>Acomptes encaissés</Text>
              <Text style={[styles.caValue, { color: theme.whatsapp }]}>{formatPrice(totalEncaisse)}</Text>
            </View>
          </View>
        </HeroCard.Body>
      </HeroCard>

      {/* 3. APPARENCE : JOUR / NUIT */}
      <HeroCard style={styles.sectionCard}>
        <HeroCard.Header>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            APPARENCE & THÈME :
          </Text>
        </HeroCard.Header>
        <HeroCard.Body>
          <HeroSurface style={styles.themeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeTitle, { color: theme.text }]}>
                {isDark ? 'Mode Nuit (Sombre)' : 'Mode Jour (Clair)'}
              </Text>
              <Text style={[styles.themeSubtitle, { color: theme.muted }]}>
                Adapte l'éclairage de l’écran pour le travail en atelier
              </Text>
            </View>
            <HeroSwitch value={isDark} onValueChange={toggleTheme} />
          </HeroSurface>
        </HeroCard.Body>
      </HeroCard>

      {/* 4. MODIFICATION DES COORDONNÉES */}
      <HeroCard style={styles.sectionCard}>
        <HeroCard.Header>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            COORDONNÉES & SÉCURITÉ :
          </Text>
        </HeroCard.Header>
        <HeroCard.Body>
          {!isUnlocked ? (
            <View>
              <Text style={[styles.lockNotice, { color: theme.textSecondary }]}>
                Pour modifier le nom de l’atelier, le numéro ou le mot de passe, déverrouille l’accès :
              </Text>
              <Field
                label="Mot de passe actuel"
                icon="lock-closed-outline"
                secureTextEntry
                placeholder="Tape ton mot de passe..."
                value={unlockPassword}
                onChangeText={(v) => {
                  setUnlockPassword(v);
                  if (pwdError) setPwdError('');
                }}
                error={pwdError}
              />
              <Button
                size="sm"
                variant="primary"
                icon="lock-open-outline"
                title="Déverrouiller la modification"
                onPress={handleUnlock}
              />
            </View>
          ) : (
            <View>
              <Field
                label="Nom de l’atelier"
                icon="business-outline"
                value={form.atelierNom}
                onChangeText={(v) => setForm((f) => ({ ...f, atelierNom: v }))}
              />
              <Field
                label="Localisation / Adresse"
                icon="location-outline"
                value={form.localisation}
                onChangeText={(v) => setForm((f) => ({ ...f, localisation: v }))}
              />
              <Field
                label="Numéro Infoline"
                icon="call-outline"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              />
              <Field
                label="Nouveau mot de passe (optionnel)"
                icon="key-outline"
                secureTextEntry
                placeholder="Laisse vide pour conserver le même"
                value={form.newPassword}
                onChangeText={(v) => setForm((f) => ({ ...f, newPassword: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Button
                  size="sm"
                  variant="outline"
                  title="Annuler"
                  onPress={() => setIsUnlocked(false)}
                />
                <Button
                  size="sm"
                  variant="primary"
                  icon="checkmark-circle"
                  title="Enregistrer"
                  loading={saving}
                  onPress={handleSave}
                />
              </View>
            </View>
          )}
        </HeroCard.Body>
      </HeroCard>

      {/* 5. DÉCONNEXION */}
      <View style={{ marginTop: 10, marginBottom: 30 }}>
        <Button
          size="md"
          variant="danger-soft"
          icon="power-outline"
          title="Fermer la session de l’atelier"
          onPress={() => setConfirmLogout(true)}
        />
      </View>

      {/* Confirmation de Déconnexion Dialog */}
      <HeroDialog
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        icon="power"
        iconColor={theme.danger}
        iconBg={theme.dangerSoft}
        title="Fermer la session ?"
        description={`Tu devras entrer ton mot de passe pour te reconnecter à ${atelier.atelierNom}.`}
      >
        <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
          <Button
            size="sm"
            title="Annuler"
            variant="tertiary"
            onPress={() => setConfirmLogout(false)}
          />
          <Button
            size="sm"
            variant="danger"
            title="Se déconnecter"
            onPress={() => {
              setConfirmLogout(false);
              onLogout?.();
            }}
          />
        </View>
      </HeroDialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  identityCard: {
    borderRadius: radius.xl,
    marginBottom: 16,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 3,
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
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
  badgeTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  atelierName: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  atelierLoc: {
    fontSize: 12,
    marginTop: 1,
  },
  atelierTel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricCount: {
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
  caCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  caLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  caValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  themeTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  themeSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  lockNotice: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
});
