import { auth, db } from "../../../app.js";
import { safeAdd } from "../helpers/sharedEventUtils.js";
import { initializeSectionToggles } from "../uiHandlers.js";
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
import { showToast } from "../toastHandler.js";

function getBuildId() {
  const path = window.location.pathname;
  const prettyMatch = path.match(/\/build\/[^/]+\/[^/]+\/([^/]+)/);
  if (prettyMatch?.[1]) {
    return decodeURIComponent(prettyMatch[1]);
  }

  const shortMatch = path.match(/\/build\/([^/]+)/);
  if (shortMatch?.[1]) {
    return decodeURIComponent(shortMatch[1]);
  }

  const query = new URLSearchParams(window.location.search);
  const queryId = query.get("id");
  return queryId ? decodeURIComponent(queryId) : "";
}

export function initializeViewBuildPage() {
  safeAdd("signInBtn", "click", window.handleSignIn);
  safeAdd("signOutBtn", "click", window.handleSignOut);
  safeAdd("switchAccountBtn", "click", window.handleSwitchAccount);
  safeAdd("importBuildButton", "click", importBuildHandler);
  initializeSectionToggles();
}

async function importBuildHandler() {
  const maybeTitleOrId = getBuildId();

  if (!maybeTitleOrId) {
    showToast("❌ Build ID or title not found in URL.", "error");
    return;
  }

  if (!auth.currentUser) {
    showToast("⚠️ Please sign in first to import builds.", "warning");
    return;
  }

  const userId = auth.currentUser.uid;

  const publishedId = maybeTitleOrId;

  const communityBuildRef = doc(db, "publishedBuilds", publishedId);
  const userBuildDocRef = doc(db, `users/${userId}/builds/${publishedId}`); // ✅ Always the publishedId!

  try {
    const buildDoc = await getDoc(communityBuildRef);
    if (!buildDoc.exists()) {
      showToast("❌ Build not found in published builds.", "error");
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
      encodedTitle: publishedId, // optional but fine
      datePublished: buildData.datePublished?.toMillis?.() || Date.now(),
      timestamp: Date.now(),
    });

    logAnalyticsEvent("build_imported", { source: "community" });

    const importBtn = document.getElementById("importBuildButton");
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.textContent = "Imported";
      importBtn.classList.add("imported");
    }

    showToast("✅ Build imported successfully!", "success");
  } catch (error) {
    console.error(error);
    showToast("❌ Failed to import build.", "error");
    logAnalyticsEvent("build_import_failed", { reason: error.message });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const shareButton = document.getElementById("shareBuildButton");
  if (!shareButton) return;

  shareButton.style.display = "inline-flex";

  safeAdd("shareBuildButton", "click", async () => {
    const shareUrl = window.location.href; // current page URL, already pretty

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out this SC2 Build Order",
          url: shareUrl,
        });
      } catch (err) {
        console.warn("Share canceled:", err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      showToast("✅ Link copied to clipboard!", "success");
    }
  });
});
