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
    return;
  }

  // Save the last viewed build ID in session storage
  sessionStorage.setItem("lastViewedBuild", buildId);

  const buildRef = doc(db, "communityBuilds", buildId);
  const buildSnapshot = await getDoc(buildRef);

  if (buildSnapshot.exists()) {
    const build = buildSnapshot.data();
    document.getElementById("buildTitle").innerText = build.title;
    document.getElementById("buildCategory").innerText = build.category;
    document.getElementById("buildMatchup").innerText = build.subcategory;
    document.getElementById("buildPublisher").innerText = build.username;
    document.getElementById("buildDate").innerText = new Date(
      build.datePublished
    ).toLocaleDateString();

    const formattedBuildOrder = Array.isArray(build.buildOrder)
      ? build.buildOrder.map(formatActionText).join("<br>")
      : formatActionText(build.buildOrder || "No build order available.");

    document.getElementById("buildOrder").innerHTML = formattedBuildOrder;
  } else {
    document.getElementById("buildTitle").innerText = "Build not found.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadBuild();
});

window.addEventListener("popstate", () => {
  loadBuild();
});
