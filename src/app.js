import { app, auth, db } from "./js/modules/firebase.js";
import { initCookieConsent } from "./js/modules/cookieConsent.js";
import {
  deferSvgImagesIn,
  deferWebpImagesIn,
  hydrateLazyImages,
  observeVisibilityForLazyImages,
  setupModalImageLazyLoading,
} from "./js/modules/ui/lazyImages.js";
import {
  initFloatingTilePositioning,
  updateFloatingTilePositions,
} from "./js/modules/ui/floatingTiles.js";
import {
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  closeUserMenu,
  handleSignIn,
  handleSignOut,
  handleSwitchAccount,
  initAuthMenuToggle,
  initializeAuthUI,
} from "./js/modules/auth/ui.js";
import { initDeleteAccountFlow } from "./js/modules/auth/deleteAccount.js";
import {
  DEFAULT_AVATAR_URL,
  getCurrentUserAvatarUrl,
  setupAvatarModal,
} from "./js/modules/settings/avatar.js";
import {
  setupUsernameSettingsSection,
} from "./js/modules/settings/username.js";
import {
  buildMmrBadges,
  setupPulseSettingsSection,
  setupSecondaryPulseModal,
  syncPulseNow,
} from "./js/modules/settings/pulse.js";
import { setupTwitchSettingsSection } from "./js/modules/settings/twitch.js";
import { setupCountrySelector } from "./js/modules/settings/country.js";
import {
  getCurrentUsername as getCurrentUsernameState,
  getCurrentUserProfile,
  getPulseState,
} from "./js/modules/settings/state.js";

// --- DOM Reset --- //
document.addEventListener("DOMContentLoaded", () => {
  const userPhoto = document.getElementById("userPhoto");
  const userName = document.getElementById("userName");
  const userMenu = document.getElementById("userMenu");

  const userNameMenu = document.getElementById("userNameMenu");
  if (userPhoto) userPhoto.style.display = "none";
  if (userName) userName.style.display = "none";
  if (userNameMenu) userNameMenu.style.display = "none";
  if (userMenu) {
    userMenu.style.display = "none";
    deferWebpImagesIn(userMenu);
    deferSvgImagesIn(userMenu);
    observeVisibilityForLazyImages(userMenu);
  }
  const replayOverlay = document.getElementById("replayDropOverlay");
  if (replayOverlay) {
    deferSvgImagesIn(replayOverlay);
    observeVisibilityForLazyImages(replayOverlay);
  }
  setupModalImageLazyLoading();

  // Position the floating utility tiles relative to auth-container
  try {
    updateFloatingTilePositions();
  } catch (_) {}
});

initFloatingTilePositioning();
initCookieConsent(app);

let settingsUiReady = false;

/*
// If testing locally, you can enable Firebase emulators by importing
// connectAuthEmulator and connectFirestoreEmulator from the relevant
// Firebase packages and calling them here.
*/
// Set persistence
setPersistence(auth, browserLocalPersistence);
initAuthMenuToggle();
initDeleteAccountFlow({ closeUserMenu });

// Expose for other modules that run before module bundling combines scope
if (typeof window !== "undefined") {
  window.buildMmrBadges = buildMmrBadges;
  window.hydrateLazyImages = hydrateLazyImages;
}

export function ensureSettingsUiReady() {
  if (settingsUiReady) return;
  setupUsernameSettingsSection();
  setupPulseSettingsSection();
  setupTwitchSettingsSection();
  setupCountrySelector();
  setupSecondaryPulseModal();
  setupAvatarModal({ closeUserMenu });
  settingsUiReady = true;
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

function getCurrentUsername() {
  return getCurrentUsernameState() || auth.currentUser?.displayName || "";
}

export {
  app,
  auth,
  db,
  initializeAuthUI,
  getPulseState,
  getCurrentUserProfile,
  getCurrentUsername,
  getCurrentUserAvatarUrl,
  syncPulseNow,
};
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.handleSwitchAccount = handleSwitchAccount;
