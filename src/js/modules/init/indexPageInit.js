import {
  getDoc,
  getDocs,
  doc,
  collection,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../../app.js";
import DOMPurify from "dompurify";
import {
  saveCurrentBuild,
  populateBuildsModal,
  updateCurrentBuild,
  loadClanBuilds,
  fetchUserBuilds,
  fetchPublishedUserBuilds,
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
  getCurrentBuildFilter,
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
} from "../clan.js";
import {
  MapAnnotations,
  initializeMapControls,
  initializeMapSelection,
  mapAnnotations,
} from "../interactive_map.js";
import {
  getSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "../buildStorage.js";
import { setupCatActivationOnInput } from "../helpers/companion.js";
import {
  getCurrentBuildId,
  setCurrentBuildId,
  clearEditingPublishedBuild,
} from "../states/buildState.js";

import {
  safeAdd,
  safeInput,
  safeChange,
  capitalize,
} from "../helpers/sharedEventUtils.js";
import { isBracketInputEnabled, setBracketInputEnabled } from "../settings.js";
import { checkForJoinRequestNotifications } from "../utils/notificationHelpers.js";

function updateSupplyColumnVisibility() {
  const table = document.getElementById("buildOrderTable");
  if (!table) return;
  if (isBracketInputEnabled()) {
    table.classList.remove("hide-supply");
  } else {
    table.classList.add("hide-supply");
  }
}

setupTemplateModal(); // Always call early

let currentClanView = null;
let allBuilds = [];
let currentBuildFilter = "all";

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
    const buildId = getCurrentBuildId();

    if (buildId) {
      try {
        console.log("🔄 Updating build:", buildId);
        await updateCurrentBuild(buildId);

        const updatedDoc = await getDoc(
          doc(db, `users/${auth.currentUser.uid}/builds/${buildId}`)
        );
        if (updatedDoc.exists()) {
          const builds = getSavedBuilds();
          const idx = builds.findIndex((b) => b.encodedTitle === buildId);
          if (idx !== -1) {
            builds[idx] = { ...builds[idx], ...updatedDoc.data() };
            saveSavedBuildsToLocalStorage();
            populateBuildDetails(idx);
          }
        }

        clearEditingPublishedBuild(); // ✅ this line is required
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

        saveBuildButton.disabled = true;
        saveBuildButton.style.backgroundColor = "";
      } catch (err) {
        console.error("Update failed:", err);
        showToast("❌ Failed to update build", "error");
      }
    } else {
      try {
        const savedId = await saveCurrentBuild();
        if (!savedId) return;

        setCurrentBuildId(savedId);
        saveBuildButton.innerText = "Update Build";
        saveBuildButton.removeAttribute("data-tooltip");
        void saveBuildButton.offsetWidth; // force reflow
        saveBuildButton.setAttribute("data-tooltip", "Update Current Build");

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
    setCurrentBuildId(null); // ✅ Correct
    resetBuildInputs();
    clearEditingPublishedBuild();

    const editBanner = document.getElementById("editModeBanner");
    if (editBanner) editBanner.style.display = "none";

    const saveBtn = document.getElementById("saveBuildButton");
    const updateBtn = document.getElementById("updateBuildButton");
    const newBtn = document.getElementById("newBuildButton");

    if (saveBtn) saveBtn.style.display = "inline-block";
    if (updateBtn) updateBtn.style.display = "none";
    if (newBtn) newBtn.style.display = "none";

    saveBuildButton.innerText = "Save Build";
    saveBuildButton.removeAttribute("data-tooltip");
    void saveBuildButton.offsetWidth;
    saveBuildButton.setAttribute("data-tooltip", "Save Current Build");
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

  safeAdd("filterPublicBtn", "click", () => {
    document.getElementById("filterPublicBtn").classList.add("active");
    document.getElementById("filterClanBtn").classList.remove("active");
    localStorage.setItem("communityBuildType", "public");
    filterCommunityBuilds(
      localStorage.getItem("communityFilterValue") || "all"
    );
  });

  safeAdd("filterClanBtn", "click", () => {
    document.getElementById("filterClanBtn").classList.add("active");
    document.getElementById("filterPublicBtn").classList.remove("active");
    localStorage.setItem("communityBuildType", "clan");
    filterCommunityBuilds(
      localStorage.getItem("communityFilterValue") || "all"
    );
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

    // ✅ Set default to Public filter
    localStorage.setItem("communityBuildType", "public");
    document.getElementById("filterPublicBtn")?.classList.add("active");
    document.getElementById("filterClanBtn")?.classList.remove("active");

    // ✅ Clear other filter buttons
    document
      .querySelectorAll("#communityModal .filter-category, .subcategory")
      .forEach((btn) => btn.classList.remove("active"));

    // ✅ Set "All" category active
    const allBtn = document.querySelector(
      '#communityModal .filter-category[data-category="all"]'
    );
    if (allBtn) allBtn.classList.add("active");

    // ✅ Clear search input
    const input = document.getElementById("communitySearchBar");
    if (input) input.value = "";

    // ✅ Load builds and setup filters
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

  safeAdd("myBuildsTab", "click", async () => {
    const spinnerWrapper = document.getElementById("buildsLoadingWrapper");
    const buildList = document.getElementById("buildList");

    buildList.innerHTML = "";
    spinnerWrapper.style.display = "flex";

    try {
      document.getElementById("myBuildsTab").classList.add("active");
      document.getElementById("publishedBuildsTab").classList.remove("active");
      await filterBuilds(getCurrentBuildFilter());
    } catch (err) {
      console.error("Error loading My Builds:", err);
    } finally {
      spinnerWrapper.style.display = "none";
    }
  });

  safeAdd("publishedBuildsTab", "click", async () => {
    const spinnerWrapper = document.getElementById("buildsLoadingWrapper");
    const buildList = document.getElementById("buildList");

    buildList.innerHTML = "";
    spinnerWrapper.style.display = "flex";

    try {
      document.getElementById("publishedBuildsTab").classList.add("active");
      document.getElementById("myBuildsTab").classList.remove("active");
      await filterBuilds(getCurrentBuildFilter());
    } catch (err) {
      console.error("Error loading Published Builds:", err);
    } finally {
      spinnerWrapper.style.display = "none";
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

  safeAdd("closeSettingsModal", "click", () => {
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "none";
  });

  const settingsModal = document.getElementById("settingsModal");
  window.addEventListener("click", (event) => {
    if (settingsModal && event.target === settingsModal) {
      settingsModal.style.display = "none";
    }
  });

  const bracketToggle = document.getElementById("bracketInputToggle");
  if (bracketToggle) {
    bracketToggle.checked = isBracketInputEnabled();
    bracketToggle.addEventListener("change", () => {
      setBracketInputEnabled(bracketToggle.checked);
      updateSupplyColumnVisibility();
    });
  }

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
    const user = auth.currentUser;
    if (!user) return;

    const buildId = window.currentBuildIdToPublish;
    if (!buildId) {
      console.error("❌ No build selected to update.");
      return;
    }

    const publishToCommunity =
      document.getElementById("publishToCommunity")?.checked;

    // ✅ Get checked clans
    const checkedClans = Array.from(
      document.querySelectorAll(".clanPublishCheckbox:checked")
    ).map((cb) => cb.value);

    // ✅ Fetch user's personal build
    const userBuildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    const buildSnap = await getDoc(userBuildRef);
    if (!buildSnap.exists()) return;

    const buildData = buildSnap.data();

    // ✅ Fetch display name
    const usernameQuery = query(
      collection(db, "usernames"),
      where("userId", "==", user.uid)
    );
    const usernameSnap = await getDocs(usernameQuery);
    const username = !usernameSnap.empty ? usernameSnap.docs[0].id : "Unknown";

    // ✅ Create/Update the published version
    const publishedBuildRef = doc(db, "publishedBuilds", buildId);
    const publishedData = {
      ...buildData,
      publisherId: user.uid,
      username,
      isPublic: publishToCommunity,
      sharedToClans: checkedClans,
      datePublished: Timestamp.now(), // ✅ Firestore-native timestamp
      views: 0,
      upvotes: 0,
      downvotes: 0,
    };

    await setDoc(publishedBuildRef, publishedData);

    // ✅ Delete if fully unpublished (optional)
    if (!publishToCommunity && checkedClans.length === 0) {
      await deleteDoc(publishedBuildRef);
    }

    showToast("✅ Publish settings updated!", "success");

    // ✅ Close modal
    const modal = document.getElementById("publishModal");
    if (modal) modal.style.display = "none";

    // ✅ Trigger the "Published Builds" tab to refresh view
    document.getElementById("publishedBuildsTab")?.click();
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
  updateSupplyColumnVisibility();
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

  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    const modal = document.getElementById("settingsModal");
    if (modal) {
      modal.style.display = "block";
      const toggle = document.getElementById("bracketInputToggle");
      if (toggle) toggle.checked = isBracketInputEnabled();
    }
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
      "#buildsModal .filter-category, #communityModal .filter-category"
    );
    const subcategoryButtons = document.querySelectorAll(
      "#buildsModal .subcategory, #communityModal .subcategory"
    );

    categoryButtons.forEach((el) => {
      el.addEventListener("click", async () => {
        const category = el.getAttribute("data-category");
        if (!category) return;

        // 🔄 UI
        categoryButtons.forEach((btn) => btn.classList.remove("active"));
        subcategoryButtons.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        // 🔄 Clear search
        document.getElementById("buildSearchBar").value = "";
        document.getElementById("communitySearchBar").value = "";

        // 🔎 Apply filter
        const isPublishedTabActive = document
          .getElementById("publishedBuildsTab")
          ?.classList.contains("active");

        if (isPublishedTabActive) {
          const publishedBuilds = await fetchPublishedUserBuilds(category);
          populateBuildList(publishedBuilds);
        } else {
          filterBuilds(category); // My Builds
        }
        await filterCommunityBuilds(category); // Community

        // 📝 Headings
        const buildsHeading = document.querySelector(
          "#buildsModal .template-header h3"
        );
        const communityHeading = document.querySelector("#communityModal h3");

        if (buildsHeading) {
          buildsHeading.textContent =
            category.toLowerCase() === "all"
              ? "Build Orders"
              : `Build Orders - ${capitalize(category)}`;
        }

        if (communityHeading) {
          communityHeading.textContent =
            category.toLowerCase() === "all"
              ? "Community Builds"
              : `Community Builds - ${capitalize(category)}`;
        }
      });
    });
  }

  function attachSubcategoryClicks() {
    const allCategories = document.querySelectorAll(
      "#buildsModal .filter-category, #communityModal .filter-category"
    );
    const allSubcategories = document.querySelectorAll(
      "#buildsModal .subcategory, #communityModal .subcategory"
    );

    allSubcategories.forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const subcat = el.getAttribute("data-subcategory");
        if (!subcat) return;

        allCategories.forEach((btn) => btn.classList.remove("active"));
        allSubcategories.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        const parent = el.closest(".filter-category");
        if (parent) parent.classList.add("active");

        document.getElementById("buildSearchBar").value = "";
        document.getElementById("communitySearchBar").value = "";

        // ✅ Always use the new unified filterBuilds logic
        await filterBuilds(subcat);

        // ✅ Also filter community builds if needed
        await filterCommunityBuilds(subcat);

        // ✅ Update headings
        const buildsHeading = document.querySelector(
          "#buildsModal .template-header h3"
        );
        const communityHeading = document.querySelector("#communityModal h3");

        if (buildsHeading)
          buildsHeading.textContent = `Build Orders - ${capitalize(subcat)}`;
        if (communityHeading)
          communityHeading.textContent = `Community Builds - ${capitalize(
            subcat
          )}`;
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

  function updateBuildsTabUI(activeTabId, headingText) {
    const myTab = document.getElementById("myBuildsTab");
    const pubTab = document.getElementById("publishedBuildsTab");

    if (myTab && pubTab) {
      myTab.classList.remove("active");
      pubTab.classList.remove("active");

      const activeTab = document.getElementById(activeTabId);
      if (activeTab) activeTab.classList.add("active");
    }

    const heading = document.querySelector("#buildsModal .template-header h3");
    if (heading) heading.textContent = headingText;
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
