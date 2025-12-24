import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { initAnalytics } from "./js/modules/analyticsHelper.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  getDocs,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  runTransaction,
  writeBatch,
  query,
  where,
  collectionGroup,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";
import { bannedWords } from "./js/data/bannedWords.js";
import countries from "./js/data/countries.json" assert { type: "json" };
import { showToast } from "./js/modules/toastHandler.js";
import { resetBuildInputs } from "./js/modules/utils.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBBLnneYwLDfIp-Oep2MvExGnVk_EvDQoo",
  authDomain: "z-build-order.firebaseapp.com",
  projectId: "z-build-order",
  storageBucket: "z-build-order.firebasestorage.app",
  messagingSenderId: "22023941178",
  appId: "1:22023941178:web:ba417e9a52332a8e055903",
  measurementId: "G-LBDMKMG1W9",
};

// --- DOM Reset --- //
document.addEventListener("DOMContentLoaded", () => {
  const userPhoto = document.getElementById("userPhoto");
  const userName = document.getElementById("userName");
  const userMenu = document.getElementById("userMenu");

  const userNameMenu = document.getElementById("userNameMenu");
  if (userPhoto) userPhoto.style.display = "none";
  if (userName) userName.style.display = "none";
  if (userNameMenu) userNameMenu.style.display = "none";
  if (userMenu) userMenu.style.display = "none";

  setupUsernameSettingsSection();
  setupPulseSettingsSection();
  setupTwitchSettingsSection();
  setupCountrySelector();
  setupSecondaryPulseModal();

  // Position the floating utility tiles relative to auth-container
  try {
    updateFloatingTilePositions();
  } catch (_) {}
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache:
    typeof window === "undefined"
      ? memoryLocalCache()
      : persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
});
const provider = new GoogleAuthProvider();
const switchAccountProvider = new GoogleAuthProvider();
switchAccountProvider.setCustomParameters({ prompt: "select_account" });

let appCheck;
if (typeof window !== "undefined") {
  appCheck = window.__appCheckInstance;
  if (!appCheck) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        "6LcBBWsrAAAAALLmBNIhl-zKPa8KRj8mXMldoKbN"
      ),
      isTokenAutoRefreshEnabled: true,
    });
    window.__appCheckInstance = appCheck;
  }
} else {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider("6LcBBWsrAAAAALLmBNIhl-zKPa8KRj8mXMldoKbN"),
    isTokenAutoRefreshEnabled: true,
  });
}

function updateFloatingTilePositions() {
  const authEl = document.getElementById("auth-container");
  const vetoEl = document.getElementById("mapVetoTile");
  const tournamentEl = document.getElementById("tournamentTile");
  if (!authEl) return;

  // Skip on mobile (tiles are hidden there)
  if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
    return;
  }

  // Preferred horizontal gap between elements
  const gap = 16; // px

  const rect = authEl.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    if (vetoEl) vetoEl.style.right = "10px";
    if (tournamentEl) tournamentEl.style.right = "10px";
    return;
  }

  // Place tiles to the left of auth container with a fixed gap
  let currentRight = Math.max(10, window.innerWidth - rect.left + gap);
  if (vetoEl) {
    vetoEl.style.right = `${currentRight}px`;
    currentRight += (vetoEl.offsetWidth || 150) + gap;
  }
  if (tournamentEl) {
    tournamentEl.style.right = `${currentRight}px`;
  }
}

window.addEventListener("resize", () => {
  try {
    updateFloatingTilePositions();
  } catch (_) {}
});
window.addEventListener("load", () => {
  try {
    updateFloatingTilePositions();
  } catch (_) {}
});

function initCookieConsent() {
  const banner = document.getElementById("cookieBanner");
  const acceptBtn = document.getElementById("cookieAccept");
  const declineBtn = document.getElementById("cookieDecline");

  const consent = localStorage.getItem("analyticsConsent");

  if (consent === "accepted") {
    import("firebase/analytics").then(({ getAnalytics }) => {
      getAnalytics(app);
      initAnalytics(app);
    });
    if (banner) banner.style.display = "none";
    return;
  }

  if (consent === "declined") {
    if (banner) banner.style.display = "none";
    return;
  }

  if (!banner) return;

  banner.style.display = "block";
  if (acceptBtn) {
    acceptBtn.addEventListener("click", async () => {
      localStorage.setItem("analyticsConsent", "accepted");
      banner.style.display = "none";
      try {
        const { getAnalytics } = await import("firebase/analytics");
        getAnalytics(app);
        initAnalytics(app);
      } catch (_) {
        // ignore analytics load errors
      }
    });
  }
  if (declineBtn) {
    declineBtn.addEventListener("click", () => {
      localStorage.setItem("analyticsConsent", "declined");
      banner.style.display = "none";
    });
  }
}

initCookieConsent();

const DEFAULT_AVATAR_URL = "img/avatar/marine_avatar_1.webp";
const AVATAR_MANIFEST_URL = "img/avatar/avatars.json";
const FALLBACK_AVATAR_OPTIONS = [
  "img/avatar/marine_avatar_1.webp",
  "img/avatar/protoss_avatar_1.webp",
  "img/avatar/zergling_avatar_1.webp",
];

let currentUserAvatarUrl = DEFAULT_AVATAR_URL;
let avatarOptionsCache = null;
let avatarModalInitialized = false;
let lastFocusedBeforeAvatarModal = null;
let currentUsername = null;
let usernameFormInitialized = false;
const normalizedBannedWords = bannedWords.map((word) =>
  (word || "").toLowerCase()
);
const DEFAULT_PULSE_STATUS =
  "Paste your SC2Pulse profile link to sync your latest MMR.";
const ISO_COUNTRIES = Array.isArray(countries) ? countries : [];
const MAX_SECONDARY_PULSE_LINKS = 5;
const MIN_SECONDARY_PULSE_LINKS = 2;
let secondaryPulseModalInitialized = false;

const RACE_UI = {
  zerg: { label: "Zerg", icon: "img/race/zerg2.webp", color: "#d16ba5" },
  terran: { label: "Terran", icon: "img/race/terran2.webp", color: "#4cc9f0" },
  protoss: {
    label: "Protoss",
    icon: "img/race/protoss2.webp",
    color: "#f6c177",
  },
  random: { label: "Random", icon: "img/race/terran2.webp", color: "#a0aec0" }, // fallback icon
};
let pulseState = {
  url: "",
  mmr: null,
  fetchedAt: null,
  byRace: null,
  secondary: [],
};
let pulseUiInitialized = false;
let pulseHelpInitialized = false;
let twitchFormInitialized = false;
let countrySelectInitialized = false;
const PULSE_ENDPOINTS = (() => {
  const endpoints = ["/api/pulse-mmr"];
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    endpoints.push(
      "http://localhost:5001/z-build-order/us-central1/fetchPulseMmr"
    );
  }
  endpoints.push(
    "https://us-central1-z-build-order.cloudfunctions.net/fetchPulseMmr"
  );
  return endpoints;
})();

const avatarModalElements = {
  changeBtn: null,
  modal: null,
  grid: null,
  closeBtn: null,
};

