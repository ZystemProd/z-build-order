import {
  getSavedBuilds,
  setSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";
import { showToast } from "./uiHandlers.js";
import { filterBuilds } from "./modal.js";
export function saveCurrentBuild() {
  const titleInput = document.getElementById("buildOrderTitleInput");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");

  const title = titleInput.value.trim();
  const comment = commentInput.value.trim();
  const videoLink = videoInput.value.trim();
  const buildOrderText = buildOrderInput.value.trim();

  if (!title) {
    showToast("Please provide a title for the build.", "error");
    return;
  }

  // Parse the build order input into an array of objects
  const buildOrder = buildOrderText.split("\n").map((line) => {
    const match = line.match(/\[(.*?)\]\s*(.*)/);
    return match
      ? {
          workersOrTimestamp: match[1],
          action: match[2],
        }
      : { workersOrTimestamp: "", action: line };
  });

  const savedBuilds = getSavedBuilds();
  const existingIndex = savedBuilds.findIndex((build) => build.title === title);

  const newBuild = {
    title,
    comment,
    videoLink,
    buildOrder,
    category: document.getElementById("buildCategoryDropdown").value,
    timestamp: Date.now(),
  };

  if (existingIndex !== -1) {
    if (
      confirm(`A build with the title "${title}" already exists. Overwrite it?`)
    ) {
      savedBuilds[existingIndex] = newBuild;
    } else {
      return;
    }
  } else {
    savedBuilds.push(newBuild);
  }

  setSavedBuilds(savedBuilds);
  saveSavedBuildsToLocalStorage();
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
