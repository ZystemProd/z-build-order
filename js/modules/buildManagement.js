import {
  getSavedBuilds,
  setSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";
import { filterBuilds } from "./uiHandlers.js";

export function saveCurrentBuild() {
  const titleInput = document.getElementById("buildOrderTitleInput");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");

  const title = titleInput.value.trim();
  const comment = commentInput.value.trim();
  const videoLink = videoInput.value.trim();
  const buildOrder = buildOrderInput.value.trim();

  if (!title) {
    alert("Please provide a title for the build.");
    return;
  }

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
  alert("Build saved successfully!");
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
    alert("No file selected.");
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

      alert("Builds loaded successfully!");
      console.log("load 1st");
      filterBuilds("all");
    } catch (error) {
      alert(`Error loading builds: ${error.message}`);
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

  alert("All builds have been removed.");
}

export function deleteBuild(index, savedBuilds, filterBuilds) {
  if (!confirm("Are you sure you want to delete this build?")) {
    return;
  }

  savedBuilds.splice(index, 1);
  localStorage.setItem("savedBuilds", JSON.stringify(savedBuilds));
  filterBuilds("all");
  alert("Build deleted successfully!");
}

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
