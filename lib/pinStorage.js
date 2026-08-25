// lib/pinStorage.js
// PIN + session-adjacent flags.
//
// Security model:
//  - The PIN itself is NEVER stored. We keep a SHA-256 hash of `${salt}:${pin}`
//    in the device keychain/keystore via expo-secure-store.
//  - Legacy plaintext PINs (old AsyncStorage builds) are migrated to the
//    hashed SecureStore format on first read, then wiped.
//  - rememberMe / background-time are not sensitive → stay in AsyncStorage.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "./secureStorage";
import * as Crypto from "expo-crypto";

const K = {
  // SecureStore (keychain/keystore)
  PIN_HASH: "tend_pin_hash",
  PIN_SALT: "tend_pin_salt",
  ENABLED:  "tend_pin_enabled",
  // AsyncStorage (non-sensitive)
  REMEMBER: "@tend/remember_me",
  BG_TIME:  "@tend/bg_time",
  // Legacy AsyncStorage keys (pre-SecureStore builds) — migrated then removed
  LEGACY_PIN:     "@tend/pin",
  LEGACY_ENABLED: "@tend/pin_enabled",
};

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

export async function savePin(pin) {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(String(pin), salt);
  await SecureStore.setItemAsync(K.PIN_SALT, salt);
  await SecureStore.setItemAsync(K.PIN_HASH, hash);
  await SecureStore.setItemAsync(K.ENABLED, "true");
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(K.PIN_HASH);
  await SecureStore.deleteItemAsync(K.PIN_SALT);
  await SecureStore.deleteItemAsync(K.ENABLED);
}

/** One-time migration of a legacy plaintext PIN into hashed SecureStore. */
async function migrateLegacyPin() {
  try {
    const legacy = await AsyncStorage.getItem(K.LEGACY_PIN);
    if (legacy) {
      await savePin(legacy);
      await AsyncStorage.multiRemove([K.LEGACY_PIN, K.LEGACY_ENABLED]);
      return true;
    }
  } catch {}
  return false;
}

export async function isPinEnabled() {
  const enabled = await SecureStore.getItemAsync(K.ENABLED);
  if (enabled === "true") return true;
  // Legacy build? Migrate silently.
  return migrateLegacyPin();
}

/** Compare an entered PIN against the stored hash. */
export async function verifyPinHash(pin) {
  let [salt, hash] = await Promise.all([
    SecureStore.getItemAsync(K.PIN_SALT),
    SecureStore.getItemAsync(K.PIN_HASH),
  ]);
  if (!salt || !hash) {
    // Might be a legacy plaintext PIN — migrate, then re-read
    const migrated = await migrateLegacyPin();
    if (!migrated) return false;
    [salt, hash] = await Promise.all([
      SecureStore.getItemAsync(K.PIN_SALT),
      SecureStore.getItemAsync(K.PIN_HASH),
    ]);
    if (!salt || !hash) return false;
  }
  const candidate = await hashPin(String(pin), salt);
  return candidate === hash;
}

export async function getRememberMe() {
  return (await AsyncStorage.getItem(K.REMEMBER)) === "true";
}

export async function setRememberMe(val) {
  await AsyncStorage.setItem(K.REMEMBER, val ? "true" : "false");
}

export async function recordBgTime() {
  await AsyncStorage.setItem(K.BG_TIME, String(Date.now()));
}

export async function popBgTime() {
  const v = await AsyncStorage.getItem(K.BG_TIME);
  await AsyncStorage.removeItem(K.BG_TIME);
  return v ? Number(v) : null;
}
