// lib/unlockPref.js
//
// How the user prefers to unlock Tend: fingerprint / Face ID, or PIN.
//
// The lock screen used to fire the system biometric prompt on every single
// unlock, so anyone who simply preferred their PIN had to dismiss a fingerprint
// dialog each time they opened the app. The choice is now asked once and
// remembered; Settings can change it.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "tend.unlockMethod";

/** @returns {Promise<"biometric"|"pin"|null>} null = never asked */
export async function getUnlockMethod() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "biometric" || v === "pin" ? v : null;
  } catch {
    return null;
  }
}

/** @param {"biometric"|"pin"} method */
export async function setUnlockMethod(method) {
  try {
    if (method === "biometric" || method === "pin") await AsyncStorage.setItem(KEY, method);
  } catch { /* non-fatal — they'll simply be asked again */ }
}
