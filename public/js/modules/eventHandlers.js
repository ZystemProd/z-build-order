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
  createNotificationDot,
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
import {
  renderCreateClanUI,
  renderChooseManageClanUI,
  renderFindClanUI,
  listPublicClans,
} from "./clan.js";
setupTemplateModal(); // Always call early
let currentClanView = null;
/** ----------------
 *  Helpers
 ----------------- */
function safeAdd(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) return;

  // prevent duplicate listeners by removing first
  el.removeEventListener(event, handler);
  el.addEventListener(event, handler);
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

      // 🧹 Clear all active classes
      document
        .querySelectorAll("#communityModal .filter-category, .subcategory")
        .forEach((btn) => btn.classList.remove("active"));

      // ✅ Apply correct active filter
      if (filterValue && filterValue !== "all") {
        const matchBtn = document.querySelector(
          `#communityModal .filter-category[data-category="${filterValue}"],
           #communityModal .subcategory[data-subcategory="${filterValue}"]`
        );
        if (matchBtn) matchBtn.classList.add("active");
      } else {
        const allBtn = document.querySelector(
          '#communityModal .filter-category[data-category="all"]'
        );
        if (allBtn) allBtn.classList.add("active");
      }

      // ✅ Apply filter + search after build list loads
      await populateCommunityBuilds();

      if (filterType && filterValue) {
        filterCommunityBuilds(filterValue);
      }

      if (searchQuery) {
        searchCommunityBuilds(searchQuery);
        const input = document.getElementById("communitySearchBar");
        if (input) input.value = searchQuery;
      }

      // ✅ Update heading
      const heading = document.querySelector("#communityModal h3");
      if (heading) {
        let title = "Community Builds";
        if (filterValue && filterValue !== "all") {
          title += ` - ${capitalize(filterValue)}`;
        }
        if (searchQuery) {
          title += ` - ${searchQuery}`;
        }
        heading.textContent = title;
      }

      // ✅ Set sort button active (hot, top, new)
      const allSortButtons = document.querySelectorAll(".sort-button");
      const currentSort = localStorage.getItem("communitySortMode") || "hot";
      allSortButtons.forEach((btn) => {
        btn.classList.remove("active");
        if (btn.id === "sort" + capitalize(currentSort)) {
          btn.classList.add("active");
        }
      });
    }

    // 🧼 Cleanup
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
    if (!modal) return;

    modal.style.display = "block";

    // 🧹 Clear all active filters
    document
      .querySelectorAll("#communityModal .filter-category, .subcategory")
      .forEach((btn) => btn.classList.remove("active"));

    // ✅ Set only 'All' active
    const allBtn = document.querySelector(
      '#communityModal .filter-category[data-category="all"]'
    );
    if (allBtn) allBtn.classList.add("active");

    // ✅ Clear search input
    const input = document.getElementById("communitySearchBar");
    if (input) input.value = "";

    // ✅ Load builds and attach filter click handlers
    await populateCommunityBuilds();
    attachCommunityCategoryClicks();

    // ✅ Reset heading
    const heading = document.querySelector("#communityModal h3");
    if (heading) heading.textContent = "Community Builds";
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

    const modal = document.getElementById("publishModal");
    if (modal) modal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    const modal = document.getElementById("publishModal");
    const content = modal?.querySelector(".modal-content.small-modal");

    if (
      modal &&
      content &&
      modal.style.display === "block" &&
      !content.contains(event.target)
    ) {
      modal.style.display = "none";
    }
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

  const replayUrl = document.getElementById("replayLinkInput")?.value.trim();
  const replayWrapper = document.getElementById("replayInputWrapper");
  const replayView = document.getElementById("replayViewWrapper");
  const replayBtn = document.getElementById("replayDownloadBtn");

  if (replayUrl && replayWrapper && replayView && replayBtn) {
    replayWrapper.style.display = "none";
    replayView.style.display = "block";
    replayBtn.href = replayUrl;
  }

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
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const buildsBtn = document.getElementById("showBuildsButton");
      const communityBtn = document.getElementById("showCommunityModalButton");
      if (buildsBtn) buildsBtn.disabled = false;
      if (communityBtn) communityBtn.disabled = false;

      // ✅ Trigger notification check after login
      await checkForJoinRequestNotifications();
    }
  });

  document.getElementById("mapVetoBtn")?.addEventListener("click", () => {
    window.location.href = "/veto.html";
  });

  const clanModal = document.getElementById("clanModal");

  document
    .getElementById("showClanModalButton")
    ?.addEventListener("click", () => {
      // 👉 Close the user menu when any item is clicked (like this one)
      const userMenu = document.getElementById("userMenu");
      if (userMenu) userMenu.style.display = "none";

      // Show the Clan modal
      const clanModal = document.getElementById("clanModal");
      clanModal.style.display = "block";

      // Default to 'Find' tab when opening
      activateClanMainTab("find");

      // Attach handlers once
      ["create", "manage", "find"].forEach((view) => {
        const btn = document.getElementById(`${view}ClanBtn`);
        if (btn) {
          btn.addEventListener("click", () => {
            if (currentClanView === view) return;

            currentClanView = view;

            // Hide all views
            document.querySelectorAll(".clan-subview").forEach((v) => {
              v.style.display = "none";
            });

            // Update top-level active button
            document
              .querySelectorAll(".clan-main-tab-button")
              .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            // Show selected view
            const activeView = document.getElementById(`${view}ClanView`);
            if (activeView) activeView.style.display = "block";

            // Render view
            if (view === "create") renderCreateClanUI();
            if (view === "manage") renderChooseManageClanUI();
            if (view === "find") renderFindClanUI();
          });
        }
      });
    });

  document.getElementById("closeClanModal")?.addEventListener("click", () => {
    document.getElementById("clanModal").style.display = "none";
    currentClanView = null;
  });

  window.addEventListener("click", (event) => {
    const modal = document.getElementById("clanModal");
    if (!modal || modal.style.display !== "block") return;

    // Only close if the click was directly on the overlay background
    if (event.target === modal) {
      modal.style.display = "none";
      currentClanView = null;
    }
  });

  function activateClanMainTab(view) {
    // Hide all subviews
    document.querySelectorAll(".clan-subview").forEach((v) => {
      v.style.display = "none";
    });

    // Show selected view
    const activeView = document.getElementById(`${view}ClanView`);
    if (activeView) activeView.style.display = "block";

    // Trigger matching render
    if (view === "create") renderCreateClanUI();
    if (view === "manage") renderChooseManageClanUI();
    if (view === "find") renderFindClanUI();

    // Update visual state (optional)
    document
      .querySelectorAll(".clan-main-tab-button")
      .forEach((btn) => btn.classList.remove("active"));
    document.getElementById(`${view}ClanBtn`)?.classList.add("active");
  }
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

