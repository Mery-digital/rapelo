import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Field from '../components/Field';
import Button from '../components/Button';
import { HeroSwitch } from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../theme';
import { saveAtelier, clearAtelier, hashPassword } from '../lib/storage';
import { digitsOnly } from '../lib/messaging';

const WORKSHOP_BADGES = [
  { icon: 'construct', label: 'Soudure & Pièces', color: '#38BDF8' },
  { icon: 'phone-portrait-outline', label: 'Écrans & Tactiles', color: '#4ADE80' },
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
  const slide = useRef(new Animated.Value(28)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 7,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(spinAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fade, slide, floatAnim, pulseAnim, spinAnim]);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const toolRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '12deg'],
  });

  const handleSetup = async () => {
    if (!phone.trim() || !password || !atelierNom.trim() || !localisation.trim()) {
      Alert.alert('Il manque des infos', 'Merci de remplir toutes les cases.');
      return;
    }
    if (digitsOnly(phone).length < 8) {
      Alert.alert('Numéro pas bon', 'Vérifie ton numéro de téléphone.');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Mot de passe trop court', 'Mets au moins 4 caractères.');
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
      Alert.alert('Erreur', "Impossible d'enregistrer. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('Il manque des infos', 'Mets ton numéro et ton mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const hash = await hashPassword(digitsOnly(phone), password);
      if (
        digitsOnly(phone) !== digitsOnly(savedAtelier.phone) ||
        hash !== savedAtelier.passwordHash
      ) {
        Alert.alert('Connexion refusée', 'Numéro ou mot de passe incorrect.');
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
      "Les infos de l'atelier sur ce téléphone seront effacées. Les fiches restent enregistrées.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, effacer',
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* VITRINE D'ATELIER ANIMÉE HEROUI */}
          <Animated.View
            style={[
              styles.heroShowcase,
              { opacity: fade, transform: [{ translateY: slide }] },
              shadow,
            ]}
          >
            <LinearGradient
              colors={isDark ? ['#18181B', '#27272A', '#004493'] : ['#0B1120', '#1E3A8A', '#006FEE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              {/* Barre supérieure : badge live + interrupteur Jour / Nuit */}
              <View style={styles.topHeroBar}>
                <View style={styles.liveAtelierPill}>
                  <Animated.View
                    style={[
                      styles.liveDot,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  />
                  <Text style={styles.liveAtelierText}>
                    ATELIER PRO · RAPELO
                  </Text>
                </View>

                <HeroSwitch value={isDark} onValueChange={toggleTheme} />
              </View>

              {/* Logo central + outils flottants animés */}
              <View style={styles.logoOrbitWrap}>
                <Animated.View
                  style={[
                    styles.orbitBadge,
                    styles.orbitLeft,
                    { transform: [{ translateY: floatY }, { rotate: toolRotate }] },
                  ]}
                >
                  <Ionicons name="construct" size={18} color="#38BDF8" />
                </Animated.View>

                <Animated.View
                  style={[
                    styles.logoCard,
                    { transform: [{ translateY: floatY }] },
                  ]}
                >
                  <Image
                    source={require('../../assets/logo.jpg')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </Animated.View>

                <Animated.View
                  style={[
                    styles.orbitBadge,
                    styles.orbitRight,
                    { transform: [{ translateY: floatY }, { rotate: toolRotate }] },
                  ]}
                >
                  <Ionicons name="hardware-chip" size={18} color="#4ADE80" />
                </Animated.View>
              </View>

              <Text style={styles.tagline}>
                Atelier de Réparation Téléphones, PC, TV & Électronique
              </Text>

              {/* Puces des spécialités de réparation */}
              <View style={styles.specialtiesRow}>
                {WORKSHOP_BADGES.map((b) => (
                  <View key={b.label} style={styles.specialtyChip}>
                    <Ionicons name={b.icon} size={12} color={b.color} />
                    <Text style={styles.specialtyChipText}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* CARTE HEROUI DE CONNEXION / CONFIGURATION */}
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
            <View style={styles.cardHeaderRow}>
              <View
                style={[styles.cardHeaderIcon, { backgroundColor: theme.accentSoft }]}
              >
                <Ionicons
                  name={isLogin ? 'shield-checkmark' : 'construct'}
                  size={20}
                  color={theme.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                {isLogin ? (
                  <>
                    <Text style={[styles.title, { color: theme.text }]}>
                      Bon retour à l'atelier
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.muted }]}>
                      {savedAtelier?.atelierNom}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.title, { color: theme.text }]}>
                      Configure ton atelier
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.muted }]}>
                      Ces coordonnées s'ajoutent automatiquement sur les reçus WhatsApp et SMS des clients.
                    </Text>
                  </>
                )}
              </View>
            </View>

            <Field
              label="Numéro de téléphone (Infoline)"
              icon="call-outline"
              placeholder="Ex : 07 07 07 07 07"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Field
              label="Mot de passe du réparateur"
              icon="lock-closed-outline"
              placeholder="Ton mot de passe"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {!isLogin && (
              <>
                <Field
                  label="Nom de l'atelier"
                  icon="storefront-outline"
                  placeholder="Ex : Chez H et M Électronique"
                  value={atelierNom}
                  onChangeText={setAtelierNom}
                />
                <Field
                  label="Adresse / Quartier"
                  icon="location-outline"
                  placeholder="Ex : Lakota, près du marché"
                  value={localisation}
                  onChangeText={setLocalisation}
                />
                <Field
                  label="Indicatif du pays (pour WhatsApp)"
                  icon="globe-outline"
                  placeholder="225"
                  keyboardType="number-pad"
                  value={indicatif}
                  onChangeText={setIndicatif}
                  hint="Côte d'Ivoire 225 · Sénégal 221 · Cameroun 237 · Mali 223 · Burkina 226"
                />
              </>
            )}

            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Button
                title={isLogin ? 'Ouvrir mon atelier' : "Enregistrer l'atelier"}
                icon={isLogin ? 'arrow-forward-circle' : 'checkmark-circle'}
                onPress={isLogin ? handleLogin : handleSetup}
                loading={loading}
              />
            </View>

            {isLogin && (
              <Pressable onPress={handleReset} style={styles.link}>
                <Ionicons name="refresh-circle-outline" size={16} color={theme.accent} />
                <Text style={[styles.linkText, { color: theme.accent }]}>
                  Changer d’atelier / Mot de passe oublié
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, paddingTop: 20, flexGrow: 1, justifyContent: 'center' },
  heroShowcase: {
    marginBottom: 16,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  topHeroBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  liveAtelierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 7,
  },
  liveAtelierText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E2E8F0',
    letterSpacing: 0.7,
  },
  logoOrbitWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  orbitBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitLeft: { marginRight: 12 },
  orbitRight: { marginLeft: 12 },
  logoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'rgba(147, 197, 253, 0.5)',
    ...shadow,
  },
  logoImage: {
    width: 175,
    height: 104,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginTop: 2,
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  specialtyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  specialtyChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
    marginLeft: 5,
  },
  card: {
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  linkText: { fontSize: 13, fontWeight: '700', marginLeft: 5 },
});
