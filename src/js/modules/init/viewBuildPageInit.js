import { auth, db } from "../../../app.js";
import { safeAdd } from "../helpers/sharedEventUtils.js";
import { initializeSectionToggles } from "../uiHandlers.js";
import { showToast } from "../toastHandler.js";
// Import Firestore methods from local Firebase SDK

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { logAnalyticsEvent } from "../analyticsHelper.js";

export function initializeViewBuildPage() {
  safeAdd("signInBtn", "click", window.handleSignIn);
  safeAdd("signOutBtn", "click", window.handleSignOut);
  safeAdd("switchAccountBtn", "click", window.handleSwitchAccount);
  safeAdd("importBuildButton", "click", importBuildHandler);
  initializeSectionToggles();
}

async function importBuildHandler() {
  const pathParts = window.location.pathname.split("/");
  let maybeTitleOrId = decodeURIComponent(pathParts[2]);


  if (!buildId) {
    showToast("Build ID not found.", "error");

    return;
  }

  if (!auth.currentUser) {

    showToast("Please sign in first to import builds.", "error");

    return;
  }

  const userId = auth.currentUser.uid;


  // 🔑 Assume it is an ID, unless it's obviously not
  let publishedId = maybeTitleOrId;

  // ✅ If it looks like a title or slug, resolve to real published Firestore ID
  if (publishedId.length < 15 || publishedId.includes(" ")) {
    const publishedRef = collection(db, "publishedBuilds");
    const q = query(publishedRef, where("title", "==", publishedId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("❌ Build not found in published builds.");
      return;
    }

    publishedId = snapshot.docs[0].id; // ✅ This is the real unique ID
  }

  // 🔑 Use the REAL ID when saving to user's builds
  const userBuildDocRef = doc(db, `users/${userId}/builds/${publishedId}`);


  try {
    const communityBuildRef = doc(db, "publishedBuilds", publishedId);
    const buildDoc = await getDoc(communityBuildRef);

    if (!buildDoc.exists()) {

      showToast("Build not found.", "error");
      return;
    }

    const userBuildDoc = await getDoc(userBuildDocRef);
    if (userBuildDoc.exists()) {
      showToast("⚠️ This build is already in your library.", "warning");

      return;
    }

    const buildData = buildDoc.data();

    await setDoc(userBuildDocRef, {
      ...buildData,
      publisher: buildData.username || buildData.publisher || "Unknown",
      imported: true,
      encodedTitle: publishedId, // optional — your real unique ID
      datePublished: buildData.datePublished?.toMillis?.() || Date.now(),
      timestamp: Date.now(),
    });

    logAnalyticsEvent("build_imported", { source: "community" });

    const importBtn = document.getElementById("importBuildButton");
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.textContent = "Imported";
    }

    showToast("✅ Build imported successfully!", "success");
  } catch (error) {
    console.error(error);
    showToast("❌ Failed to import build.", "error");
    logAnalyticsEvent("build_import_failed", { reason: error.message });
  }
}
