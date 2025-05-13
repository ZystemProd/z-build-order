import { auth, db } from "../../../app.js";
import { safeAdd } from "../helpers/sharedEventUtils.js";
import { initializeSectionToggles } from "../uiHandlers.js";
// Import Firestore methods from local Firebase SDK
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { populateBuildsModal } from "../buildManagement.js";

export function initializeViewBuildPage() {
  safeAdd("signInBtn", "click", window.handleSignIn);
  safeAdd("signOutBtn", "click", window.handleSignOut);
  safeAdd("switchAccountBtn", "click", window.handleSwitchAccount);
  safeAdd("importBuildButton", "click", importBuildHandler);
  initializeSectionToggles();
}

async function importBuildHandler() {
  const urlParams = new URLSearchParams(window.location.search);
  const buildId = urlParams.get("id");

  if (!buildId) {
    alert("Build ID not found.");
    return;
  }

  if (!auth.currentUser) {
    alert("Please sign in first to import builds.");
    return;
  }

  const userId = auth.currentUser.uid;
  const communityBuildRef = doc(db, "communityBuilds", buildId);
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

    document.getElementById("importBuildButton").disabled = true;
    document.getElementById("importBuildButton").textContent = "Imported";

    alert("✅ Build imported successfully!");
    populateBuildsModal();
  } catch (error) {
    console.error(error);
    alert("❌ Failed to import build.");
  }
}
