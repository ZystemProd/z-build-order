import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import {
  initializeEventListeners,
  initializeModalEventListeners,
} from "./js/modules/eventHandlers.js";
import { resetBuildInputs } from "./js/modules/utils.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBLnneYwLDfIp-Oep2MvExGnVk_EvDQoo",
  authDomain: "z-build-order.firebaseapp.com",
  projectId: "z-build-order",
  storageBucket: "z-build-order.firebasestorage.app",
  messagingSenderId: "22023941178",
  appId: "1:22023941178:web:ba417e9a52332a8e055903",
  measurementId: "G-LBDMKMG1W9",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/*********************************************************************
 * 2. CHECK & SET USERNAME
 *********************************************************************/
async function checkAndSetUsername(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  // If no username in Firestore, prompt for one
  if (!userSnapshot.exists() || !userSnapshot.data().username) {
    // Show modal
    document.getElementById("usernameModal").style.display = "block";

    // Handle "Confirm" button
    document.getElementById("confirmUsernameButton").onclick = async () => {
      const usernameInput = document.getElementById("usernameInput");
      const username = usernameInput.value.trim();

      if (!username) {
        alert("Username cannot be empty!");
        return;
      }

      // Check if username already exists
      const usernameDoc = doc(db, "usernames", username);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        alert("That username is taken. Try another.");
      } else {
        // Store username in "users" collection
        await setDoc(userRef, { username, userId: user.uid }, { merge: true });
        // Also mark it as taken in "usernames" collection
        await setDoc(usernameDoc, { userId: user.uid });

        alert(`Username set as: ${username}`);
        document.getElementById("usernameModal").style.display = "none";
      }
    };
  }
}

/*********************************************************************
 * 3. UPDATE UI BASED ON AUTH STATE
 *********************************************************************/
async function updateAuthUI(user) {
  const authLoading = document.getElementById("authLoading");
  if (authLoading) authLoading.innerText = "";

  if (user) {
    console.log("User signed in:", user);

    // Fetch username from Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);
    let username = userSnapshot.exists() ? userSnapshot.data().username : null;

    if (!username) {
      // Prompt for username
      await checkAndSetUsername(user);
      const updatedSnapshot = await getDoc(userRef);
      username = updatedSnapshot.exists()
        ? updatedSnapshot.data().username
        : "Unknown";
    }

    // Show username (not email)
    document.getElementById("userName").innerText = username || "Guest";

    // Show user photo
    const userPhoto = user.photoURL || "img/default-avatar.png";
    document.getElementById("userPhoto").src = userPhoto;

    // Show Switch & Sign Out buttons, hide Sign In
    document.getElementById("signInBtn").style.display = "none";
    document.getElementById("switchAccountBtn").style.display = "inline-block";
    document.getElementById("signOutBtn").style.display = "inline-block";
  } else {
    console.log("No user signed in.");

    // Reset display
    document.getElementById("userName").innerText = "Guest";
    document.getElementById("userPhoto").src = "img/default-avatar.png";

    // Show Sign In, hide Switch & Sign Out
    document.getElementById("signInBtn").style.display = "inline-block";
    document.getElementById("switchAccountBtn").style.display = "none";
    document.getElementById("signOutBtn").style.display = "none";
  }
}

/*********************************************************************
 * 4. SIGN-IN / SIGN-OUT / SWITCH
 *********************************************************************/
function handleSignIn() {
  const authLoading = document.getElementById("authLoading");
  if (authLoading) {
    authLoading.innerText = "Signing in...";
  }

  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("Sign in successful:", result.user);
      updateAuthUI(result.user);
    })
    .catch((error) => {
      console.error("Sign in error:", error);
      if (authLoading) authLoading.innerText = "Sign in failed!";
    });
}

function handleSignOut() {
  signOut(auth)
    .then(() => {
      console.log("✅ User signed out successfully.");

      resetBuildInputs(); // ✅ Reset UI when signing out

      updateAuthUI(null); // Ensure UI updates
      window.location.reload(); // Optional: Reload to fully refresh the page
    })
    .catch((error) => {
      console.error("❌ Sign out error:", error);
    });
}

/**
 * Signs out the current user, then opens the sign-in popup
 * for selecting a different Google account.
 */
async function handleSwitchAccount() {
  try {
    await signOut(auth);
    console.log("🔄 Signed out. Now signing in with another account...");

    resetBuildInputs(); // ✅ Reset all inputs when switching accounts

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    console.log("✅ Switched to new account:", result.user);

    updateAuthUI(result.user);
    window.location.reload(); // Optional: Reload to fully refresh UI
  } catch (err) {
    console.error("❌ Error switching accounts:", err);
  }
}

/*********************************************************************
 * 5. EVENT LISTENERS
 *********************************************************************/
function attachEventListeners() {
  document.getElementById("signInBtn")?.addEventListener("click", handleSignIn);
  document
    .getElementById("signOutBtn")
    ?.addEventListener("click", handleSignOut);
  document
    .getElementById("switchAccountBtn")
    ?.addEventListener("click", handleSwitchAccount);
}

/*********************************************************************
 * 6. AUTH STATE CHANGE LISTENER
 *********************************************************************/

onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.log("🚫 No user logged in. Resetting UI...");
    resetBuildInputs(); // ✅ Reset everything when user logs out
    updateAuthUI(null);
  } else {
    console.log("✅ User logged in:", user.displayName);
    updateAuthUI(user);
  }
});

/*********************************************************************
 * 7. ON DOM READY
 *********************************************************************/
document.addEventListener("DOMContentLoaded", () => {
  const authLoading = document.getElementById("authLoading");
  enableCloseModalOnOutsideClick();
  if (authLoading) {
    authLoading.innerText = "Checking authentication status...";
  }
  attachEventListeners();
});

function enableCloseModalOnOutsideClick() {
  const modal = document.getElementById("usernameModal");

  // If the user clicks anywhere outside the .modal-content area, close the modal
  modal.addEventListener("click", (event) => {
    // Check if the clicked element is the modal background itself
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  initializeModalEventListeners();
});

// Export Firebase utilities
export { app, auth, db };
