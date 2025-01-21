import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import {
  initializeEventListeners,
  initializeModalEventListeners,
} from "./js/modules/eventHandlers.js";

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

// Google Sign-In
const provider = new GoogleAuthProvider();

document.getElementById("signInBtn").addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("User signed in:", result.user);
      document.getElementById(
        "userDetails"
      ).innerText = `Welcome, ${result.user.displayName}`;
      document.getElementById("whenSignedOut").hidden = true;
      document.getElementById("whenSignedIn").hidden = false;
    })
    .catch((error) => {
      console.error("Sign-in error:", error);
    });
});

document.getElementById("signOutBtn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("User signed out.");
      document.getElementById("whenSignedOut").hidden = false;
      document.getElementById("whenSignedIn").hidden = true;
    })
    .catch((error) => {
      console.error("Sign-out error:", error);
    });
});

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  initializeModalEventListeners();
});
