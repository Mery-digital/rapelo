import { Linking, Platform, Alert, Share } from 'react-native';
import * as SMS from 'expo-sms';
import * as IntentLauncher from 'expo-intent-launcher';

/** Keep only digits. */
export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const COUNTRY_DIAL_CODES = [
  { code: '225', flag: '🇨🇮', country: "Côte d'Ivoire", keepZero: true },
  { code: '221', flag: '🇸🇳', country: 'Sénégal' },
  { code: '223', flag: '🇲🇱', country: 'Mali' },
  { code: '226', flag: '🇧🇫', country: 'Burkina Faso' },
  { code: '237', flag: '🇨🇲', country: 'Cameroun' },
  { code: '228', flag: '🇹🇬', country: 'Togo' },
  { code: '229', flag: '🇧🇯', country: 'Bénin' },
  { code: '224', flag: '🇬🇳', country: 'Guinée' },
  { code: '227', flag: '🇳🇪', country: 'Niger' },
  { code: '241', flag: '🇬🇦', country: 'Gabon' },
  { code: '242', flag: '🇨🇬', country: 'Congo' },
  { code: '243', flag: '🇨🇩', country: 'RD Congo' },
  { code: '212', flag: '🇲🇦', country: 'Maroc' },
  { code: '216', flag: '🇹🇳', country: 'Tunisie' },
  { code: '213', flag: '🇩🇿', country: 'Algérie' },
  { code: '33', flag: '🇫🇷', country: 'France' },
];

// Countries where the local leading '0' MUST stay after +countryCode (Côte d'Ivoire +225 07...)
const KEEP_LEADING_ZERO_CODES = new Set(['225']);

/**
 * Turn a local number into the international format WhatsApp needs (digits only, no '+').
 * - "+221 77 123 45 67" / "00221..." -> kept as is
 * - Côte d'Ivoire (225): "0707070707" -> "2250707070707" (10 digits kept)
 * - Other countries (221, 237, 223, 226, 228, 229, 243, 33...):
 *   "0612345678" -> leading 0 stripped -> "<cc>612345678"
 */
export function toInternational(phone, indicatif = '225') {
  const raw = String(phone || '').trim();
  const d = digitsOnly(raw);
  if (!d) return '';
  if (raw.startsWith('+')) return d;
  if (d.startsWith('00')) return d.slice(2);

  const cc = digitsOnly(indicatif) || '225';
  if (cc && d.startsWith(cc) && d.length >= cc.length + 8) {
    return d;
  }
  const localPart =
    !KEEP_LEADING_ZERO_CODES.has(cc) && d.startsWith('0') ? d.slice(1) : d;
  return cc + localPart;
}

export function formatPrice(value) {
  const n = Math.round(Number(value) || 0);
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} à ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

// ---------- Messages ----------

export function depositMessage({ clientNom, appareil, atelier }) {
  return (
    `RAPELO\n` +
    `Bonjour ${clientNom}, votre ${appareil} a bien été déposé chez ${atelier.atelierNom} ` +
    `à ${atelier.localisation}. On vous prévient dès que c'est prêt ! Infoline: ${atelier.phone}`
  );
}

export function readyMessage({ clientNom, appareil, prix, atelier }) {
  const price = Number(prix) > 0 ? ` Montant à payer : ${formatPrice(prix)}.` : '';
  return (
    `RAPELO\n` +
    `Bonjour ${clientNom}, bonne nouvelle ! Votre ${appareil} est prêt. ` +
    `Vous pouvez venir le récupérer chez ${atelier.atelierNom} à ${atelier.localisation}.${price} ` +
    `Infoline: ${atelier.phone}`
  );
}

export function unrepairedMessage({ clientNom, appareil, atelier }) {
  return (
    `RAPELO\n` +
    `Bonjour ${clientNom}, concernant votre ${appareil} déposé chez ${atelier.atelierNom} ` +
    `à ${atelier.localisation} : malheureusement la réparation n'a pas pu aboutir. ` +
    `Vous pouvez venir récupérer votre appareil à l'atelier. Infoline: ${atelier.phone}`
  );
}

// ---------- Opening WhatsApp & SMS ----------

/**
 * Helper so an Android IntentLauncher call never hangs the JS thread if the user
 * stays inside WhatsApp or returns without a result code.
 */
