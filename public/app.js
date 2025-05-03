// app.js (final, polished)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getPerformance } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-performance.js";
import { bannedWords } from "./js/data/bannedWords.js";
import { showToast } from "./js/modules/uiHandlers.js";
import { resetBuildInputs } from "./js/modules/utils.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBBLnneYwLDfIp-Oep2MvExGnVk_EvDQoo",
  authDomain: "z-build-order.firebaseapp.com",
  projectId: "z-build-order",
  storageBucket: "z-build-order.appspot.com",
  messagingSenderId: "22023941178",
  appId: "1:22023941178:web:ba417e9a52332a8e055903",
  measurementId: "G-LBDMKMG1W9",
};

// --- DOM Reset --- //
document.addEventListener("DOMContentLoaded", () => {
  const userPhoto = document.getElementById("userPhoto");
  const userName = document.getElementById("userName");
  const userMenu = document.getElementById("userMenu");

  if (userPhoto) userPhoto.style.display = "none";
  if (userName) userName.style.display = "none";
  if (userMenu) userMenu.style.display = "none";
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const perf = getPerformance(app);

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
  const signInBtn = document.getElementById("signInBtn");
  const showClanBtn = document.getElementById("showClanModalButton");

  // ✅ IMMEDIATE HIDE to prevent any flashing before Firebase loads
  if (userMenu) userMenu.style.display = "none";

  if (authLoadingWrapper) authLoadingWrapper.style.display = "flex";
  if (userName) userName.style.display = "none";
  if (userPhoto) userPhoto.style.display = "none";

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnapshot = await getDoc(userRef);

      let username = userSnapshot.exists()
        ? userSnapshot.data().username
        : null;

      if (!username) {
        await checkAndSetUsername(user);
        const updatedSnapshot = await getDoc(userRef);
        username = updatedSnapshot.exists()
          ? updatedSnapshot.data().username
          : "Guest";
      }

      if (userName) userName.innerText = username || "Guest";
      if (userPhoto) userPhoto.src = user.photoURL || "img/default-avatar.webp";
      if (signInBtn) signInBtn.style.display = "none";
      if (showClanBtn) showClanBtn.disabled = false;
    } else {
      if (userName) userName.innerText = "Guest";
      if (userPhoto) userPhoto.src = "img/default-avatar.webp";
      if (userMenu) userMenu.style.display = "none";
      if (signInBtn) signInBtn.style.display = "inline-block";
      if (showClanBtn) showClanBtn.disabled = true;
      resetBuildInputs();
    }

    if (authLoadingWrapper) authLoadingWrapper.style.display = "none";
    if (userName) userName.style.display = "inline";
    if (userPhoto) userPhoto.style.display = "inline";
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
        const communityRef = collection(db, "communityBuilds");
        const querySnapshot = await getDocs(communityRef);
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
 * User Photo Click Menu
 *********************************************************************/
const userPhoto = document.getElementById("userPhoto");
const userMenu = document.getElementById("userMenu");

if (userPhoto && userMenu) {
  // Toggle menu on avatar click
  userPhoto.addEventListener("click", (event) => {
    event.stopPropagation();
    userMenu.style.display =
      userMenu.style.display === "block" ? "none" : "block";
  });

  // Close menu if clicking outside
  window.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target) && e.target !== userPhoto) {
      userMenu.style.display = "none";
    }
  });
}

// Also fix closing the menu if clicking outside
window.addEventListener("click", (event) => {
  if (
    userMenu &&
    !userMenu.contains(event.target) &&
    event.target !== userPhoto
  ) {
    userMenu.style.display = "none";
  }
});

// Close user menu if clicking outside
window.addEventListener("click", (e) => {
  if (userMenu && !userMenu.contains(e.target) && e.target !== userPhoto) {
    userMenu.style.display = "none";
  }
});

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
  const userPhoto = document.getElementById("userPhoto");

  if (userPhoto) userPhoto.src = "img/default-avatar.webp";
  if (userName) userName.innerText = "Guest";

  await signOut(auth);
}

export { auth, db };
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.handleSwitchAccount = handleSwitchAccount;