function sanitizeAvatarUrl(url) {
  if (typeof url !== "string") return DEFAULT_AVATAR_URL;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_AVATAR_URL;
  const lower = trimmed.toLowerCase();
  const allowedStarts = [
    "http://",
    "https://",
    "data:image",
    "img/",
    "/img/",
    "./img/",
  ];
  if (allowedStarts.some((prefix) => lower.startsWith(prefix))) {
    return trimmed.replace(/^\.\//, "");
  }
  return trimmed.endsWith(".webp")
    ? `img/avatar/${trimmed}`
    : DEFAULT_AVATAR_URL;
}

function emitAvatarUpdate(avatarUrl) {
  const sanitized = sanitizeAvatarUrl(avatarUrl);
  const settingsPreview = document.getElementById("settingsCurrentAvatar");
  if (settingsPreview) {
    settingsPreview.src = sanitized;
  }
  const buttonPreview = document.getElementById("settingsAvatarButtonImage");
  if (buttonPreview) {
    buttonPreview.src = sanitized;
  }

  window.dispatchEvent(
    new CustomEvent("user-avatar-updated", { detail: { avatarUrl: sanitized } })
  );
}

async function loadAvatarOptions() {
  if (Array.isArray(avatarOptionsCache) && avatarOptionsCache.length) {
    return avatarOptionsCache;
  }

  const options = new Set([DEFAULT_AVATAR_URL]);

  try {
    const response = await fetch(AVATAR_MANIFEST_URL, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload)) {
        payload.forEach((entry) => {
          if (typeof entry !== "string") return;
          const sanitized = sanitizeAvatarUrl(entry);
          if (sanitized) options.add(sanitized);
        });
      }
    }
  } catch (error) {
    console.warn(
      "Failed to load avatar manifest, using fallback avatars.",
      error
    );
  }

  FALLBACK_AVATAR_OPTIONS.forEach((fallback) => {
    const sanitized = sanitizeAvatarUrl(fallback);
    if (sanitized) options.add(sanitized);
  });

  avatarOptionsCache = Array.from(options);
  return avatarOptionsCache;
}

function updateAvatarSelectionHighlight(selectedUrl) {
  const grid = avatarModalElements.grid;
  if (!grid) return;

  const sanitizedSelected = sanitizeAvatarUrl(selectedUrl);

  grid.querySelectorAll(".avatar-option").forEach((button) => {
    const isSelected = button.dataset.avatar === sanitizedSelected;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

async function populateAvatarGrid() {
  const grid = avatarModalElements.grid;
  if (!grid) return;

  const avatars = await loadAvatarOptions();
  grid.innerHTML = "";

  avatars.forEach((avatarUrl) => {
    const sanitized = sanitizeAvatarUrl(avatarUrl);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "avatar-option";
    button.dataset.avatar = sanitized;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Select avatar");

    const img = document.createElement("img");
    img.src = sanitized;
    img.alt = "Avatar option";
    img.loading = "lazy";

    button.appendChild(img);
    button.addEventListener("click", () => handleAvatarSelection(sanitized));
    grid.appendChild(button);
  });

  updateAvatarSelectionHighlight(currentUserAvatarUrl);
}

async function openAvatarModal() {
  if (!avatarModalInitialized) return;
  if (!auth.currentUser) {
    showToast("Sign in to change your avatar.", "info");
    return;
  }

  closeUserMenu();
  await populateAvatarGrid();

  const modal = avatarModalElements.modal;
  if (!modal) return;

  lastFocusedBeforeAvatarModal = document.activeElement;
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");

  const focusTarget =
    avatarModalElements.closeBtn ||
    modal.querySelector(".avatar-option") ||
    modal;
  if (focusTarget && typeof focusTarget.focus === "function") {
    focusTarget.focus();
  }
}

function closeAvatarModal() {
  const modal = avatarModalElements.modal;
  if (!modal) return;

  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  if (
    lastFocusedBeforeAvatarModal &&
    typeof lastFocusedBeforeAvatarModal.focus === "function"
  ) {
    lastFocusedBeforeAvatarModal.focus();
  }
  lastFocusedBeforeAvatarModal = null;
}

async function handleAvatarSelection(avatarUrl) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Sign in to change your avatar.", "info");
    return;
  }

  const sanitized = sanitizeAvatarUrl(avatarUrl);
  if (!sanitized) return;

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      { profile: { avatarUrl: sanitized } },
      { merge: true }
    );

    currentUserAvatarUrl = sanitized;
    updateAvatarSelectionHighlight(sanitized);

    if (auth.currentUser) {
      auth.currentUser.photoURL = sanitized;
    }

    const userPhotoEl = document.getElementById("userPhoto");
    if (userPhotoEl) {
      userPhotoEl.src = sanitized;
    }

    emitAvatarUpdate(sanitized);
    showToast("Avatar updated!", "success");
    closeAvatarModal();
  } catch (error) {
    console.error("Failed to update avatar:", error);
    showToast("Failed to update avatar. Please try again.", "error");
  }
}

function resolveUserAvatar(userData) {
  const profileAvatar = userData?.profile?.avatarUrl;
  if (profileAvatar) return profileAvatar;
  return "img/default-avatar.webp";
}

function setupAvatarModal() {
  if (avatarModalInitialized) {
    updateAvatarSelectionHighlight(currentUserAvatarUrl);
    return;
  }

  const changeBtn = document.getElementById("changeAvatarBtn");
  const modal = document.getElementById("avatarModal");
  const grid = document.getElementById("avatarGrid");
  const closeBtn = document.getElementById("closeAvatarModal");

  if (!changeBtn || !modal || !grid || !closeBtn) {
    return;
  }

  avatarModalElements.changeBtn = changeBtn;
  avatarModalElements.modal = modal;
  avatarModalElements.grid = grid;
  avatarModalElements.closeBtn = closeBtn;

  changeBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await openAvatarModal();
  });

  closeBtn.addEventListener("click", closeAvatarModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAvatarModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.style.display === "block") {
      closeAvatarModal();
    }
  });

  avatarModalInitialized = true;
}

/*
// If testing locally, you can enable Firebase emulators by importing
// connectAuthEmulator and connectFirestoreEmulator from the relevant
// Firebase packages and calling them here.
*/
// Set persistence
setPersistence(auth, browserLocalPersistence);

/*********************************************************************
 * Username Management
 *********************************************************************/
function containsBannedUsernameWord(username) {
  const lower = (username || "").toLowerCase();
  return normalizedBannedWords.some((badWord) => lower.includes(badWord));
}

function validateUsernameValue(rawInput) {
  const trimmed = typeof rawInput === "string" ? rawInput.trim() : "";
  if (!trimmed) {
    return { valid: false, message: "Username cannot be empty." };
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
    return {
      valid: false,
      message: "Username must be 3-20 characters, only letters, numbers, or _",
    };
  }
  if (containsBannedUsernameWord(trimmed)) {
    return {
      valid: false,
      message: "Username contains inappropriate words or reserved terms.",
    };
  }
  return { valid: true, cleaned: trimmed, message: "" };
}

function setSettingsUsernameStatus(message, tone = "muted") {
  const statusEl = document.getElementById("settingsUsernameStatus");
  if (!statusEl) return;

  let color = "#b0b0b0";
  if (tone === "error") color = "#ff9a9a";
  else if (tone === "success") color = "#9ae6b4";
  else if (tone === "info") color = "#8be9fd";

  statusEl.textContent = message;
  statusEl.style.color = color;
}

