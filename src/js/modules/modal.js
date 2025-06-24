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
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
import { auth, db } from "../../app.js";
import { showToast } from "./toastHandler.js";
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import { mapAnnotations } from "./interactive_map.js";
import { formatActionText } from "./textFormatters.js";
import { capitalize } from "./helpers/sharedEventUtils.js";
import { analyzeBuildOrder } from "./uiHandlers.js";
import { publishBuildToCommunity } from "./community.js";
import {
  setCurrentBuildId,
  clearEditingPublishedBuild,
} from "./states/buildState.js";
import { loadBuilds } from "./buildService.js";
import {
  fetchUserBuilds,
  fetchPublishedUserBuilds,
  updateBuildFavorite,
} from "./buildManagement.js";
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

function isPublishedBuildsTabActive() {
  return document
    .getElementById("publishedBuildsTab")
    ?.classList.contains("active");
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

  const isPublishedTabActive = document
    .getElementById("publishedBuildsTab")
    ?.classList.contains("active");

  console.log("🧪 Filtering builds...");
  console.log("➡️ Filter:", currentBuildFilter);
  console.log("📦 Tab:", isPublishedTabActive ? "Published" : "My Builds");

  const { builds, lastDoc } = await loadBuilds({
    type: isPublishedTabActive ? "published" : "my",
    filter: currentBuildFilter,
    batchSize: 20,
  });

  lastVisibleBuild = lastDoc;

  const label =
    currentBuildFilter === "all"
      ? `Build Orders${isPublishedTabActive ? " - Published Builds" : ""}`
      : `Build Orders${isPublishedTabActive ? " - Published Builds" : ""} - ${
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
    type: isPublishedBuildsTabActive() ? "published" : "my",
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
      type: isPublishedBuildsTabActive() ? "published" : "my",
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
    const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    await deleteDoc(buildRef);
    showToast("Build deleted successfully!", "success");

    // Refresh the build list
    populateBuildList();
  } catch (error) {
    console.error("Error deleting build:", error);
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
        const response = await fetch("/data/maps.json");
        const maps = await response.json();
        const mapEntry = maps.find(
          (m) => m.name.toLowerCase() === mapName.toLowerCase()
        );
        const folder = mapEntry?.folder || "";
        const fileName =
          mapEntry?.file || mapName.replace(/ /g, "_").toLowerCase() + ".webp";
        mapUrl = folder
          ? `/img/maps/${folder}/${fileName}`
          : `/img/maps/${fileName}`;
      } catch (err) {
        console.warn("Could not load maps.json, falling back.");
        mapUrl = `/img/maps/${mapName.replace(/ /g, "_").toLowerCase()}.webp`;
      }

      if (mapImage) mapImage.src = mapUrl;
      if (selectedMapText) selectedMapText.innerText = formattedMapName;

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
      if (mapImage) mapImage.src = "";
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

    // Comment
    const commentInput = document.getElementById("commentInput");
    if (commentInput)
      commentInput.value = DOMPurify.sanitize(build.comment) || "";

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

    if (replayUrl && replayWrapper && replayView && replayBtn) {
      replayWrapper.style.display = "none";
      replayView.style.display = "block";
      replayBtn.href = replayUrl;
      replayBtn.innerText = "Download Replay on Drop.sc";
    } else if (replayWrapper && replayView) {
      replayWrapper.style.display = "flex";
      replayView.style.display = "none";
    }

    analyzeBuildOrder(buildOrderInput?.value || "");
    setCurrentBuildId(buildId);

    const editBanner = document.getElementById("editModeBanner");
    if (editBanner) {
      editBanner.innerHTML = `[Edit Mode] <strong>${DOMPurify.sanitize(
        build.title
      )}</strong>`;
      editBanner.style.display = "block";
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

  // ✅ Activate the "My Builds" tab
  const myTab = document.getElementById("myBuildsTab");
  const pubTab = document.getElementById("publishedBuildsTab");
  if (myTab && pubTab) {
    myTab.classList.add("active");
    pubTab.classList.remove("active");
  }

  // ✅ Activate "All" category filter
  const allTab = document.querySelector(
    '#buildsModal .filter-category[data-category="all"]'
  );
  const allTabs = document.querySelectorAll("#buildsModal .filter-category");
  allTabs.forEach((tab) => tab.classList.remove("active"));
  if (allTab) allTab.classList.add("active");

  // ✅ Update heading
  if (heading) heading.textContent = "Build Orders - My Builds";

  // ✅ Load My Builds
  try {
    // 🔁 Only fetch when My Builds tab is active
    const myTabActive = document
      .getElementById("myBuildsTab")
      ?.classList.contains("active");

    if (myTabActive) {
      const activeCategory =
        document.querySelector("#buildsModal .filter-category.active")?.dataset
          .category ||
        document.querySelector("#buildsModal .subcategory.active")?.dataset
          .subcategory ||
        "all";

      await filterBuilds(activeCategory);
    }
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
              ${formatShortDate(build.timestamp)}
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
    } else {
      buildEl.innerHTML = `
        <div class="build-card-header">
          ${matchupIconsHTML}
          <button class="delete-build-btn" title="Delete Build">×</button>
        </div>
        <h3 class="build-title">${DOMPurify.sanitize(build.title)}</h3>
        <div class="build-meta">
          <p>Publisher: ${DOMPurify.sanitize(build.publisher || "You")}</p>
          <p>Date: ${formatShortDate(build.timestamp)}</p>
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
    buildEl.prepend(favBtn);

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
        updateBuildPreview(build);
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
        clearEditingPublishedBuild();
        viewBuild(build.id);
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
          if (preview?.dataset.buildId === build.id) {
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
      const publishedTab = isPublishedBuildsTabActive();
      const isBuildPublished =
        build.isPublished ||
        build.isPublic ||
        (build.sharedToClans?.length ?? 0) > 0;

      if (build.imported) {
        publishInfo.classList.add("publish-imported");
        publishInfo.dataset.tooltip = "imported";
        publishInfo.innerHTML = `<img src="./img/SVG/import2.svg" class="publish-icon" alt="Imported">`;
        publishInfo.style.pointerEvents = "auto";
      } else if (isBuildPublished) {
        publishInfo.classList.add("publish-published");
        publishInfo.dataset.tooltip = "published";
        publishInfo.innerHTML = `<img src="./img/SVG/checkmark2.svg" class="publish-icon" alt="Published">`;
        if (publishedTab) {
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
          publishInfo.style.pointerEvents = "auto";
          publishInfo.classList.add("no-border");
        }
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
    .map(
      (step) => `[${step.workersOrTimestamp}] ${formatActionText(step.action)}`
    )
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

  // Determine which tab is active and fetch builds accordingly
  const isPublishedTabActive = document
    .getElementById("publishedBuildsTab")
    ?.classList.contains("active");

  let builds = [];
  if (isPublishedTabActive) {
    builds = await fetchPublishedUserBuilds("all");
  } else {
    builds = await fetchUserBuilds();
  }

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
  titleBanner.innerHTML = `[Edit Mode] <strong>${DOMPurify.sanitize(
    build.title
  )}</strong>`;
  titleBanner.style.display = "block";
  titleBanner.style.backgroundColor = "#165016";
  titleBanner.style.color = "#fff";

  // Button logic
  saveButton.style.display = "none";
  updateButton.style.display = "inline-block";
  newButton.style.display = "inline-block";
}

function loadBuildIntoEditor(build) {
  document.getElementById("buildOrderTitleInput").value = build.title || "";
  document.getElementById("buildCategoryDropdown").value =
    build.subcategory || "";
  document.getElementById("commentInput").value = build.comment || "";
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

  // Optional: Map annotations, replayUrl, etc.
}

export { closeBuildsModal };
