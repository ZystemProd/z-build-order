import { getDoc, getDocs, doc, collection } from "firebase/firestore";
import { auth, db } from "../../../app.js";
import DOMPurify from "dompurify";
import {
  saveCurrentBuild,
  populateBuildsModal,
  updateCurrentBuild,
  loadClanBuilds,
} from "../buildManagement.js";
import { initializeAutoCorrect } from "../autoCorrect.js";
import { populateBuildDetails, analyzeBuildOrder } from "../uiHandlers.js";
import { showToast } from "../toastHandler.js";
import { updateYouTubeEmbed } from "../youtube.js";
import {
  closeModal,
  showSubcategories,
  filterBuilds,
  searchBuilds,
  populateBuildList,
} from "../modal.js";
import {
  initializeSectionToggles,
  initializeTextareaClickHandler,
  showBuildOrderHelpModal,
  createNotificationDot,
} from "../uiHandlers.js";
import {
  showTemplatesModal,
  setupTemplateModal,
  showSaveTemplateModal,
  searchTemplates,
  previewTemplate,
} from "../template.js";
import { initializeTooltips } from "../tooltip.js";
import {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
  searchCommunityBuilds,
  filterCommunityBuilds,
} from "../community.js";
import { resetBuildInputs } from "../utils.js";
import {
  renderCreateClanUI,
  renderChooseManageClanUI,
  renderFindClanUI,
  saveBuildToClan,
} from "../clan.js";
import {
  MapAnnotations,
  initializeMapControls,
  initializeMapSelection,
  mapAnnotations,
} from "../interactive_map.js";
import { getSavedBuilds } from "../buildStorage.js";
import { setupCatActivationOnInput } from "../helpers/companion.js";
// import {
//   attachCategoryClicks,
//   attachSubcategoryClicks,
//   attachCommunityCategoryClicks,
//   updateDropdownColor,
//   monitorBuildChanges,
// } from "./clickHandlers.js";

import {
  safeAdd,
  safeInput,
  safeChange,
  capitalize,
} from "../helpers/sharedEventUtils.js";
import { checkForJoinRequestNotifications } from "../utils/notificationHelpers.js";