function setSettingsUsernameValue(value) {
  const input = document.getElementById("settingsUsernameInput");
  if (input) input.value = value || "";
}

function setSettingsUsernameDisabled(isDisabled) {
  const input = document.getElementById("settingsUsernameInput");
  const saveBtn = document.getElementById("saveUsernameButton");
  if (input) input.disabled = isDisabled;
  if (saveBtn) saveBtn.disabled = isDisabled;
}

function setupUsernameSettingsSection() {
  if (usernameFormInitialized) return;
  const input = document.getElementById("settingsUsernameInput");
  const saveBtn = document.getElementById("saveUsernameButton");
  if (!input || !saveBtn) return;

  input.addEventListener("input", () => {
    const value = input.value || "";
    if (!value.trim()) {
      input.classList.remove("username-valid", "username-invalid");
      setSettingsUsernameStatus(
        "Use 3-20 letters, numbers, or underscores.",
        "muted"
      );
      return;
    }

    const validation = validateUsernameValue(value);
    if (validation.valid) {
      input.classList.add("username-valid");
      input.classList.remove("username-invalid");
      setSettingsUsernameStatus(
        "Looks good. Availability is checked when you save.",
        "info"
      );
    } else {
      input.classList.remove("username-valid");
      input.classList.add("username-invalid");
      setSettingsUsernameStatus(validation.message, "error");
    }
  });

  saveBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await handleUsernameUpdate();
  });

  usernameFormInitialized = true;
}

function normalizePulseUrlClient(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.hostname !== "sc2pulse.nephest.com") return "";
    return url.toString();
  } catch (_) {
    return "";
  }
}

function parsePulseTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") {
    try {
      return value.toMillis();
    } catch (_) {
      return null;
    }
  }
  if (value?.seconds) return value.seconds * 1000;
  return null;
}

function setPulseStatus(message, tone = "muted", extraNode = null) {
  const statusEl = document.getElementById("pulseStatusText");
  if (!statusEl) return;
  let color = "#b0b0b0";
  if (tone === "error") color = "#ff9a9a";
  else if (tone === "success") color = "#9ae6b4";
  else if (tone === "info") color = "#8be9fd";

  statusEl.innerHTML = "";
  statusEl.style.whiteSpace = "pre-line";
  statusEl.style.color = color;
  const span = document.createElement("span");
  span.textContent = message || DEFAULT_PULSE_STATUS;
  statusEl.appendChild(span);
  if (extraNode) {
    statusEl.appendChild(extraNode);
  }
}

function updateSettingsHelperText(id, message, tone = "muted") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  let color = "#b0b0b0";
  if (tone === "error") color = "#ff9a9a";
  else if (tone === "success") color = "#9ae6b4";
  else if (tone === "info") color = "#8be9fd";
  el.style.color = color;
}

function setTwitchStatus(message, tone = "muted") {
  updateSettingsHelperText("settingsTwitchStatus", message, tone);
}

function setCountryStatus(message, tone = "muted") {
  updateSettingsHelperText("settingsCountryStatus", message, tone);
}

function setTwitchInputValue(value) {
  const input = document.getElementById("settingsTwitchInput");
  if (input) input.value = value || "";
}

function setCountrySelectValue(value) {
  const select = document.getElementById("settingsCountrySelect");
  if (!select) return;
  if (!select.querySelector(`option[value="${value}"]`)) {
    // No matching option; leave blank
    select.value = "";
    return;
  }
  select.value = value || "";
}

function populateCountrySelectOptions() {
  const select = document.getElementById("settingsCountrySelect");
  if (!select || select.dataset.filled === "true") return;
  const sortedCountries = [...ISO_COUNTRIES].sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), "en", {
      sensitivity: "base",
    })
  );
  const options = ['<option value="">Prefer not to say</option>']
    .concat(
      sortedCountries.map(
        (country) => `<option value="${country.code}">${country.name}</option>`
      )
    )
    .join("");
  select.innerHTML = options;
  select.dataset.filled = "true";
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

function setupCountrySelector() {
  if (countrySelectInitialized) return;
  const select = document.getElementById("settingsCountrySelect");
  if (!select) return;
  populateCountrySelectOptions();
  select.addEventListener("change", handleCountrySelection);
  countrySelectInitialized = true;
}

async function handleCountrySelection(event) {
  const select =
    event?.target || document.getElementById("settingsCountrySelect");
  if (!select) return;
  const code = select.value;
  const user = auth.currentUser;
  if (!user) {
    setCountryStatus("Sign in to set your country.", "error");
    showToast("? Please sign in to set your country.", "error");
    return;
  }
  const payload = code ? { country: code } : { country: deleteField() };
  try {
    await setDoc(doc(db, "users", user.uid), payload, { merge: true });
    setCountryStatus(
      code ? "Country saved." : "Country cleared.",
      code ? "success" : "muted"
    );
    showToast("? Country updated.", "success");
  } catch (err) {
    console.error("Failed to save country", err);
    setCountryStatus("Failed to save country.", "error");
    showToast("? Failed to save country.", "error");
  }
}

function setPulseControlsDisabled(isDisabled) {
  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (input) input.disabled = isDisabled;
  if (connectBtn) connectBtn.disabled = isDisabled;
}

function deriveOverallMmr(byRace, fallback) {
  if (byRace && typeof byRace === "object") {
    const vals = Object.values(byRace).filter((v) => Number.isFinite(v));
    if (vals.length) return Math.max(...vals);
  }
  return Number.isFinite(fallback) ? fallback : null;
}

function buildMmrBadges(byRace, overall, updatedAt) {
  const order = ["zerg", "terran", "protoss", "random"];
  const frag = document.createDocumentFragment();
  const list = document.createElement("div");
  list.className = "mmr-badge-list";
  let hasBadges = false;

  order.forEach((race) => {
    const val =
      byRace && Number.isFinite(byRace[race]) ? Math.round(byRace[race]) : null;
    if (!val) return;
    const meta = RACE_UI[race] || { label: race, icon: "", color: "#9ae6b4" };
    const badge = document.createElement("div");
    badge.className = "mmr-badge";
    badge.style.setProperty("--race-color", meta.color || "#9ae6b4");

    if (meta.icon) {
      const img = document.createElement("img");
      img.className = "mmr-badge-icon";
      img.src = meta.icon;
      img.alt = `${meta.label} icon`;
      badge.appendChild(img);
    }

    const text = document.createElement("span");
    text.textContent = `${meta.label}: ${val} MMR`;
    badge.appendChild(text);

    list.appendChild(badge);
    hasBadges = true;
  });

  if (!hasBadges && Number.isFinite(overall)) {
    const badge = document.createElement("div");
    badge.className = "mmr-badge";
    const text = document.createElement("span");
    text.textContent = `${Math.round(overall)} MMR`;
    badge.appendChild(text);
    list.appendChild(badge);
    hasBadges = true;
  }

  if (hasBadges) {
    frag.appendChild(list);
    if (updatedAt) {
      const date = new Date(updatedAt);
      if (!Number.isNaN(date.getTime())) {
        const updatedEl = document.createElement("div");
        updatedEl.className = "mmr-updated";
        updatedEl.textContent = `Last updated ${date.toLocaleDateString()}`;
        frag.appendChild(updatedEl);
      }
    }
  }

  return hasBadges ? frag : null;
}
// Expose for other modules that run before module bundling combines scope
if (typeof window !== "undefined") {
  window.buildMmrBadges = buildMmrBadges;
}

