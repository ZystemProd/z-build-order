import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { formatActionText } from "../modules/textFormatters.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadBuild() {
  const urlParams = new URLSearchParams(window.location.search);
  const buildId = urlParams.get("id");

  if (!buildId) {
    document.getElementById("buildTitle").innerText = "Build not found.";
    console.error("❌ Error: No build ID in URL.");
    return;
  }

  console.log("🔍 Loading build with ID:", buildId);

  const buildRef = doc(db, "communityBuilds", buildId);
  const buildSnapshot = await getDoc(buildRef);

  if (buildSnapshot.exists()) {
    const build = buildSnapshot.data();
    console.log("✅ Build Loaded:", build);

    // Populate build details
    document.getElementById("buildTitle").innerText =
      build.title || "Untitled Build";
    document.getElementById("buildCategory").innerText =
      build.category || "Unknown";
    document.getElementById("buildMatchup").innerText =
      build.subcategory || "Unknown";
    document.getElementById("buildPublisher").innerText =
      build.username || "Anonymous";
    document.getElementById("buildDate").innerText = new Date(
      build.datePublished
    ).toLocaleDateString();

    // ✅ Fixing Build Order Display
    const buildOrderContainer = document.getElementById("buildOrder");

    // Check if buildOrderContainer is being selected correctly
    if (!buildOrderContainer) {
      console.error("❌ Error: 'buildOrder' container not found!");
      return;
    }

    buildOrderContainer.innerHTML = ""; // Clear previous content

    if (Array.isArray(build.buildOrder) && build.buildOrder.length > 0) {
      // ✅ Ensure each action is formatted properly
      build.buildOrder.forEach((step) => {
        if (typeof step === "string") {
          // If it's a string (like a single action without brackets), just format it
          buildOrderContainer.innerHTML += `<p>${formatActionText(step)}</p>`;
        } else if (
          typeof step === "object" &&
          step.action &&
          step.action.trim() !== "" // Ensure action is not empty
        ) {
          // Handle steps with workersOrTimestamp (with optional bracket)
          const bracket =
            step.workersOrTimestamp && step.workersOrTimestamp.trim() !== ""
              ? `<strong>[${step.workersOrTimestamp}]</strong> `
              : "";

          // Only show action if it's not empty
          if (step.action.trim() !== "") {
            buildOrderContainer.innerHTML += `<p>${bracket}${formatActionText(
              step.action
            )}</p>`;
          }
        }
      });
    } else {
      buildOrderContainer.innerHTML = "<p>No build order available.</p>";
    }
  } else {
    console.error("❌ Build not found in Firestore:", buildId);
    document.getElementById("buildTitle").innerText = "Build not found.";
  }
}

document.addEventListener("DOMContentLoaded", loadBuild);

window.addEventListener("popstate", () => {
  loadBuild();
});
