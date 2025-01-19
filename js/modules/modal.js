import { displayBuildOrder, showToast } from "./uiHandlers.js";
import { updateYouTubeEmbed } from "./youtube.js";
import { saveBuilds, getSavedBuilds } from "./buildStorage.js";

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
    const savedBuilds = getSavedBuilds();
    if (index >= 0 && index < savedBuilds.length) {
      savedBuilds.splice(index, 1); // Remove the build
      saveBuilds(savedBuilds); // Save updated builds to storage
      showAllBuilds(); // Refresh build cards
      showBuildsModal();
    }
    deleteModal.style.display = "none"; // Close the modal
  };

  // Handle cancellation
  cancelButton.onclick = () => {
    deleteModal.style.display = "none";
  };
}

function deleteBuild(index) {
  const builds = getSavedBuilds();
  builds.splice(index, 1); // Remove the selected build
  setSavedBuilds(builds);
  saveSavedBuildsToLocalStorage();
  showBuildsModal(); // Refresh the modal content
}

// Ensure the function is globally accessible for inline onclick handlers
window.deleteBuild = deleteBuild;

export function viewBuild(index) {
  const savedBuilds = getSavedBuilds(); // Retrieve builds
  const build = savedBuilds[index];
  if (!build) return;

  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");

  // Update the title input and text display
  titleInput.value = build.title;
  titleText.textContent = build.title;
  titleText.classList.remove("dimmed");

  // Populate the match-up dropdown
  if (build.category) {
    categoryDropdown.value = build.category;
    const selectedOption =
      categoryDropdown.options[categoryDropdown.selectedIndex];
    const optgroup = selectedOption.parentElement;

    // Update the dropdown text color to match the selected category
    if (optgroup && optgroup.style.color) {
      categoryDropdown.style.color = optgroup.style.color;
    }
  }

  // Populate comment and video link
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");

  commentInput.value = build.comment || ""; // Populate comment
  videoInput.value = build.videoLink || ""; // Populate video link

  // Update the YouTube embed with the new video link
  if (build.videoLink) {
    updateYouTubeEmbed(build.videoLink);
  }

  // Populate build order input as a formatted string
  const buildOrderInput = document.getElementById("buildOrderInput");
  const formattedBuildOrder = build.buildOrder
    .map(
      (step) =>
        `[${step.workersOrTimestamp}] ${step.action.replace(
          /<\/?[^>]+(>|$)/g,
          ""
        )}`
    )
    .join("\n");
  buildOrderInput.value = formattedBuildOrder;

  // Populate the build order table
  displayBuildOrder(build.buildOrder);

  closeModal();
}

window.viewBuild = viewBuild;

export function showAllBuilds() {
  const modal = document.getElementById("buildsModal");
  const buildsContainer = document.getElementById("modalBuildsContainer");

  buildsContainer.innerHTML = ""; // Clear existing builds

  const savedBuilds = getSavedBuilds(); // Retrieve builds from storage

  savedBuilds.forEach((build, index) => {
    const buildElement = document.createElement("div");
    buildElement.classList.add("build-card");

    buildElement.innerHTML = `
      <div class="delete-icon" onclick="deleteBuild(${index})">×</div>
      <h4 class="build-card-title">${build.title}</h4>
      <button onclick="viewBuild(${index})">View</button>
    `;

    buildsContainer.appendChild(buildElement);
  });

  modal.style.display = "block"; // Show the modal
}

// Close the modal
export function closeModal() {
  const modal = document.getElementById("buildsModal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Function to open the modal
export function openModal() {
  const modal = document.getElementById("buildsModal");
  modal.style.display = "block";
  filterBuilds("all"); // Default to show all builds
}

export function showSubcategories(category) {
  const subcategories = document.querySelectorAll(".subcategory-container");
  subcategories.forEach((container) => {
    container.style.display = "none"; // Hide all subcategories
  });

  const activeSubcategory = document.querySelector(
    `.subcategory-container.${category}`
  );
  if (activeSubcategory) {
    activeSubcategory.style.display = "block";
  }
}

import {
  getSavedBuilds,
  setSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";

export function showBuildsModal() {
  const buildsModal = document.getElementById("buildsModal");
  const buildListContainer = document.getElementById("buildList");
  buildListContainer.innerHTML = ""; // Clear the list before populating

  const builds = getSavedBuilds();

  builds.forEach((build, index) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("template-card");

    buildCard.innerHTML = `
      <div class="delete-icon" onclick="deleteBuild(${index})">&times;</div>
      <h4>${build.title || "Untitled Build"}</h4>
      <p>${build.description || "No description provided"}</p>
    `;

    buildCard.addEventListener("click", () => loadBuild(build));
    buildListContainer.appendChild(buildCard);
  });

  buildsModal.style.display = "block";
}

export function hideBuildsModal() {
  const buildsModal = document.getElementById("buildsModal");
  buildsModal.style.display = "none";
}

function loadBuild(build) {
  // Logic to load the selected build into the application
  console.log("Loading build:", build);
}