function updateUserMmrBadge(mmr, byRace = null, updatedAt = null) {
  const mmrEl = document.getElementById("userMmrMenu");
  if (!mmrEl) return;
  const badges = buildMmrBadges(byRace, mmr, updatedAt);
  mmrEl.innerHTML = "";
  if (badges) {
    mmrEl.appendChild(badges);
    mmrEl.style.display = "block";
  } else {
    mmrEl.style.display = "none";
  }
}

function applyPulseStateFromProfile(pulseData = {}) {
  const byRace =
    pulseData.lastMmrByRace && typeof pulseData.lastMmrByRace === "object"
      ? pulseData.lastMmrByRace
      : pulseData.byRace && typeof pulseData.byRace === "object"
      ? pulseData.byRace
      : null;
  const mmrValue = deriveOverallMmr(
    byRace,
    Number(pulseData.lastMmr ?? pulseData.mmr)
  );
  const fetchedAt =
    parsePulseTimestamp(pulseData.fetchedAt) ||
    parsePulseTimestamp(pulseData.lastMmrUpdated);
  const accountName =
    (pulseData.name && pulseData.name.toString().trim()) || "";
  const secondary =
    Array.isArray(pulseData.secondary) && pulseData.secondary.length
      ? pulseData.secondary.slice(0, MAX_SECONDARY_PULSE_LINKS)
      : [];
  pulseState = {
    url: typeof pulseData.url === "string" ? pulseData.url : "",
    mmr:
      Number.isFinite(mmrValue) && mmrValue > 0 ? Math.round(mmrValue) : null,
    fetchedAt,
    byRace,
    accountName,
    secondary,
  };

  const input = document.getElementById("sc2PulseInput");
  if (input) input.value = pulseState.url || "";

  updateUserMmrBadge(pulseState.mmr, pulseState.byRace, pulseState.fetchedAt);

  if (pulseState.url && pulseState.mmr) {
    const badgeFrag = buildMmrBadges(
      pulseState.byRace,
      pulseState.mmr,
      pulseState.fetchedAt
    );
    setPulseStatus("Connected.", "success", badgeFrag);
  } else if (pulseState.url) {
    setPulseStatus("Link saved. Click Update to refresh your MMR.", "info");
  } else {
    setPulseStatus(DEFAULT_PULSE_STATUS, "muted");
  }

  dispatchPulseState();
}

function resetPulseUi() {
  pulseState = {
    url: "",
    mmr: null,
    fetchedAt: null,
    byRace: null,
    secondary: [],
  };
  updateUserMmrBadge(null, null);
  const input = document.getElementById("sc2PulseInput");
  if (input) input.value = "";
  setPulseStatus(DEFAULT_PULSE_STATUS, "muted");
  dispatchPulseState();
}

function dispatchPulseState() {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  )
    return;
  window.dispatchEvent(
    new CustomEvent("pulse-state-changed", {
      detail: { ...pulseState },
    })
  );
}

function setupPulseSettingsSection() {
  if (pulseUiInitialized) return;
  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (!input || !connectBtn) return;

  connectBtn.addEventListener("click", handleConnectPulse);
  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      setPulseStatus(DEFAULT_PULSE_STATUS, "muted");
    }
  });

  setupPulseHelpModal();

  pulseUiInitialized = true;
}

function setupPulseHelpModal() {
  if (pulseHelpInitialized) return;
  const openBtn = document.getElementById("pulseHelpBtn");
  const modal = document.getElementById("pulseHelpModal");
  const closeBtn = document.getElementById("closePulseHelp");
  if (!openBtn || !modal) return;

  const hide = () => {
    modal.style.display = "none";
  };
  const show = () => {
    modal.style.display = "block";
  };

  openBtn.addEventListener("click", show);
  if (closeBtn) closeBtn.addEventListener("click", hide);
  window.addEventListener("mousedown", (e) => {
    if (e.target === modal) hide();
  });

  pulseHelpInitialized = true;
}

