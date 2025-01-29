import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
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

// Grab references to DOM elements
const elements = {
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  userDetails: document.getElementById("userDetails"),
  authLoading: document.getElementById("authLoading"),
  whenSignedIn: document.getElementById("whenSignedIn"),
  whenSignedOut: document.getElementById("whenSignedOut"),
};

// Utility function to update UI based on auth state
function updateAuthUI(user) {
  if (elements.authLoading) elements.authLoading.hidden = true;

  if (user) {
    console.log("User is signed in:", user);

    if (elements.userDetails) {
      const sanitizedDisplayName = user.displayName
        ? DOMPurify.sanitize(user.displayName)
        : null;
      const sanitizedEmail = user.email ? DOMPurify.sanitize(user.email) : null;

      elements.userDetails.innerText = `Welcome, ${
        sanitizedDisplayName || sanitizedEmail
      }`;
    }
    if (elements.whenSignedIn) elements.whenSignedIn.hidden = false;
    if (elements.whenSignedOut) elements.whenSignedOut.hidden = true;
  } else {
    console.log("No user signed in.");

    if (elements.userDetails) elements.userDetails.innerText = "";
    if (elements.whenSignedIn) elements.whenSignedIn.hidden = true;
    if (elements.whenSignedOut) elements.whenSignedOut.hidden = false;
  }
}

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
    await signOut(auth);
    console.log("User signed out successfully.");
    updateAuthUI(null);
  } catch (error) {
    console.error("Error signing out:", DOMPurify.sanitize(error.message));
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
  if (elements.authLoading) elements.authLoading.hidden = false; // Show loading indicator
  initializeEventListeners();
  initializeModalEventListeners();
  attachEventListeners();
});

// Export Firebase utilities
export { app, auth, db };
