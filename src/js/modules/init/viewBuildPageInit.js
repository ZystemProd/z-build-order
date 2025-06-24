import { auth, db } from "../../../app.js";
import { safeAdd } from "../helpers/sharedEventUtils.js";
import { initializeSectionToggles } from "../uiHandlers.js";
// Import Firestore methods from local Firebase SDK
import {
  doc,
  getDoc,
  setDoc,
  collection,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { populateBuildsModal } from "../buildManagement.js";
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
  const buildId = pathParts[2]; // because URL is /build/abc123

  if (!buildId) {
    alert("Build ID not found.");
    return;
  }

  if (!auth.currentUser) {
    alert("Please sign in first to import builds.");
    return;
  }

  const userId = auth.currentUser.uid;
  const communityBuildRef = doc(db, "publishedBuilds", buildId);
  const userBuildsRef = collection(db, `users/${userId}/builds`);

  try {
    const buildDoc = await getDoc(communityBuildRef);
    if (!buildDoc.exists()) {
      alert("Build not found.");
      return;
    }

    const buildData = buildDoc.data();
    const encodedTitle = buildData.title.replace(/\//g, "__SLASH__");
    const userBuildDocRef = doc(userBuildsRef, encodedTitle);
    const existingDoc = await getDoc(userBuildDocRef);

    if (existingDoc.exists()) {
      alert("⚠️ This build is already in your library.");
      return;
    }

    await setDoc(userBuildDocRef, {
      ...buildData,
      publisher: buildData.username || buildData.publisher || "Unknown",
      imported: true,
      timestamp: Date.now(),
    });

    logAnalyticsEvent("build_imported", { source: "community" });

    document.getElementById("importBuildButton").disabled = true;
    document.getElementById("importBuildButton").textContent = "Imported";

    alert("✅ Build imported successfully!");
  } catch (error) {
    console.error(error);
    alert("❌ Failed to import build.");
    logAnalyticsEvent("build_import_failed", { reason: error.message });
  }
}
