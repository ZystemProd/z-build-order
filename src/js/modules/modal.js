import {
  getDoc,
  doc,
  getFirestore,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app, auth, db } from "../../app.js";
import { showToast } from "./toastHandler.js";
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import { mapAnnotations } from "./interactive_map.js";
import {
  formatActionText,
  formatWorkersOrTimestampText,
} from "./textFormatters.js";
import { capitalize } from "./helpers/sharedEventUtils.js";
import { analyzeBuildOrder } from "./uiHandlers.js";
import { publishBuildToCommunity } from "./community.js";
import {
  setCurrentBuildId,
  clearEditingPublishedBuild,
} from "./states/buildState.js";
import { loadBuilds } from "./buildService.js";
import { fetchUserBuilds, updateBuildFavorite, fetchVariationsForGroup } from "./buildManagement.js";
import { setSavedBuilds } from "./buildStorage.js";
import DOMPurify from "dompurify";
import { updateTooltips } from "./tooltip.js";
import { getMainClanId } from "./settings.js";
import { getClanInfo } from "./clan.js";

// --- Firestore Pagination State
let lastVisibleBuild = null;
let isLoadingMoreBuilds = false;
let currentBuildFilter = "all";

// --- View Mode State
const storedViewMode = localStorage.getItem("buildViewMode") || "list";
let buildViewMode = storedViewMode;

export function getBuildViewMode() {
  return buildViewMode;
}

export function applyBuildViewMode() {
  const container = document.getElementById("buildList");
  const gridBtn = document.getElementById("gridViewBtn");
  const listBtn = document.getElementById("listViewBtn");

  if (container) {
    if (buildViewMode === "list") {
      container.classList.add("list-view");
    } else {
      container.classList.remove("list-view");
    }
  }

  if (gridBtn && listBtn) {
    if (buildViewMode === "list") {
      listBtn.classList.add("active");
      gridBtn.classList.remove("active");
    } else {
      gridBtn.classList.add("active");
      listBtn.classList.remove("active");
    }
  }
}

export async function setBuildViewMode(mode) {
  buildViewMode = mode === "list" ? "list" : "grid";
  localStorage.setItem("buildViewMode", buildViewMode);
  applyBuildViewMode();

  const spinnerWrapper = document.getElementById("buildsLoadingWrapper");
  if (spinnerWrapper) spinnerWrapper.style.display = "flex";
  try {
    await filterBuilds(getCurrentBuildFilter());
  } finally {
    if (spinnerWrapper) spinnerWrapper.style.display = "none";
  }
}

export function formatMatchup(matchup) {
  if (!matchup) return "Unknown Match-Up";
  return (
    matchup.charAt(0).toUpperCase() +
    matchup.slice(1, -1).toLowerCase() +
    matchup.charAt(matchup.length - 1).toUpperCase()
  );
}

