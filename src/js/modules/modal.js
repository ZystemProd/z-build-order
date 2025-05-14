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
import { auth, db } from "../../app.js";
import { showToast } from "./toastHandler.js";
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import { mapAnnotations } from "./interactive_map.js";
import { formatActionText } from "./textFormatters.js";
import { capitalize } from "./helpers/sharedEventUtils.js";
import { analyzeBuildOrder } from "./uiHandlers.js";
import { publishBuildToCommunity } from "./community.js";
import { setCurrentBuildId } from "./states/buildState.js";
import DOMPurify from "dompurify";

// --- Firestore Pagination State
let lastVisibleBuild = null;
let isLoadingMoreBuilds = false;
let currentBuildFilter = "all";

export function formatMatchup(matchup) {
  if (!matchup) return "Unknown Match-Up";
  return (
    matchup.charAt(0).toUpperCase() +
    matchup.slice(1, -1).toLowerCase() +
    matchup.charAt(matchup.length - 1).toUpperCase()
  );
}

export async function filterBuilds(categoryOrSubcategory = "all") {
  const heading = document.querySelector("#buildsModal .template-header h3");
  const db = getFirestore();
  const user = getAuth().currentUser;
  if (!user) return;

  currentBuildFilter = categoryOrSubcategory.toLowerCase();
  lastVisibleBuild = null;
  document.getElementById("buildList").innerHTML = "";

  const builds = await fetchFilteredBuilds();

  const label =
    currentBuildFilter === "all"
      ? "Build Orders"
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

  populateBuildList(builds);
  attachBuildScrollListener();
}

