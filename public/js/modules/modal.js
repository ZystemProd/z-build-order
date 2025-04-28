import {
  getDoc,
  doc,
  getFirestore,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
//import * as DOMPurify from "./dompurify/dist/purify.min.js";
import { displayBuildOrder, showToast } from "./uiHandlers.js";
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import {
  getSavedBuilds,
  saveBuilds,
  deleteBuildFromStorage,
} from "./buildStorage.js";
import { fetchUserBuilds } from "./buildManagement.js";
import { mapAnnotations } from "./interactive_map.js";
import { formatActionText } from "./textFormatters.js";
import { analyzeBuildOrder } from "./uiHandlers.js";

function formatMatchup(matchup) {
  if (!matchup) return "Unknown Match-Up";
  return (
    matchup.charAt(0).toUpperCase() +
    matchup.slice(1, -1).toLowerCase() +
    matchup.charAt(matchup.length - 1).toUpperCase()
  );
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

export function viewBuild(buildId) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    return;
  }

  const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
  getDoc(buildRef)
    .then((docSnap) => {
      if (docSnap.exists()) {
        const build = docSnap.data();
        const mapImage = document.getElementById("map-preview-image");
        const selectedMapText = document.getElementById("selected-map-text");
        const titleInput = document.getElementById("buildOrderTitleInput");
        const titleText = document.getElementById("buildOrderTitleText");
        const matchUpDropdown = document.getElementById(
          "buildCategoryDropdown"
        );

        console.log("Loaded build:", build);

        // Helper function to capitalize each word
        const capitalizeWords = (str) => {
          return str
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        };

        // Check for mandatory fields
        if (!build.title || !build.subcategory) {
          console.error("Mandatory fields (Title or Match-Up) are missing.");
          showToast(
            "This build cannot be viewed due to missing mandatory fields.",
            "error"
          );
          return;
        }

        // ✅ **Update Match-Up Dropdown & Set Color**
        if (matchUpDropdown) {
          const subcategoryValue = build.subcategory.toLowerCase();
          let matchFound = false;

          for (const option of matchUpDropdown.options) {
            if (option.value.toLowerCase() === subcategoryValue) {
              matchUpDropdown.value = option.value;
              matchFound = true;
              break;
            }
          }

          if (!matchFound) {
            console.warn(
              `No match found for subcategory: ${build.subcategory}`
            );
          }

          // ✅ **Update the Dropdown Color**
          if (subcategoryValue.startsWith("zv")) {
            matchUpDropdown.style.color = "#c07aeb"; // Purple (Zerg)
          } else if (subcategoryValue.startsWith("pv")) {
            matchUpDropdown.style.color = "#5fe5ff"; // Blue (Protoss)
          } else if (subcategoryValue.startsWith("tv")) {
            matchUpDropdown.style.color = "#ff3a30"; // Red (Terran)
          } else {
            matchUpDropdown.style.color = ""; // Default color if unmatched
          }
        }

        // ✅ **Update the map preview and selected map text**
        if (build.map) {
          const mapName = build.map;
          const formattedMapName = capitalizeWords(mapName);
          const mapUrl = `https://z-build-order.web.app/img/maps/${mapName
            .replace(/ /g, "_")
            .toLowerCase()}.webp`;

          if (mapImage) mapImage.src = mapUrl;
          if (selectedMapText) selectedMapText.innerText = formattedMapName;
        } else if (selectedMapText) {
          selectedMapText.innerText = "No map selected";
        }

        // ✅ **Load annotations (circles and arrows)**
        if (build.interactiveMap) {
          mapAnnotations.circles = [];
          mapAnnotations.annotationsContainer.innerHTML = "";

          build.interactiveMap.circles?.forEach(({ x, y }) => {
            mapAnnotations.createCircle(x, y);
          });

          build.interactiveMap.arrows?.forEach(
            ({ startX, startY, endX, endY }) => {
              mapAnnotations.createArrow(startX, startY, endX, endY);
            }
          );

          mapAnnotations.updateCircleNumbers();
        }

        // ✅ **Update titleText and titleInput**
        if (titleText) {
          titleText.textContent =
            DOMPurify.sanitize(build.title) ||
            "Enter build order title here...";
          titleText.classList.remove("dimmed");
        }

        if (titleInput) {
          titleInput.value = build.title || "";
        }

        // ✅ **Format and display match-up**
        const matchUpElement = document.getElementById("matchUpDisplay");
        if (matchUpElement) {
          const formattedMatchUp = build.subcategory
            ? capitalizeWords(build.subcategory)
            : "Unknown";
          matchUpElement.textContent = `Match-Up: ${formattedMatchUp}`;
        }

        // ✅ **Populate comment**
        const commentInput = document.getElementById("commentInput");
        if (commentInput) {
          commentInput.value = DOMPurify.sanitize(build.comment) || "";
        }

        // ✅ Populate YouTube input field
        const videoInput = document.getElementById("videoInput");

        if (videoInput) {
          console.log("✅ videoInput found:", videoInput); // Debug log
          console.log("✅ Loaded build.youtube value:", build.youtube);
          // Set value into input
          videoInput.value = build.youtube || build.videoLink || "";

          console.log("✅ Set videoInput value to:", videoInput.value); // Debug log

          // ✅ Then update the iframe based on the input value
          updateYouTubeEmbed(videoInput.value);
        } else {
          console.error("❌ videoInput not found in DOM when loading build.");
        }

        // ✅ **Validate build order**
        const validBuildOrder = Array.isArray(build.buildOrder)
          ? build.buildOrder.filter(
              (step) => step && (step.workersOrTimestamp || step.action)
            ) // Remove invalid steps
          : [];

        // ✅ **Convert valid build order to a string format with empty brackets if needed**
        const buildOrderText = build.buildOrder.length
          ? build.buildOrder
              .map((step) => {
                const workersOrTimestamp = step.workersOrTimestamp
                  ?.toString()
                  .trim();
                const action = step.action || "";
                return `[${workersOrTimestamp || ""}] ${action}`.trim();
              })
              .join("\n")
          : "No build order available.";

        // ✅ **Populate the build order input field**
        const buildOrderInput = document.getElementById("buildOrderInput");
        if (buildOrderInput) {
          buildOrderInput.value = buildOrderText;
        }

        // ✅ **Run the analyzeBuildOrder function to update the table**
        analyzeBuildOrder(buildOrderInput.value);

        closeModal();
      } else {
        console.error("No such build found.");
      }
    })
    .catch((error) => {
      console.error("Error loading build:", error);
    });
}

