import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Field from '../components/Field';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, shadowSoft } from '../theme';
import { createRepair } from '../lib/repairs';
import { persistPhotoUri } from '../lib/photos';
import {
  COUNTRY_DIAL_CODES,
  depositMessage,
  openWhatsApp,
  openSms,
  digitsOnly,
  toInternational,
  computeBalance,
  formatPrice,
} from '../lib/messaging';

export const DEVICE_CATEGORIES = [
  { id: 'phone', label: 'Smartphone', icon: 'phone-portrait-outline', hint: 'Ex : iPhone 13, Samsung A54, Tecno...' },
  { id: 'laptop', label: 'Ordinateur / PC', icon: 'laptop-outline', hint: 'Ex : PC HP Pavilion, MacBook Pro, Dell...' },
  { id: 'tablet', label: 'Tablette', icon: 'tablet-portrait-outline', hint: 'Ex : iPad Air, Galaxy Tab...' },
  { id: 'tv', label: 'Télévision / Écran', icon: 'tv-outline', hint: 'Ex : TV LG 43", Samsung Smart TV...' },
  { id: 'console', label: 'Console de jeu', icon: 'game-controller-outline', hint: 'Ex : PS5, PS4, Xbox, Nintendo Switch...' },
  { id: 'audio', label: 'Enceinte / Audio', icon: 'volume-high-outline', hint: 'Ex : Baffe JBL, Ampli, Home Cinéma...' },
  { id: 'appliance', label: 'Électroménager', icon: 'flash-outline', hint: 'Ex : Micro-ondes, Ventilateur, Fer, Mixeur...' },
  { id: 'other', label: 'Autre appareil', icon: 'hardware-chip-outline', hint: 'Ex : Imprimante, Décodeur Canal+, Onduleur...' },
];

const QUICK_PROBLEMS = [
  'Écran cassé / noir',
  'Ne s’allume plus',
  'Problème de charge',
  'Batterie faible',
  'Court-circuit / Eau',
  'Pas de son / image',
  'Déblocage / Système',
];