async function fetchFilteredBuilds(batchSize = 20) {
  const db = getFirestore();
  const user = getAuth().currentUser;
  if (!user) return [];

  let q = collection(db, `users/${user.uid}/builds`);
  const lowerFilter = currentBuildFilter;

  if (lowerFilter === "all") {
    q = query(q, orderBy("timestamp", "desc"), limit(batchSize));
  } else if (
    ["zvp", "zvt", "zvz", "pvp", "pvt", "pvz", "tvp", "tvt", "tvz"].includes(
      lowerFilter
    )
  ) {
    q = query(
      q,
      where("subcategoryLowercase", "==", lowerFilter),
      orderBy("timestamp", "desc"),
      limit(batchSize)
    );
  } else if (["zerg", "protoss", "terran"].includes(lowerFilter)) {
    q = query(
      q,
      where("category", "==", capitalize(lowerFilter)),
      orderBy("timestamp", "desc"),
      limit(batchSize)
    );
  }

  if (lastVisibleBuild) {
    q = query(q, startAfter(lastVisibleBuild));
  }

  const snap = await getDocs(q);
  if (!snap.empty) {
    lastVisibleBuild = snap.docs[snap.docs.length - 1];
  }

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function attachBuildScrollListener() {
  const container = document.querySelector("#buildsModal .modal-content");
  if (!container) return;

  container.removeEventListener("scroll", handleBuildScroll);
  container.addEventListener("scroll", handleBuildScroll);
}

async function handleBuildScroll() {
  const container = document.querySelector("#buildsModal .modal-content");
  if (
    isLoadingMoreBuilds ||
    !container ||
    container.scrollTop + container.clientHeight < container.scrollHeight - 200
  ) {
    return;
  }

  isLoadingMoreBuilds = true;
  const builds = await fetchFilteredBuilds();
  populateBuildList(builds, true);
  isLoadingMoreBuilds = false;
}

async function uploadReplayFile(file) {
  const storage = getStorage();
  const timestamp = Date.now();
  const uniqueFileName = `replays/${timestamp}_${file.name}`; // Avoid overwriting files
  const storageRef = ref(storage, uniqueFileName);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
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
    if (build.map) {
      const mapName = build.map;
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
    } else if (selectedMapText) {
      selectedMapText.innerText = "No map selected";
    }

    // Annotations
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

export async function openPublishModal(buildId) {
  currentBuildIdToPublish = buildId;
  const modal = document.getElementById("publishModal");
  modal.style.display = "block";

  // 🧠 Populate list of clans user is a member of
  const clanContainer = document.getElementById("clanPublishList");
  if (clanContainer) {
    clanContainer.innerHTML = ""; // Clear previous list
    const user = auth.currentUser;
    if (!user) return;

    const clansSnap = await getDocs(collection(db, "clans"));

    clansSnap.forEach((docSnap) => {
      const clan = docSnap.data();
      const clanId = docSnap.id;

      if (clan.members?.includes(user.uid)) {
        const label = document.createElement("label");
        label.className = "publish-checkbox-row";
        label.innerHTML = `
          <input type="checkbox" class="clanPublishCheckbox" value="${clanId}" />
          Share with ${clan.name}
        `;
        clanContainer.appendChild(label);
      }
    });
  }
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

  // Disable the button to prevent multiple clicks
  showBuildsButton.disabled = true;

  // Find or create the loader element
  let loader = buildList.querySelector(".lds-roller");
  if (!loader) {
    loader = document.createElement("div");
    loader.className = "lds-roller";
    loader.innerHTML =
      "<div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>";
    buildList.appendChild(loader);
  }
  loader.style.display = "block";

  // Clear existing build cards (but keep the loader)
  Array.from(buildList.children).forEach((child) => {
    if (!child.classList.contains("lds-roller")) {
      buildList.removeChild(child);
    }
  });

  // ✅ Visually activate the "All" filter tab
  const allTab = document.querySelector(
    '#buildsModal .filter-category[data-category="all"]'
  );
  const allTabs = document.querySelectorAll('#buildsModal .filter-category');
  allTabs.forEach((tab) => tab.classList.remove("active"));
  if (allTab) allTab.classList.add("active");

  // ✅ Update heading
  if (heading) heading.textContent = "Build Orders - All";

  // ✅ Run new Firestore-indexed fetch
  await filterBuilds("all");

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

export async function populateBuildList(filteredBuilds = null) {
  const buildList = document.getElementById("buildList");
  const buildPreview = document.getElementById("buildPreview");

  if (!buildList || !buildPreview) {
    console.error("Build modal elements not found!");
    return;
  }

  if (isPopulatingBuildList) return;
  isPopulatingBuildList = true;

  buildList.innerHTML = "";

  const builds = filteredBuilds || [];

  if (!builds.length) {
    buildList.innerHTML = "<p>No builds available.</p>";
    isPopulatingBuildList = false;
    return;
  }

  let lastHoveredBuild = null;
  const fragment = document.createDocumentFragment();

  builds.forEach((build) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");
    buildCard.dataset.id = build.id;
    buildCard.style.position = "relative";

    // ✅ Add .published class if published
    if (build.isPublished) {
      buildCard.classList.add("published");
    }

    // ✅ Determine races based on matchup
    const [playerRace, opponentRace] = getRaceIcons(
      build.subcategory || "Unknown"
    );

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

    buildCard.innerHTML = `
      <div class="build-card-header">
        ${matchupIconsHTML}
        <button class="delete-build-btn" title="Delete Build">×</button>
      </div>
      <h3 class="build-title">${DOMPurify.sanitize(build.title)}</h3>
      <div class="build-meta">
        <p>Publisher: You</p>
        <p>Date: ${new Date(build.timestamp).toLocaleDateString()}</p>
      </div>
      <div class="build-publish-info"></div> <!-- Placeholder -->
    `;

    // ✅ Set dynamic colors
    if (build.subcategory?.toUpperCase().startsWith("ZV")) {
      buildCard.style.setProperty("--gradient-color1", "#8e2de2");
      buildCard.style.setProperty("--gradient-color2", "#4a00e0");
      buildCard.style.setProperty("--race-color", "#8e2de2");
    } else if (build.subcategory?.toUpperCase().startsWith("PV")) {
      buildCard.style.setProperty("--gradient-color1", "#5fe5ff");
      buildCard.style.setProperty("--gradient-color2", "#007cf0");
      buildCard.style.setProperty("--race-color", "#5fe5ff");
    } else if (build.subcategory?.toUpperCase().startsWith("TV")) {
      buildCard.style.setProperty("--gradient-color1", "#ff3a30");
      buildCard.style.setProperty("--gradient-color2", "#ff7b00");
      buildCard.style.setProperty("--race-color", "#ff3a30");
    } else {
      buildCard.style.setProperty("--gradient-color1", "#555");
      buildCard.style.setProperty("--gradient-color2", "#333");
      buildCard.style.setProperty("--race-color", "#888");
    }

    // ✅ Hover preview
    buildCard.addEventListener("mouseover", () => {
      if (lastHoveredBuild !== build) {
        updateBuildPreview(build);
        lastHoveredBuild = build;
      }
    });

    // ✅ Click to view build
    buildCard.addEventListener("click", () => viewBuild(build.id));

    // ✅ Delete build
    const deleteButton = buildCard.querySelector(".delete-build-btn");
    if (deleteButton) {
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const confirmation = confirm(
          `Are you sure you want to delete "${build.title}"?`
        );
        if (confirmation) {
          await deleteBuildFromFirestore(build.id);
          const updatedBuilds = await fetchUserBuilds();
          populateBuildList(updatedBuilds);
        }
      });
    }

    const publishButton = buildCard.querySelector(".build-publish-info");
    if (publishButton) {
      publishButton.addEventListener("click", (event) => {
        event.stopPropagation();
        window.currentBuildIdToPublish = build.id;

        const publishModal = document.getElementById("publishModal");
        if (publishModal) publishModal.style.display = "block";
      });
    }

    // ✅ Setup publish-info button
    const publishInfo = buildCard.querySelector(".build-publish-info");
    if (publishInfo) {
      if (build.imported) {
        // Imported build (non-clickable)
        publishInfo.classList.add("publish-imported");
        publishInfo.innerHTML = `<span>Imported</span>`;
        publishInfo.style.pointerEvents = "none";
        publishInfo.style.cursor = "default";
      } else if (build.isPublished) {
        // Published build
        publishInfo.classList.add("publish-published");
        publishInfo.innerHTML = `<span>Published </span><img src="./img/SVG/checkmark2.svg" alt="Published" class="publish-icon">`;
        publishInfo.addEventListener("click", (event) => {
          event.stopPropagation();
          openPublishSettingsModal(build.id);
        });
      } else {
        // Not published build
        publishInfo.classList.add("publish-unpublished");
        publishInfo.innerHTML = `<img src="./img/SVG/publish2.svg" alt="Publish" class="publish-icon"><span>Publish</span>`;
        publishInfo.addEventListener("click", (event) => {
          event.stopPropagation();
          openPublishModal(build.id);
        });
      }
    }

    fragment.appendChild(buildCard);
  });

  buildList.appendChild(fragment);
  isPopulatingBuildList = false;
}

