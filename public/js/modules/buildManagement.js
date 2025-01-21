import {
  getSavedBuilds,
  setSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";
import { showToast } from "./uiHandlers.js";
import { filterBuilds } from "./modal.js";

import { parseBuildOrder } from "./utils.js";

export function saveCurrentBuild() {
  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");

  const title = titleInput.value.trim();
  const comment = commentInput.value.trim();
  const videoLink = videoInput.value.trim();
  const buildOrderText = buildOrderInput.value.trim();
  const selectedMatchup = categoryDropdown.value;

  // Missing title handling
  if (!title) {
    // Highlight the title input
    titleText.classList.add("highlight");
    console.log("Adding highlight to title input.");
    showToast("Please provide a title for the build.", "error");

    // Remove the highlight on user interaction
    const stopHighlight = () => {
      titleText.classList.remove("highlight");
      titleText.removeEventListener("click", stopHighlight);
      titleText.removeEventListener("input", stopHighlight);
    };

    titleText.addEventListener("click", stopHighlight);
    titleText.addEventListener("input", stopHighlight);

    return;
  }

  if (!selectedMatchup) {
    // Highlight the match-up dropdown
    categoryDropdown.classList.add("highlight");
    showToast("Please select a match-up.", "error");

    // Remove the highlight on user interaction
    const stopHighlight = () => {
      categoryDropdown.classList.remove("highlight");
      categoryDropdown.removeEventListener("click", stopHighlight);
      categoryDropdown.removeEventListener("change", stopHighlight);
      categoryDropdown.removeEventListener("keydown", stopHighlight);
    };

    categoryDropdown.addEventListener("click", stopHighlight);
    categoryDropdown.addEventListener("change", stopHighlight);
    categoryDropdown.addEventListener("keydown", stopHighlight);

    return;
  }

  // Parse the build order using a helper function
  const buildOrder = parseBuildOrder(buildOrderText);
  if (buildOrder.length === 0) {
    showToast("Build order cannot be empty.", "error");
    return;
  }

  // Determine category and subcategory
  const category = selectedMatchup.startsWith("zv")
    ? "Zerg"
    : selectedMatchup.startsWith("pv")
    ? "Protoss"
    : "Terran";
  const subcategory = selectedMatchup;

  const newBuild = {
    title,
    comment,
    videoLink,
    buildOrder,
    category, // Race
    subcategory, // Match-up
    timestamp: Date.now(),
  };

  const savedBuilds = getSavedBuilds();
  const existingIndex = savedBuilds.findIndex((build) => build.title === title);

  if (existingIndex !== -1) {
    const overwrite = confirm(
      `A build with the title "${title}" already exists. Overwrite it?`
    );
    if (!overwrite) return;

    savedBuilds[existingIndex] = newBuild;
  } else {
    savedBuilds.push(newBuild);
  }

  setSavedBuilds(savedBuilds);
  showToast("Build saved successfully!", "success");
  filterBuilds("all");
}

// Save all builds to a JSON file
export function saveBuildsToFile(savedBuilds) {
  const blob = new Blob([JSON.stringify(savedBuilds, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "build_orders.json";
  downloadLink.click();
  URL.revokeObjectURL(url);
}

// Load builds from a file
export function loadBuildsFromFile(event) {
  const file = event.target.files[0];
  if (!file) {
    showToast("No file selected.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedBuilds = JSON.parse(e.target.result);

      importedBuilds.forEach((build) => {
        if (!build.title || !build.category) {
          throw new Error(
            "Invalid build format. Each build must include a title and category."
          );
        }
      });

      const savedBuilds = getSavedBuilds();
      savedBuilds.splice(0, savedBuilds.length, ...importedBuilds);
      saveSavedBuildsToLocalStorage(savedBuilds);

      showToast("Builds loaded successfully!", "success");
      filterBuilds("all");
    } catch (error) {
      showToast(`Error loading builds: ${error.message}`, "error");
    }
  };
  reader.readAsText(file);
}

// Function to remove all builds
export function removeAllBuilds(savedBuilds, modalBuildsContainer) {
  if (
    !confirm(
      "Are you sure you want to delete all builds? This action cannot be undone."
    )
  ) {
    return;
  }

  savedBuilds.length = 0;
  localStorage.removeItem("savedBuilds");

  if (modalBuildsContainer) {
    modalBuildsContainer.innerHTML = "";
  }

  showToast("All builds have been removed.", "success");
}

export function deleteBuild(index) {
  const deleteModal = document.getElementById("deleteConfirmationModal");
  const confirmButton = document.getElementById("confirmDeleteButton");
  const cancelButton = document.getElementById("cancelDeleteButton");

  // Show the confirmation modal
  deleteModal.style.display = "flex";
  confirmButton.focus();

  confirmButton.onclick = () => {
    const savedBuilds = getSavedBuilds();
    if (index >= 0 && index < savedBuilds.length) {
      savedBuilds.splice(index, 1); // Remove build
      saveBuilds(savedBuilds); // Save changes
      showBuildsModal(); // Refresh modal content
    }
    deleteModal.style.display = "none"; // Close modal
  };

  cancelButton.onclick = () => {
    deleteModal.style.display = "none"; // Close modal
  };
}

// Ensure the function is globally accessible for inline onclick handlers
window.deleteBuild = deleteBuild;

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
