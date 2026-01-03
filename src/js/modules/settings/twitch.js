import { deleteField, doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { showToast } from "../toastHandler.js";
import { updateSettingsHelperText } from "./helpers.js";

let twitchFormInitialized = false;

function setTwitchStatus(message, tone = "muted") {
  updateSettingsHelperText("settingsTwitchStatus", message, tone);
}

function setTwitchInputValue(value) {
  const input = document.getElementById("settingsTwitchInput");
  if (input) input.value = value || "";
}

function normalizeTwitchUrl(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const usernameMatch = trimmed.match(/^@?([a-zA-Z0-9_]{3,25})$/);
  if (usernameMatch) {
    return `https://www.twitch.tv/${usernameMatch[1]}`;
  }
  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("twitch.tv")) return "";
    const path = url.pathname.replace(/\/+$/, "");
    return `https://${host}${path}`;
  } catch (_) {
    return "";
  }
}

function setupTwitchSettingsSection() {
  if (twitchFormInitialized) return;
  const button = document.getElementById("saveTwitchButton");
  if (!button) return;
  button.addEventListener("click", handleTwitchUpdate);
  twitchFormInitialized = true;
}

async function handleTwitchUpdate(event) {
  if (event?.preventDefault) event.preventDefault();
  const input = document.getElementById("settingsTwitchInput");
  const button = document.getElementById("saveTwitchButton");
  if (!input || !button) return;
  const rawUrl = (input.value || "").trim();
  const normalized = rawUrl ? normalizeTwitchUrl(rawUrl) : "";
  if (rawUrl && !normalized) {
    setTwitchStatus("Enter a valid Twitch username or URL.", "error");
    return;
  }
  const user = auth.currentUser;
  if (!user) {
    setTwitchStatus("Sign in to save your Twitch channel.", "error");
    showToast("? Please sign in to save Twitch.", "error");
    return;
  }
  button.disabled = true;
  const originalHtml = button.innerHTML;
  button.textContent = "Saving...";
  const payload = normalized
    ? { twitchUrl: normalized }
    : { twitchUrl: deleteField() };
  try {
    await setDoc(doc(db, "users", user.uid), payload, { merge: true });
    setTwitchStatus(
      normalized ? "Twitch link saved." : "Twitch link removed.",
      normalized ? "success" : "muted"
    );
    showToast(
      normalized ? "? Twitch channel saved." : "? Twitch channel removed.",
      "success"
    );
  } catch (err) {
    console.error("Failed to save Twitch link", err);
    setTwitchStatus("Failed to save Twitch channel.", "error");
    showToast("? Failed to save Twitch channel.", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
  }
}

export {
  setTwitchInputValue,
  setTwitchStatus,
  setupTwitchSettingsSection,
};
