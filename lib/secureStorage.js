// lib/secureStorage.js
// Cross-platform key/value store with the same API as expo-secure-store.
// expo-secure-store has no web implementation (no keychain/keystore exists
// in a browser). Web is dev/preview-only for this app — it is never shipped —
// so it falls back to AsyncStorage there. Native builds (iOS/Android) keep
// the full SecureStore hardening untouched.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export async function getItemAsync(key) {
  return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

export async function setItemAsync(key, value) {
  return isWeb ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key) {
  return isWeb ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
}
