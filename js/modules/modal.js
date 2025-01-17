import { getSavedBuilds } from "./buildStorage.js";
import { displayBuildOrder } from "./uiHandlers.js";
import { updateYouTubeEmbed } from "./youtube.js";

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
