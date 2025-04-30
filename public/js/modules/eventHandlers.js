// eventHandlers.js (FINAL version)

import { auth, db } from "../../app.js";
import { saveCurrentBuild, populateBuildsModal } from "./buildManagement.js";
import { initializeAutoCorrect } from "./autoCorrect.js";
import { populateBuildDetails, analyzeBuildOrder } from "./uiHandlers.js";
import { updateYouTubeEmbed } from "./youtube.js";
import {
  closeModal,
  showSubcategories,
  filterBuilds,
  searchBuilds,
} from "./modal.js";
import {
  MapAnnotations,
  initializeMapControls,
  initializeMapSelection,
  mapAnnotations,
} from "./interactive_map.js";
import {
  initializeSectionToggles,
  initializeTextareaClickHandler,
  showBuildOrderHelpModal,
} from "./uiHandlers.js";
import {
  showTemplatesModal,
  setupTemplateModal,
  showSaveTemplateModal,
  searchTemplates,
  previewTemplate,
} from "./template.js";
import { initializeTooltips } from "./tooltip.js";
import {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
  searchCommunityBuilds,
  filterCommunityBuilds,
} from "./community.js";

setupTemplateModal(); // Always call early

/** ----------------
 *  Helpers
 ----------------- */
function safeAdd(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

function safeInput(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", (e) => callback(e.target.value.trim()));
}

function safeChange(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", callback);
}

/** ----------------
 *  Initialize index.html
 ----------------- */
export async function initializeIndexPage() {
  console.log("🛠 Initializing Index Page");

  const restoreCommunity = localStorage.getItem("restoreCommunityModal");
  const filterType = localStorage.getItem("communityFilterType");
  const filterValue = localStorage.getItem("communityFilterValue");
  const searchQuery = localStorage.getItem("communitySearchQuery");

  if (restoreCommunity === "true") {
    const modal = document.getElementById("communityModal");
    if (modal) {
      modal.style.display = "block";
      await populateCommunityBuilds();

      // Step 1: Apply category/subcategory filter first (if any)
      if (filterType && filterValue) {
        filterCommunityBuilds(filterValue);
      }

      // Step 2: Apply search text filter afterward (if any)
      if (searchQuery) {
        searchCommunityBuilds(searchQuery);
        const input = document.getElementById("communitySearchBar");
        if (input) input.value = searchQuery;
      }
    }

    // Cleanup
    localStorage.removeItem("restoreCommunityModal");
    localStorage.removeItem("communityFilterType");
    localStorage.removeItem("communityFilterValue");
    localStorage.removeItem("communitySearchQuery");
  }

  // --- Auth Buttons
  safeAdd("signInBtn", "click", window.handleSignIn);
  safeAdd("signOutBtn", "click", window.handleSignOut);
  safeAdd("switchAccountBtn", "click", window.handleSwitchAccount);

  // --- Main Build Buttons
  safeAdd("saveBuildButton", "click", saveCurrentBuild);
  safeAdd("showBuildsButton", "click", window.showBuildsModal);
  safeAdd("showCommunityModalButton", "click", async () => {
    const modal = document.getElementById("communityModal");
    if (modal) {
      modal.style.display = "block";
      await populateCommunityBuilds();
    }
  });
  safeAdd("closeCommunityModal", "click", () => {
    const modal = document.getElementById("communityModal");
    if (modal) modal.style.display = "none";
  });

  // --- Templates
  safeAdd("openTemplatesButton", "click", showTemplatesModal);
  safeAdd("saveTemplateButton", "click", showSaveTemplateModal);

  // --- Text Inputs
  safeInput("buildOrderInput", (val) => analyzeBuildOrder(val));
  safeInput("buildSearchBar", (val) => searchBuilds(val));
  safeInput("communitySearchBar", (val) => searchCommunityBuilds(val));
  safeInput("templateSearchBar", (val) => searchTemplates(val));
  safeInput("videoInput", (val) => updateYouTubeEmbed(val));
  safeAdd("buildOrderTitleText", "click", () => toggleTitleInput(true));

  // --- Dropdown Color Change
  safeChange("buildCategoryDropdown", updateDropdownColor);

  // --- Help Modal
  safeAdd("buildOrderHelpBtn", "click", showBuildOrderHelpModal);
  safeAdd("closeBuildOrderHelpModal", "click", () => {
    const modal = document.getElementById("buildOrderHelpModal");
    if (modal) modal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    const helpModal = document.getElementById("buildOrderHelpModal");
    if (helpModal && event.target === helpModal) {
      helpModal.style.display = "none";
    }
  });

  // --- Template Preview Hover (NEW! ✅)
  safeAdd("templateList", "mouseover", (event) => {
    const templateCard = event.target.closest(".template-card");
    if (templateCard) {
      const templateData = JSON.parse(
        templateCard.getAttribute("data-template")
      );
      previewTemplate(templateData);
    }
  });

  safeAdd("closePublishModalButton", "click", () => {
    const publishModal = document.getElementById("publishModal");
    if (publishModal) publishModal.style.display = "none";
  });

  safeAdd("confirmPublishButton", "click", async () => {
    const selectedDestination = document.querySelector(
      'input[name="publishDestination"]:checked'
    )?.value;

    if (!window.currentBuildIdToPublish) {
      console.error("❌ No build selected for publishing.");
      return;
    }

    if (selectedDestination === "community") {
      await window.publishBuildToCommunity(window.currentBuildIdToPublish);
    } else {
      window.showToast("Clan publishing is coming soon!", "info");
    }

    const publishModal = document.getElementById("publishModal");
    if (publishModal) publishModal.style.display = "none";
  });

  safeAdd("savePublishSettingsButton", "click", async () => {
    const publishToCommunity =
      document.getElementById("publishToCommunity")?.checked;

    if (!window.currentBuildIdToPublish) {
      console.error("❌ No build selected to update.");
      return;
    }

    if (publishToCommunity) {
      await window.publishBuildToCommunity(window.currentBuildIdToPublish);
    } else {
      await window.unpublishBuild(window.currentBuildIdToPublish);
    }

    const modal = document.getElementById("managePublishModal");
    if (modal) modal.style.display = "none";
  });

  // --- Other Initializations
  initializeSectionToggles();
  initializeTextareaClickHandler();
  initializeAutoCorrect();
  initializeTooltips();
  checkPublishButtonVisibility();
  populateBuildDetails();

  attachCategoryClicks();
  attachSubcategoryClicks();
  attachCommunityCategoryClicks();

  // --- Map Setup (only if map container exists)
  if (document.getElementById("map-preview-container")) {
    initializeMapControls(mapAnnotations);
    initializeMapSelection(mapAnnotations);
    setupMapModalListeners();
  }

  // --- Load Community Builds
  document.addEventListener("DOMContentLoaded", async () => {
    await populateCommunityBuilds();
    await populateBuildsModal();
  });

  // --- Enable build buttons after auth ready
  auth.onAuthStateChanged((user) => {
    if (user) {
      const buildsBtn = document.getElementById("showBuildsButton");
      const communityBtn = document.getElementById("showCommunityModalButton");
      if (buildsBtn) buildsBtn.disabled = false;
      if (communityBtn) communityBtn.disabled = false;
    }
  });
}

/** ----------------
 * Initialize viewBuild.html
 ----------------- */
export function initializeViewBuildPage() {
  console.log("🛠 Initializing ViewBuild Page");

  safeAdd("signInBtn", "click", window.handleSignIn);
  safeAdd("signOutBtn", "click", window.handleSignOut);
  safeAdd("switchAccountBtn", "click", window.handleSwitchAccount);

  safeAdd("importBuildButton", "click", importBuildHandler);
  initializeSectionToggles();
}

/** ----------------
 * Support Functions
 ----------------- */
function attachCategoryClicks() {
  document.querySelectorAll(".filter-category").forEach((el) => {
    el.addEventListener("click", () => {
      const category = el.getAttribute("data-category");
      if (category) {
        const buildSearch = document.getElementById("buildSearchBar");
        if (buildSearch) buildSearch.value = "";
        filterBuilds(category);
      }
    });
  });
}

function attachSubcategoryClicks() {
  document.querySelectorAll(".subcategory").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const subcategory = el.getAttribute("data-subcategory");
      if (subcategory) {
        const buildSearch = document.getElementById("buildSearchBar");
        if (buildSearch) buildSearch.value = "";
        filterBuilds(subcategory);
      }
    });
  });
}

