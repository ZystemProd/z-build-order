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
      elements.userDetails.innerText = `Welcome, ${
        user.displayName || user.email
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
      console.error("Sign-in error:", error);
    });
}

// Sign out
async function handleSignOut() {
  try {
    await signOut(auth);
    console.log("User signed out successfully.");
    updateAuthUI(null);
  } catch (error) {
    console.error("Error signing out:", error);
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

document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("buildOrderInput"); // Ensure this matches your textarea's ID
  if (textarea) {
    textarea.addEventListener("click", function () {
      console.log("Textarea clicked! Current value:", textarea.value); // Logs the current value on click
      if (textarea.value.trim() === "") {
        console.log("Textarea is empty, adding brackets []"); // Logs when brackets are being added
        // If the textarea is empty, set its value to "[]"
        textarea.value = "[]";
        // Position the caret inside the brackets
        textarea.selectionStart = 1;
        textarea.selectionEnd = 1;
      } else {
        console.log("Textarea is not empty. No changes made."); // Logs when the textarea is not empty
      }
    });
  } else {
    console.error("Textarea with ID 'buildOrderInput' not found!"); // Logs an error if the textarea is not found
  }
});
