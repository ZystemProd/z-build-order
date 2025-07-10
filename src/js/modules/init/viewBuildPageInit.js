import { auth, db } from "../../../app.js";
import { safeAdd } from "../helpers/sharedEventUtils.js";
import { initializeSectionToggles } from "../uiHandlers.js";
import { showToast } from "../toastHandler.js";
// Import Firestore methods from local Firebase SDK
import {
  doc,
  getDoc,
  addDoc,
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
  const buildId = pathParts[2]; // because URL is /build/abc123

  if (!buildId) {
    showToast("Build ID not found.", "error");
    return;
  }

  if (!auth.currentUser) {
    showToast("Please sign in first to import builds.", "error");
    return;
  }

  const userId = auth.currentUser.uid;
  const communityBuildRef = doc(db, "publishedBuilds", buildId);
  const userBuildsRef = collection(db, `users/${userId}/builds`);

  try {
    const buildDoc = await getDoc(communityBuildRef);
    if (!buildDoc.exists()) {
      showToast("Build not found.", "error");
      return;
    }

    const buildData = buildDoc.data();
    const encodedTitle = buildData.title.replace(/\//g, "__SLASH__");
    const q = query(userBuildsRef, where("encodedTitle", "==", encodedTitle));
    const existingSnap = await getDocs(q);

    if (!existingSnap.empty) {
      showToast("⚠️ This build is already in your library.", "warning");
      return;
    }

    const docRef = await addDoc(userBuildsRef, {
      ...buildData,
      publisher: buildData.username || buildData.publisher || "Unknown",
      imported: true,
      timestamp: Date.now(),
    });

    logAnalyticsEvent("build_imported", { source: "community" });

    document.getElementById("importBuildButton").disabled = true;
    document.getElementById("importBuildButton").textContent = "Imported";

    showToast("✅ Build imported successfully!", "success");
  } catch (error) {
    console.error(error);
    showToast("❌ Failed to import build.", "error");
    logAnalyticsEvent("build_import_failed", { reason: error.message });
  }
}