export default function NewRepairScreen({ atelier, onCreated }) {
  const { theme, isDark } = useTheme();
  const defaultDial = digitsOnly(atelier?.indicatif) || '225';
  const makeEmpty = () => ({
    category: 'phone',
    clientNom: '',
    clientTel: '',
    dialCode: defaultDial,
    appareil: '',
    probleme: '',
    prix: '',
    avance: '',
    photoUri: null,
  });

  const [form, setForm] = useState(makeEmpty);
  const [sending, setSending] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const toolAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(toolAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(toolAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [toolAnim]);

  const toolRotate = toolAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-14deg', '14deg'],
  });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const currentCat =
    DEVICE_CATEGORIES.find((c) => c.id === form.category) || DEVICE_CATEGORIES[0];

  const selectCategory = (cat) => {
    Haptics.selectionAsync().catch(() => {});
    setForm((f) => ({ ...f, category: cat.id }));
  };

  const selectDialCode = (code) => {
    Haptics.selectionAsync().catch(() => {});
    setForm((f) => ({ ...f, dialCode: code }));
  };

  const addQuickProblem = (chip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setForm((f) => {
      const cur = f.probleme.trim();
      if (cur.toLowerCase().includes(chip.toLowerCase())) return f;
      return { ...f, probleme: cur ? `${cur}, ${chip}` : chip };
    });
  };

  const validate = () => {
    const { clientNom, clientTel, appareil, probleme } = form;
    if (!clientNom.trim() || !clientTel.trim() || !appareil.trim() || !probleme.trim()) {
      Alert.alert(
        'Il manque des infos',
        'Remplis le nom du client, son numéro, l’appareil déposé et la panne.'
      );
      return false;
    }
    if (digitsOnly(clientTel).length < 7) {
      Alert.alert('Numéro pas bon', 'Vérifie le numéro de téléphone du client.');
      return false;
    }
    return true;
  };

  const sendMessage = (channel, phone, dialCode, message) =>
    channel === 'whatsapp'
      ? openWhatsApp(phone, message, dialCode)
      : openSms(phone, message);

  const submit = async (channel) => {
    if (!validate()) return;
    setSending(channel);

    const rawTel = form.clientTel.trim();
    const dialCode = form.dialCode || defaultDial;
    const intlDigits = toInternational(rawTel, dialCode);
    const storedPhone = rawTel.startsWith('+') ? rawTel : `+${intlDigits}`;

    const fullDeviceName = form.appareil.trim();
    const prixNum = parseInt(digitsOnly(form.prix), 10) || 0;
    const avanceNum = parseInt(digitsOnly(form.avance), 10) || 0;
    const message = depositMessage({
      clientNom: form.clientNom.trim(),
      appareil: fullDeviceName,
      prix: prixNum,
      avance: avanceNum,
      atelier,
    });

    const atelierTel = digitsOnly(atelier.phone);
    const savedPhotoUrl = await persistPhotoUri(form.photoUri, atelierTel);

    const payload = {
      atelier_nom: atelier.atelierNom,
      atelier_tel: atelierTel,
      client_nom: form.clientNom.trim(),
      client_tel: storedPhone,
      appareil: fullDeviceName,
      probleme: form.probleme.trim(),
      prix_estime: prixNum,
      avance_payee: avanceNum,
      statut: 'en_cours',
    };
    if (savedPhotoUrl) {
      payload.photo_url = savedPhotoUrl;
    }

    try {
      let created;
      try {
        created = await createRepair(payload);
      } catch (dbErr) {
        if (savedPhotoUrl && String(dbErr?.message || '').includes('photo_url')) {
          const { photo_url, ...withoutPhoto } = payload;
          created = await createRepair(withoutPhoto);
          created = { ...created, photo_url: savedPhotoUrl };
        } else {
          throw dbErr;
        }
      }
      await sendMessage(channel, storedPhone, dialCode, message);
      setForm(makeEmpty());
      onCreated?.({ ...created, categorie: form.category });
    } catch (e) {
      Alert.alert(
        'Fiche pas enregistrée',
        `${e?.message || 'Problème de connexion.'}\n\nTu veux quand même envoyer le message au client ?`,
        [
          { text: 'Non', style: 'cancel' },
          {
            text: 'Envoyer quand même',
            onPress: () => sendMessage(channel, storedPhone, dialCode, message),
          },
        ]
      );
    } finally {
      setSending(null);
    }
  };

  const bannerScale = scrollY.interpolate({
    inputRange: [-60, 0, 140],
    outputRange: [1.04, 1, 0.96],
    extrapolate: 'clamp',
  });
  const bannerTranslateY = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [0, -6],
    extrapolate: 'clamp',
  });

  const previewIntl = form.clientTel.trim()
    ? `+${toInternational(form.clientTel, form.dialCode)}`
    : null;

  return (
    <Animated.ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}
    >
      {/* Hero header card with scroll animation */}
      <Animated.View
        style={{
          transform: [{ scale: bannerScale }, { translateY: bannerTranslateY }],
        }}
      >
        <LinearGradient
          colors={isDark ? ['#18181B', '#27272A'] : ['#0B1120', '#1E3A8A', '#006FEE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroBanner,
            isDark && { borderWidth: 1, borderColor: '#3F3F46' },
            shadow,
          ]}
        >
          <View style={styles.heroTopRow}>
            <Animated.View
              style={[
                styles.heroIconWrap,
                { transform: [{ rotate: toolRotate }] },
              ]}
            >
              <Ionicons name="construct" size={24} color="#38BDF8" />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTag}>RÉCEPTION & DIAGNOSTIC D'ATELIER</Text>
              <Text style={styles.heroTitle}>Nouveau dépôt d'appareil</Text>
              <Text style={styles.heroSubtitle}>
                Téléphone, PC, TV, console, électroménager… prends la photo et envoie le reçu.
              </Text>
            </View>
          </View>

          <View style={styles.heroStepsRow}>
            <View style={styles.heroStepPill}>
              <Ionicons name="camera-outline" size={12} color="#38BDF8" />
              <Text style={styles.heroStepPillText}>1. Photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={12} color="#93C5FD" />
            <View style={styles.heroStepPill}>
              <Ionicons name="hardware-chip-outline" size={12} color="#4ADE80" />
              <Text style={styles.heroStepPillText}>2. Diagnostic</Text>
            </View>
            <Ionicons name="chevron-forward" size={12} color="#93C5FD" />
            <View style={styles.heroStepPill}>
              <Ionicons name="paper-plane-outline" size={12} color="#FBBF24" />
              <Text style={styles.heroStepPillText}>3. Reçu client</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
          shadow,
        ]}
      >
        <PhotoPicker uri={form.photoUri} onChange={set('photoUri')} />

        <Text style={[styles.sectionLabel, { color: theme.muted }]}>
          TYPE D'APPAREIL ÉLECTRONIQUE
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {DEVICE_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              cat={cat}
              active={form.category === cat.id}
              onPress={() => selectCategory(cat)}
            />
          ))}
        </ScrollView>

        <Field
          label="Marque & Modèle de l'appareil"
          icon={currentCat.icon}
          placeholder={currentCat.hint}
          value={form.appareil}
          onChangeText={set('appareil')}
        />

        <Field
          label="Nom du client"
          icon="person-outline"
          placeholder="Ex : Konan Yao"
          value={form.clientNom}
          onChangeText={set('clientNom')}
        />

        <Text style={[styles.sectionLabel, { color: theme.muted }]}>
          PAYS DU NUMÉRO WHATSAPP
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dialScroll}
        >
          {COUNTRY_DIAL_CODES.map((c) => {
            const active = form.dialCode === c.code;
            return (
              <Pressable
                key={c.code}
                onPress={() => selectDialCode(c.code)}
                style={[
                  styles.dialChip,
                  {
                    backgroundColor: active ? theme.whatsappSoft : theme.surface,
                    borderColor: active ? theme.whatsappDark : theme.border,
                  },
                ]}
              >
                <Text style={styles.dialFlag}>{c.flag}</Text>
                <Text
                  style={[
                    styles.dialText,
                    {
                      color: active ? theme.whatsappDark : theme.textSecondary,
                    },
                  ]}
                >
                  +{c.code}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          label="Numéro du client (WhatsApp / SMS)"
          icon="logo-whatsapp"
          rightSuffix={previewIntl || `+${form.dialCode}`}
          placeholder="Ex : 07 07 07 07 07"
          keyboardType="phone-pad"
          value={form.clientTel}
          onChangeText={set('clientTel')}
          hint={
            previewIntl
              ? `Numéro WhatsApp qui sera contacté : ${previewIntl}`
              : 'Choisis le drapeau du pays ci-dessus puis tape le numéro du client.'
          }
        />

        <Field
          label="Panne / Problème constaté"
          icon="build-outline"
          placeholder="Décris la panne ou touche un bouton rapide ci-dessous..."
          multiline
          value={form.probleme}
          onChangeText={set('probleme')}
        />
        <View style={styles.quickProblemsWrap}>
          {QUICK_PROBLEMS.map((p) => (
            <QuickChip key={p} label={p} onPress={() => addQuickProblem(p)} />
          ))}
        </View>

        <Field
          label="Prix estimé de la réparation (Total)"
          icon="cash-outline"
          rightSuffix="FCFA"
          placeholder="Ex : 15000"
          keyboardType="number-pad"
          value={form.prix}
          onChangeText={(v) => set('prix')(digitsOnly(v))}
        />

        <Field
          label="Avance payée par le client (Acompte)"
          icon="wallet-outline"
          rightSuffix="FCFA"
          placeholder="Ex : 5000 (laisse vide si 0)"
          keyboardType="number-pad"
          value={form.avance}
          onChangeText={(v) => set('avance')(digitsOnly(v))}
        />

        {Number(form.prix) > 0 || Number(form.avance) > 0 ? (
          <BalancePreview prix={form.prix} avance={form.avance} />
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Text style={[styles.sendLabel, { color: theme.textSecondary }]}>
          Enregistrer la fiche et envoyer le reçu au client :
        </Text>
        <View style={styles.actions}>
          <Button
            title="WhatsApp"
            subtitle="Reçu instantané"
            icon="logo-whatsapp"
            variant="whatsapp"
            loading={sending === 'whatsapp'}
            disabled={!!sending}
            onPress={() => submit('whatsapp')}
          />
          <View style={{ width: 12 }} />
          <Button
            title="SMS Direct"
            subtitle="Sans internet"
            icon="chatbubble-ellipses"
            variant="sms"
            loading={sending === 'sms'}
            disabled={!!sending}
            onPress={() => submit('sms')}
          />
        </View>
      </View>
    </Animated.ScrollView>
  );
}

function BalancePreview({ prix, avance }) {
  const { theme } = useTheme();
  const { total, paid, reste } = computeBalance(prix, avance);
  const isPaidFull = total > 0 && reste === 0;
  return (
    <View
      style={[
        styles.balanceCard,
        {
          backgroundColor: isPaidFull ? theme.badgeGreen : theme.surface,
          borderColor: isPaidFull ? `${theme.success}66` : theme.border,
        },
      ]}
    >
      <View style={styles.balanceItem}>
        <Text style={[styles.balanceLabel, { color: theme.muted }]}>Total</Text>
        <Text style={[styles.balanceValue, { color: theme.text }]}>
          {formatPrice(total)}
        </Text>
      </View>
      <View style={[styles.balanceSep, { backgroundColor: theme.border }]} />
      <View style={styles.balanceItem}>
        <Text style={[styles.balanceLabel, { color: theme.muted }]}>
          Avance payée
        </Text>
        <Text style={[styles.balanceValue, { color: theme.success }]}>
          {formatPrice(paid)}
        </Text>
      </View>
      <View style={[styles.balanceSep, { backgroundColor: theme.border }]} />
      <View style={styles.balanceItem}>
        <Text style={[styles.balanceLabel, { color: theme.muted }]}>
          Reste à payer
        </Text>
        <Text
          style={[
            styles.balanceValue,
            { color: isPaidFull ? theme.success : theme.danger },
          ]}
        >
          {isPaidFull ? 'Soldé (0 FCFA)' : formatPrice(reste)}
        </Text>
      </View>
    </View>
  );
}

function CategoryChip({ cat, active, onPress }) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 8 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => bounce(0.92)}
        onPressOut={() => bounce(1)}
        style={[
          styles.catChip,
          {
            backgroundColor: active ? theme.accent : theme.surface,
            borderColor: active ? theme.accent : theme.border,
          },
          shadowSoft,
        ]}
      >
        <Ionicons
          name={cat.icon}
          size={17}
          color={active ? '#FFFFFF' : theme.textSecondary}
        />
        <Text
          style={[
            styles.catChipText,
            { color: active ? '#FFFFFF' : theme.textSecondary },
          ]}
        >
          {cat.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function QuickChip({ label, onPress }) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 32,
      bounciness: 12,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 6, marginBottom: 6 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => bounce(0.92)}
        onPressOut={() => bounce(1)}
        style={[
          styles.quickChip,
          {
            backgroundColor: theme.accentSoft,
            borderColor: `${theme.accent}44`,
          },
        ]}
      >
        <Text style={[styles.quickChipText, { color: theme.accent }]}>
          + {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  heroBanner: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  heroTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#93C5FD',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 12, color: '#CBD5E1', marginTop: 3, lineHeight: 17 },
  heroStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 12,
  },
  heroStepPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStepPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E2E8F0',
    marginLeft: 5,
  },
  card: {
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  chipsScroll: {
    paddingBottom: 14,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  dialScroll: {
    paddingBottom: 10,
  },
  dialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 7,
  },
  dialFlag: { fontSize: 14, marginRight: 5 },
  dialText: { fontSize: 12, fontWeight: '800' },
  quickProblemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -6,
    marginBottom: 12,
  },
  quickChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: -4,
    marginBottom: 4,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceSep: {
    width: 1,
    height: 28,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  sendLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  actions: { flexDirection: 'row' },
});