function setupSecondaryPulseModal() {
  if (secondaryPulseModalInitialized) return;
  const openBtn = document.getElementById("openSecondaryPulseModalBtn");
  const modal = document.getElementById("secondaryPulseModal");
  const closeBtn = document.getElementById("closeSecondaryPulseModal");
  const addBtn = document.getElementById("secondaryAddInputBtn");
  const saveBtn = document.getElementById("saveSecondaryPulseBtn");
  const listEl = document.getElementById("secondaryPulseList");
  const helper = document.getElementById("secondaryPulseHelper");
  if (!openBtn || !modal || !listEl) return;

  const extractUrls = (secondary) =>
    Array.isArray(secondary)
      ? secondary
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : entry && typeof entry === "object"
              ? entry.url || ""
              : ""
          )
          .filter(Boolean)
      : [];

  const createRow = (value = "") => {
    const row = document.createElement("div");
    row.className = "secondary-pulse-row";
    const input = document.createElement("input");
    input.type = "url";
    input.className = "settings-input secondary-pulse-input";
    input.placeholder = "add link here...";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = value;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "secondary-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      if (listEl.contains(row)) {
        row.remove();
        ensureMinRows();
        updateHelper();
        updateAddButtonState();
      }
    });
    row.append(input, removeBtn);
    return row;
  };

  const ensureMinRows = () => {
    while (listEl.children.length < MIN_SECONDARY_PULSE_LINKS) {
      listEl.appendChild(createRow());
    }
  };

  const updateHelper = () => {
    if (!helper) return;
    const remaining = Math.max(
      0,
      MAX_SECONDARY_PULSE_LINKS - listEl.children.length
    );
    helper.textContent = `You can add up to ${MAX_SECONDARY_PULSE_LINKS} secondary SC2Pulse links. ${remaining} slot${
      remaining === 1 ? "" : "s"
    } remaining.`;
  };

  const updateAddButtonState = () => {
    if (!addBtn) return;
    addBtn.disabled = listEl.children.length >= MAX_SECONDARY_PULSE_LINKS;
  };

  const addSecondaryRow = (value = "") => {
    if (listEl.children.length >= MAX_SECONDARY_PULSE_LINKS) return;
    listEl.appendChild(createRow(value));
    updateHelper();
    updateAddButtonState();
  };

  const collectValues = () =>
    Array.from(listEl.querySelectorAll("input.secondary-pulse-input"))
      .map((input) => input.value.trim())
      .filter(Boolean)
      .slice(0, MAX_SECONDARY_PULSE_LINKS);

  const prefillFromState = async () => {
    const urlsFromState = extractUrls(pulseState.secondary);
    let urls = [...urlsFromState];

    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const secondary =
          snap.exists() && Array.isArray(snap.data()?.pulse?.secondary)
            ? snap.data().pulse.secondary
            : [];
        const urlsFromDb = extractUrls(secondary);
        if (urlsFromDb.length) {
          urls = Array.from(new Set([...urlsFromDb, ...urls]));
          applyPulseStateFromProfile({
            ...pulseState,
            secondary,
          });
        }
      } catch (err) {
        console.warn("Could not prefill secondary links from Firestore", err);
      }
    }

    if (!urls.length) return;
    listEl.innerHTML = "";
    urls.forEach((url) => addSecondaryRow(url));
  };

  const buildSecondaryProfiles = (links) =>
    links
      .map((link) => normalizePulseUrlClient(link))
      .filter(Boolean)
      .map((url) => ({ url }));

  const enrichSecondaryProfiles = async (profiles) => {
    const enriched = [];
    for (const profile of profiles) {
      const enrichedProfile = { ...profile };
      try {
        const payload = await fetchPulseMmrFromBackend(profile.url);
        const byRace = payload.byRace || null;
        const mmr = deriveOverallMmr(byRace, Number(payload.mmr));
        enrichedProfile.name = (payload.pulseName || "").toString();
        enrichedProfile.lastMmrByRace = byRace;
        enrichedProfile.lastMmr = Number.isFinite(mmr) ? Math.round(mmr) : null;
        enrichedProfile.fetchedAt = Date.now();
      } catch (err) {
        console.warn("Failed to fetch secondary SC2Pulse link", err);
      }
      enriched.push(enrichedProfile);
    }
    return enriched;
  };

  const persistSecondaryProfiles = async (links) => {
    if (!auth.currentUser) {
      showToast("? Please sign in to save secondary links.", "error");
      return [];
    }
    const baseProfiles = buildSecondaryProfiles(links);
    // Always persist URLs, even if enrichment fails
    let profilesToSave = baseProfiles;
    try {
      profilesToSave = await enrichSecondaryProfiles(baseProfiles);
    } catch (_) {
      profilesToSave = baseProfiles;
    }

    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { pulse: { secondary: profilesToSave } },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to save secondary SC2Pulse links", err);
      throw err;
    }
    // Update local state + downstream listeners
    applyPulseStateFromProfile({ ...pulseState, secondary: profilesToSave });
    return profilesToSave;
  };

  const showModal = async () => {
    modal.style.display = "block";
    await prefillFromState();
    ensureMinRows();
    updateHelper();
    updateAddButtonState();
  };

  // Keep inputs in sync when pulse state changes (e.g., after reload)
  window.addEventListener("pulse-state-changed", (event) => {
    const urls = extractUrls(event?.detail?.secondary);
    if (!urls.length) return;
    listEl.innerHTML = "";
    urls.forEach((url) => addSecondaryRow(url));
    ensureMinRows();
    updateHelper();
    updateAddButtonState();
  });

  const hideModal = () => {
    modal.style.display = "none";
  };

  openBtn.addEventListener("click", (event) => {
    event.preventDefault();
    showModal();
  });
  if (closeBtn) closeBtn.addEventListener("click", hideModal);
  window.addEventListener("mousedown", (event) => {
    if (event.target === modal) {
      hideModal();
    }
  });
  if (addBtn) {
    addBtn.addEventListener("click", (event) => {
      event.preventDefault();
      addSecondaryRow();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const values = collectValues();
      const original = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      try {
        const profiles = await persistSecondaryProfiles(values);
        showToast(
          `Saved ${profiles.length} secondary link${
            profiles.length === 1 ? "" : "s"
          }.`,
          "success"
        );
        hideModal();
      } catch (err) {
        showToast("Failed to save secondary links.", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = original;
      }
    });
  }

  ensureMinRows();
  updateHelper();
  updateAddButtonState();
  secondaryPulseModalInitialized = true;
}

async function fetchPulseMmrFromBackend(url) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please sign in first.");
  }

  let lastError = null;

  for (const endpoint of PULSE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, url }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (_) {
        // ignore json parse errors; handled below
      }

      if (!response.ok) {
        const message =
          (payload && payload.error) ||
          `Failed to fetch MMR (status ${response.status}).`;
        lastError = new Error(message);
        // Try next endpoint (helps when local dev lacks hosting rewrite)
        continue;
      }

      if (!Number.isFinite(payload?.mmr)) {
        lastError = new Error("Could not read MMR from SC2Pulse.");
        continue;
      }

      return payload;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error("Failed to fetch MMR from SC2Pulse.");
}

async function handleConnectPulse(event) {
  if (event?.preventDefault) event.preventDefault();

  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (!input || !connectBtn) return;

  const user = auth.currentUser;
  if (!user) {
    setPulseStatus("Sign in to connect your SC2Pulse link.", "error");
    showToast("? Please sign in to connect SC2Pulse.", "error");
    return;
  }

  const rawUrl = (input.value || "").trim();
  if (!rawUrl) {
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { pulse: deleteField(), sc2PulseUrl: deleteField() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to clear SC2Pulse link:", err);
    }
    resetPulseUi();
    setPulseStatus("SC2Pulse link removed.", "info");
    showToast("? SC2Pulse link removed.", "success");
    return;
  }

  const normalizedUrl = normalizePulseUrlClient(rawUrl);
  if (!normalizedUrl) {
    setPulseStatus("Please paste a full sc2pulse.nephest.com link.", "error");
    return;
  }

  connectBtn.disabled = true;
  const originalHtml = connectBtn.innerHTML;
  connectBtn.textContent = "Fetching...";
  setPulseStatus("Fetching MMR from SC2Pulse...", "info");

  try {
    const payload = await fetchPulseMmrFromBackend(normalizedUrl);
    const byRace = payload.byRace || null;
    const overall = deriveOverallMmr(byRace, Number(payload.mmr));
    const pulsePayload = {
      url: payload.url || normalizedUrl,
      fetchedAt: Date.now(),
      lastMmrByRace: byRace,
      name: payload.pulseName || "",
      secondary: pulseState.secondary || [],
    };

    await setDoc(
      doc(db, "users", user.uid),
      { pulse: pulsePayload, sc2PulseUrl: normalizedUrl },
      { merge: true }
    );

    applyPulseStateFromProfile(pulsePayload);
    const badgeFrag = buildMmrBadges(byRace, overall, pulsePayload.fetchedAt);
    setPulseStatus("Connected.", "success", badgeFrag);
    showToast("? SC2Pulse connected and MMR updated.", "success");
  } catch (error) {
    console.error("SC2Pulse fetch failed:", error);
    const message = error?.message || "Failed to fetch MMR from SC2Pulse.";
    setPulseStatus(message.replace("?", "").trim(), "error");
    showToast(message.startsWith("?") ? message : `? ${message}`, "error");
  } finally {
    connectBtn.disabled = false;
    connectBtn.innerHTML = originalHtml;
  }
}

async function writeInBatches(docSnaps, updater) {
  if (!Array.isArray(docSnaps) || docSnaps.length === 0) return;

  let batch = writeBatch(db);
  const commits = [];
  let opCount = 0;

  for (const snap of docSnaps) {
    updater(batch, snap);
    opCount += 1;
    if (opCount >= 450) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);
}

async function updateUserBuildUsernames(userId, newUsername) {
  const buildsRef = collection(db, `users/${userId}/builds`);
  const snap = await getDocs(buildsRef);
  if (snap.empty) return;

  await writeInBatches(snap.docs, (batch, docSnap) => {
    batch.set(
      docSnap.ref,
      { publisher: newUsername, username: newUsername },
      { merge: true }
    );
  });
}

