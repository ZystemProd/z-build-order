import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, provider, switchAccountProvider } from "../firebase.js";
import { showToast } from "../toastHandler.js";
import { resetBuildInputs } from "../utils.js";
import { updateFloatingTilePositions } from "../ui/floatingTiles.js";
import { hydrateLazyImages } from "../ui/lazyImages.js";
import { applySettingsToLocalStorage } from "../settings/localStorage.js";
import {
  checkAndSetUsername,
  setSettingsUsernameDisabled,
  setSettingsUsernameStatus,
  setSettingsUsernameValue,
} from "../settings/username.js";
import {
  applyPulseStateFromProfile,
  resetPulseUi,
  setPulseControlsDisabled,
  setPulseStatus,
  updateUserMenuMmrFromProfile,
} from "../settings/pulse.js";
import { setTwitchInputValue, setTwitchStatus } from "../settings/twitch.js";
import {
  setCountrySelectValue,
  setCountryStatus,
} from "../settings/country.js";
import {
  DEFAULT_AVATAR_URL,
  closeAvatarModal,
  emitAvatarUpdate,
  getCurrentUserAvatarUrl,
  resolveUserAvatar,
  setCurrentUserAvatarUrl,
  updateAvatarSelectionHighlight,
} from "../settings/avatar.js";
import {
  getCurrentUsername,
  setCurrentUsername,
  setCurrentUserProfile,
} from "../settings/state.js";

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

function initializeAuthUI() {
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

      setCurrentUserProfile(userData);
      setCurrentUsername(username || "Guest");
      applySettingsToLocalStorage(userData?.settings || {});
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("user-profile-updated", {
            detail: { userData },
          })
        );
      }
      setSettingsUsernameDisabled(false);
      setSettingsUsernameValue(getCurrentUsername());
      setSettingsUsernameStatus(
        "Use 3-20 letters, numbers, or underscores.",
        "muted"
      );

      setCurrentUserAvatarUrl(resolveUserAvatar(userData));
      const currentAvatarUrl = getCurrentUserAvatarUrl();
      const pulseMerged = {
        ...(userData?.pulse || {}),
        lastMmrUpdated: userData?.lastMmrUpdated,
      };
      applyPulseStateFromProfile(pulseMerged);
      updateUserMenuMmrFromProfile(userData);
      setPulseControlsDisabled(false);

      if (userName) userName.innerText = username || "Guest";
      if (userNameMenu) userNameMenu.innerText = username || "Guest";
      if (userPhoto) userPhoto.src = currentAvatarUrl;
      if (settingsAvatarImg) settingsAvatarImg.src = currentAvatarUrl;
      updateAvatarSelectionHighlight(currentAvatarUrl);
      emitAvatarUpdate(currentAvatarUrl);
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
      setCurrentUserAvatarUrl(DEFAULT_AVATAR_URL);
      setCurrentUserProfile(null);
      setCurrentUsername(null);
      updateAvatarSelectionHighlight(DEFAULT_AVATAR_URL);
      emitAvatarUpdate(DEFAULT_AVATAR_URL);
      closeAvatarModal();
      if (userName) userName.innerText = "Guest";
      if (userNameMenu) userNameMenu.innerText = "Guest";
      if (userPhoto) userPhoto.src = DEFAULT_AVATAR_URL;
      if (settingsAvatarImg) settingsAvatarImg.src = DEFAULT_AVATAR_URL;
      const mmrEl = document.getElementById("userMmrMenu");
      if (mmrEl) {
        mmrEl.style.display = "none";
        mmrEl.textContent = "";
      }
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

function handleSignIn() {
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

function handleSignOut() {
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

async function handleSwitchAccount() {
  try {
    if (authPopupInProgress) return;
    authPopupInProgress = true;
    scheduleAuthPopupReset();
    await signOut(auth);
    await signInWithPopup(auth, switchAccountProvider);
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

function initAuthMenuToggle() {
  const userMenu = document.getElementById("userMenu");
  const authContainer = document.getElementById("auth-container");
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
      const isOpen = userMenu.style.display === "block";
      userMenu.style.display = isOpen ? "none" : "block";
      if (!isOpen) {
        hydrateLazyImages(userMenu);
      }
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
}

export {
  closeUserMenu,
  handleSignIn,
  handleSignOut,
  handleSwitchAccount,
  initAuthMenuToggle,
  initializeAuthUI,
};