setupTemplateModal(); // Always call early
let currentBuildId = null;
let currentClanView = null;
let allBuilds = [];

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
  const saveBuildButton = document.getElementById("saveBuildButton");
  const newBuildButton = document.getElementById("newBuildButton");

  // Save or update build depending on context
  safeAdd("saveBuildButton", "click", async () => {
    if (currentBuildId) {
      try {
        console.log("🔄 Updating build:", currentBuildId);
        await updateCurrentBuild(currentBuildId);
        showToast("✅ Build updated!", "success");

        const replayUrl = document
          .getElementById("replayLinkInput")
          ?.value.trim();
        const replayWrapper = document.getElementById("replayInputWrapper");
        const replayView = document.getElementById("replayViewWrapper");
        const replayBtn = document.getElementById("replayDownloadBtn");

        if (replayUrl && replayWrapper && replayView && replayBtn) {
          replayWrapper.style.display = "none";
          replayView.style.display = "block";
          replayBtn.href = replayUrl;
          replayBtn.innerText = "Download Replay on Drop.sc";
        }

        // ✅ Reset button after update
        saveBuildButton.disabled = true;
        saveBuildButton.style.backgroundColor = "";
      } catch (err) {
        console.error("Update failed:", err);
        showToast("❌ Failed to update build", "error");
      }
    } else {
      try {
        const savedId = await saveCurrentBuild(); // should return encodedTitle or null

        if (!savedId) return; // 🛑 Stop if validation failed inside saveCurrentBuild

        currentBuildId = savedId;
        saveBuildButton.innerText = "Update Build";
        newBuildButton.style.display = "inline-block";
        showToast("✅ Build saved!", "success");

        const replayUrl = document
          .getElementById("replayLinkInput")
          ?.value.trim();
        const replayWrapper = document.getElementById("replayInputWrapper");
        const replayView = document.getElementById("replayViewWrapper");
        const replayBtn = document.getElementById("replayDownloadBtn");

        if (replayUrl && replayWrapper && replayView && replayBtn) {
          replayWrapper.style.display = "none";
          replayView.style.display = "block";
          replayBtn.href = replayUrl;
          replayBtn.innerText = "Download Replay on Drop.sc";
        }

        // ✅ Reset button after save
        saveBuildButton.disabled = true;
        saveBuildButton.style.backgroundColor = "";
      } catch (err) {
        console.error("Save failed:", err);
        showToast("❌ Failed to save build", "error");
      }
    }
  });

  // Start a new build
  safeAdd("newBuildButton", "click", () => {
    currentBuildId = null;
    resetBuildInputs();
    saveBuildButton.innerText = "Save Build";
    newBuildButton.style.display = "none";
  });

  auth.onAuthStateChanged(async (user) => {
    const buildsBtn = document.getElementById("showBuildsButton");
    const communityBtn = document.getElementById("showCommunityModalButton");

    // ✅ Always enable buttons
    if (buildsBtn) buildsBtn.disabled = false;
    if (communityBtn) communityBtn.disabled = false;

    // ✅ If logged in, do user setup
    if (user) {
      await checkForJoinRequestNotifications();
      initializeUserData(user);
    }
  });

  // monitorBuildChanges();

  safeAdd("showBuildsButton", "click", () => {
    if (!auth.currentUser) {
      const authBox = document.getElementById("auth-container");
      authBox.classList.add("highlight");
      authBox.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => authBox.classList.remove("highlight"), 1500);
      return;
    }
    showBuildsModal(); // ✅ when logged in
  });

  safeAdd("showCommunityModalButton", "click", async () => {
    if (!auth.currentUser) {
      const authBox = document.getElementById("auth-container");
      authBox.classList.add("highlight");
      authBox.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => authBox.classList.remove("highlight"), 1500);
      return;
    }

    const modal = document.getElementById("communityModal");
    if (!modal) return;
    modal.style.display = "block";
    document.getElementById("communityBuildsContainer").scrollTop = 0;

    document
      .querySelectorAll("#communityModal .filter-category, .subcategory")
      .forEach((btn) => btn.classList.remove("active"));

    const allBtn = document.querySelector(
      '#communityModal .filter-category[data-category="all"]'
    );
    if (allBtn) allBtn.classList.add("active");

    const input = document.getElementById("communitySearchBar");
    if (input) input.value = "";

    await populateCommunityBuilds();
    attachCommunityCategoryClicks();

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
  safeInput("communitySearchBar", async (val) => {
    await searchCommunityBuilds(val);
  });

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

  safeAdd("legalNoticeLink", "click", () => {
    const modal = document.getElementById("privacyModal");
    if (modal) modal.style.display = "block";
  });

  safeAdd("closePrivacyModal", "click", () => {
    const modal = document.getElementById("privacyModal");
    if (modal) modal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    const modal = document.getElementById("privacyModal");
    if (modal && event.target === modal) {
      modal.style.display = "none";
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const openModals = document.querySelectorAll(".modal");
      openModals.forEach((modal) => {
        if (modal.style.display === "block" || modal.style.display === "flex") {
          modal.style.display = "none";
        }
      });
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

    // ✅ Handle community publishing
    if (publishToCommunity) {
      await window.publishBuildToCommunity(window.currentBuildIdToPublish);
    } else {
      await window.unpublishBuild(window.currentBuildIdToPublish);
    }

    // ✅ Handle clan publishing via checked checkboxes
    const checkedClans = Array.from(
      document.querySelectorAll(".clanPublishCheckbox:checked")
    ).map((cb) => cb.value);

    const user = auth.currentUser;
    if (!user) return;

    const usernameSnap = await getDoc(doc(db, "usernames", user.displayName));
    const username = usernameSnap.exists() ? usernameSnap.id : "Unknown";

    const buildId = window.currentBuildIdToPublish;
    const userBuildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    const buildSnap = await getDoc(userBuildRef);
    if (!buildSnap.exists()) return;

    const buildData = buildSnap.data();

    for (const clanId of checkedClans) {
      await saveBuildToClan(clanId, buildId, {
        ...buildData,
        ownerUid: user.uid,
        username,
        timestamp: Date.now(),
      });
    }

    if (checkedClans.length > 0) {
      showToast("✅ Shared with selected clans!", "success");
    }

    // ✅ Close the publish modal
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
  setupCatActivationOnInput();
  checkPublishButtonVisibility();
  const savedBuilds = getSavedBuilds();
  const buildId = sessionStorage.getItem("lastViewedBuild");
  const index = savedBuilds.findIndex((b) => b.id === buildId);
  if (index !== -1) populateBuildDetails(index);

  // attachCategoryClicks();
  attachMyBuildsCategoryClicks();
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

  // This will load the necessary user data after successful authentication
  async function initializeUserData(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      const username = userSnapshot.data().username || "Guest";
      document.getElementById("userName").innerText = username;
      document.getElementById("userPhoto").src =
        user.photoURL || "img/default-avatar.webp";
    } else {
      // Handle case when user data doesn't exist
      console.log("No user data found!");
    }
  }

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
      // Default to 'Find' tab when opening
      activateClanMainTab("find");

      // Attach handlers for clan tabs
      ["create", "manage", "find"].forEach((view) => {
        const btn = document.getElementById(`${view}ClanBtn`);
        if (btn) {
          btn.addEventListener("click", () => {
            if (currentClanView === view) return;

            currentClanView = view;

            // Hide all subviews
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

  function attachMyBuildsCategoryClicks() {
    const heading = document.querySelector("#buildsModal .template-header h3");
    const categoryButtons = document.querySelectorAll(
      "#buildsModal .filter-category"
    );
    const subcategoryButtons = document.querySelectorAll(
      "#buildsModal .subcategory"
    );

    categoryButtons.forEach((el) => {
      el.addEventListener("click", async () => {
        const category = el.getAttribute("data-category");
        if (!category) return;

        // 🔄 UI state
        categoryButtons.forEach((btn) => btn.classList.remove("active"));
        subcategoryButtons.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        // 🔄 Clear search bar
        const search = document.getElementById("buildSearchBar");
        if (search) search.value = "";

        // 🧠 Special case: Clan Builds
        if (category === "clan") {
          const builds = await loadClanBuilds(); // <- your new function
          populateBuildList(builds); // <- reuse your card renderer
          if (heading) heading.textContent = "Clan Builds";
          return;
        }

        // 🔎 Normal filtering
        filterBuilds(category);

        // 📝 Heading
        if (heading) {
          heading.textContent =
            category.toLowerCase() === "all"
              ? "Build Orders"
              : `Build Orders - ${capitalize(category)}`;
        }
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

  function attachCommunityCategoryClicks() {
    const categoryButtons = document.querySelectorAll(
      "#communityModal .filter-category"
    );
    const subcategoryButtons = document.querySelectorAll(
      "#communityModal .subcategory"
    );

    categoryButtons.forEach((el) => {
      el.addEventListener("click", async () => {
        const category = el.getAttribute("data-category");
        if (!category) return;

        // 🔄 UI active states
        categoryButtons.forEach((btn) => btn.classList.remove("active"));
        subcategoryButtons.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        // 🔄 Clear search input
        document.getElementById("communitySearchBar").value = "";

        // 🔎 Firestore-based filter
        await filterCommunityBuilds(category);

        // 📝 Update heading
        const heading = document.querySelector("#communityModal h3");
        heading.textContent =
          category.toLowerCase() === "all"
            ? "Community Builds"
            : `Community Builds - ${capitalize(category)}`;
      });
    });

    subcategoryButtons.forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const subcat = el.getAttribute("data-subcategory");
        if (!subcat) return;

        // 🔄 UI active states
        subcategoryButtons.forEach((btn) => btn.classList.remove("active"));
        categoryButtons.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");
        const parent = el.closest(".filter-category");
        if (parent) parent.classList.add("active");

        // 🔄 Clear search input
        document.getElementById("communitySearchBar").value = "";

        // 🔎 Firestore-based filter
        await filterCommunityBuilds(subcat);

        // 📝 Update heading
        const heading = document.querySelector("#communityModal h3");
        heading.textContent = `Community Builds - ${capitalize(subcat)}`;
      });
    });
  }

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
}