async function updatePublishedBuildUsernames(userId, newUsername) {
  const publishedRef = collection(db, "publishedBuilds");
  const publishedSnap = await getDocs(
    query(publishedRef, where("publisherId", "==", userId))
  );
  if (publishedSnap.empty) return;

  await writeInBatches(publishedSnap.docs, (batch, docSnap) => {
    batch.set(
      docSnap.ref,
      { username: newUsername, publisher: newUsername },
      { merge: true }
    );
  });
}

async function updateUserCommentsUsername(userId, newUsername) {
  const commentsSnap = await getDocs(
    query(collectionGroup(db, "comments"), where("userId", "==", userId))
  );
  if (commentsSnap.empty) return;

  await writeInBatches(commentsSnap.docs, (batch, docSnap) => {
    batch.update(docSnap.ref, { username: newUsername });
  });
}

async function propagateUsernameChange(userId, newUsername) {
  let hadError = false;
  const tasks = [
    updateUserBuildUsernames(userId, newUsername).catch((err) => {
      console.error(
        "? Failed to update personal builds with new username",
        err
      );
      hadError = true;
    }),
    updatePublishedBuildUsernames(userId, newUsername).catch((err) => {
      console.error(
        "? Failed to update published builds with new username",
        err
      );
      hadError = true;
    }),
    updateUserCommentsUsername(userId, newUsername).catch((err) => {
      console.error("? Failed to update comments with new username", err);
      hadError = true;
    }),
  ];

  await Promise.all(tasks);
  return !hadError;
}

function applyUsernameToDom(newUsername) {
  const displayName = newUsername || "Guest";

  const userName = document.getElementById("userName");
  if (userName) userName.innerText = displayName;
  const userNameMenu = document.getElementById("userNameMenu");
  if (userNameMenu) userNameMenu.innerText = displayName;

  const buildPublisher = document.getElementById("buildPublisher");
  if (buildPublisher) buildPublisher.innerText = displayName;
  const buildPublisherMobile = document.getElementById("buildPublisherMobile");
  if (buildPublisherMobile) buildPublisherMobile.innerText = displayName;

  const currentUserId = auth.currentUser?.uid;
  if (currentUserId) {
    document
      .querySelectorAll(
        `.comment-card[data-user-id="${currentUserId}"] .comment-identity`
      )
      .forEach((btn) => {
        btn.textContent = displayName;
      });
  }

  setSettingsUsernameValue(displayName);
  setSettingsUsernameDisabled(!auth.currentUser);
}

async function handleUsernameUpdate() {
  const input = document.getElementById("settingsUsernameInput");
  const saveBtn = document.getElementById("saveUsernameButton");
  if (!input || !saveBtn) return;

  const user = auth.currentUser;
  if (!user) {
    setSettingsUsernameStatus(
      "Please sign in to change your username.",
      "error"
    );
    showToast("? Please sign in to change your username.", "error");
    return;
  }

  const validation = validateUsernameValue(input.value || "");
  if (!validation.valid) {
    setSettingsUsernameStatus(validation.message, "error");
    showToast(validation.message, "error");
    return;
  }

  const desiredUsername = validation.cleaned;
  if (
    currentUsername &&
    currentUsername.toLowerCase() === desiredUsername.toLowerCase()
  ) {
    setSettingsUsernameStatus("You're already using that username.", "info");
    showToast("You're already using that username.", "info");
    return;
  }

  setSettingsUsernameDisabled(true);
  setSettingsUsernameStatus("Checking availability...", "info");

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await transaction.get(userRef);
      const existingUsername = userSnap.exists()
        ? userSnap.data().username || null
        : null;

      if (
        existingUsername &&
        existingUsername.toLowerCase() === desiredUsername.toLowerCase()
      ) {
        throw new Error("username_same");
      }

      const usernameRef = doc(db, "usernames", desiredUsername);
      const usernameSnap = await transaction.get(usernameRef);
      const usernameData = usernameSnap.exists() ? usernameSnap.data() : null;

      if (usernameData && usernameData.userId !== user.uid) {
        throw new Error("username_taken");
      }

      transaction.set(
        userRef,
        { username: desiredUsername, userId: user.uid },
        { merge: true }
      );
      transaction.set(usernameRef, { userId: user.uid });

      if (existingUsername && existingUsername !== desiredUsername) {
        transaction.delete(doc(db, "usernames", existingUsername));
      }
    });

    const propagated = await propagateUsernameChange(user.uid, desiredUsername);
    currentUsername = desiredUsername;
    applyUsernameToDom(desiredUsername);

    setSettingsUsernameStatus(
      propagated
        ? `Username updated to ${desiredUsername}.`
        : "Username updated. Some content may take a moment to refresh.",
      propagated ? "success" : "info"
    );
    showToast(
      propagated
        ? `? Username updated to ${desiredUsername}`
        : "Username updated. Some content may take a moment to refresh.",
      propagated ? "success" : "info"
    );
  } catch (error) {
    let message = "? Failed to update username. Please try again.";
    if (error.message === "username_taken") {
      message = "? That username is already taken.";
    } else if (error.message === "username_same") {
      message = "You're already using that username.";
    }
    console.error("Username update failed:", error);
    setSettingsUsernameStatus(message.replace("?", "").trim(), "error");
    showToast(message, "error");
  } finally {
    setSettingsUsernameDisabled(false);
  }
}

async function checkAndSetUsername(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists() || !userSnapshot.data().username) {
    const usernameModal = document.getElementById("usernameModal");
    const usernameInput = document.getElementById("usernameInput");

    usernameModal.style.display = "block";

    usernameInput.addEventListener("input", async () => {
      const validation = validateUsernameValue(usernameInput.value || "");
      const hasValue = (usernameInput.value || "").trim().length > 0;

      if (!hasValue) {
        usernameInput.classList.remove("username-valid", "username-invalid");
        return;
      }

      if (!validation.valid) {
        usernameInput.classList.remove("username-valid");
        usernameInput.classList.add("username-invalid");
        return;
      }

      const usernameDoc = doc(db, "usernames", validation.cleaned);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        usernameInput.classList.remove("username-valid");
        usernameInput.classList.add("username-invalid");
      } else {
        usernameInput.classList.remove("username-invalid");
        usernameInput.classList.add("username-valid");
      }
    });

    document.getElementById("confirmUsernameButton").onclick = async () => {
      const validation = validateUsernameValue(usernameInput.value || "");
      if (!validation.valid) {
        showToast(validation.message, "error");
        return;
      }

      const username = validation.cleaned;
      const usernameDoc = doc(db, "usernames", username);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        showToast("? That username is already taken.", "error");
      } else {
        await setDoc(userRef, { username, userId: user.uid }, { merge: true });
        await setDoc(usernameDoc, { userId: user.uid });

        showToast("? Username set as: " + username, "success");

        document.getElementById("userName").innerText = username;
        document.getElementById("userNameMenu").innerText = username;
        document.getElementById("userNameMenu").style.display = "inline-block";
        document.getElementById("userName").style.display = "inline-block";
        document.getElementById("userPhoto").style.display = "inline-block";
        usernameModal.style.display = "none";
      }
    };
  }
}
/*********************************************************************
 * UI Updates Based on Auth State
 *********************************************************************/