export function formatShortDate(dateValue) {
  if (dateValue?.toMillis) dateValue = dateValue.toMillis();
  const d = new Date(dateValue);
  if (isNaN(d)) return "";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}-${year}`;
}

export async function filterBuilds(categoryOrSubcategory = "all") {
  const heading = document.querySelector("#buildsModal .template-header h3");
  const user = getAuth().currentUser;
  if (!user) return;

  currentBuildFilter = categoryOrSubcategory.toLowerCase();
  lastVisibleBuild = null;
  isLoadingMoreBuilds = false;

  const buildListEl = document.getElementById("buildList");
  if (buildListEl) buildListEl.innerHTML = "";

  console.log("🧪 Filtering builds...");
  console.log("➡️ Filter:", currentBuildFilter);

  const { builds, lastDoc } = await loadBuilds({
    type: "my",
    filter: currentBuildFilter,
    batchSize: 20,
  });

  lastVisibleBuild = lastDoc;

  const label =
    currentBuildFilter === "all"
      ? `Build Orders`
      : `Build Orders - ${
          [
            "zvp",
            "zvt",
            "zvz",
            "pvp",
            "pvt",
            "pvz",
            "tvp",
            "tvt",
            "tvz",
          ].includes(currentBuildFilter)
            ? formatMatchup(currentBuildFilter)
            : capitalize(currentBuildFilter)
        }`;

  if (heading) heading.textContent = label;
  console.log("🧪 Builds fetched for filter:", currentBuildFilter, builds);

  populateBuildList(builds);
  attachBuildScrollListener();
}

export async function loadMoreBuilds() {
  if (isLoadingMoreBuilds) return;
  isLoadingMoreBuilds = true;

  const container = document.getElementById("buildList");
  const user = getAuth().currentUser;
  if (!user || !lastVisibleBuild) return;

  const newBuilds = await loadBuilds({
    type: "my",
    filter: currentBuildFilter,
    batchSize: 20,
    after: lastVisibleBuild,
  });

  if (newBuilds.length > 0) {
    lastVisibleBuild = newBuilds[newBuilds.length - 1];
    populateBuildList(newBuilds, true);
  }

  isLoadingMoreBuilds = false;
}

export function getCurrentBuildFilter() {
  return currentBuildFilter;
}

function attachBuildScrollListener() {
  const container = document.getElementById("buildList");
  if (!container) return;

  container.removeEventListener("scroll", handleScroll); // Prevent duplicates
  container.addEventListener("scroll", handleScroll);
}

async function handleScroll() {
  if (isLoadingMoreBuilds || !lastVisibleBuild) return;

  const container = document.getElementById("buildList");
  if (
    container.scrollTop + container.clientHeight >=
    container.scrollHeight - 200
  ) {
    isLoadingMoreBuilds = true;

    const more = await loadBuilds({
      type: "my",
      filter: currentBuildFilter,
      batchSize: 20,
      startAfter: lastVisibleBuild,
    });

    if (more.builds.length) {
      populateBuildList(more.builds, { append: true });
      lastVisibleBuild = more.lastDoc;
    }

    isLoadingMoreBuilds = false;
  }
}

export async function deleteBuildFromFirestore(buildId) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    showToast("You must be signed in to delete a build.", "error");
    return;
  }

  try {
    // ✅ Always remove your user copy
    const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    await deleteDoc(buildRef);
    console.log(`✅ User build deleted: ${buildId}`);

    // ✅ Try to remove from published builds only if you own it
    const publishedRef = doc(db, "publishedBuilds", buildId);
    const publishedSnap = await getDoc(publishedRef);

    if (publishedSnap.exists()) {
      const pubData = publishedSnap.data();
      if (pubData.publisherId === user.uid) {
        try {
          await deleteDoc(publishedRef);
          console.log(`✅ Also deleted from publishedBuilds: ${buildId}`);
        } catch (err) {
          console.warn(
            `⚠️ Failed to delete from publishedBuilds (but user copy is gone):`,
            err
          );
        }
      } else {
        console.log(
          `ℹ️ Not the publisher (${pubData.publisherId}), skipping published delete`
        );
      }
    }

    showToast("Build deleted successfully!", "success");
    populateBuildList();
  } catch (error) {
    console.error("Error deleting user build:", error);
    showToast("Failed to delete the build. Please try again.", "error");
  }
}

export async function viewBuild(buildId) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    const authContainer = document.getElementById("auth-container");
    if (authContainer) {
      authContainer.classList.add("highlight");
      setTimeout(() => {
        authContainer.classList.remove("highlight");
      }, 5000);
    }
    return;
  }

  try {
    const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    const docSnap = await getDoc(buildRef);

    if (!docSnap.exists()) {
      console.error("No such build found.");
      return;
    }

    const build = docSnap.data();
    const mapImage = document.getElementById("map-preview-image");
    const selectedMapText = document.getElementById("selected-map-text");
    const titleInput = document.getElementById("buildOrderTitleInput");
    const titleText = document.getElementById("buildOrderTitleText");
    const matchUpDropdown = document.getElementById("buildCategoryDropdown");
    const modeDropdown = document.getElementById("mapModeDropdown");
    if (modeDropdown && build.mapMode) {
      modeDropdown.value = build.mapMode;
    }

    const capitalizeWords = (str) =>
      str
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    if (!build.title || !build.subcategory) {
      showToast(
        "This build cannot be viewed due to missing mandatory fields.",
        "error"
      );
      return;
    }

    // Match-up dropdown logic
    const subcategoryValue = build.subcategory.toLowerCase();
    if (matchUpDropdown) {
      let matchFound = false;
      for (const option of matchUpDropdown.options) {
        if (option.value.toLowerCase() === subcategoryValue) {
          matchUpDropdown.value = option.value;
          matchFound = true;
          break;
        }
      }
      matchUpDropdown.style.color = subcategoryValue.startsWith("zv")
        ? "#c07aeb"
        : subcategoryValue.startsWith("pv")
        ? "#5fe5ff"
        : subcategoryValue.startsWith("tv")
        ? "#ff3a30"
        : "";
    }

    // ✅ Map Preview Logic (async fetch of maps.json)
    const mapName = (build.map || "").trim();
    const isValidMap =
      mapName &&
      mapName.toLowerCase() !== "index" &&
      mapName.toLowerCase() !== "no map selected";

    if (isValidMap) {
      const formattedMapName = capitalizeWords(mapName);
      let mapUrl = "";

      try {
        const response = await fetch("/data/maps.json", { cache: "no-store" });
        const maps = await response.json();
        const mapEntry = maps.find(
          (m) => m.name.toLowerCase() === mapName.toLowerCase()
        );
        const folder = mapEntry?.folder || "";
        const fileName =
          mapEntry?.file || mapName.replace(/ /g, "_").toLowerCase() + ".webp";
        // ✅ Add support for mapMode
        const mode = build.mapMode || "1v1"; // fallback for old builds

        mapUrl = folder
          ? `/img/maps/${folder}/${fileName}`
          : `/img/maps/${build.mapMode || "1v1"}/${fileName}`;
      } catch (err) {
        console.warn("Could not load maps.json, falling back.");
        mapUrl = `/img/maps/${mapName.replace(/ /g, "_").toLowerCase()}.webp`;
      }

      if (mapImage) mapImage.src = mapUrl;
      if (selectedMapText) selectedMapText.innerText = formattedMapName;

      // Fallback: derive image path when maps.json name does not match stored map
      if (mapImage && mapName) {
        const baseName = mapName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "");
        const folder = build.mapFolder;
        if (baseName && folder) {
          try {
            const currentUrl = new URL(
              mapImage.src || "",
              window.location.origin
            );
            if (!currentUrl.pathname.includes(`/maps/${folder}/`)) {
              mapImage.src = `/img/maps/${folder}/${baseName}.webp`;
            }
          } catch (_) {
            mapImage.src = `/img/maps/${folder}/${baseName}.webp`;
          }
        }
      }

      const clearBtn = document.querySelector(".clear-annotations-button");
      if (clearBtn) clearBtn.style.display = "inline-block";

      const secondRow = document.getElementById("secondRow");
      const secondRowHeader = document.querySelector(
        '[data-section="secondRow"]'
      );
      if (secondRow) {
        secondRow.classList.remove("hidden");
        secondRow.classList.add("visible");
      }
      if (secondRowHeader) {
        const arrowIcon = secondRowHeader.querySelector(".arrow");
        if (arrowIcon) arrowIcon.classList.add("open");
      }
    } else {
      if (mapImage) mapImage.removeAttribute("src");
      if (selectedMapText) selectedMapText.innerText = "No map selected";
    }

    // Annotations
    const loadAnnotations = () => {
      if (build.interactiveMap) {
        mapAnnotations.circles = [];
        mapAnnotations.annotationsContainer.innerHTML = "";
        build.interactiveMap.circles?.forEach(({ x, y }) =>
          mapAnnotations.createCircle(x, y)
        );
        build.interactiveMap.arrows?.forEach(({ startX, startY, endX, endY }) =>
          mapAnnotations.createArrow(startX, startY, endX, endY)
        );
        mapAnnotations.updateCircleNumbers();
      }
    };

    if (mapImage && mapImage.complete && mapImage.naturalWidth > 0) {
      loadAnnotations();
    } else if (mapImage) {
      mapImage.addEventListener("load", loadAnnotations, { once: true });
    }

    // Title
    if (titleText) {
      titleText.textContent =
        DOMPurify.sanitize(build.title) || "Enter build order title here...";
      titleText.classList.remove("dimmed");
    }
    if (titleInput) titleInput.value = build.title || "";

    // Match-Up display
    const matchUpElement = document.getElementById("matchUpDisplay");
    if (matchUpElement) {
      matchUpElement.textContent = `Match-Up: ${
        build.subcategory ? capitalizeWords(build.subcategory) : "Unknown"
      }`;
    }

    // Description
    const descriptionInput = document.getElementById("descriptionInput");
    if (descriptionInput)
      descriptionInput.value = DOMPurify.sanitize(build.description) || "";

    // YouTube
    const videoInput = document.getElementById("videoInput");
    if (videoInput) {
      videoInput.value = build.youtube || build.videoLink || "";
      updateYouTubeEmbed(videoInput.value);
    }

    // Build Order
    const validBuildOrder = Array.isArray(build.buildOrder)
      ? build.buildOrder.filter(
          (step) => step && (step.workersOrTimestamp || step.action)
        )
      : [];

    const buildOrderText = validBuildOrder.length
      ? validBuildOrder
          .map((step) =>
            `[${step.workersOrTimestamp || ""}] ${step.action || ""}`.trim()
          )
          .join("\n")
      : "No build order available.";

    const buildOrderInput = document.getElementById("buildOrderInput");
    if (buildOrderInput) buildOrderInput.value = buildOrderText;

    // Replay
    const replayUrl = build.replayUrl?.trim();
    const replayWrapper = document.getElementById("replayInputWrapper");
    const replayView = document.getElementById("replayViewWrapper");
    const replayBtn = document.getElementById("replayDownloadBtn");
    const replayInput = document.getElementById("replayLinkInput");

    // Always allow renewing the replay link
    if (replayWrapper) replayWrapper.style.display = "flex";
    if (replayUrl && replayView && replayBtn) {
      replayView.style.display = "block";
      replayBtn.href = replayUrl;
      replayBtn.innerText = "Download Replay";
      if (replayInput) replayInput.value = replayUrl;
    } else if (replayView) {
      replayView.style.display = "none";
      if (replayInput) replayInput.value = "";
    }

    analyzeBuildOrder(buildOrderInput?.value || "");
    setCurrentBuildId(buildId);

    const editBanner = document.getElementById("editModeBanner");
    if (editBanner) {
      editBanner.innerHTML =
        '<img src="./img/SVG/pencil.svg" class="svg-icon" alt="Edit"> <strong>Edit Mode</strong>';
      editBanner.style.display = "flex";
      editBanner.style.backgroundColor = "#165016";
      editBanner.style.color = "#fff";
      updateTooltips();
    }

    const saveBtn = document.getElementById("saveBuildButton");
    const newBtn = document.getElementById("newBuildButton");
    if (saveBtn) saveBtn.innerText = "Update Build";
    if (newBtn) newBtn.style.display = "inline-block";

    closeModal();
  } catch (error) {
    console.error("❌ Error loading build:", error);
  }
}

window.viewBuild = viewBuild;

// Close the modal
export function closeModal() {
  const modal = document.getElementById("buildsModal");
  if (!modal) return;

  modal.style.display = "none";
  document.body.classList.remove("modal-open");

  // 🔄 Reset filters
  const allCategories = document.querySelectorAll(
    "#buildsModal .filter-category"
  );
  const allSubcategories = document.querySelectorAll(
    "#buildsModal .subcategory"
  );

  allCategories.forEach((btn) => btn.classList.remove("active"));
  allSubcategories.forEach((btn) => btn.classList.remove("active"));

  const allBtn = document.querySelector(
    '#buildsModal .filter-category[data-category="all"]'
  );
  if (allBtn) allBtn.classList.add("active");

  // 🔄 Reset heading
  const heading = document.querySelector("#buildsModal .template-header h3");
  if (heading) heading.textContent = "Build Orders";

  // 🔄 Reset list
  filterBuilds("all");

  // 🔄 Optional: clear search input
  const search = document.getElementById("buildSearchBar");
  if (search) search.value = "";
}

// Function to open the modal
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "block";
    document.body.classList.add("modal-open");
  } else {
    console.error(`Modal with ID "${modalId}" not found.`);
  }
}

// Make functions globally accessible
window.openModal = openModal;
//window.showAllBuilds = showAllBuilds;

let currentBuildIdToPublish = null;
window.currentBuildIdToPublish = null;

export async function openPublishModal(buildId) {
  currentBuildIdToPublish = buildId;
  window.currentBuildIdToPublish = buildId;
  const user = auth.currentUser;
  if (!user) return;

  // 🧠 Check if this build has already been published
  const publishedRef = doc(db, `publishedBuilds/${buildId}`);
  const publishedSnap = await getDoc(publishedRef);
  const publishedData = publishedSnap.exists() ? publishedSnap.data() : null;

  // 🧠 Default to user's build if unpublished
  const sourceData = publishedData
    ? publishedData
    : (await getDoc(doc(db, `users/${user.uid}/builds/${buildId}`)))?.data();

  if (!sourceData) {
    console.warn("❌ Could not find the build to open in publish modal.");
    return;
  }

  // ✅ Update publishToCommunity checkbox
  const communityCheckbox = document.getElementById("publishToCommunity");
  if (communityCheckbox) {
    communityCheckbox.checked = !!sourceData.isPublic;
  }

  // ✅ Update clan checkboxes
  const clanContainer = document.getElementById("clanPublishList");
  clanContainer.innerHTML = "";

  const clansSnap = await getDocs(collection(db, "clans"));
  clansSnap.forEach((clanDoc) => {
    const clan = clanDoc.data();
    const cid = clanDoc.id;

    if (clan.members?.includes(user.uid)) {
      const row = document.createElement("div");
      row.classList.add("clan-checkbox-label", "publish-checkbox-row");

      const isShared = sourceData?.sharedToClans?.includes(cid);

      row.innerHTML = `
        <span class="label-clan">${DOMPurify.sanitize(clan.name)}</span>
        <div class="checkbox-wrapper-59">
          <label class="switch">
            <input type="checkbox" class="clanPublishCheckbox" value="${cid}" ${
        isShared ? "checked" : ""
      } />
            <span class="slider"></span>
          </label>
        </div>
      `;

      clanContainer.appendChild(row);
    }
  });

  // ✅ Show modal
  const modal = document.getElementById("publishModal");
  modal.style.display = "block";
}

export function showSubcategories(event) {
  const subcategoriesMenu = event.target.querySelector(".subcategories-menu");
  if (subcategoriesMenu) {
    subcategoriesMenu.style.display = "block";
  }
}

window.showSubcategories = showSubcategories;

export function hideSubcategories(event) {
  const subcategoriesMenu = event.target.querySelector(".subcategories-menu");
  if (subcategoriesMenu) {
    subcategoriesMenu.style.display = "none";
  }
}

window.hideSubcategories = hideSubcategories;

export async function showBuildsModal() {
  const buildModal = document.getElementById("buildsModal");
  const showBuildsButton = document.getElementById("showBuildsButton");
  const buildList = document.getElementById("buildList");
  const heading = buildModal.querySelector("h3");

  if (!buildModal) {
    console.error("Build modal not found!");
    return;
  }

  showBuildsButton.disabled = true;

  // Find or create loader
  let loader = buildList.querySelector(".lds-roller");
  if (!loader) {
    loader = document.createElement("div");
    loader.className = "lds-roller";
    loader.innerHTML =
      "<div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>";
    buildList.appendChild(loader);
  }
  loader.style.display = "block";

  // Clear all but loader
  Array.from(buildList.children).forEach((child) => {
    if (!child.classList.contains("lds-roller")) {
      buildList.removeChild(child);
    }
  });

  // ✅ Activate "All" category filter
  const allTab = document.querySelector(
    '#buildsModal .filter-category[data-category="all"]'
  );
  const allTabs = document.querySelectorAll("#buildsModal .filter-category");
  allTabs.forEach((tab) => tab.classList.remove("active"));
  if (allTab) allTab.classList.add("active");

  // ✅ Update heading
  if (heading) heading.textContent = "Build Orders";

  // ✅ Load My Builds
  try {
    const activeCategory =
      document.querySelector("#buildsModal .filter-category.active")?.dataset
        .category ||
      document.querySelector("#buildsModal .subcategory.active")?.dataset
        .subcategory ||
      "all";

    await filterBuilds(activeCategory);
  } catch (err) {
    console.error("Error loading My Builds:", err);
  }

  loader.style.display = "none";
  buildModal.style.display = "block";
  showBuildsButton.disabled = false;

  document.getElementById("closeBuildsModal").onclick = closeModal;

  window.onclick = (event) => {
    if (event.target === buildModal) {
      closeModal();
    }
  };
}

// Attach to the global window object
window.showBuildsModal = showBuildsModal;

let isPopulatingBuildList = false;

export async function populateBuildList(
  filteredBuilds = null,
  { append = false } = {}
) {
  const buildList = document.getElementById("buildList");
  const buildPreview = document.getElementById("buildPreview");

  if (!buildList || !buildPreview) {
    console.error("Build modal elements not found!");
    return;
  }

  if (isPopulatingBuildList) return;
  isPopulatingBuildList = true;

  if (!append) buildList.innerHTML = "";

  const builds = filteredBuilds || [];

  console.log("🔍 populateBuildList received builds:", builds); // ✅ Safe to use here

  if (!builds.length && !append) {
    buildList.innerHTML = "<p>No builds available.</p>";
    isPopulatingBuildList = false;
    return;
  }

  let lastHoveredBuild = null;
  const fragment = document.createDocumentFragment();

  for (const build of builds) {
    const isList = getBuildViewMode() === "list";
    const buildEl = document.createElement("div");
    if (isList) {
      buildEl.classList.add("build-entry");
    } else {
      buildEl.classList.add("build-card");
      buildEl.style.position = "relative";
    }
    buildEl.dataset.id = build.id;
    buildEl.dataset.source = build.source || "user";
    buildEl.dataset.clanid = build.clanId || "";

    // ✅ Make tab-focusable
    buildEl.tabIndex = 0;

    if (build.isPublished) buildEl.classList.add("published");

    const [playerRace, opponentRace] = getRaceIcons(
      build.subcategory || "Unknown"
    );

    const matchupClass = getMatchupClass(playerRace) || "matchup-unknown";

    const matchupIconsHTML =
      playerRace && opponentRace
        ? `
      <div class="matchup-icons">
        <img src="./img/race/${playerRace}.webp" alt="${playerRace}" class="race-icon">
        <span class="versus-text">vs</span>
        <img src="./img/race/${opponentRace}.webp" alt="${opponentRace}" class="race-icon">
      </div>
    `
        : `<div class="matchup-icons">Invalid Matchup</div>`;

    if (isList) {
      buildEl.innerHTML = `
        <div class="build-left ${matchupClass}">
          <img src="./img/race/${playerRace}2.webp" alt="${playerRace}" class="matchup-icon">
        </div>
        <div class="build-right">
          <div class="build-title">${DOMPurify.sanitize(build.title)}</div>
          <div class="build-meta">
            <span class="meta-chip matchup-chip">${formatMatchup(
              build.subcategory || ""
            )}</span>
            <span class="meta-chip publisher-chip">
              <img src="./img/SVG/user-svgrepo-com.svg" alt="Publisher" class="meta-icon">
              ${DOMPurify.sanitize(build.publisher || "You")}
            </span>
            <span class="meta-chip">
              <img src="./img/SVG/time.svg" alt="Date" class="meta-icon">
              ${formatShortDate(build.datePublished || build.timestamp)}
            </span>
          </div>
        </div>
        <button class="delete-build-btn" title="Delete Build">×</button>
        <div class="build-publish-info"></div>`;
      const pubImg = buildEl.querySelector(".publisher-chip img");
      const mainId = getMainClanId();
      if (pubImg && mainId) {
        getClanInfo(mainId).then((info) => {
          if (info?.logoUrl) pubImg.src = info.logoUrl;
        });
      }

      // Merge matchup icon and matchup chip to save space (list view)
      try {
        const left = buildEl.querySelector(".build-left");
        const meta = buildEl.querySelector(".build-meta");
        const chip = meta?.querySelector(".matchup-chip");
        const icon = left?.querySelector(".matchup-icon");
        if (left && icon && chip) {
          const badge = document.createElement("div");
          badge.className = "matchup-badge";
          left.appendChild(badge);
          badge.appendChild(icon);
          chip.classList.add("matchup-overlay");
          badge.appendChild(chip);
        }
      } catch (e) {
        console.warn("Failed to merge matchup chip with icon", e);
      }
    } else {
      buildEl.innerHTML = `
        <div class="build-card-header">
          ${matchupIconsHTML}
          <button class="delete-build-btn" title="Delete Build">×</button>
        </div>
        <h3 class="build-title">${DOMPurify.sanitize(build.title)}</h3>
        <div class="build-meta">
          <p>Publisher: ${DOMPurify.sanitize(build.publisher || "You")}</p>
          <p>Date: ${formatShortDate(
            build.datePublished || build.timestamp
          )}</p>
        </div>
        <div class="build-publish-info"></div>
      `;
    }

    const favBtn = document.createElement("button");
    favBtn.classList.add("favorite-btn");
    favBtn.dataset.tooltip = build.favorite
      ? "Remove from favorites"
      : "Add to favorites";

    const favImg = document.createElement("img");
    favImg.src = build.favorite
      ? "./img/SVG/star_filled.svg"
      : "./img/SVG/star.svg";
    favImg.alt = "Favorite";
    favBtn.appendChild(favImg);
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newState = !build.favorite;
      build.favorite = newState;
      favImg.src = newState
        ? "./img/SVG/star_filled.svg"
        : "./img/SVG/star.svg";
      await updateBuildFavorite(build.id, newState);
      await filterBuilds(getCurrentBuildFilter());
    });
    // Place favorite button relative to the left column so it can be
    // vertically centered against the matchup icon regardless of entry height.
    const leftContainer = buildEl.querySelector(".build-left");
    if (leftContainer) {
      leftContainer.appendChild(favBtn);
    } else {
      buildEl.prepend(favBtn);
    }

    // Color styles
    const sub = build.subcategory?.toUpperCase() || "";
    if (sub.startsWith("ZV")) {
      buildEl.style.setProperty("--gradient-color1", "#8e2de2");
      buildEl.style.setProperty("--gradient-color2", "#4a00e0");
      buildEl.style.setProperty("--race-color", "#8e2de2");
    } else if (sub.startsWith("PV")) {
      buildEl.style.setProperty("--gradient-color1", "#5fe5ff");
      buildEl.style.setProperty("--gradient-color2", "#007cf0");
      buildEl.style.setProperty("--race-color", "#5fe5ff");
    } else if (sub.startsWith("TV")) {
      buildEl.style.setProperty("--gradient-color1", "#ff3a30");
      buildEl.style.setProperty("--gradient-color2", "#ff7b00");
      buildEl.style.setProperty("--race-color", "#ff3a30");
    } else {
      buildEl.style.setProperty("--gradient-color1", "#555");
      buildEl.style.setProperty("--gradient-color2", "#333");
      buildEl.style.setProperty("--race-color", "#888");
    }

    // Hover + click preview
    buildEl.addEventListener("mouseover", () => {
      if (lastHoveredBuild !== build) {
        updateBuildPreviewWithTabs(build);
        lastHoveredBuild = build;
      }
    });

    buildEl.addEventListener("click", () => {
      if (build.source === "community" || build.source === "clan") {
        setEditingPublishedBuild(build);
        loadBuildIntoEditor(build);
        showEditorUIForPublishedEdit();
        document.getElementById("buildsModal").style.display = "none";
      } else {
        // Open my own build directly into the editor with variations/tabs
        try {
          clearEditingPublishedBuild();
          setCurrentBuildId(build.id);
          loadBuildIntoEditor(build);
          const saveBuildButton = document.getElementById("saveBuildButton");
          if (saveBuildButton) {
            saveBuildButton.innerText = "Update Build";
            saveBuildButton.removeAttribute("data-tooltip");
            void saveBuildButton.offsetWidth;
            saveBuildButton.setAttribute("data-tooltip", "Update Current Build");
          }
          document.getElementById("buildsModal").style.display = "none";
        } catch (e) {
          // Fallback to legacy route if anything goes wrong
          viewBuild(build.id);
        }
      }
    });

    buildEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        buildEl.click();
      }
    });

    // Handle delete button
    if (build.source !== "community" && build.source !== "clan") {
      const deleteButton = buildEl.querySelector(".delete-build-btn");
      if (deleteButton) {
        deleteButton.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (!confirm(`Delete "${build.title}"?`)) return;

          // ✅ Make sure you use the encoded ID!
          const encodedId =
            build.encodedTitle || build.id.replace(/\//g, "__SLASH__");
          await deleteBuildFromFirestore(build.id);

          const updatedBuilds = await fetchUserBuilds();
          setSavedBuilds(updatedBuilds);

          const activeFilter =
            document.querySelector("#buildsModal .filter-category.active")
              ?.dataset.category ||
            document.querySelector("#buildsModal .subcategory.active")?.dataset
              .subcategory ||
            "all";
          filterBuilds(activeFilter);

          const preview = document.getElementById("buildPreview");
          if (preview?.dataset.buildId === encodedId) {
            preview.innerHTML = `<h4>Build Preview</h4><p>Select a build to view details here.</p>`;
            delete preview.dataset.buildId;
          }
        });
      }
    } else {
      const deleteBtn = buildEl.querySelector(".delete-build-btn");
      if (deleteBtn) deleteBtn.remove();
    }

    const publishInfo = buildEl.querySelector(".build-publish-info");
    if (publishInfo) {
      const isBuildPublished = !!build.isPublished || !!build.isPublic;

      if (build.imported) {
        publishInfo.classList.add("publish-imported");
        publishInfo.dataset.tooltip = "imported";
        publishInfo.innerHTML = `<img src="./img/SVG/import2.svg" class="publish-icon" alt="Imported">`;
        publishInfo.style.pointerEvents = "auto";
      } else if (isBuildPublished) {
        publishInfo.classList.add("publish-published");
        publishInfo.dataset.tooltip = "published";
        publishInfo.innerHTML = `<img src="./img/SVG/checkmark2.svg" class="publish-icon" alt="Published">`;
        if (build.isPublic)
          publishInfo.innerHTML += `<span class="tag public">Public</span>`;
        if (build.sharedToClans?.length > 0)
          publishInfo.innerHTML += `<span class="tag clan">Clan</span>`;
        publishInfo.style.pointerEvents = "auto";
        publishInfo.classList.remove("no-border");
        publishInfo.addEventListener("click", (e) => {
          e.stopPropagation();
          openPublishModal(build.id);
        });
      } else {
        publishInfo.classList.add("publish-unpublished");
        publishInfo.dataset.tooltip = "publish";
        publishInfo.innerHTML = `<img src="./img/SVG/publish2.svg" class="publish-icon" alt="Publish">`;
        publishInfo.addEventListener("click", (e) => {
          e.stopPropagation();
          openPublishModal(build.id);
        });
      }
    }

    fragment.appendChild(buildEl);
  }

  buildList.appendChild(fragment);
  updateTooltips();
  isPopulatingBuildList = false;
}

// ✅ Helper function to parse matchup races correctly
function getRaceIcons(subcategory) {
  const raceMap = {
    Z: "zerg",
    P: "protoss",
    T: "terran",
  };

  if (!subcategory) {
    return [null, null];
  }

  const cleanedSubcategory = subcategory.trim().toUpperCase();

  if (cleanedSubcategory.length !== 3 || cleanedSubcategory.charAt(1) !== "V") {
    console.warn("⚠️ Unexpected matchup format:", subcategory);
    return [null, null];
  }

  const playerRace = raceMap[cleanedSubcategory.charAt(0)] || null;
  const opponentRace = raceMap[cleanedSubcategory.charAt(2)] || null;

  return [playerRace, opponentRace];
}

// ✅ Determine CSS class based on player's race
function getMatchupClass(playerRace) {
  const classes = {
    zerg: "matchup-zerg",
    protoss: "matchup-protoss",
    terran: "matchup-terran",
  };
  return classes[playerRace] || "matchup-unknown";
}

export async function unpublishBuild(buildId) {
  try {
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      alert("You must be signed in to unpublish builds.");
      return;
    }

    // ✅ Update your own saved build
    const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    await updateDoc(buildRef, {
      isPublished: false,
    });

    // ✅ Now search publishedBuilds where publisherId == user.uid
    const publishedRef = collection(db, "publishedBuilds");
    const buildSnapshot = await getDoc(buildRef);
    const buildData = buildSnapshot.data();
    const title = buildData?.title;

    const q = query(
      publishedRef,
      where("publisherId", "==", user.uid),
      where("title", "==", title)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (docSnap) => {
      const buildData = docSnap.data();
      if (buildData.title) {
        // Optional more matching checks
        // ✅ Delete this community build
        await deleteDoc(doc(db, "publishedBuilds", docSnap.id));
        console.log(`✅ Deleted from publishedBuilds: ${docSnap.id}`);
      }
    });

    showToast("✅ Build unpublished!", "success");

    // ✅ Update card UI live
    const buildEl = document.querySelector(
      `.build-card[data-id="${buildId}"], .build-entry[data-id="${buildId}"]`
    );
    if (buildEl) {
      const publishInfo = buildEl.querySelector(".build-publish-info");
      if (publishInfo) {
        publishInfo.innerHTML = `<img src="./img/SVG/publish2.svg" alt="Publish" class="publish-icon">`;
        publishInfo.dataset.tooltip = "publish";
        publishInfo.classList.remove("publish-published", "no-border");
        publishInfo.classList.add("publish-unpublished");
        publishInfo.style.pointerEvents = "auto";
        publishInfo.onclick = (event) => {
          event.stopPropagation();
          openPublishModal(buildId);
        };
      }
      buildEl.classList.remove("published");
    }
  } catch (error) {
    console.error("❌ Error unpublishing build:", error.message);
    showToast("Failed to unpublish build.", "error");
  }
}
window.unpublishBuild = unpublishBuild;

function updateBuildPreview(build) {
  const buildPreview = document.getElementById("buildPreview");
  if (!buildPreview) return;

  // ✅ Ensure `publisher` field is properly referenced
  const publisherName = build.publisher || build.username || "Unknown";

  // Format the build order using formatActionText
  const formattedBuildOrder = build.buildOrder
    .map((step) => {
      if (typeof step === "string") {
        return formatActionText(step);
      }
      if (step && step.action) {
        const bracket = step.workersOrTimestamp
          ? `<strong>${formatWorkersOrTimestampText(
              step.workersOrTimestamp
            )}</strong> `
          : "";
        return `${bracket}${formatActionText(step.action)}`;
      }
      return "";
    })
    .join("<br>"); // Use <br> for line breaks in HTML output

  // Apply the formatted text, including publisher (without video link)
  buildPreview.innerHTML = `
    <h4>${DOMPurify.sanitize(build.title)}</h4>
    <p><strong>Publisher:</strong> ${DOMPurify.sanitize(
      publisherName
    )}</p> <!-- ✅ Publisher correctly assigned -->
    <pre>${formattedBuildOrder}</pre>
  `;
}

function closeBuildsModal() {
  const buildsModal = document.getElementById("buildsModal");
  buildsModal.style.display = "none";
}

export function hideBuildsModal() {
  const buildsModal = document.getElementById("buildsModal");
  buildsModal.style.display = "none";
}

// Enhanced preview with Variation tabs
async function updateBuildPreviewWithTabs(build) {
  const buildPreview = document.getElementById("buildPreview");
  if (!buildPreview) return;

  const publisherName = build.publisher || build.username || "Unknown";
  const formattedBuildOrder = (build.buildOrder || [])
    .map((step) => {
      if (typeof step === "string") return formatActionText(step);
      if (step && step.action) {
        const bracket = step.workersOrTimestamp
          ? `<strong>${formatWorkersOrTimestampText(step.workersOrTimestamp)}</strong> `
          : "";
        return `${bracket}${formatActionText(step.action)}`;
      }
      return "";
    })
    .join("<br>");

  buildPreview.innerHTML = `
    <h4>${DOMPurify.sanitize(build.title)}</h4>
    <p class="build-publisher-line"><strong>Publisher:</strong> ${DOMPurify.sanitize(publisherName)}</p>
    <div class="variation-section-title">Variations</div>
    <div class="variation-tabs" id="buildPreviewTabs" aria-label="Build variations" role="tablist"></div>
    <div class="variation-divider"></div>
    <pre id="buildPreviewBody">${formattedBuildOrder}</pre>
  `;

  await setupVariationTabs(buildPreview, build);
}

async function setupVariationTabs(container, build) {
  try {
    const tabsHost = container.querySelector('#buildPreviewTabs');
    const bodyEl = container.querySelector('#buildPreviewBody');
    if (!tabsHost || !bodyEl) return;

    let variations = Array.isArray(build.variations) ? build.variations : [];
    if ((!variations || variations.length === 0) && build.groupId) {
      try {
        const grouped = await fetchVariationsForGroup(build.groupId);
        variations = grouped.filter(v => v.id !== build.id);
      } catch (e) {
        console.warn('Failed to fetch grouped variations', e);
      }
    }

    if (!Array.isArray(variations) || variations.length === 0) return;

    tabsHost.innerHTML = '';

    const MAX_TABS = 5;
    const MAIN_COLOR = '#4CC9F0';
    const VARIATION_COLORS = ['#F72585', '#8AC926', '#F19E39', '#B38CFF', '#3DD6D0'];
    const tabModels = [{ id: 'main', name: 'Main', data: null, color: MAIN_COLOR }].concat(
      variations.slice(0, MAX_TABS).map((v, i) => ({
        id: v.id || `var_${i + 1}`,
        name: v.variantName || v.name || v.title || `Variation ${i + 1}`,
        data: v,
        color: VARIATION_COLORS[i % VARIATION_COLORS.length]
      }))
    );

    function formatBuildArray(arr) {
      return (arr || [])
        .map((step) => {
          if (typeof step === 'string') return formatActionText(step);
          if (step && step.action) {
            const bracket = step.workersOrTimestamp
              ? `<strong>${formatWorkersOrTimestampText(step.workersOrTimestamp)}</strong> `
              : '';
            return `${bracket}${formatActionText(step.action)}`;
          }
          return '';
        })
        .join('<br>');
    }

    function applyTab(tabId) {
      if (tabId === 'main') {
        bodyEl.innerHTML = formatBuildArray(build.buildOrder || []);
        return;
      }
      const model = tabModels.find(t => t.id === tabId);
      if (!model || !model.data) return;
      const v = model.data;
      let html = '';
      if (Array.isArray(v.buildOrder) && v.buildOrder.length > 0) {
        html = formatBuildArray(v.buildOrder);
      } else if (typeof v.text === 'string' && v.text.trim()) {
        html = DOMPurify.sanitize(
          v.text
            .split(/\r?\n/)
            .filter(Boolean)
            .map((ln) => ln.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
            .join('<br>')
        );
      }
      if (html) bodyEl.innerHTML = html;
    }

    tabModels.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = 'variation-tab' + (idx === 0 ? ' active' : '');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-var-id', m.id);
      btn.title = m.name;
      btn.textContent = m.name;
      try { btn.style.borderColor = m.color || MAIN_COLOR; } catch (_) {}
      // active underline like main page
      try { btn.style.boxShadow = idx === 0 ? `inset 0 -3px 0 0 ${m.color || MAIN_COLOR}` : 'none'; } catch (_) {}
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        tabsHost.querySelectorAll('.variation-tab').forEach((b) => {
          b.classList.remove('active');
          // clear underline
          try { b.style.boxShadow = 'none'; } catch (_) {}
        });
        btn.classList.add('active');
        try { btn.style.boxShadow = `inset 0 -3px 0 0 ${m.color || MAIN_COLOR}`; } catch (_) {}
        applyTab(m.id);
      });
      tabsHost.appendChild(btn);
    });

    container.addEventListener(
      'mouseleave',
      () => {
        const mainBtn = tabsHost.querySelector('.variation-tab[data-var-id="main"]');
        if (mainBtn) {
          tabsHost.querySelectorAll('.variation-tab').forEach((b) => {
            b.classList.remove('active');
            try { b.style.boxShadow = 'none'; } catch (_) {}
          });
          mainBtn.classList.add('active');
          try { mainBtn.style.boxShadow = `inset 0 -3px 0 0 ${MAIN_COLOR}`; } catch (_) {}
          applyTab('main');
        }
      },
      { passive: true }
    );
  } catch (e) {
    console.warn('setupVariationTabs failed', e);
  }
}
export function loadBuild(index) {
  const build = getSavedBuilds()[index];
  const inputField = document.getElementById("buildOrderInput");
  inputField.value = build.data;

  // Analyze the build and update output
  analyzeBuildOrder(inputField.value);

  // Close the modal
  closeBuildsModal();
}

export async function searchBuilds(query) {
  const lowerCaseQuery = query.toLowerCase().trim();

  // When query is empty, revert to current filter
  if (!lowerCaseQuery) {
    await filterBuilds(currentBuildFilter);
    return;
  }

  // Activate "All" filter to avoid conflicts with race filters
  currentBuildFilter = "all";
  const buttons = document.querySelectorAll(
    "#buildsModal .filter-category, #buildsModal .subcategory"
  );
  buttons.forEach((btn) => btn.classList.remove("active"));
  const allBtn = document.querySelector(
    '#buildsModal .filter-category[data-category="all"]'
  );
  if (allBtn) allBtn.classList.add("active");

  // Fetch all of the user's builds
  const builds = await fetchUserBuilds();

  // Filter builds by title
  const filteredBuilds = builds.filter((build) =>
    build.title.toLowerCase().includes(lowerCaseQuery)
  );

  populateBuildList(filteredBuilds); // Update UI with filtered results
}

export async function populateMapModal(maps) {
  const mapContainer = document.querySelector(".map-cards-container");
  mapContainer.innerHTML = ""; // Clear existing maps

  maps.forEach((map) => {
    const mapCard = document.createElement("div");
    mapCard.classList.add("map-card");

    mapCard.innerHTML = `
      <img src="${DOMPurify.sanitize(map.image)}" alt="${DOMPurify.sanitize(
      map.name
    )}" />
      <h4>${DOMPurify.sanitize(map.name)}</h4>
    `;

    // Add click event for selecting a map
    mapCard.addEventListener("click", () => {
      selectMap(map.name);
    });

    mapContainer.appendChild(mapCard);
  });
}

function showEditorUIForPublishedEdit() {
  const titleBanner = document.getElementById("editModeBanner");
  const saveButton = document.getElementById("saveBuildButton");
  const updateButton = document.getElementById("updateBuildButton");
  const newButton = document.getElementById("newBuildButton");

  const build = getEditingPublishedBuild();
  if (!build) return;

  // Show edit banner
  titleBanner.innerHTML =
    '<img src="./img/SVG/pencil.svg" class="svg-icon" alt="Edit"> <strong>Edit Mode</strong>';
  titleBanner.style.display = "flex";
  titleBanner.style.backgroundColor = "#165016";
  titleBanner.style.color = "#fff";
  updateTooltips();

  // Button logic
  saveButton.style.display = "none";
  updateButton.style.display = "inline-block";
  newButton.style.display = "inline-block";
}

async function loadBuildIntoEditor(build) {
  const titleStr = build.title || "";
  const titleInputEl = document.getElementById("buildOrderTitleInput");
  if (titleInputEl) titleInputEl.value = titleStr;
  const titleTextEl = document.getElementById("buildOrderTitleText");
  if (titleTextEl) {
    titleTextEl.textContent = titleStr || "Enter build order title here...";
    if (titleStr) titleTextEl.classList.remove("dimmed");
    else titleTextEl.classList.add("dimmed");
  }
  // Robustly apply matchup dropdown ignoring case
  try {
    const matchUpDropdown = document.getElementById("buildCategoryDropdown");
    const subRaw = (build.subcategory || build.subcategoryLowercase || "").toString();
    const subLower = subRaw.toLowerCase();
    if (matchUpDropdown && subLower) {
      let matched = false;
      for (const opt of matchUpDropdown.options) {
        if (String(opt.value).toLowerCase() === subLower) {
          matchUpDropdown.value = opt.value;
          matched = true;
          break;
        }
      }
      // Colorize like viewBuild
      matchUpDropdown.style.color = subLower.startsWith("zv")
        ? "#c07aeb"
        : subLower.startsWith("pv")
        ? "#5fe5ff"
        : subLower.startsWith("tv")
        ? "#ff3a30"
        : "";
      if (!matched) matchUpDropdown.selectedIndex = 0; // fallback
    }
  } catch (_) {}
  document.getElementById("descriptionInput").value = build.description || "";
  document.getElementById("videoInput").value = build.videoLink || "";
  document.getElementById("buildOrderInput").value = Array.isArray(
    build.buildOrder
  )
    ? build.buildOrder
        .map((step) =>
          `[${step.workersOrTimestamp || ""}] ${step.action || ""}`.trim()
        )
        .join("\n")
    : "";

  // Setup DOM-based variation editors so tabs appear for this build
  try {
    const main = document.getElementById("buildOrderInput");
    if (main) {
      // Ensure editor stack exists and main is registered
      let stack = document.getElementById("boEditorsStack");
      if (!stack) {
        stack = document.createElement("div");
        stack.id = "boEditorsStack";
        const parent = main.parentElement;
        if (parent) parent.insertBefore(stack, main);
        stack.appendChild(main);
      } else {
        // Remove old variation editors if any
        Array.from(stack.querySelectorAll(".bo-editor"))
          .filter((ed) => ed !== main)
          .forEach((ed) => ed.remove());
      }
      main.classList.add("bo-editor");
      main.dataset.editorId = "main";
      main.dataset.editorName = "Main";
      main.style.display = "block";

      const toText = (v) => {
        if (Array.isArray(v?.buildOrder)) {
          return v.buildOrder
            .map((s) =>
              `[${s.workersOrTimestamp || ""}] ${s.action || ""}`.trim()
            )
            .join("\n");
        }
        return String(v?.text || "");
      };

      let variations = Array.isArray(build.variations)
        ? build.variations
        : [];

      // If build uses grouped variations (separate docs), fetch siblings
      try {
        if ((!variations || variations.length === 0) && build.groupId) {
          const siblings = await fetchVariationsForGroup(build.groupId);
          if (Array.isArray(siblings) && siblings.length) {
            const mainDoc = siblings.find((b) => b.isMain) || build;
            // Populate Main editor from the mainDoc
            if (Array.isArray(mainDoc.buildOrder)) {
              main.value = mainDoc.buildOrder
                .map((s) => `[${s.workersOrTimestamp || ""}] ${s.action || ""}`.trim())
                .join("\n");
            } else if (typeof mainDoc.text === "string") {
              main.value = String(mainDoc.text || "");
            }
            // Normalized variations from other siblings
            const others = siblings.filter((b) => b.id !== (mainDoc.id || ""));
            variations = others.map((b, idx) => ({
              id: b.id || `var_${idx + 1}`,
              name: b.variantName || b.name || `Variation ${idx + 1}`,
              buildOrder: Array.isArray(b.buildOrder) ? b.buildOrder : undefined,
              text: Array.isArray(b.buildOrder)
                ? undefined
                : (typeof b.text === "string" ? b.text : ""),
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch grouped variations", err);
      }
      // Expose list for analyze fallback
      window.zboPreloadedVariations = variations.map((v, idx) => ({
        id: v.id || `var_${idx + 1}`,
        name: v.name || `Variation ${idx + 1}`,
      }));
      variations.slice(0, 5).forEach((v, idx) => {
        const ta = document.createElement("textarea");
        ta.value = toText(v);
        ta.className = "bo-editor";
        ta.dataset.editorId = v.id || `var_${idx + 1}`;
        ta.dataset.editorName = v.name || `Variation ${idx + 1}`;
        ta.style.display = "none";
        stack.appendChild(ta);
      });

      // Trigger rendering/tabs for this build (uiHandlers will render tabs)
      analyzeBuildOrder(main.value || "");
    }
  } catch (e) {
    console.warn("Failed to create variation editors from build", e);
    analyzeBuildOrder(document.getElementById("buildOrderInput").value || "");
  }

  // Optional: Map annotations, replayUrl, etc.
}

export { closeBuildsModal };

