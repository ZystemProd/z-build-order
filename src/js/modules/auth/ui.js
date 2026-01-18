import {
  getAdditionalUserInfo,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, getDocs, query, where, limit, collection } from "firebase/firestore";
import { auth, db, provider, switchAccountProvider } from "../firebase.js";
import { logAnalyticsEvent } from "../analyticsHelper.js";
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
let authModalReady = false;
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

function getAuthModalElements() {
  return {
    modal: document.getElementById("signInModal"),
    closeBtn: document.getElementById("closeSignInModal"),
    googleButton: document.getElementById("googleSignInButton"),
    authForm: document.getElementById("authForm"),
    emailInput: document.getElementById("authEmail"),
    passwordInput: document.getElementById("authPassword"),
    emailSignInButton: document.getElementById("emailSignInButton"),
    emailSignUpButton: document.getElementById("emailSignUpButton"),
  };
}

function openAuthModal() {
  const { modal, emailInput } = getAuthModalElements();
  if (!modal) return;
  modal.style.display = "block";
  document.body.classList.add("modal-open");
  if (emailInput) emailInput.focus();
}

function closeAuthModal() {
  const { modal, emailInput, passwordInput } = getAuthModalElements();
  if (!modal) return;
  modal.style.display = "none";
  document.body.classList.remove("modal-open");
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
}

function formatAuthError(error) {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "Email already in use. Try signing in.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network blocked. Try a VPN or different network.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

function initAuthModal() {
  if (authModalReady) return;
  const {
    modal,
    closeBtn,
    googleButton,
    authForm,
    emailInput,
    passwordInput,
    emailSignInButton,
    emailSignUpButton,
  } = getAuthModalElements();
  if (!modal) return;

  const handleGoogleSignIn = async () => {
    if (authPopupInProgress) return;
    authPopupInProgress = true;
    scheduleAuthPopupReset();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      trackSignupFromCredential(userCredential);
      closeAuthModal();
      initializeAuthUI();
    } catch (error) {
      if (error?.code === "auth/cancelled-popup-request") return;
      if (error?.code === "auth/popup-closed-by-user") return;
      if (error?.code === "auth/popup-blocked") {
        showToast("Popup blocked. Allow popups and try again.", "error");
        return;
      }
      console.error("? Sign in error:", error);
      showToast(formatAuthError(error), "error");
    } finally {
      authPopupInProgress = false;
    }
  };

  const handleEmailSignIn = async () => {
    if (authPopupInProgress) return;
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!email || !password) {
      showToast("Enter an email and password.", "error");
      return;
    }
    authPopupInProgress = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeAuthModal();
      initializeAuthUI();
    } catch (error) {
      console.error("? Email sign in error:", error);
      showToast(formatAuthError(error), "error");
    } finally {
      authPopupInProgress = false;
    }
  };

  const handleEmailSignUp = async () => {
    if (authPopupInProgress) return;
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!email || !password) {
      showToast("Enter an email and password.", "error");
      return;
    }
    authPopupInProgress = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      trackSignupFromCredential(userCredential);
      await sendEmailVerification(userCredential.user);
      showToast("Verification email sent. Check your inbox.", "info");
      closeAuthModal();
      initializeAuthUI();
    } catch (error) {
      console.error("? Email sign up error:", error);
      showToast(formatAuthError(error), "error");
    } finally {
      authPopupInProgress = false;
    }
  };

  closeBtn?.addEventListener("click", closeAuthModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeAuthModal();
  });
  googleButton?.addEventListener("click", handleGoogleSignIn);
  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleEmailSignIn();
  });
  emailSignInButton?.addEventListener("click", (event) => {
    event.preventDefault();
    handleEmailSignIn();
  });
  emailSignUpButton?.addEventListener("click", handleEmailSignUp);
  passwordInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleEmailSignIn();
    }
  });

  authModalReady = true;
}

function trackSignupFromCredential(userCredential) {
  const info = getAdditionalUserInfo(userCredential);
  if (!info?.isNewUser) return;
  const providerId = info?.providerId || "";
  const method = providerId ? providerId.replace(".com", "") : "unknown";
  logAnalyticsEvent("sign_up", { method });
}

function initializeAuthUI() {
  initAuthModal();
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
      let userSnapshot = null;
      let userData = {};
      let username = null;
      const fetchUsernameByUid = async (uid) => {
        const q = query(
          collection(db, "usernames"),
          where("userId", "==", uid),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0]?.id || null;
      };
      try {
        userSnapshot = await getDoc(userRef);
        userData = userSnapshot.exists() ? userSnapshot.data() : {};
        username = userData?.username ?? null;
        if (!username) {
          await checkAndSetUsername(user);
          const updatedSnapshot = await getDoc(userRef);
          userData = updatedSnapshot.exists() ? updatedSnapshot.data() : userData;
          username = userData?.username ?? "Guest";
        }
      } catch (err) {
        if (err?.code !== "permission-denied") {
          console.error("Failed to load user profile", err);
        }
        username = (await fetchUsernameByUid(user.uid)) || "Guest";
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
  openAuthModal();
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
    const userCredential = await signInWithPopup(auth, switchAccountProvider);
    trackSignupFromCredential(userCredential);
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