export function initializeAuthUI() {
  const authLoadingWrapper = document.getElementById("authLoadingWrapper");
  const userName = document.getElementById("userName");
  const userPhoto = document.getElementById("userPhoto");
  const userMenu = document.getElementById("userMenu");
  const userNameMenu = document.getElementById("userNameMenu");
  const signInBtn = document.getElementById("signInBtn");
  const showClanBtn = document.getElementById("showClanModalButton");
  const mapVetoBtn = document.getElementById("mapVetoBtn");
  const settingsMenuItem = document.getElementById("settingsBtn");
  const statsMenuItem = document.getElementById("showStatsButton");
  const switchAccountMenuItem = document.getElementById("switchAccountBtn");
  const signOutMenuItem = document.getElementById("signOutBtn");
  const deleteAccountMenuItem = document.getElementById("deleteAccountBtn");
  const menuDividers = document.querySelectorAll("#userMenu .menu-divider");
  const settingsAvatarImg = document.getElementById("settingsCurrentAvatar");

  setupUsernameSettingsSection();
  setupAvatarModal();
  setupTwitchSettingsSection();
  setupCountrySelector();

  // ✅ IMMEDIATE HIDE to prevent any flashing before Firebase loads
  if (userMenu) userMenu.style.display = "none";
  menuDividers.forEach((d) => (d.style.display = "none"));

  if (authLoadingWrapper) authLoadingWrapper.style.display = "flex";
  if (userName) userName.style.display = "none";
  if (userPhoto) userPhoto.style.display = "none";

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const authContainerEl = document.getElementById("auth-container");
      if (authContainerEl) authContainerEl.classList.add("is-auth");
      const userRef = doc(db, "users", user.uid);
      const userSnapshot = await getDoc(userRef);

      let userData = userSnapshot.exists() ? userSnapshot.data() : {};
      let username = userData?.username ?? null;

      if (!username) {
        await checkAndSetUsername(user);
        const updatedSnapshot = await getDoc(userRef);
        userData = updatedSnapshot.exists() ? updatedSnapshot.data() : userData;
        username = userData?.username ?? "Guest";
      }

      currentUsername = username || "Guest";
      setSettingsUsernameDisabled(false);
      setSettingsUsernameValue(currentUsername);
      setSettingsUsernameStatus(
        "Use 3-20 letters, numbers, or underscores.",
        "muted"
      );

      currentUserAvatarUrl = resolveUserAvatar(userData);
      const pulseMerged = {
        ...(userData?.pulse || {}),
        lastMmrUpdated: userData?.lastMmrUpdated,
      };
      applyPulseStateFromProfile(pulseMerged);
      setPulseControlsDisabled(false);

      if (userName) userName.innerText = username || "Guest";
      if (userNameMenu) userNameMenu.innerText = username || "Guest";
      if (userPhoto) userPhoto.src = currentUserAvatarUrl;
      if (settingsAvatarImg) settingsAvatarImg.src = currentUserAvatarUrl;
      updateAvatarSelectionHighlight(currentUserAvatarUrl);
      emitAvatarUpdate(currentUserAvatarUrl);
      setTwitchInputValue(userData?.twitchUrl || "");
      setTwitchStatus(
        userData?.twitchUrl
          ? "Twitch channel loaded."
          : "Add your Twitch channel to link your stream.",
        userData?.twitchUrl ? "info" : "muted"
      );
      setCountrySelectValue(userData?.country || "");
      if (signInBtn) signInBtn.style.display = "none";
      if (showClanBtn) showClanBtn.disabled = false;
      // map veto inline button visibility handled via CSS media queries
      if (showClanBtn) showClanBtn.style.display = "block";
      if (settingsMenuItem) settingsMenuItem.style.display = "block";
      if (statsMenuItem) statsMenuItem.style.display = "block";
      if (switchAccountMenuItem) switchAccountMenuItem.style.display = "block";
      if (signOutMenuItem) signOutMenuItem.style.display = "block";
      if (deleteAccountMenuItem)
        deleteAccountMenuItem.style.display = "inline-flex";
      menuDividers.forEach((d) => (d.style.display = "block"));
      try {
        updateFloatingTilePositions();
      } catch (_) {}
    } else {
      const authContainerEl = document.getElementById("auth-container");
      if (authContainerEl) authContainerEl.classList.remove("is-auth");
      currentUserAvatarUrl = DEFAULT_AVATAR_URL;
      currentUsername = null;
      updateAvatarSelectionHighlight(DEFAULT_AVATAR_URL);
      emitAvatarUpdate(DEFAULT_AVATAR_URL);
      closeAvatarModal();
      if (userName) userName.innerText = "Guest";
      if (userNameMenu) userNameMenu.innerText = "Guest";
      if (userPhoto) userPhoto.src = DEFAULT_AVATAR_URL;
      if (settingsAvatarImg) settingsAvatarImg.src = DEFAULT_AVATAR_URL;
      setTwitchInputValue("");
      setTwitchStatus("Sign in to add your Twitch channel.", "muted");
      setCountrySelectValue("");
      setCountryStatus("Sign in to set your country.", "muted");
      setSettingsUsernameDisabled(true);
      setSettingsUsernameValue("");
      setSettingsUsernameStatus("Sign in to update your username.", "muted");
      resetPulseUi();
      setPulseControlsDisabled(true);
      setPulseStatus("Sign in to connect your SC2Pulse link.", "muted");
      if (userMenu) userMenu.style.display = "none";
      if (signInBtn) signInBtn.style.display = "inline-block";
      if (showClanBtn) showClanBtn.disabled = true;
      // map veto inline button visibility handled via CSS media queries
      if (showClanBtn) showClanBtn.style.display = "none";
      if (settingsMenuItem) settingsMenuItem.style.display = "none";
      if (statsMenuItem) statsMenuItem.style.display = "none";
      if (switchAccountMenuItem) switchAccountMenuItem.style.display = "none";
      if (signOutMenuItem) signOutMenuItem.style.display = "none";
      if (deleteAccountMenuItem) deleteAccountMenuItem.style.display = "none";
      menuDividers.forEach((d) => (d.style.display = "none"));
      resetBuildInputs();
      try {
        updateFloatingTilePositions();
      } catch (_) {}
    }

    if (authLoadingWrapper) authLoadingWrapper.style.display = "none";
    if (userName) userName.style.display = "inline";
    if (userNameMenu) userNameMenu.style.display = "inline-block";
    if (userPhoto) userPhoto.style.display = "inline";
    try {
      updateFloatingTilePositions();
    } catch (_) {}
  });
}

/*********************************************************************
 * Auth Button Functions
 *********************************************************************/
function closeUserMenu() {
  const menu = document.getElementById("userMenu");
  if (menu) {
    menu.style.display = "none";
    setTimeout(() => (menu.style.display = ""), 100); // Reset visibility for next toggle
  }
}