function attachCommunityCategoryClicks() {
  document
    .querySelectorAll("#communityModal .filter-category")
    .forEach((el) => {
      el.addEventListener("click", () => {
        const category = el.getAttribute("data-category");
        if (category) {
          filterCommunityBuilds(category);
          localStorage.setItem("communityFilter", category);

          // 🔄 Set active state
          document
            .querySelectorAll("#communityModal .filter-category")
            .forEach((btn) => btn.classList.remove("active"));
          el.classList.add("active");

          // 🔄 Clear any active subcategories (since a category was selected directly)
          document
            .querySelectorAll("#communityModal .subcategory")
            .forEach((btn) => btn.classList.remove("active"));
        }
      });
    });

  document.querySelectorAll("#communityModal .subcategory").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const subcat = el.getAttribute("data-subcategory");
      if (subcat) {
        filterCommunityBuilds(subcat);
        localStorage.setItem("communityFilter", subcat);

        // 🔄 Set active subcategory
        document
          .querySelectorAll("#communityModal .subcategory")
          .forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        // 🔄 Ensure parent category is also marked active
        const parentCategory = el.closest(".filter-category");
        if (parentCategory) {
          document
            .querySelectorAll("#communityModal .filter-category")
            .forEach((btn) => btn.classList.remove("active"));
          parentCategory.classList.add("active");
        }
      }
    });
  });
}

