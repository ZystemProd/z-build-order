import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const BRACKET_KEY = "enableBracketInput";
const INPUT_KEY = "showBuildInput";
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

export function isBuildInputShown() {
  const value = localStorage.getItem(INPUT_KEY);
  return value === null ? true : value === "true";
}

export function setBuildInputShown(shown) {
  localStorage.setItem(INPUT_KEY, shown ? "true" : "false");

  const user = getAuth().currentUser;
  if (user) {
    const db = getFirestore();
    updateDoc(doc(db, "users", user.uid), {
      "settings.showBuildInput": shown,
    }).catch((err) => console.error("Failed to save input field setting", err));
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
    if (data.showBuildInput !== undefined) {
      localStorage.setItem(
        INPUT_KEY,
        data.showBuildInput ? "true" : "false"
      );
    }
  } catch (err) {
    console.error("Failed to load user settings", err);
  }
}