export async function checkForJoinRequestNotifications() {
  const clans = await listPublicClans();
  const user = auth.currentUser;
  if (!user) return;

  const hasPending = clans.some((c) => {
    const isCaptain =
      c.adminUid === user.uid ||
      c.memberInfo?.[user.uid]?.role === "Co-Captain";
    return isCaptain && c.joinRequests?.length > 0;
  });

  const btn = document.getElementById("showClanModalButton");
  if (!btn) return;

  // Remove existing dot if present
  const existingDot = btn.querySelector(".notification-dot");
  if (existingDot) {
    existingDot.classList.add("removing");
    setTimeout(() => existingDot.remove(), 300);
  }

  if (hasPending) {
    const dot = createNotificationDot();
    dot.classList.add("notification-dot");
    btn.style.position = "relative";
    btn.appendChild(dot);
  }
}

function attachCategoryClicks() {
  const heading = document.querySelector("#buildsModal .template-header h3");
  const allCategories = document.querySelectorAll(
    "#buildsModal .filter-category"
  );
  const allSubcategories = document.querySelectorAll(
    "#buildsModal .subcategory"
  );

  allCategories.forEach((el) => {
    el.addEventListener("click", () => {
      const category = el.getAttribute("data-category");
      if (!category) return;

      // Clear actives
      allCategories.forEach((btn) => btn.classList.remove("active"));
      allSubcategories.forEach((btn) => btn.classList.remove("active"));

      // Mark this as active
      el.classList.add("active");

      // Clear search bar
      const buildSearch = document.getElementById("buildSearchBar");
      if (buildSearch) buildSearch.value = "";

      // Update heading
      if (heading) {
        heading.textContent =
          category.toLowerCase() === "all"
            ? "Build Orders"
            : `Build Orders - ${capitalize(category)}`;
      }

      // Filter builds
      filterBuilds(category);
    });
  });
}

function attachSubcategoryClicks() {
  const heading = document.querySelector("#buildsModal .template-header h3");
  const allCategories = document.querySelectorAll(
    "#buildsModal .filter-category"
  );
  const allSubcategories = document.querySelectorAll(
    "#buildsModal .subcategory"
  );

  allSubcategories.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const subcat = el.getAttribute("data-subcategory");
      if (!subcat) return;

      // Clear actives
      allCategories.forEach((btn) => btn.classList.remove("active"));
      allSubcategories.forEach((btn) => btn.classList.remove("active"));

      // Set current subcategory and parent as active
      el.classList.add("active");
      const parent = el.closest(".filter-category");
      if (parent) parent.classList.add("active");

      // Clear search bar
      const buildSearch = document.getElementById("buildSearchBar");
      if (buildSearch) buildSearch.value = "";

      // Update heading
      if (heading) {
        heading.textContent = `Build Orders - ${capitalize(subcat)}`;
      }

      // Filter builds
      filterBuilds(subcat);
    });
  });
}

function attachCommunityCategoryClicks() {
  const categoryButtons = document.querySelectorAll(
    "#communityModal .filter-category"
  );
  const subcategoryButtons = document.querySelectorAll(
    "#communityModal .subcategory"
  );

  categoryButtons.forEach((el) => {
    el.addEventListener("click", () => {
      const category = el.getAttribute("data-category");
      if (!category) return;

      categoryButtons.forEach((btn) => btn.classList.remove("active"));
      subcategoryButtons.forEach((btn) => btn.classList.remove("active"));

      el.classList.add("active");

      filterCommunityBuilds(category);
      localStorage.setItem("communityFilter", category);

      const heading = document.querySelector("#communityModal h3");
      heading.textContent =
        category.toLowerCase() === "all"
          ? "Community Builds"
          : `Community Builds - ${capitalize(category)}`;
    });
  });

  subcategoryButtons.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const subcat = el.getAttribute("data-subcategory");
      if (!subcat) return;

      subcategoryButtons.forEach((btn) => btn.classList.remove("active"));
      categoryButtons.forEach((btn) => btn.classList.remove("active"));

      el.classList.add("active");

      const parent = el.closest(".filter-category");
      if (parent) parent.classList.add("active");

      filterCommunityBuilds(subcat);
      localStorage.setItem("communityFilter", subcat);

      const heading = document.querySelector("#communityModal h3");
      heading.textContent = `Community Builds - ${capitalize(subcat)}`;
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
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
