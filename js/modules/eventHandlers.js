import {
  saveCurrentBuild,
  loadBuildsFromFile,
  removeAllBuilds,
  saveBuildsToFile,
} from "./buildManagement.js";
import {
  getSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";
import {
  updateYouTubeEmbed,
  toggleTitleInput,
  filterBuilds,
} from "./uiHandlers.js";
import {
  showAllBuilds,
  closeModal,
  showSubcategories,
  openModal,
} from "./modal.js";

// Initialize event listeners
export function initializeEventListeners() {
  // Build management buttons
  document.getElementById("saveBuildButton").addEventListener("click", () => {
    const savedBuilds = JSON.parse(localStorage.getItem("savedBuilds")) || [];
    saveCurrentBuild(savedBuilds, filterBuilds);
  });

  document
    .getElementById("showBuildsButton")
    .addEventListener("click", showAllBuilds);

  document
    .getElementById("removeAllBuildsButton")
    .addEventListener("click", () => {
      const savedBuilds = getSavedBuilds();
      removeAllBuilds(savedBuilds, modalBuildsContainer);
      saveSavedBuildsToLocalStorage();
    });

  document
    .getElementById("loadBuildsInput")
    .addEventListener("change", (event) => {
      const savedBuilds = JSON.parse(localStorage.getItem("savedBuilds")) || [];
      loadBuildsFromFile(event, savedBuilds, filterBuilds);
    });

  // Input interactions
  document
    .getElementById("buildOrderInput")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault(); // Prevent the default behavior of adding a new line

        const textarea = event.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const text = textarea.value;

        // Insert a new row with brackets "[]" at the cursor position
        const newText = text.slice(0, start) + "\n[]" + text.slice(end);

        textarea.value = newText;
        textarea.selectionStart = textarea.selectionEnd = start + 3; // Place cursor inside the brackets
      }
    });

  // Dropdown styling
  document
    .getElementById("buildCategoryDropdown")
    .addEventListener("change", function () {
      const dropdown = this;
      const selectedOption = dropdown.options[dropdown.selectedIndex];
      const optgroup = selectedOption.parentElement;

      // Apply the color of the optgroup to the dropdown
      if (optgroup && optgroup.style.color) {
        dropdown.style.color = optgroup.style.color;
      }
    });

  // Video embed updates
  document
    .getElementById("videoInput")
    .addEventListener("input", updateYouTubeEmbed);

  // Section toggle logic
  document.querySelectorAll(".toggle-title").forEach((header) => {
    header.addEventListener("click", () => {
      const sectionId = header.getAttribute("data-section");
      const section = document.getElementById(sectionId);
      const arrow = header.querySelector(".arrow");

      if (section.style.display === "none" || !section.style.display) {
        section.style.display = "block";
        arrow.classList.add("open"); // Rotate arrow down
      } else {
        section.style.display = "none";
        arrow.classList.remove("open"); // Rotate arrow right
      }
    });
  });
}

export function initializeModalEventListeners() {
  // Close modal when clicking outside of it
  window.addEventListener("click", (event) => {
    const modal = document.getElementById("buildsModal");
    if (event.target === modal) {
      closeModal();
    }
  });

  // Close modal when clicking the close button
  document
    .getElementById("closeModalButton")
    ?.addEventListener("click", closeModal);

  document.querySelectorAll(".category").forEach((element) => {
    element.addEventListener("mouseover", (event) => {
      const categoryId = event.currentTarget.dataset.categoryId; // Adjust to your HTML structure
      showSubcategories(categoryId);
    });
  });
}
