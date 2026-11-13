import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Field from '../components/Field';
import Button from '../components/Button';
import {
  HeroCard,
  HeroChip,
  HeroSeparator,
  HeroSwitch,
} from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, shadowSoft } from '../theme';
import { saveAtelier, clearAtelier, hashPassword } from '../lib/storage';
import { digitsOnly } from '../lib/messaging';

const WORKSHOP_SPECIALTIES = [
  { icon: 'construct', label: 'Soudure & Pièces', color: '#38BDF8' },
  { icon: 'phone-portrait-outline', label: 'Écrans & Vitres', color: '#4ADE80' },
  { icon: 'hardware-chip-outline', label: 'Carte mère & IC', color: '#FBBF24' },
  { icon: 'flash-outline', label: 'Charge & Batterie', color: '#F472B6' },
];

export default function SetupScreen({ mode, savedAtelier, onDone, onReset }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const isLogin = mode === 'login';
  const [phone, setPhone] = useState(isLogin ? savedAtelier?.phone || '' : '');
  const [password, setPassword] = useState('');
  const [atelierNom, setAtelierNom] = useState('');
  const [localisation, setLocalisation] = useState('');
  const [indicatif, setIndicatif] = useState('225');
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 6,
      }),
    ]).start();
  }, [fade, slide]);

  const handleSetup = async () => {
    if (!phone.trim() || !password || !atelierNom.trim() || !localisation.trim()) {
      Alert.alert('Champs requis', 'Merci de renseigner toutes les informations.');
      return;
    }
    if (digitsOnly(phone).length < 8) {
      Alert.alert('Numéro incomplet', 'Vérifie ton numéro de téléphone.');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Mot de passe court', 'Choisis un mot de passe d’au moins 4 caractères.');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.trim();
      const profile = {
        phone: cleanPhone,
        atelierNom: atelierNom.trim(),
        localisation: localisation.trim(),
        indicatif: digitsOnly(indicatif) || '225',
        passwordHash: await hashPassword(digitsOnly(cleanPhone), password),
      };
      await saveAtelier(profile);
      onDone(profile);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer l’atelier.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('Champs requis', 'Saisis ton numéro et ton mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const hash = await hashPassword(digitsOnly(phone), password);
      if (
        digitsOnly(phone) !== digitsOnly(savedAtelier.phone) ||
        hash !== savedAtelier.passwordHash
      ) {
        Alert.alert('Accès refusé', 'Numéro ou mot de passe incorrect.');
        return;
      }
      onDone(savedAtelier);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Changer d’atelier ?',
      'Les identifiants locaux seront réinitialisés pour enregistrer un nouvel atelier.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, réinitialiser',
          style: 'destructive',
          onPress: async () => {
            await clearAtelier();
            onReset();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* 1. HERO SHOWCASE CARD */}
          <LinearGradient
            colors={isDark ? ['#09090B', '#18181B'] : ['#0B1120', '#1E3A8A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroShowcase}
          >
            <View style={styles.topBar}>
              <HeroChip
                label="SYSTÈME D’ATELIER · RAPELO"
                color="#38BDF8"
                variant="flat"
                size="sm"
              />

              <HeroSwitch value={isDark} onValueChange={toggleTheme} />
            </View>

            <View style={styles.logoCenter}>
              <View style={styles.logoWrap}>
                <Image
                  source={require('../../assets/logo.jpg')}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.heroTitle}>RAPELO</Text>
              <Text style={styles.heroSubtitle}>
                Gestion professionnelle d’atelier de réparation électronique
              </Text>
            </View>

            <View style={styles.specialtiesWrap}>
              {WORKSHOP_SPECIALTIES.map((s) => (
                <HeroChip
                  key={s.label}
                  icon={s.icon}
                  label={s.label}
                  color={s.color}
                  variant="flat"
                  size="sm"
                  style={styles.specialtyChip}
                />
              ))}
            </View>
          </LinearGradient>

          {/* 2. FORM HERO CARD */}
          <HeroCard style={styles.formCard}>
            <HeroCard.Header>
              <View style={styles.formHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons
                    name={isLogin ? 'shield-checkmark' : 'construct'}
                    size={22}
                    color={theme.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {isLogin ? 'Ouvrir mon atelier' : 'Créer mon atelier'}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.muted }]}>
                    {isLogin
                      ? savedAtelier?.atelierNom
                      : 'Informations figurant sur les reçus WhatsApp et SMS'}
                  </Text>
                </View>
              </View>
            </HeroCard.Header>

            <HeroSeparator style={{ marginVertical: 0 }} />

            <HeroCard.Body style={styles.cardBody}>
              <Field
                label="Numéro de téléphone (Infoline)"
                icon="call-outline"
                placeholder="Ex : 07 07 07 07 07"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                isRequired
              />

              <Field
                label="Mot de passe administrateur"
                icon="lock-closed-outline"
                placeholder="Ton mot de passe secret"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                isRequired
              />

              {!isLogin && (
                <>
                  <Field
                    label="Nom de l’atelier"
                    icon="business-outline"
                    placeholder="Ex : Clinique Mobile Pro"
                    value={atelierNom}
                    onChangeText={setAtelierNom}
                    isRequired
                  />

                  <Field
                    label="Localisation / Ville / Quartier"
                    icon="location-outline"
                    placeholder="Ex : Abidjan, Yopougon carrefour CHU"
                    value={localisation}
                    onChangeText={setLocalisation}
                    isRequired
                  />

                  <Field
                    label="Indicatif pays WhatsApp (sans le +)"
                    icon="globe-outline"
                    placeholder="Ex : 225"
                    keyboardType="numeric"
                    value={indicatif}
                    onChangeText={setIndicatif}
                    hint="Côte d’Ivoire 225 · Sénégal 221 · Cameroun 237 · Mali 223 · Burkina 226"
                  />
                </>
              )}
            </HeroCard.Body>

            <HeroSeparator style={{ marginVertical: 0 }} />

            <HeroCard.Footer>
              <Button
                title={isLogin ? 'Ouvrir l’atelier' : 'Enregistrer et démarrer'}
                icon={isLogin ? 'arrow-forward-circle' : 'checkmark-circle'}
                variant="primary"
                feedbackVariant="scale-ripple"
                onPress={isLogin ? handleLogin : handleSetup}
                loading={loading}
              />

              {isLogin && (
                <Pressable onPress={handleReset} style={styles.resetBtn}>
                  <Ionicons name="refresh-circle-outline" size={16} color={theme.accent} />
                  <Text style={[styles.resetText, { color: theme.accent }]}>
                    Changer d’atelier / Mot de passe oublié
                  </Text>
                </Pressable>
              )}
            </HeroCard.Footer>
          </HeroCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  heroShowcase: {
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  logoCenter: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: '#93C5FD',
    textAlign: 'center',
    marginTop: 3,
    paddingHorizontal: 12,
  },
  specialtiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  specialtyChip: {
    margin: 3,
  },
  formCard: {
    borderRadius: radius.xl,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cardBody: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 5,
  },
  resetText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
