import { auth, db } from "../../../app.js";
import { safeAdd } from "../helpers/sharedEventUtils.js";
import { initializeSectionToggles } from "../uiHandlers.js";
import { doc, getDoc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
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
  
  // User menu actions: mirror index.html behavior
  safeAdd("mapVetoBtn", "click", () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    window.location.href = "/veto.html";
  });
  safeAdd("tournamentBtn", "click", () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    window.location.href = "/tournament/";
  });

  // These modals live on index.html; set a flag and route there
  safeAdd("showClanModalButton", "click", () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    try { localStorage.setItem("openClanModalOnLoad", "true"); } catch {}
    window.location.href = "/index.html";
  });

  safeAdd("showStatsButton", "click", () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    try { localStorage.setItem("openStatsOnLoad", "true"); } catch {}
    window.location.href = "/index.html";
  });

  safeAdd("settingsBtn", "click", () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    try { localStorage.setItem("openSettingsOnLoad", "true"); } catch {}
    window.location.href = "/index.html";
  });
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
      importBtn.classList.add("imported");
      const label = importBtn.querySelector(".btn-label");
      if (label) {
        label.textContent = "Imported";
      } else {
        importBtn.textContent = "Imported";
      }
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

// Variation tab listeners for View Build page
export function addVariationTabListeners(build, onInlineChange, onGroupNavigate) {
  const tabsEl = document.getElementById("variationTabs");
  if (!tabsEl) return;
  const buttons = tabsEl.querySelectorAll(".variation-tab");
  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // Navigate if tab has a target URL (group mode)
      const url = btn.dataset.url;
      if (url) {
        try {
          if (typeof onGroupNavigate === "function") {
            onGroupNavigate(url);
            return;
          }
          window.history.pushState({}, "", url);
          window.dispatchEvent(new PopStateEvent("popstate"));
        } catch (_) {
          window.location.href = url;
        }
        return;
      }

      // Inline variation index switch
      const idx = parseInt(btn.dataset.varIndex || "0", 10);
      tabsEl.querySelectorAll(".variation-tab").forEach((b) => b.classList.remove("active-tab"));
      btn.classList.add("active-tab");
      if (typeof onInlineChange === "function") {
        try { onInlineChange(idx, build); } catch (_) {}
      }
    });
  });
}
