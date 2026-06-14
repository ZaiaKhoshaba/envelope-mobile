// lib/pinStorage.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const K = {
  PIN:      "@tend/pin",
  ENABLED:  "@tend/pin_enabled",
  REMEMBER: "@tend/remember_me",
  BG_TIME:  "@tend/bg_time",
};

export async function savePin(pin) {
  await AsyncStorage.multiSet([[K.PIN, pin], [K.ENABLED, "true"]]);
}

export async function getPin() {
  return AsyncStorage.getItem(K.PIN);
}

export async function clearPin() {
  await AsyncStorage.multiRemove([K.PIN, K.ENABLED]);
}

export async function isPinEnabled() {
  return (await AsyncStorage.getItem(K.ENABLED)) === "true";
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