let authPopupInProgress = false;
function scheduleAuthPopupReset() {
  const resetIfIdle = () => {
    if (authPopupInProgress && !auth.currentUser) {
      authPopupInProgress = false;
    }
  };
  const onFocus = () => {
    window.removeEventListener("focus", onFocus);
    setTimeout(resetIfIdle, 150);
  };
  const onVisibility = () => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", onVisibility);
    setTimeout(resetIfIdle, 150);
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  setTimeout(resetIfIdle, 4000);
}

export function handleSignIn() {
  if (authPopupInProgress) return;
  authPopupInProgress = true;
  scheduleAuthPopupReset();
  signInWithPopup(auth, provider)
    .then(() => {
      initializeAuthUI();
    })
    .catch((error) => {
      if (error?.code === "auth/cancelled-popup-request") return;
      if (error?.code === "auth/popup-closed-by-user") return;
      console.error("❌ Sign in error:", error);
      showToast("Sign-in failed. Please try again.", "error");
    })
    .finally(() => {
      authPopupInProgress = false;
    });
}

export function handleSignOut() {
  signOut(auth)
    .then(() => {
      resetBuildInputs();
      initializeAuthUI();
      closeUserMenu();
      window.location.reload();
    })
    .catch((error) => {
      console.error("❌ Sign out error:", error);
    });
}

export async function handleSwitchAccount() {
  try {
    if (authPopupInProgress) return;
    authPopupInProgress = true;
    scheduleAuthPopupReset();
    await signOut(auth);
    const result = await signInWithPopup(auth, switchAccountProvider);
    initializeAuthUI();
    closeUserMenu();
    window.location.reload();
  } catch (err) {
    if (err?.code === "auth/cancelled-popup-request") return;
    if (err?.code === "auth/popup-closed-by-user") return;
    console.error("❌ Error switching accounts:", err);
    showToast("Failed to switch account. Please try again.", "error");
  } finally {
    authPopupInProgress = false;
  }
}

/*********************************************************************
 * Account Deletion (User Menu)
 *********************************************************************/
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const deleteAccountModal = document.getElementById("deleteAccountModal");
const confirmDeleteAccountButton = document.getElementById(
  "confirmDeleteAccountButton"
);
const cancelDeleteAccountButton = document.getElementById(
  "cancelDeleteAccountButton"
);

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener("click", () => {
    deleteAccountModal.style.display = "block";
  });
}

if (cancelDeleteAccountButton) {
  cancelDeleteAccountButton.addEventListener("click", () => {
    deleteAccountModal.style.display = "none";
  });
}

if (confirmDeleteAccountButton) {
  confirmDeleteAccountButton.addEventListener("click", async () => {
    const deleteCommunityBuilds = document.getElementById(
      "deleteCommunityBuildsCheckbox"
    ).checked;

    const user = auth.currentUser;
    const userId = user.uid;

    try {
      const db = getFirestore();

      // 1. Get the username first
      const userRef = doc(db, "users", userId);
      const userSnapshot = await getDoc(userRef);

      let usernameToDelete = null;
      if (userSnapshot.exists()) {
        usernameToDelete = userSnapshot.data().username || null;
      }

      // 2. Delete user document
      await deleteDoc(userRef);

      // 3. Delete username mapping
      if (usernameToDelete) {
        const usernameDoc = doc(db, "usernames", usernameToDelete);
        await deleteDoc(usernameDoc);
        console.log(`✅ Deleted username mapping: ${usernameToDelete}`);
      }

      // 4. Delete all user's personal builds
      const buildsRef = collection(db, `users/${userId}/builds`);
      const buildSnapshots = await getDocs(buildsRef);
      const deletePersonalBuilds = buildSnapshots.docs.map((doc) =>
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePersonalBuilds);
      console.log("✅ Deleted all personal builds");

      // 5. Optionally delete community builds by this user
      if (deleteCommunityBuilds && usernameToDelete) {
        const publishedRef = collection(db, "publishedBuilds");
        const querySnapshot = await getDocs(publishedRef);
        const toDelete = querySnapshot.docs.filter(
          (doc) =>
            doc.data().username === usernameToDelete ||
            doc.data().publisher === usernameToDelete
        );
        const deleteCommunity = toDelete.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deleteCommunity);
        console.log(`✅ Deleted ${toDelete.length} community builds`);
      }

      // 6. Delete Firebase Auth account
      await deleteUser(user);
      closeUserMenu();
      showToast("✅ Account deleted successfully.", "success");

      deleteAccountModal.style.display = "none";
      setTimeout(() => (window.location.href = "/"), 2000);
    } catch (error) {
      console.error("❌ Error deleting account:", error);
      showToast(
        "❌ Failed to delete account. Try re-logging in first.",
        "error"
      );
    }
  });
}

/*********************************************************************
 * Auth Container Click Menu (replaces avatar click)
 *********************************************************************/
const userMenu = document.getElementById("userMenu");
const authContainer = document.getElementById("auth-container");
const userPhoto = document.getElementById("userPhoto");

if (authContainer && userMenu) {
  // Toggle menu on auth container click
  authContainer.addEventListener("click", (event) => {
    // Only allow toggling when user is signed in
    if (!auth.currentUser) return;
    // Do not toggle if clicking the sign-in button
    const signInBtn = document.getElementById("signInBtn");
    if (
      signInBtn &&
      (event.target === signInBtn || signInBtn.contains(event.target))
    ) {
      return;
    }
    // Prevent toggling when clicking inside the open menu itself
    if (userMenu.contains(event.target)) return;
    event.stopPropagation();
    userMenu.style.display =
      userMenu.style.display === "block" ? "none" : "block";
  });

  // Close menu if clicking outside of both auth container and the menu
  window.addEventListener("click", (e) => {
    const clickedInsideAuth = authContainer.contains(e.target);
    const clickedInsideMenu = userMenu.contains(e.target);
    if (!clickedInsideAuth && !clickedInsideMenu) {
      userMenu.style.display = "none";
    }
  });
}

/*********************************************************************
 * Username Modal Closing Behavior
 *********************************************************************/
const usernameModal = document.getElementById("usernameModal");
const closeUsernameModal = document.getElementById("closeUsernameModal");

if (closeUsernameModal) {
  closeUsernameModal.addEventListener("click", async () => {
    await handleCancelUsername();
  });
}

window.addEventListener("click", async (e) => {
  if (e.target === usernameModal) {
    await handleCancelUsername();
  }
});

async function handleCancelUsername() {
  document.getElementById("usernameModal").style.display = "none";

  // Reset to guest and sign out
  const userName = document.getElementById("userName");
  const userNameMenu = document.getElementById("userNameMenu");
  const userPhoto = document.getElementById("userPhoto");

  if (userPhoto) userPhoto.src = DEFAULT_AVATAR_URL;
  if (userName) userName.innerText = "Guest";
  if (userNameMenu) userNameMenu.innerText = "Guest";

  await signOut(auth);
}

function getPulseState() {
  return { ...pulseState };
}

function getCurrentUsername() {
  return currentUsername || auth.currentUser?.displayName || "";
}

function getCurrentUserAvatarUrl() {
  return currentUserAvatarUrl;
}

export {
  app,
  auth,
  db,
  getPulseState,
  getCurrentUsername,
  getCurrentUserAvatarUrl,
};
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.handleSwitchAccount = handleSwitchAccount;
