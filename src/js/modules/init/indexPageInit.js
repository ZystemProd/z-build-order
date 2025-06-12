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
  setBuildViewMode,
  applyBuildViewMode,
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
import {
  isBracketInputEnabled,
  setBracketInputEnabled,
  isBuildInputShown,
  setBuildInputShown,
  loadUserSettings,
} from "../settings.js";
import { checkForJoinRequestNotifications } from "../utils/notificationHelpers.js";
import { logAnalyticsEvent } from "../analyticsHelper.js";

function updateSupplyColumnVisibility() {
  const table = document.getElementById("buildOrderTable");
  if (!table) return;
  if (isBracketInputEnabled()) {
    table.classList.remove("hide-supply");
  } else {
    table.classList.add("hide-supply");
  }
}

function updateBuildInputVisibility() {
  const section = document.getElementById("buildOrderInputField");
  if (!section) return;
  section.style.display = isBuildInputShown() ? "block" : "none";
}

function updateBuildInputPlaceholder() {
  const textarea = document.getElementById("buildOrderInput");
  if (!textarea) return;
  textarea.placeholder = isBracketInputEnabled()
    ? "[12] Spawning Pool"
    : "Spawning Pool";
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
      if (filterType && filterValue) {
        await filterCommunityBuilds(filterValue); // Only do filtered call
      } else {
        await populateCommunityBuilds(); // Only do full list if no filter
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

        const titleInput = document.getElementById("buildOrderTitleInput");
        const editBanner = document.getElementById("editModeBanner");
        if (editBanner && titleInput) {
          editBanner.innerHTML = `[Edit Mode] <strong>${DOMPurify.sanitize(
            titleInput.value.trim()
          )}</strong>`;
          editBanner.style.display = "block";
        }

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
      await loadUserSettings();
      const toggle = document.getElementById("bracketInputToggle");
      if (toggle) {
        toggle.checked = isBracketInputEnabled();
      }
      const inputToggle = document.getElementById("buildInputToggle");
      if (inputToggle) {
        inputToggle.checked = isBuildInputShown();
      }
      updateSupplyColumnVisibility();
      updateBuildInputVisibility();
      updateBuildInputPlaceholder();
    }
  });

  monitorBuildChanges();
  applyBuildViewMode();

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

  safeAdd("gridViewBtn", "click", () => setBuildViewMode("grid"));
  safeAdd("listViewBtn", "click", () => setBuildViewMode("list"));

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
    const storedFilter = localStorage.getItem("communityFilterValue") || "all";
    if (storedFilter && storedFilter !== "all") {
      await filterCommunityBuilds(storedFilter);
    } else {
      await populateCommunityBuilds();
    }

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
  const buildInput = document.getElementById("buildOrderInput");
  if (buildInput) {
    buildInput.addEventListener("input", () => {
      analyzeBuildOrder(buildInput.value.trim());
    });
  }
  safeInput("buildSearchBar", (val) => searchBuilds(val));
  safeInput("communitySearchBar", async (val) => {
    await searchCommunityBuilds(val);
  });

  safeInput("templateSearchBar", (val) => searchTemplates(val));
  safeInput("videoInput", (val) => updateYouTubeEmbed(val));

  let selectedReplayFile = null;

  safeAdd("parseReplayButton", "click", () => {
    const input = document.getElementById("replayFileInput");
    if (input) input.click();
  });

  async function populateReplayOptions(file) {
    const loader = document.getElementById("optionsLoadingWrapper");
    if (loader) loader.style.display = "flex";
    const select = document.getElementById("playerSelect");
    if (!select) return;
    select.innerHTML = "<option>Loading...</option>";

    const formData = new FormData();
    formData.append("replay", file);

    try {
      const res = await fetch("https://z-build-order.onrender.com/players", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const players = Array.isArray(data) ? data : data.players;
      select.innerHTML = "";
      players.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.pid;
        opt.textContent = `${p.name} (${p.race})`;
        select.appendChild(opt);
      });
      const matchup = data.matchup;
      if (matchup) {
        const dropdown = document.getElementById("buildCategoryDropdown");
        if (dropdown) {
          dropdown.value = matchup;
          updateDropdownColor();
        }
      }
    } catch (err) {
      console.error("Failed to fetch players", err);
      select.innerHTML = "<option value='1'>Player 1</option>";
    }
    if (loader) loader.style.display = "none";
  }

  safeAdd("replayFileInput", "change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".sc2replay")) {
      alert("Please select a .SC2Replay file");
      e.target.value = "";
      return;
    }

    selectedReplayFile = file;
    e.target.value = "";

    await populateReplayOptions(file);
    const modal = document.getElementById("replayOptionsModal");
    if (modal) modal.style.display = "block";
  });

  safeAdd("confirmReplayOptionsButton", "click", async () => {
    if (!selectedReplayFile) return;
    const btn = document.getElementById("confirmReplayOptionsButton");
    btn.disabled = true;
    btn.innerText = "⏳ Parsing...";

    const formData = new FormData();
    formData.append("replay", selectedReplayFile);
    const player = document.getElementById("playerSelect")?.value;
    if (player) formData.append("player", player);
    if (document.getElementById("excludeWorkersCheckbox")?.checked) {
      formData.append("exclude_workers", "1");
    }
    if (document.getElementById("excludeSupplyCheckbox")?.checked) {
      formData.append("exclude_supply", "1");
    }
    if (document.getElementById("excludeTimeCheckbox")?.checked) {
      formData.append("exclude_time", "1");
    }
    if (document.getElementById("compactModeCheckbox")?.checked) {
      formData.append("compact", "1");
      formData.append("exclude_time", "1");
    }
    const stopInput = document.getElementById("stopLimitInput");
    const toggleBtn = document.getElementById("toggleStopTypeBtn");
    const stopVal = stopInput?.value;
    const stopType = toggleBtn?.dataset.type || "supply";
    if (stopVal) {
      if (stopType === "time") {
        formData.append("stop_time", stopVal);
      } else {
        formData.append("stop_supply", stopVal);
      }
    }

    try {
      const res = await fetch("https://z-build-order.onrender.com/upload", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();

      const buildInput = document.getElementById("buildOrderInput");
      if (buildInput) buildInput.value = text;
      analyzeBuildOrder(text);
      logAnalyticsEvent("replay_uploaded", {
        fileName: selectedReplayFile.name,
        sizeKB: Math.round(selectedReplayFile.size / 1024),
      });
    } catch (err) {
      console.error("Replay upload failed", err);
      alert(
        "Could not parse the replay. Make sure the Python backend is running."
      );
      logAnalyticsEvent("replay_upload_failed", { error: err.message });
    }

    btn.disabled = false;
    btn.innerText = "Parse Replay";
    const modal = document.getElementById("replayOptionsModal");
    if (modal) modal.style.display = "none";
  });

  safeAdd("closeReplayOptionsModal", "click", () => {
    const modal = document.getElementById("replayOptionsModal");
    if (modal) modal.style.display = "none";
  });

  const compactBox = document.getElementById("compactModeCheckbox");
  if (compactBox) {
    compactBox.addEventListener("change", () => {
      if (compactBox.checked) {
        const timeBox = document.getElementById("excludeTimeCheckbox");
        if (timeBox) timeBox.checked = true;
      }
    });
  }

  const toggleStopTypeBtn = document.getElementById("toggleStopTypeBtn");
  const stopLimitInput = document.getElementById("stopLimitInput");
  const stopLimitLabel = document.getElementById("stopLimitLabel");
  const stopUnitLabel = document.getElementById("stopUnitLabel");
  if (toggleStopTypeBtn && stopLimitInput && stopLimitLabel && stopUnitLabel) {
    toggleStopTypeBtn.addEventListener("click", () => {
      const newType =
        toggleStopTypeBtn.dataset.type === "time" ? "supply" : "time";
      toggleStopTypeBtn.dataset.type = newType;
      stopLimitInput.value = "";
      if (newType === "time") {
        stopLimitLabel.textContent = "Stop at time:";
        toggleStopTypeBtn.textContent = "Use Supply";
        stopLimitInput.placeholder = "e.g. 5";
        stopLimitInput.step = "1";
        stopUnitLabel.style.display = "inline";
      } else {
        stopLimitLabel.textContent = "Stop at supply:";
        toggleStopTypeBtn.textContent = "Use Time";
        stopLimitInput.placeholder = "e.g. 50";
        stopUnitLabel.style.display = "none";
      }
    });
  }

  const timeBox = document.getElementById("excludeTimeCheckbox");
  if (timeBox) {
    timeBox.addEventListener("change", () => {
      if (!timeBox.checked) {
        const cBox = document.getElementById("compactModeCheckbox");
        if (cBox) cBox.checked = false;
      }
    });
  }

  window.addEventListener("mousedown", (event) => {
    const modal = document.getElementById("replayOptionsModal");
    if (modal && event.target === modal) {
      modal.style.display = "none";
    }
  });

  safeAdd("buildOrderTitleText", "click", () => toggleTitleInput(true));
  safeAdd("buildOrderTitleText", "focus", () => toggleTitleInput(true));
  safeAdd("buildOrderTitleInput", "blur", () => toggleTitleInput(false));

  // --- Dropdown Color Change
  safeChange("buildCategoryDropdown", updateDropdownColor);

  // --- Help Modal
  safeAdd("buildOrderHelpBtn", "click", showBuildOrderHelpModal);
  safeAdd("closeBuildOrderHelpModal", "click", () => {
    const modal = document.getElementById("buildOrderHelpModal");
    if (modal) modal.style.display = "none";
  });

  window.addEventListener("mousedown", (event) => {
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

  safeAdd("cookiePolicyLink", "click", () => {
    const modal = document.getElementById("privacyModal");
    if (modal) modal.style.display = "block";
  });

  safeAdd("closeSettingsModal", "click", () => {
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "none";
  });

  const settingsModal = document.getElementById("settingsModal");
  window.addEventListener("mousedown", (event) => {
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
      updateBuildInputPlaceholder();
    });
  }

  const inputToggle = document.getElementById("buildInputToggle");
  if (inputToggle) {
    inputToggle.checked = isBuildInputShown();
    inputToggle.addEventListener("change", () => {
      setBuildInputShown(inputToggle.checked);
      updateBuildInputVisibility();
    });
  }

  safeAdd("closePrivacyModal", "click", () => {
    const modal = document.getElementById("privacyModal");
    if (modal) modal.style.display = "none";
  });

  window.addEventListener("mousedown", (event) => {
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
    if (publishToCommunity || checkedClans.length > 0) {
      logAnalyticsEvent("build_published", {
        race: buildData.category,
        matchup: buildData.subcategory,
      });
    }

    // ✅ Delete if fully unpublished (optional)
    if (!publishToCommunity && checkedClans.length === 0) {
      await deleteDoc(publishedBuildRef);
      await updateDoc(userBuildRef, {
        isPublished: false,
        isPublic: false,
        sharedToClans: [],
      });
    } else {
      await updateDoc(userBuildRef, {
        isPublished: true,
        isPublic: publishToCommunity,
        sharedToClans: checkedClans,
      });
    }

    showToast("✅ Publish settings updated!", "success");

    // ✅ Close modal
    const modal = document.getElementById("publishModal");
    if (modal) modal.style.display = "none";

    // ✅ Trigger the "Published Builds" tab to refresh view
    document.getElementById("publishedBuildsTab")?.click();
  });

  window.addEventListener("mousedown", (event) => {
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
  updateBuildInputVisibility();
  updateBuildInputPlaceholder();
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
      document.getElementById("userNameMenu").innerText = username;
    } else {
      // Handle case when user data doesn't exist
      console.log("No user data found!");
    }
  }

  document.getElementById("mapVetoBtn")?.addEventListener("click", () => {
    window.location.href = "/veto.html";
  });

  // Close the avatar submenu after selecting any menu item
  const userMenuEl = document.getElementById("userMenu");
  if (userMenuEl) {
    userMenuEl.addEventListener("click", (e) => {
      if (e.target.closest(".menu-item")) {
        userMenuEl.style.display = "none";
      }
    });
  }

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

  window.addEventListener("mousedown", (event) => {
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
      if (optgroup) {
        const color = window.getComputedStyle(optgroup).color;
        dropdown.style.color = color || "";
      }
    }
  }

  function attachMyBuildsCategoryClicks() {
    const buildsCategories = document.querySelectorAll(
      "#buildsModal .filter-category"
    );
    const communityCategories = document.querySelectorAll(
      "#communityModal .filter-category"
    );
    const buildsSubcategories = document.querySelectorAll(
      "#buildsModal .subcategory"
    );
    const communitySubcategories = document.querySelectorAll(
      "#communityModal .subcategory"
    );

    buildsCategories.forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.target.closest(".subcategory")) return;
        const category = el.getAttribute("data-category");
        if (!category) return;

        if (window.innerWidth <= 768) {
          const wasOpen = el.classList.contains("show-submenu");
          document
            .querySelectorAll("#buildsModal .filter-category.show-submenu")
            .forEach((c) => {
              if (c !== el) c.classList.remove("show-submenu");
            });
          const submenu = el.querySelector(".submenu");
          if (submenu) {
            if (wasOpen) {
              el.classList.remove("show-submenu");
            } else {
              el.classList.add("show-submenu");
            }
          }
        }

        buildsCategories.forEach((btn) => btn.classList.remove("active"));
        buildsSubcategories.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        document.getElementById("buildSearchBar").value = "";

        const isPublishedTabActive = document
          .getElementById("publishedBuildsTab")
          ?.classList.contains("active");

        if (isPublishedTabActive) {
          const publishedBuilds = await fetchPublishedUserBuilds(category);
          populateBuildList(publishedBuilds);
        } else {
          filterBuilds(category);
        }

        const heading = document.querySelector(
          "#buildsModal .template-header h3"
        );
        if (heading) {
          heading.textContent =
            category.toLowerCase() === "all"
              ? "Build Orders"
              : `Build Orders - ${capitalize(category)}`;
        }
      });
    });

    communityCategories.forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.target.closest(".subcategory")) return;
        const category = el.getAttribute("data-category");
        if (!category) return;

        if (window.innerWidth <= 768) {
          const wasOpen = el.classList.contains("show-submenu");
          document
            .querySelectorAll("#communityModal .filter-category.show-submenu")
            .forEach((c) => {
              if (c !== el) c.classList.remove("show-submenu");
            });
          const submenu = el.querySelector(".submenu");
          if (submenu) {
            if (wasOpen) {
              el.classList.remove("show-submenu");
            } else {
              el.classList.add("show-submenu");
            }
          }
        }

        communityCategories.forEach((btn) => btn.classList.remove("active"));
        communitySubcategories.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        document.getElementById("communitySearchBar").value = "";

        await filterCommunityBuilds(category);

        const heading = document.querySelector("#communityModal h3");
        if (heading) {
          heading.textContent =
            category.toLowerCase() === "all"
              ? "Community Builds"
              : `Community Builds - ${capitalize(category)}`;
        }
      });
    });
  }

  function attachSubcategoryClicks() {
    const buildSubcats = document.querySelectorAll("#buildsModal .subcategory");
    const communitySubcats = document.querySelectorAll(
      "#communityModal .subcategory"
    );

    buildSubcats.forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const subcat = el.getAttribute("data-subcategory");
        if (!subcat) return;

        document
          .querySelectorAll("#buildsModal .filter-category")
          .forEach((btn) => btn.classList.remove("active"));
        buildSubcats.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");

        const parent = el.closest(".filter-category");
        if (parent) parent.classList.add("active");

        document.getElementById("buildSearchBar").value = "";

        await filterBuilds(subcat);

        const heading = document.querySelector(
          "#buildsModal .template-header h3"
        );
        if (heading)
          heading.textContent = `Build Orders - ${capitalize(subcat)}`;

        if (window.innerWidth <= 768) {
          const parent = el.closest(".filter-category");
          if (parent) parent.classList.remove("show-submenu");
        }
      });
    });

    communitySubcats.forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const subcat = el.getAttribute("data-subcategory");
        if (!subcat) return;

        document
          .querySelectorAll("#communityModal .filter-category")
          .forEach((btn) => btn.classList.remove("active"));
        communitySubcats.forEach((btn) => btn.classList.remove("active"));
        el.classList.add("active");
        const parent = el.closest(".filter-category");
        if (parent) parent.classList.add("active");

        document.getElementById("communitySearchBar").value = "";

        await filterCommunityBuilds(subcat);

        const heading = document.querySelector("#communityModal h3");
        if (heading)
          heading.textContent = `Community Builds - ${capitalize(subcat)}`;

        if (window.innerWidth <= 768) {
          const parent = el.closest(".filter-category");
          if (parent) parent.classList.remove("show-submenu");
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

  function attachCommunityCategoryClicks() {
    const categoryButtons = document.querySelectorAll(
      "#communityModal .filter-category"
    );
    const subcategoryButtons = document.querySelectorAll(
      "#communityModal .subcategory"
    );

    categoryButtons.forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.target.closest(".subcategory")) return;
        const category = el.getAttribute("data-category");
        if (!category) return;

        if (window.innerWidth <= 768) {
          const wasOpen = el.classList.contains("show-submenu");
          document
            .querySelectorAll("#communityModal .filter-category.show-submenu")
            .forEach((c) => {
              if (c !== el) c.classList.remove("show-submenu");
            });
          const submenu = el.querySelector(".submenu");
          if (submenu) {
            if (wasOpen) {
              el.classList.remove("show-submenu");
            } else {
              el.classList.add("show-submenu");
            }
          }
        }

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

        if (window.innerWidth <= 768) {
          const parent = el.closest(".filter-category");
          if (parent) parent.classList.remove("show-submenu");
        }
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

    const mapPreviewImage = document.getElementById("map-preview-image");

    mapPreview.addEventListener("click", () => {
      const hasMap = mapPreviewImage && mapPreviewImage.getAttribute("src");
      if (!hasMap) {
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

          mapModal.style.display = "none";
        }
      });

    window.addEventListener("mousedown", (event) => {
      if (event.target === mapModal) {
        mapModal.style.display = "none";
      }
    });
  }

  function monitorBuildChanges() {
    const fields = [
      "buildOrderInput",
      "commentInput",
      "videoInput",
      "replayLinkInput",
      "buildOrderTitleInput",
    ];

    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.monitorAttached) {
        el.addEventListener("input", () => {
          saveBuildButton.disabled = false;
          saveBuildButton.style.backgroundColor = "#963325";

          if (id === "buildOrderTitleInput") {
            const titleText = document.getElementById("buildOrderTitleText");
            const title = el.value.trim().toLowerCase();
            const savedBuilds = getSavedBuilds();
            const currentId = getCurrentBuildId();
            const duplicate = savedBuilds.some(
              (b) =>
                b.title.toLowerCase() === title && b.encodedTitle !== currentId
            );
            if (duplicate) {
              saveBuildButton.disabled = true;
              if (titleText) titleText.classList.add("highlight");
            } else if (titleText) {
              titleText.classList.remove("highlight");
            }
          }
        });
        el.dataset.monitorAttached = "true";
      }
    });

    const categoryDropdown = document.getElementById("buildCategoryDropdown");
    if (categoryDropdown && !categoryDropdown.dataset.monitorAttached) {
      categoryDropdown.addEventListener("change", () => {
        saveBuildButton.disabled = false;
        saveBuildButton.style.backgroundColor = "#963325";
      });
      categoryDropdown.dataset.monitorAttached = "true";
    }
  }
}
