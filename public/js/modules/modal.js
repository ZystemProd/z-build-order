import {
  getDoc,
  doc,
  getFirestore,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
//import * as DOMPurify from "./dompurify/dist/purify.min.js";
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

function formatMatchup(matchup) {
  if (!matchup) return "Unknown Match-Up";
  return (
    matchup.charAt(0).toUpperCase() +
    matchup.slice(1, -1).toLowerCase() +
    matchup.charAt(matchup.length - 1).toUpperCase()
  );
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
          titleText.classList.remove("dimmed"); // Remove dimmed style if applicable
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
          commentInput.value = DOMPurify.sanitize(build.comment) || "";
        }

        // ✅ **Validate build order**
        const validBuildOrder = Array.isArray(build.buildOrder)
          ? build.buildOrder.filter(
              (step) => step && step.workersOrTimestamp && step.action
            ) // Remove invalid steps
          : [];

        // ✅ **Prevent undefined values in build order input**
        const buildOrderInput = document.getElementById("buildOrderInput");
        if (buildOrderInput) {
          buildOrderInput.value = validBuildOrder.length
            ? validBuildOrder
                .map((step) => `[${step.workersOrTimestamp}] ${step.action}`)
                .join("\n")
            : "No build order available."; // Default message if empty
        }

        // ✅ **Pass only valid build steps to `displayBuildOrder()`**
        displayBuildOrder(validBuildOrder);

        closeModal();
      } else {
        console.error("No such build found.");
      }
    })
    .catch((error) => {
      console.error("Error loading build:", error);
    });
}

// Helper to recreate missing elements
function recreateInput(id) {
  const input = document.createElement("input");
  input.id = id;
  document.body.appendChild(input); // Adjust this to append to the correct parent
  return input;
}

function recreateText(id) {
  const text = document.createElement("span");
  text.id = id;
  document.body.appendChild(text); // Adjust this to append to the correct parent
  return text;
}

function recreateDropdown(id) {
  const dropdown = document.createElement("select");
  dropdown.id = id;
  document.body.appendChild(dropdown); // Adjust this to append to the correct parent
  return dropdown;
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

  // Prevent multiple simultaneous population calls.
  if (isPopulatingBuildList) return;
  isPopulatingBuildList = true;

  // Clear the current list
  buildList.innerHTML = "";

  // If no filtered builds are provided, fetch all builds
  const builds = filteredBuilds || (await fetchUserBuilds());

  if (!builds.length) {
    buildList.innerHTML = "<p>No builds available.</p>";
    isPopulatingBuildList = false;
    return;
  }

  let lastHoveredBuild = null; // Track the last hovered build
  const fragment = document.createDocumentFragment();

  builds.forEach((build) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");

    // Determine the background image based on the match-up
    const matchup = build.subcategory || "unknown";
    const backgroundImageUrl = `../img/frames/${matchup.toLowerCase()}.webp`;
    buildCard.style.backgroundImage = `url("${backgroundImageUrl}")`;

    buildCard.innerHTML = `
      <div class="card-header">
        <h4>${DOMPurify.sanitize(build.title)}</h4>
        <button class="delete-build-btn" data-tooltip="Delete Build" title="Delete Build">&times;</button>
        <div class="delete-bg"></div>
      </div>
      <p class="matchup-text">${DOMPurify.sanitize(formatMatchup(matchup))}</p>
    `;

    // Add hover functionality for preview
    buildCard.addEventListener("mouseover", () => {
      if (lastHoveredBuild !== build) {
        updateBuildPreview(build);
        lastHoveredBuild = build;
      }
    });

    // Add view build functionality
    buildCard.addEventListener("click", () => viewBuild(build.id));

    // Add delete functionality
    const deleteButton = buildCard.querySelector(".delete-build-btn");
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation(); // Prevent card click from firing
      const confirmation = confirm(
        `Are you sure you want to delete the build "${build.title}"?`
      );
      if (confirmation) {
        await deleteBuildFromFirestore(build.id); // Delete from Firestore
        const updatedBuilds = await fetchUserBuilds(); // Fetch updated build list
        populateBuildList(updatedBuilds); // Refresh the list
      }
    });

    fragment.appendChild(buildCard);
  });

  buildList.appendChild(fragment);
  isPopulatingBuildList = false;
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

function clearBuildPreview() {
  const buildPreview = document.getElementById("buildPreview");

  if (!buildPreview) {
    console.error("Build preview element not found.");
    return;
  }

  buildPreview.innerHTML = "<p>Hover over a build to see its details here.</p>";
}

// Helper function to update the preview
function updatePreview(build, buildPreview) {
  buildPreview.innerHTML = `
    <h4>${build.title}</h4>
    <p>${build.comment || "No comments available."}</p>
    <pre>${build.buildOrder
      .map((step) => `[${step.workersOrTimestamp}] ${step.action}`)
      .join("\n")}</pre>
    ${
      build.videoLink
        ? `<iframe src="${build.videoLink}" frameborder="0" allowfullscreen></iframe>`
        : ""
    }
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
