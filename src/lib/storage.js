import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'rapelo.atelier.v1';

const KNOWN_CODES = ['225', '221', '223', '226', '237', '228', '229', '224', '227', '241', '242', '243', '212', '216', '213', '33'];

function sanitizeIndicatif(indicatif) {
  let ind = String(indicatif || '225').replace(/\D/g, '');
  if (ind.length > 4) {
    const matched = KNOWN_CODES.find((cc) => ind.startsWith(cc));
    return matched || ind.slice(0, 3) || '225';
  }
  return ind || '225';
}

export function hashPassword(phone, password) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `rapelo:${phone}:${password}`
  );
}

/** Returns { phone, atelierNom, localisation, indicatif, passwordHash } or null. */
export async function loadAtelier() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    if (profile && profile.indicatif) {
      const cleanInd = sanitizeIndicatif(profile.indicatif);
      if (cleanInd !== profile.indicatif) {
        profile.indicatif = cleanInd;
        await AsyncStorage.setItem(KEY, JSON.stringify(profile));
      }
    }
    return profile;
  } catch {
    return null;
  }
}

export async function saveAtelier(profile) {
  if (profile) {
    profile.indicatif = sanitizeIndicatif(profile.indicatif);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export async function clearAtelier() {
  await AsyncStorage.removeItem(KEY);
}
