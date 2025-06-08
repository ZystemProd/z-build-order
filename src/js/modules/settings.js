import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const BRACKET_KEY = "enableBracketInput";
const SMART_SUPPLY_KEY = "enableSmartSupply";
export function isBracketInputEnabled() {
  const value = localStorage.getItem(BRACKET_KEY);
  return value === null ? true : value === "true";
}

export function setBracketInputEnabled(enabled) {
  localStorage.setItem(BRACKET_KEY, enabled ? "true" : "false");

  const user = getAuth().currentUser;
  if (user) {
    const db = getFirestore();
    updateDoc(doc(db, "users", user.uid), {
      "settings.enableBracketInput": enabled,
    }).catch((err) => console.error("Failed to save bracket setting", err));
  }
}

export function isSmartSupplyEnabled() {
  const value = localStorage.getItem(SMART_SUPPLY_KEY);
  return value === "true";
}

export function setSmartSupplyEnabled(enabled) {
  localStorage.setItem(SMART_SUPPLY_KEY, enabled ? "true" : "false");

  const user = getAuth().currentUser;
  if (user) {
    const db = getFirestore();
    updateDoc(doc(db, "users", user.uid), {
      "settings.enableSmartSupply": enabled,
    }).catch((err) => console.error("Failed to save smart supply setting", err));
  }
}


export async function loadUserSettings() {
  const user = getAuth().currentUser;
  if (!user) return;

  try {
    const snap = await getDoc(doc(getFirestore(), "users", user.uid));
    const data = snap.exists() ? snap.data().settings || {} : {};
    if (data.enableBracketInput !== undefined) {
      localStorage.setItem(
        BRACKET_KEY,
        data.enableBracketInput ? "true" : "false"
      );
    }
    if (data.enableSmartSupply !== undefined) {
      localStorage.setItem(
        SMART_SUPPLY_KEY,
        data.enableSmartSupply ? "true" : "false"
      );
    }
  } catch (err) {
    console.error("Failed to load user settings", err);
  }
}