// Open/close dropdown when clicking the button
safeAdd("templateMenuButton", "click", (event) => {
  event.stopPropagation(); // 🛡 prevent window click from closing immediately
  const dropdown = document.getElementById("templateDropdown");
  if (dropdown) {
    dropdown.classList.toggle("active");
  }
});

// Close dropdown when clicking outside
window.addEventListener("click", (event) => {
  const dropdown = document.getElementById("templateDropdown");
  const button = document.getElementById("templateMenuButton");

  if (dropdown && button) {
    if (!dropdown.contains(event.target) && !button.contains(event.target)) {
      dropdown.classList.remove("active"); // 🔥 Close dropdown
    }
  }
});

function setupMapModalListeners() {
  const mapPreview = document.getElementById("map-preview-container");
  const mapModal = document.getElementById("mapSelectionModal");

  if (!mapPreview || !mapModal) return;

  let isMapSelected = false;

  mapPreview.addEventListener("click", () => {
    if (!isMapSelected) {
      mapModal.style.display = "block";
    }
  });

  document
    .querySelector(".builds-container")
    ?.addEventListener("click", (e) => {
      const mapCard = e.target.closest(".map-card");
      if (mapCard) {
        const mapImageSrc = DOMPurify.sanitize(
          mapCard.getAttribute("data-map")
        );
        const mapName = DOMPurify.sanitize(
          mapCard.querySelector(".map-card-title").innerText
        );

        const mapPreviewImage = document.getElementById("map-preview-image");
        const selectedMapText = document.getElementById("selected-map-text");

        if (mapPreviewImage) mapPreviewImage.src = mapImageSrc;
        if (selectedMapText) selectedMapText.innerText = mapName;

        isMapSelected = true;
        mapModal.style.display = "none";
      }
    });

  window.addEventListener("click", (event) => {
    if (event.target === mapModal) {
      mapModal.style.display = "none";
    }
  });
}

function updateDropdownColor() {
  const dropdown = document.getElementById("buildCategoryDropdown");
  if (dropdown) {
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    const optgroup = selectedOption.parentElement;
    if (optgroup && optgroup.style.color) {
      dropdown.style.color = optgroup.style.color;
    }
  }
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

  const { doc, getDoc, setDoc, collection } = await import(
    "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js"
  );

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
    const userBuildDocRef = doc(userBuildsRef, buildData.title);

    await setDoc(userBuildDocRef, {
      ...buildData,
      publisher: buildData.username || buildData.publisher || "Unknown",
      imported: true,
      timestamp: Date.now(),
    });

    alert("Build imported successfully!");
    populateBuildsModal();
  } catch (error) {
    console.error(error);
    alert("Failed to import build.");
  }
}
