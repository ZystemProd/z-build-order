// app.js (corrected and final)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getPerformance } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-performance.js";
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
    document.getElementById("usernameModal").style.display = "block";

    document.getElementById("confirmUsernameButton").onclick = async () => {
      const usernameInput = document.getElementById("usernameInput");
      const username = usernameInput.value.trim();

      if (!username) {
        alert("Username cannot be empty!");
        return;
      }

      const usernameDoc = doc(db, "usernames", username);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        alert("That username is already taken. Please choose another.");
      } else {
        await setDoc(userRef, { username, userId: user.uid }, { merge: true });
        await setDoc(usernameDoc, { userId: user.uid });

        alert(`Username set as: ${username}`);
        document.getElementById("usernameModal").style.display = "none";
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

  // ✅ When page loads: show spinner + "Loading user...", hide user info
  if (authLoadingWrapper) authLoadingWrapper.style.display = "flex";
  if (userName) {
    userName.style.display = "none";
    userName.classList.remove("visible");
  }
  if (userPhoto) {
    userPhoto.style.display = "none";
    userPhoto.classList.remove("visible");
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("✅ User logged in:", user.displayName || user.email);

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

      document.getElementById("userName").innerText = username || "Guest";
      document.getElementById("userPhoto").src =
        user.photoURL || "img/default-avatar.webp";

      toggleAuthButtons(true);
    } else {
      console.log("🚫 No user logged in.");

      document.getElementById("userName").innerText = "Guest";
      document.getElementById("userPhoto").src = "img/default-avatar.webp";

      toggleAuthButtons(false);
      resetBuildInputs();
    }

    // ✅ After Firebase confirms login state:
    if (authLoadingWrapper) authLoadingWrapper.style.display = "none"; // Hide spinner + loading text
    if (userName) {
      userName.style.display = "inline";
      userName.classList.add("visible"); // fade-in effect
    }
    if (userPhoto) {
      userPhoto.style.display = "inline";
      userPhoto.classList.add("visible"); // fade-in effect
    }
  });
}

/*********************************************************************
 * Auth Button Functions
 *********************************************************************/
function toggleAuthButtons(isLoggedIn) {
  document.getElementById("signInBtn").style.display = isLoggedIn
    ? "none"
    : "inline-block";
  document.getElementById("switchAccountBtn").style.display = isLoggedIn
    ? "inline-block"
    : "none";
  document.getElementById("signOutBtn").style.display = isLoggedIn
    ? "inline-block"
    : "none";
}

export function handleSignIn() {
  const authLoading = document.getElementById("authLoading");
  if (authLoading) authLoading.innerText = "Signing in...";

  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("✅ Signed in as:", result.user.displayName);
      initializeAuthUI();
    })
    .catch((error) => {
      console.error("❌ Sign in error:", error);
      if (authLoading) authLoading.innerText = "Sign in failed!";
    });
}

export function handleSignOut() {
  signOut(auth)
    .then(() => {
      console.log("✅ Signed out.");
      resetBuildInputs();
      initializeAuthUI();
      window.location.reload(); // Refresh to clean UI
    })
    .catch((error) => {
      console.error("❌ Sign out error:", error);
    });
}

export async function handleSwitchAccount() {
  try {
    await signOut(auth);
    console.log("🔄 Signed out. Switching accounts...");
    resetBuildInputs();

    const result = await signInWithPopup(auth, provider);
    console.log("✅ Switched to account:", result.user.displayName);
    initializeAuthUI();
    window.location.reload();
  } catch (err) {
    console.error("❌ Error switching accounts:", err);
  }
}

/*********************************************************************
 * Exports
 *********************************************************************/

// Export to modules
export { auth, db };

// Attach to window for UI buttons
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.handleSwitchAccount = handleSwitchAccount;