function launchIntentNonBlocking(action, params) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(true);
      }
    }, 900);

    IntentLauncher.startActivityAsync(action, params)
      .then(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

/**
 * Reliably open WhatsApp or WhatsApp Business with the customer's number and message:
 * 1. Tries `whatsapp://send?phone=<intl>&text=<msg>` via `Linking.openURL`.
 * 2. Tries `https://wa.me/<intl>?text=<msg>` and `https://api.whatsapp.com/send?...`.
 * 3. On Android, tries native `ACTION_VIEW` intent on `whatsapp://send`.
 * 4. If no direct number link could open, opens WhatsApp chat picker (`whatsapp://send?text=...`).
 */
export async function openWhatsApp(phone, message, indicatif = '225') {
  const number = toInternational(phone, indicatif);
  if (!number) {
    Alert.alert('Numéro manquant', 'Vérifie le numéro de téléphone du client.');
    return false;
  }

  const encoded = encodeURIComponent(message);

  // Web (Vercel version): wa.me opens WhatsApp app on phones, WhatsApp Web on computers
  if (Platform.OS === 'web') {
    const url = `https://wa.me/${number}?text=${encoded}`;
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url; // pop-up blocked
    return true;
  }

  const directLinks = [
    `whatsapp://send?phone=${number}&text=${encoded}`,
    `whatsapp://send?phone=+${number}&text=${encoded}`,
    `https://api.whatsapp.com/send?phone=${number}&text=${encoded}`,
    `https://wa.me/${number}?text=${encoded}`,
  ];

  // 1. Try React Native Linking with direct schemes and universal HTTPS links
  for (const url of directLinks) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try next URL
    }
  }

  // 2. Android native ACTION_VIEW intent (without packageName restriction)
  if (Platform.OS === 'android') {
    for (const url of [
      `whatsapp://send?phone=${number}&text=${encoded}`,
      `https://wa.me/${number}?text=${encoded}`,
    ]) {
      try {
        await launchIntentNonBlocking('android.intent.action.VIEW', { data: url });
        return true;
      } catch {
        // Try next
      }
    }
  }

  // 3. Fallback: open WhatsApp with the message pre-filled so technician can pick contact
  try {
    await Linking.openURL(`whatsapp://send?text=${encoded}`);
    return true;
  } catch {
    // Continue to Share sheet
  }

  // 4. Last resort: system Share sheet
  try {
    await Share.share({ message });
    return true;
  } catch {
    Alert.alert(
      'WhatsApp indisponible',
      "Impossible d'ouvrir WhatsApp sur ce téléphone. Vérifie que WhatsApp est bien installé."
    );
    return false;
  }
}

/**
 * Reliably open the phone's native SMS composer with recipient and body pre-filled.
 */
export async function openSms(phone, message) {
  const raw = String(phone || '').trim();
  const cleanNumber = raw.startsWith('+')
    ? `+${digitsOnly(raw)}`
    : digitsOnly(raw);

  if (!cleanNumber) {
    Alert.alert('Numéro manquant', 'Vérifie le numéro de téléphone du client.');
    return false;
  }

  // 1. Native Expo SMS module (most reliable on Android & iOS)
  try {
    const available = await SMS.isAvailableAsync();
    if (available) {
      await SMS.sendSMSAsync([cleanNumber], message);
      return true;
    }
  } catch {
    // Fallback below
  }

  // 2. Standard URL schemes (`sms:` and `smsto:`)
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const candidates = [
    `sms:${cleanNumber}${sep}body=${encodeURIComponent(message)}`,
    `smsto:${cleanNumber}?body=${encodeURIComponent(message)}`,
    `sms:${cleanNumber}`,
  ];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try next candidate
    }
  }

  // 3. Android native ACTION_SENDTO intent with `smsto:` and `sms_body`
  if (Platform.OS === 'android') {
    try {
      await launchIntentNonBlocking('android.intent.action.SENDTO', {
        data: `smsto:${cleanNumber}`,
        extra: { sms_body: message },
      });
      return true;
    } catch {
      // Fallback below
    }
  }

  // 4. Last resort: system Share sheet
  try {
    await Share.share({ message });
    return true;
  } catch {
    Alert.alert('SMS indisponible', "Impossible d'ouvrir l'application SMS sur ce téléphone.");
    return false;
  }
}
