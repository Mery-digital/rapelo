import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Field, { HeroTextArea } from '../components/Field';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import {
  HeroCard,
  HeroChip,
  HeroSeparator,
  HeroSurface,
} from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';
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
        'Champs obligatoires',
        'Remplis le nom du client, son numéro, l’appareil déposé et la panne constatée.'
      );
      return false;
    }
    if (digitsOnly(clientTel).length < 7) {
      Alert.alert('Numéro invalide', 'Vérifie le numéro de téléphone du client.');
      return false;
    }
    return true;
  };

  const submit = async (channel) => {
    if (!validate()) return;
    setSending(channel);

    const rawTel = form.clientTel.trim();
    const dialCode = form.dialCode || defaultDial;
    const intlDigits = toInternational(rawTel, dialCode);
    const storedPhone = rawTel.startsWith('+') ? rawTel : `+${intlDigits}`;

    try {
      let finalPhotoUrl = null;
      if (form.photoUri) {
        finalPhotoUrl = await persistPhotoUri(form.photoUri, digitsOnly(atelier.phone));
      }

      const fichePayload = {
        atelier_nom: atelier.atelierNom,
        atelier_tel: atelier.phone,
        client_nom: form.clientNom.trim(),
        client_tel: storedPhone,
        appareil: form.appareil.trim(),
        probleme: form.probleme.trim(),
        prix_estime: parseInt(digitsOnly(form.prix), 10) || 0,
        avance_payee: parseInt(digitsOnly(form.avance), 10) || 0,
        photo_url: finalPhotoUrl,
        statut: 'en_cours',
      };

      let created;
      try {
        created = await createRepair(fichePayload);
      } catch (dbErr) {
        if (String(dbErr?.message || '').includes('photo_url')) {
          const { photo_url, ...withoutPhoto } = fichePayload;
          created = await createRepair(withoutPhoto);
          created = { ...created, photo_url: finalPhotoUrl };
        } else {
          throw dbErr;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Send Instant WhatsApp or SMS receipt
      const message = depositMessage(created, atelier);
      if (channel === 'whatsapp') {
        openWhatsApp(form.clientTel, message, dialCode);
      } else {
        openSms(form.clientTel, message);
      }

      onCreated(created);
      setForm(makeEmpty());
    } catch (e) {
      Alert.alert('Erreur', e?.message || "Impossible d'enregistrer l'appareil.");
    } finally {
      setSending(null);
    }
  };

  const previewIntl = form.clientTel.trim()
    ? `+${toInternational(form.clientTel, form.dialCode || defaultDial)}`
    : '';

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <HeroCard style={styles.formCard}>
        <HeroCard.Header>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Enregistrer un dépôt d’appareil
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
            Crée la fiche et envoie immédiatement le reçu de prise en charge au client.
          </Text>
        </HeroCard.Header>

        <HeroSeparator style={{ marginVertical: 0 }} />

        <HeroCard.Body style={styles.formBody}>
          {/* Category Chips Selector */}
          <Text style={[styles.sectionHeading, { color: theme.muted }]}>
            1. TYPE D’APPAREIL :
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {DEVICE_CATEGORIES.map((cat) => {
              const active = cat.id === form.category;
              return (
                <Pressable key={cat.id} onPress={() => selectCategory(cat)}>
                  <HeroChip
                    icon={cat.icon}
                    label={cat.label}
                    color={theme.accent}
                    variant={active ? 'solid' : 'flat'}
                    size="md"
                    style={styles.categoryChip}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Photo Picker */}
          <View style={{ marginBottom: 16 }}>
            <PhotoPicker uri={form.photoUri} onChange={set('photoUri')} />
          </View>

          {/* Device & Client Fields */}
          <Text style={[styles.sectionHeading, { color: theme.muted }]}>
            2. COORDONNÉES & DIAGNOSTIC :
          </Text>

          <Field
            label="Modèle précis de l’appareil"
            icon={currentCat.icon}
            placeholder={currentCat.hint}
            value={form.appareil}
            onChangeText={set('appareil')}
            isRequired
          />

          <Field
            label="Nom complet du client"
            icon="person-outline"
            placeholder="Ex : Moussa Koné"
            value={form.clientNom}
            onChangeText={set('clientNom')}
            isRequired
          />

          {/* Indicatif pays */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dialScroll}
          >
            {COUNTRY_DIAL_CODES.map((c) => {
              const active = form.dialCode === c.code;
              return (
                <Pressable key={c.code} onPress={() => selectDialCode(c.code)}>
                  <HeroChip
                    label={`${c.flag} +${c.code}`}
                    color={theme.whatsapp}
                    variant={active ? 'solid' : 'flat'}
                    size="sm"
                    style={{ marginRight: 6 }}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <Field
            label="Numéro WhatsApp / Téléphone"
            icon="logo-whatsapp"
            rightSuffix={previewIntl || `+${form.dialCode}`}
            placeholder="Ex : 07 07 07 07 07"
            keyboardType="phone-pad"
            value={form.clientTel}
            onChangeText={set('clientTel')}
            hint={
              previewIntl
                ? `Numéro format international : ${previewIntl}`
                : 'Sélectionne l’indicatif du pays ci-dessus.'
            }
            isRequired
          />

          <HeroTextArea
            label="Panne / Problème constaté"
            icon="construct-outline"
            placeholder="Décris le problème ou sélectionne une panne fréquente..."
            value={form.probleme}
            onChangeText={set('probleme')}
            isRequired
          />

          {/* Quick Problem Tag Group */}
          <View style={styles.quickTagsWrap}>
            {QUICK_PROBLEMS.map((p) => (
              <Pressable key={p} onPress={() => addQuickProblem(p)}>
                <HeroChip
                  label={p}
                  color={theme.accent}
                  variant="flat"
                  size="sm"
                  style={styles.quickTag}
                />
              </Pressable>
            ))}
          </View>

          {/* Pricing Fields */}
          <Text style={[styles.sectionHeading, { color: theme.muted, marginTop: 12 }]}>
            3. TARIFICATION (FCFA) :
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field
              label="Prix total estimé"
              icon="cash-outline"
              rightSuffix="FCFA"
              placeholder="Ex : 15000"
              keyboardType="number-pad"
              value={form.prix}
              onChangeText={(v) => set('prix')(digitsOnly(v))}
              style={{ flex: 1 }}
            />
            <Field
              label="Avance versée"
              icon="wallet-outline"
              rightSuffix="FCFA"
              placeholder="Ex : 5000"
              keyboardType="number-pad"
              value={form.avance}
              onChangeText={(v) => set('avance')(digitsOnly(v))}
              style={{ flex: 1 }}
            />
          </View>

          {/* Financial summary preview */}
          {Number(form.prix) > 0 || Number(form.avance) > 0 ? (
            <BalancePreview prix={form.prix} avance={form.avance} />
          ) : null}
        </HeroCard.Body>

        <HeroSeparator style={{ marginVertical: 0 }} />

        {/* Card Footer : Action Buttons */}
        <HeroCard.Footer style={styles.formFooter}>
          <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>
            Enregistrer et envoyer le reçu de dépôt :
          </Text>

          <View style={styles.actionButtonsRow}>
            <Button
              title="WhatsApp"
              subtitle="Reçu instantané"
              icon="logo-whatsapp"
              variant="whatsapp"
              feedbackVariant="scale-ripple"
              loading={sending === 'whatsapp'}
              disabled={Boolean(sending)}
              onPress={() => submit('whatsapp')}
            />
            <View style={{ width: 12 }} />
            <Button
              title="SMS Direct"
              subtitle="Sans internet"
              icon="chatbubble-ellipses"
              variant="sms"
              feedbackVariant="scale-ripple"
              loading={sending === 'sms'}
              disabled={Boolean(sending)}
              onPress={() => submit('sms')}
            />
          </View>
        </HeroCard.Footer>
      </HeroCard>
    </ScrollView>
  );
}

function BalancePreview({ prix, avance }) {
  const { theme } = useTheme();
  const { total, paid, reste } = computeBalance(prix, avance);
  const isPaidFull = total > 0 && reste === 0;

  return (
    <HeroSurface style={styles.balanceSurface}>
      <View style={styles.balanceCol}>
        <Text style={[styles.balanceSub, { color: theme.muted }]}>Total réparation</Text>
        <Text style={[styles.balanceNum, { color: theme.text }]}>
          {formatPrice(total)}
        </Text>
      </View>

      <View style={[styles.balanceDiv, { backgroundColor: theme.border }]} />

      <View style={styles.balanceCol}>
        <Text style={[styles.balanceSub, { color: theme.muted }]}>Avance payée</Text>
        <Text style={[styles.balanceNum, { color: theme.whatsapp }]}>
          {formatPrice(paid)}
        </Text>
      </View>

      <View style={[styles.balanceDiv, { backgroundColor: theme.border }]} />

      <View style={styles.balanceCol}>
        <Text style={[styles.balanceSub, { color: theme.muted }]}>Reste dû</Text>
        <Text
          style={[
            styles.balanceNum,
            { color: isPaidFull ? theme.whatsapp : theme.danger },
          ]}
        >
          {isPaidFull ? 'Soldé' : formatPrice(reste)}
        </Text>
      </View>
    </HeroSurface>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    borderRadius: radius.xl,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  formBody: {
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categoryScroll: {
    paddingBottom: 16,
    gap: 8,
  },
  categoryChip: {
    marginRight: 6,
  },
  dialScroll: {
    paddingBottom: 12,
  },
  quickTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -8,
    marginBottom: 14,
  },
  quickTag: {
    marginRight: 6,
    marginBottom: 6,
  },
  balanceSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    marginTop: 4,
    marginBottom: 8,
  },
  balanceCol: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDiv: {
    width: 1,
    height: 28,
  },
  balanceSub: {
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  balanceNum: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  formFooter: {
    paddingTop: 16,
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
  },
});
