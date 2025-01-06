import { getSavedBuilds } from "./buildStorage.js";

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
