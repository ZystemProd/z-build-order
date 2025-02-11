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
  collection,
  doc,
  getDoc,
  setDoc,
  disableNetwork,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import {
  initializeEventListeners,
  initializeModalEventListeners,
} from "./js/modules/eventHandlers.js";
import { populateBuildList } from "./js/modules/modal.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

async function checkAndSetUsername(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists() || !userSnapshot.data().username) {
    // Show username modal
    document.getElementById("usernameModal").style.display = "block";

    document.getElementById("confirmUsernameButton").onclick = async () => {
      let username = document.getElementById("usernameInput").value.trim();
      if (!username) return alert("Username cannot be empty!");

      const usernameRef = doc(db, "usernames", username);
      const usernameSnapshot = await getDoc(usernameRef);

      if (usernameSnapshot.exists()) {
        alert("That username is taken. Try another.");
      } else {
        // Store username in Firestore
        await setDoc(userRef, { username, userId: user.uid }, { merge: true });
        await setDoc(usernameRef, { userId: user.uid });

        alert(`Username set as: ${username}`);
        document.getElementById("usernameModal").style.display = "none";
      }
    };
  }
}

// Update UI based on auth state
async function updateAuthUI(user) {
  const authLoading = document.getElementById("authLoading"); // Get loading indicator

  if (authLoading) {
    authLoading.innerText = ""; // ✅ Hide loading message
  }

  if (user) {
    console.log("User signed in:", user);

    // Get username from Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    let username = userSnapshot.exists() ? userSnapshot.data().username : null;

    if (!username) {
      await checkAndSetUsername(user); // Prompt user to set a username if not found
      const updatedUserSnapshot = await getDoc(userRef);
      username = updatedUserSnapshot.exists()
        ? updatedUserSnapshot.data().username
        : "Unknown";
    }

    // ✅ Update userDetails with the username
    document.getElementById("userDetails").innerText = `${username}`;
    document.getElementById("whenSignedIn").hidden = false;
    document.getElementById("whenSignedOut").hidden = true;
  } else {
    console.log("No user signed in.");
    document.getElementById("userDetails").innerText = "";
    document.getElementById("whenSignedIn").hidden = true;
    document.getElementById("whenSignedOut").hidden = false;
  }
}

// ✅ "Switch Account" Button Logic (Added Inside updateAuthUI)
document
  .getElementById("switchAccountBtn")
  .addEventListener("click", async () => {
    try {
      await signOut(auth);
      console.log("User signed out. Switching accounts...");

      const result = await signInWithPopup(auth, provider);
      console.log("User signed in:", result.user);

      updateAuthUI(result.user); // ✅ Refresh UI after switching accounts
    } catch (error) {
      console.error("Switch account error:", error);
    }
  });

// Grab references to DOM elements
const elements = {
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  userDetails: document.getElementById("userDetails"),
  authLoading: document.getElementById("authLoading"),
  whenSignedIn: document.getElementById("whenSignedIn"),
  whenSignedOut: document.getElementById("whenSignedOut"),
};

// Sign in with Google
function handleSignIn() {
  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("User signed in:", result.user);
      updateAuthUI(result.user);
    })
    .catch((error) => {
      console.error(
        "Sign-in error:",
        DOMPurify.sanitize(error.message || error)
      );
    });
}

// Sign out
async function handleSignOut() {
  try {
    await disableNetwork(db); //  Force close Firestore connection
    await signOut(auth);
    console.log("User signed out successfully.");
    updateAuthUI(null);
  } catch (error) {
    console.error("Error signing out:", error.message);
  }
}

// Attach event listeners
function attachEventListeners() {
  if (elements.signInBtn)
    elements.signInBtn.addEventListener("click", handleSignIn);
  if (elements.signOutBtn)
    elements.signOutBtn.addEventListener("click", handleSignOut);
}

// Listen for authentication state changes
onAuthStateChanged(auth, updateAuthUI);

// Initialize application on DOM load
document.addEventListener("DOMContentLoaded", () => {
  const authLoading = document.getElementById("authLoading");
  if (authLoading) {
    authLoading.innerText = "Checking authentication status..."; // ✅ Show message before auth check
  }

  initializeEventListeners();
  initializeModalEventListeners();
  attachEventListeners();
});

// Export Firebase utilities
export { app, auth, db };