export function openPublishSettingsModal(buildId) {
  console.log(`⚙️ Open manage publish settings for build: ${buildId}`);
  currentBuildIdToPublish = buildId;

  const modal = document.getElementById("publishModal");
  modal.style.display = "block";

  // Load current publish state
  const buildCard = document.querySelector(`.build-card[data-id="${buildId}"]`);
  if (buildCard) {
    const isPublished = buildCard.classList.contains("published"); // or based on your state
    const checkbox = document.getElementById("publishToCommunity");
    if (checkbox) {
      checkbox.checked = isPublished;
    }
  }
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
/*
// ✅ Helper to set border color based on race
function getRaceBorderColor(subcategory) {
  if (!subcategory) return "#555555";

  if (subcategory.startsWith("Zv")) {
    return "#7e57c2"; // Zerg purple
  } else if (subcategory.startsWith("Pv")) {
    return "#5fe5ff"; // Protoss blue
  } else if (subcategory.startsWith("Tv")) {
    return "#ff5252"; // Terran red
  }
  return "#555555"; // Default gray
}
*/
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

    // ✅ Now search communityBuilds where publisherId == user.uid
    const communityRef = collection(db, "communityBuilds");
    const buildSnapshot = await getDoc(buildRef);
    const buildData = buildSnapshot.data();
    const title = buildData?.title;

    const q = query(
      communityRef,
      where("publisherId", "==", user.uid),
      where("title", "==", title)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (docSnap) => {
      const buildData = docSnap.data();
      if (buildData.title) {
        // Optional more matching checks
        // ✅ Delete this community build
        await deleteDoc(doc(db, "communityBuilds", docSnap.id));
        console.log(`✅ Deleted from communityBuilds: ${docSnap.id}`);
      }
    });

    showToast("✅ Build unpublished!", "success");

    // ✅ Update card UI live
    const buildCard = document.querySelector(
      `.build-card[data-id="${buildId}"]`
    );
    if (buildCard) {
      const publishInfo = buildCard.querySelector(".build-publish-info");
      if (publishInfo) {
        publishInfo.innerHTML = `<img src="./img/SVG/publish2.svg" alt="Publish" class="publish-icon"><span>Publish</span>`;
        publishInfo.classList.remove("publish-published");
        publishInfo.classList.add("publish-unpublished");
        publishInfo.onclick = (event) => {
          event.stopPropagation();
          openPublishModal(buildId);
        };
      }
      buildCard.classList.remove("published");
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
  const lowerCaseQuery = query.toLowerCase();
  const builds = await fetchUserBuilds(); // Fetch all builds

  // Filter builds based on the query
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

export { closeBuildsModal };
