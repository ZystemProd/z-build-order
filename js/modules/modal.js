import { displayBuildOrder, showToast } from "./uiHandlers.js";
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import {
  getSavedBuilds,
  saveBuilds,
  deleteBuildFromStorage,
} from "./buildStorage.js";

export function deleteBuild(index) {
  const deleteModal = document.getElementById("deleteConfirmationModal");
  const confirmButton = document.getElementById("confirmDeleteButton");
  const cancelButton = document.getElementById("cancelDeleteButton");

  // Show the confirmation modal
  deleteModal.style.display = "flex";

  // Automatically focus on the "Yes" button
  confirmButton.focus();

  // Handle confirmation
  confirmButton.onclick = () => {
    if (index >= 0 && index < getSavedBuilds().length) {
      deleteBuildFromStorage(index); // Use the modular delete function
      showAllBuilds(); // Refresh build cards
    }
    deleteModal.style.display = "none"; // Close the modal
  };

  // Handle cancellation
  cancelButton.onclick = () => {
    deleteModal.style.display = "none";
  };
}
/*
function deleteBuild(index) {
  const builds = getSavedBuilds();
  builds.splice(index, 1); // Remove the selected build
  setSavedBuilds(builds);
  saveSavedBuildsToLocalStorage();
  showBuildsModal(); // Refresh the modal content
}
*/

export function viewBuild(index) {
  const savedBuilds = getSavedBuilds(); // Retrieve saved builds
  const build = savedBuilds[index];

  if (!build) {
    console.error(`Build with index ${index} not found.`);
    return;
  }

  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");

  // Update the title input and text display
  titleInput.value = build.title;
  titleText.textContent = build.title;
  titleText.classList.remove("dimmed");

  // Populate match-up dropdown and apply the selected category's color
  if (build.subcategory) {
    categoryDropdown.value = build.subcategory;
    const selectedOption =
      categoryDropdown.options[categoryDropdown.selectedIndex];
    const optgroup = selectedOption?.parentElement;

    if (optgroup?.style.color) {
      categoryDropdown.style.color = optgroup.style.color;
    }
  }

  // Populate comment and video link
  commentInput.value = build.comment || "";
  videoInput.value = build.videoLink || "";

  // Update the YouTube embed if a video link exists
  if (build.videoLink) {
    updateYouTubeEmbed(build.videoLink);
  } else {
    clearYouTubeEmbed(); // Clear embed if no link exists
  }

  // Format build order as a string
  const formattedBuildOrder = build.buildOrder
    .map((step) => `[${step.workersOrTimestamp}] ${sanitizeHTML(step.action)}`)
    .join("\n");
  buildOrderInput.value = formattedBuildOrder;

  // Populate build order table
  displayBuildOrder(build.buildOrder);

  closeModal();
}

// Helper to sanitize potentially unsafe HTML input
function sanitizeHTML(str) {
  const tempDiv = document.createElement("div");
  tempDiv.textContent = str;
  return tempDiv.innerHTML;
}

window.viewBuild = viewBuild;

export function showAllBuilds() {
  openModal("buildsModal"); // Open the builds modal
  populateBuildList(getSavedBuilds()); // Populate the build list using the saved builds
}

// Close the modal
export function closeModal() {
  const modal = document.getElementById("buildsModal");
  if (modal) {
    modal.style.display = "none";
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
window.showAllBuilds = showAllBuilds;

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

export function showBuildsModal() {
  const buildModal = document.getElementById("buildModal");
  const buildList = document.getElementById("buildList");
  const buildPreview = document.getElementById("buildPreview");

  if (!buildModal || !buildList || !buildPreview) {
    console.error("Build modal elements not found!");
    return;
  }

  // Populate the build list
  populateBuildList();

  // Display the modal
  buildModal.style.display = "block";

  // Close modal logic
  document.getElementById("closeBuildModal").onclick = () => {
    buildModal.style.display = "none";
  };

  // Close modal on clicking outside
  window.onclick = (event) => {
    if (event.target === buildModal) {
      buildModal.style.display = "none";
    }
  };
}

export function populateBuildList(builds = getSavedBuilds()) {
  const buildList = document.getElementById("buildList");
  const buildPreview = document.getElementById("buildPreview");

  if (!buildList || !buildPreview) {
    console.error("Build modal elements not found!");
    return;
  }

  buildList.innerHTML = ""; // Clear existing builds

  // Create a document fragment for performance
  const fragment = document.createDocumentFragment();

  builds.forEach((build, index) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");

    // Add category and subcategory attributes for filtering
    buildCard.setAttribute("data-category", build.category || "undefined");
    buildCard.setAttribute(
      "data-subcategory",
      build.subcategory || "undefined"
    );

    buildCard.innerHTML = `
      <h4>${build.title}</h4>
      <p>${build.comment || "No comments provided."}</p>
    `;

    // Hover to show preview
    buildCard.onmouseover = () => updatePreview(build, buildPreview);

    // Click to view the build
    buildCard.onclick = () => viewBuild(index);

    fragment.appendChild(buildCard);
  });

  buildList.appendChild(fragment);
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

export function filterBuilds(categoryOrSubcategory) {
  const savedBuilds = getSavedBuilds();

  console.log("All saved builds:", savedBuilds);
  console.log("Filter category or subcategory:", categoryOrSubcategory);

  // Filter builds based on category or subcategory
  const filteredBuilds = savedBuilds.filter((build) => {
    if (categoryOrSubcategory === "all") {
      return true; // Show all builds
    }

    // Match by subcategory first
    if (
      ["zvz", "zvp", "zvt", "pvp", "pvz", "pvt", "tvt", "tvz", "tvp"].includes(
        categoryOrSubcategory.toLowerCase()
      )
    ) {
      return build.subcategory === categoryOrSubcategory.toLowerCase();
    }

    // Otherwise, match by category
    return build.category.toLowerCase() === categoryOrSubcategory.toLowerCase();
  });

  console.log("Filtered builds:", filteredBuilds);

  populateBuildList(filteredBuilds); // Refresh the displayed builds
}

function searchBuilds(query) {
  const lowerCaseQuery = query.toLowerCase();
  const filteredBuilds = getSavedBuilds().filter((build) =>
    build.title.toLowerCase().includes(lowerCaseQuery)
  );
  populateBuildList(filteredBuilds);
}

export { closeBuildsModal };
