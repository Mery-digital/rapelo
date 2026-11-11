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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Field from '../components/Field';
import Button from '../components/Button';
import { colors, radius, shadow } from '../theme';
import { saveAtelier, clearAtelier, hashPassword } from '../lib/storage';
import { digitsOnly } from '../lib/messaging';

/**
 * mode = "setup" : first time, create the workshop
 * mode = "login" : workshop already saved, check phone + password
 */
export default function SetupScreen({ mode, savedAtelier, onDone, onReset }) {
  const isLogin = mode === 'login';
  const [phone, setPhone] = useState(isLogin ? savedAtelier?.phone || '' : '');
  const [password, setPassword] = useState('');
  const [atelierNom, setAtelierNom] = useState('');
  const [localisation, setLocalisation] = useState('');
  const [indicatif, setIndicatif] = useState('225');
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 7,
      }),
    ]).start();
  }, [fade, slide]);

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[styles.brand, { opacity: fade, transform: [{ translateY: slide }] }]}
          >
            <View style={styles.logoCard}>
              <Image
                source={require('../../assets/logo.jpg')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.tagline}>
              Gestion moderne d'atelier électronique & réparation
            </Text>
          </Animated.View>

          <Animated.View
            style={[styles.card, { opacity: fade, transform: [{ translateY: slide }] }]}
          >
            {isLogin ? (
              <>
                <Text style={styles.title}>Bon retour 👋</Text>
                <Text style={styles.subtitle}>{savedAtelier?.atelierNom}</Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Configure ton atelier</Text>
                <Text style={styles.subtitle}>
                  Ces infos s'ajoutent automatiquement aux messages WhatsApp et SMS des clients.
                </Text>
              </>
            )}

            <Field
              label="Numéro de téléphone (Infoline)"
              icon="call-outline"
              placeholder="Ex : 07 07 07 07 07"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Field
              label="Mot de passe"
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
                <Text style={styles.linkText}>Changer d’atelier / Mot de passe oublié</Text>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 28, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 22 },
  logoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow,
  },
  logoImage: {
    width: 190,
    height: 120,
  },
  tagline: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 18, lineHeight: 18 },
  link: { alignItems: 'center', marginTop: 16 },
  linkText: { color: colors.sms, fontSize: 13, fontWeight: '700' },
});
