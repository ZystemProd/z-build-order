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
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";
import { bannedWords } from "./js/data/bannedWords.js";
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

  // Position the Map Veto tile relative to auth-container
  try { updateMapVetoPosition(); } catch (_) {}
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

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6LcBBWsrAAAAALLmBNIhl-zKPa8KRj8mXMldoKbN"),
  isTokenAutoRefreshEnabled: true, // auto refresh recommended
});

function updateMapVetoPosition() {
  const authEl = document.getElementById("auth-container");
  const vetoEl = document.getElementById("mapVetoTile");
  if (!authEl || !vetoEl) return;

  // Skip on mobile (tile is hidden there)
  if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
    return;
  }

  // Preferred horizontal gap between elements
  const gap = 16; // px

  const rect = authEl.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    vetoEl.style.right = "10px";
    return;
  }

  // Place tile to the left of auth container with a fixed gap
  const targetRight = Math.max(10, window.innerWidth - rect.left + gap);
  vetoEl.style.right = `${targetRight}px`;
}

window.addEventListener("resize", () => {
  try { updateMapVetoPosition(); } catch (_) {}
});
window.addEventListener("load", () => {
  try { updateMapVetoPosition(); } catch (_) {}
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
async function checkAndSetUsername(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists() || !userSnapshot.data().username) {
    const usernameModal = document.getElementById("usernameModal");
    const usernameInput = document.getElementById("usernameInput");

    usernameModal.style.display = "block";

    usernameInput.addEventListener("input", async () => {
      const username = usernameInput.value.trim();
      if (!username) {
        usernameInput.classList.remove("username-valid", "username-invalid");
        return;
      }

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        usernameInput.classList.remove("username-valid");
        usernameInput.classList.add("username-invalid");
        return;
      }

      const lowerUsername = username.toLowerCase();
      if (bannedWords.some((badWord) => lowerUsername.includes(badWord))) {
        usernameInput.classList.remove("username-valid");
        usernameInput.classList.add("username-invalid");
        return;
      }

      const usernameDoc = doc(db, "usernames", username);
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
      const username = usernameInput.value.trim();
      if (!username) {
        showToast("Username cannot be empty!", "error");
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        showToast(
          "Username must be 3-20 characters, only letters, numbers, or _",
          "error"
        );
        return;
      }

      const lowerUsername = username.toLowerCase();
      if (bannedWords.some((badWord) => lowerUsername.includes(badWord))) {
        showToast(
          "🚫 Username contains inappropriate words or reserved terms.",
          "error"
        );
        return;
      }

      const usernameDoc = doc(db, "usernames", username);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        showToast("❌ That username is already taken.", "error");
      } else {
        await setDoc(userRef, { username, userId: user.uid }, { merge: true });
        await setDoc(usernameDoc, { userId: user.uid });

        showToast(`✅ Username set as: ${username}`, "success");

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

  setupAvatarModal();

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

      currentUserAvatarUrl = resolveUserAvatar(userData);

      if (userName) userName.innerText = username || "Guest";
      if (userNameMenu) userNameMenu.innerText = username || "Guest";
      if (userPhoto) userPhoto.src = currentUserAvatarUrl;
      if (settingsAvatarImg) settingsAvatarImg.src = currentUserAvatarUrl;
      updateAvatarSelectionHighlight(currentUserAvatarUrl);
      emitAvatarUpdate(currentUserAvatarUrl);
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
      try { updateMapVetoPosition(); } catch (_) {}
    } else {
      const authContainerEl = document.getElementById("auth-container");
      if (authContainerEl) authContainerEl.classList.remove("is-auth");
      currentUserAvatarUrl = DEFAULT_AVATAR_URL;
      updateAvatarSelectionHighlight(DEFAULT_AVATAR_URL);
      emitAvatarUpdate(DEFAULT_AVATAR_URL);
      closeAvatarModal();
      if (userName) userName.innerText = "Guest";
      if (userNameMenu) userNameMenu.innerText = "Guest";
      if (userPhoto) userPhoto.src = DEFAULT_AVATAR_URL;
      if (settingsAvatarImg) settingsAvatarImg.src = DEFAULT_AVATAR_URL;
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
      try { updateMapVetoPosition(); } catch (_) {}
    }

    if (authLoadingWrapper) authLoadingWrapper.style.display = "none";
    if (userName) userName.style.display = "inline";
    if (userNameMenu) userNameMenu.style.display = "inline-block";
    if (userPhoto) userPhoto.style.display = "inline";
    try { updateMapVetoPosition(); } catch (_) {}
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

export function handleSignIn() {
  signInWithPopup(auth, provider)
    .then(() => {
      initializeAuthUI();
    })
    .catch((error) => {
      console.error("❌ Sign in error:", error);
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
    await signOut(auth);
    const result = await signInWithPopup(auth, provider);
    initializeAuthUI();
    closeUserMenu();
    window.location.reload();
  } catch (err) {
    console.error("❌ Error switching accounts:", err);
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

export { app, auth, db };
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.handleSwitchAccount = handleSwitchAccount;