window.viewBuild = viewBuild;

// Close the modal
export function closeModal() {
  const modal = document.getElementById("buildsModal");
  if (modal) {
    modal.style.display = "none"; // Only hide the modal
  }
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
  // Show the loader
  loader.style.display = "block";

  // Optionally, clear any existing build cards but keep the loader
  Array.from(buildList.children).forEach((child) => {
    if (!child.classList.contains("lds-roller")) {
      buildList.removeChild(child);
    }
  });

  // Populate the build list and wait for it to finish
  await populateBuildList();

  // Hide the loader once the build list is populated
  loader.style.display = "none";

  // Open the modal once the build list is fully loaded
  buildModal.style.display = "block";

  // Re-enable the button
  showBuildsButton.disabled = false;

  // Set up closing behavior for the modal
  document.getElementById("closeBuildsModal").onclick = () => {
    buildModal.style.display = "none";
  };
  window.onclick = (event) => {
    if (event.target === buildModal) {
      buildModal.style.display = "none";
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

  const builds = filteredBuilds || (await fetchUserBuilds());

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

    // ✅ Determine races based on matchup
    const [playerRace, opponentRace] = getRaceIcons(
      build.subcategory || "Unknown"
    );

    // ✅ Only create icons if both playerRace and opponentRace exist
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

    const publishedText = build.isPublished
      ? "Published to: Community ✅"
      : "Not published 🔒";

    // ✅ Build the card inner HTML
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
      <div class="build-publish-info clickable">
        ${publishedText}
      </div>
    `;

    // ✅ Set dynamic gradient colors based on matchup
    if (build.subcategory?.toUpperCase().startsWith("ZV")) {
      buildCard.style.setProperty("--gradient-color1", "#8e2de2"); // Zerg purple
      buildCard.style.setProperty("--gradient-color2", "#4a00e0");
    } else if (build.subcategory?.toUpperCase().startsWith("PV")) {
      buildCard.style.setProperty("--gradient-color1", "#5fe5ff"); // Protoss blue
      buildCard.style.setProperty("--gradient-color2", "#007cf0");
    } else if (build.subcategory?.toUpperCase().startsWith("TV")) {
      buildCard.style.setProperty("--gradient-color1", "#ff3a30"); // Terran red
      buildCard.style.setProperty("--gradient-color2", "#ff7b00");
    } else {
      buildCard.style.setProperty("--gradient-color1", "#555");
      buildCard.style.setProperty("--gradient-color2", "#333");
    }

    // ✅ Hover to preview
    buildCard.addEventListener("mouseover", () => {
      if (lastHoveredBuild !== build) {
        updateBuildPreview(build);
        lastHoveredBuild = build;
      }
    });

    // ✅ Click to view build
    buildCard.addEventListener("click", () => viewBuild(build.id));

    // ✅ Delete button click
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

    // ✅ Publish/Unpublish click
    const publishInfo = buildCard.querySelector(".build-publish-info");
    if (publishInfo) {
      publishInfo.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (build.isPublished) {
          const confirmation = confirm(
            `Are you sure you want to unpublish "${build.title}" from the Community?`
          );
          if (confirmation) {
            await unpublishBuild(build.id);
            const updatedBuilds = await fetchUserBuilds();
            populateBuildList(updatedBuilds);
          }
        } else {
          alert("This build is not published yet!");
        }
      });
    }

    fragment.appendChild(buildCard);
  });

  buildList.appendChild(fragment);
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
async function unpublishBuild(buildId) {
  const db = getFirestore();
  const user = getAuth().currentUser;

  if (!user) {
    console.error("No user logged in. Cannot unpublish.");
    return;
  }

  const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);

  try {
    await updateDoc(buildRef, {
      isPublished: false,
      datePublished: null,
    });
    console.log(`✅ Build "${buildId}" unpublished successfully.`);
    showToast("✅ Build unpublished!", "success");
  } catch (error) {
    console.error("❌ Error unpublishing build:", error);
    showToast("❌ Failed to unpublish build.", "error");
  }
}

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

export async function filterBuilds(
  categoryOrSubcategory = "all",
  searchQuery = ""
) {
  const builds = await fetchUserBuilds(); // Fetch all builds from Firestore
  const lowerCaseQuery = searchQuery.toLowerCase();

  // Filter builds based on category or subcategory
  const filteredBuilds = builds.filter((build) => {
    const matchesCategory =
      categoryOrSubcategory === "all" ||
      (["zvz", "zvp", "zvt", "pvp", "pvz", "pvt", "tvt", "tvz", "tvp"].includes(
        categoryOrSubcategory.toLowerCase()
      ) &&
        build.subcategory.toLowerCase() ===
          categoryOrSubcategory.toLowerCase()) ||
      (["zerg", "protoss", "terran"].includes(
        categoryOrSubcategory.toLowerCase()
      ) &&
        build.category.toLowerCase() === categoryOrSubcategory.toLowerCase());

    const matchesSearch =
      build.title.toLowerCase().includes(lowerCaseQuery) ||
      (build.comment && build.comment.toLowerCase().includes(lowerCaseQuery));

    return matchesCategory && matchesSearch;
  });

  // Populate the filtered list
  populateBuildList(filteredBuilds);
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
