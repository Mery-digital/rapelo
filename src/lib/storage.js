import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'rapelo.atelier.v1';

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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveAtelier(profile) {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export async function clearAtelier() {
  await AsyncStorage.removeItem(KEY);
}
