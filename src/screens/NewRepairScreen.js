import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Field from '../components/Field';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { colors, radius, shadow, shadowSoft } from '../theme';
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
  const [sending, setSending] = useState(null); // 'whatsapp' | 'sms' | null
  const scrollY = useRef(new Animated.Value(0)).current;

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

    // Store the number with its '+' international format when using a country prefix
    // so later "Ready" notifications from the list always use the right country code!
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
    outputRange: [1.05, 1, 0.95],
    extrapolate: 'clamp',
  });
  const bannerTranslateY = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [0, -8],
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
          colors={['#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroIconWrap}>
            <Ionicons name="construct" size={24} color="#60A5FA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Nouveau dépôt d'appareil</Text>
            <Text style={styles.heroSubtitle}>
              Téléphone, PC, TV, console, électroménager… prends la photo et envoie le reçu.
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.card}>
        {/* 1. Direct Camera & Gallery Picker */}
        <PhotoPicker uri={form.photoUri} onChange={set('photoUri')} />

        {/* 2. Electronic Device Category Chips */}
        <Text style={styles.sectionLabel}>TYPE D'APPAREIL ÉLECTRONIQUE</Text>
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

        {/* 3. Customer Info */}
        <Field
          label="Nom du client"
          icon="person-outline"
          placeholder="Ex : Konan Yao"
          value={form.clientNom}
          onChangeText={set('clientNom')}
        />

        {/* Country dial code selector so WhatsApp always gets the exact country prefix */}
        <Text style={styles.sectionLabel}>PAYS DU NUMÉRO WHATSAPP</Text>
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

        {/* 4. Problem + Quick Problem Chips */}
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

        {/* 5. Price & Advance in FCFA */}
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

        <View style={styles.divider} />

        <Text style={styles.sendLabel}>
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
  const { total, paid, reste } = computeBalance(prix, avance);
  const isPaidFull = total > 0 && reste === 0;
  return (
    <View style={[styles.balanceCard, isPaidFull && styles.balanceCardPaid]}>
      <View style={styles.balanceItem}>
        <Text style={styles.balanceLabel}>Total</Text>
        <Text style={styles.balanceValue}>{formatPrice(total)}</Text>
      </View>
      <View style={styles.balanceSep} />
      <View style={styles.balanceItem}>
        <Text style={styles.balanceLabel}>Avance payée</Text>
        <Text style={[styles.balanceValue, { color: colors.success }]}>
          {formatPrice(paid)}
        </Text>
      </View>
      <View style={styles.balanceSep} />
      <View style={styles.balanceItem}>
        <Text style={styles.balanceLabel}>Reste à payer</Text>
        <Text
          style={[
            styles.balanceValue,
            { color: isPaidFull ? colors.success : colors.danger },
          ]}
        >
          {isPaidFull ? 'Soldé (0 FCFA)' : formatPrice(reste)}
        </Text>
      </View>
    </View>
  );
}

function CategoryChip({ cat, active, onPress }) {
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
        style={[styles.catChip, active && styles.catChipActive]}
      >
        <Ionicons
          name={cat.icon}
          size={17}
          color={active ? '#FFFFFF' : colors.textSecondary}
        />
        <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
          {cat.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function QuickChip({ label, onPress }) {
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
        style={styles.quickChip}
      >
        <Text style={styles.quickChipText}>+ {label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    ...shadow,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(96, 165, 250, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 12, color: '#CBD5E1', marginTop: 3, lineHeight: 17 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EEF6',
    ...shadow,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  chipsScroll: {
    paddingBottom: 14,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    ...shadowSoft,
  },
  catChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 6,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  dialScroll: {
    paddingBottom: 10,
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
  quickProblemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -6,
    marginBottom: 12,
  },
  quickChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730A3',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: -4,
    marginBottom: 4,
  },
  balanceCardPaid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceSep: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  sendLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  actions: { flexDirection: 'row' },
});
