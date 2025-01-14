import {
  saveCurrentBuild,
  saveBuildsToFile,
  loadBuildsFromFile,
  removeAllBuilds,
} from "./buildManagement.js";
import { initializeAutoCorrect } from "./textFormatters.js";

import {
  getSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";

import { populateBuildDetails, analyzeBuildOrder } from "./uiHandlers.js";

import { updateYouTubeEmbed } from "./youtube.js";

import { showAllBuilds, closeModal, showSubcategories } from "./modal.js";

import { MapAnnotations, initializeMapControls } from "./interactive_map.js";

import { initializeSectionToggles } from "./uiHandlers.js";
document.addEventListener("DOMContentLoaded", initializeAutoCorrect);
// Initialize event listeners
export function initializeEventListeners() {
  // Initialize autocomplete
  //document.addEventListener("DOMContentLoaded", initializeAutoCorrect);

  document
    .getElementById("buildCategoryDropdown")
    .addEventListener("change", function () {
      const dropdown = this;
      const selectedValue = dropdown.value;

      if (!selectedValue) {
        // Handle cases where no match-up is selected
        console.warn("No match-up selected.");
        return;
      }

      // Proceed with normal logic for selected match-up
      console.log(`Selected match-up: ${selectedValue}`);
    });

  window.showSubcategories = showSubcategories;

  document
    .getElementById("buildCategoryTabs")
    .addEventListener("mouseleave", () => {
      const subcategories = document.querySelectorAll(".subcategory-container");
      subcategories.forEach((container) => {
        container.style.display = "none"; // Hide all subcategories
      });
    });

  // Automatically trigger analysis when the user types in the buildOrderInput field
  document
    .getElementById("buildOrderInput")
    .addEventListener("input", (event) => {
      analyzeBuildOrder(event.target.value);
    });

  document.getElementById("loadBuildsButton").addEventListener("click", () => {
    document.getElementById("loadBuildsInput").click();
  });

  // Save Build
  document.getElementById("saveBuildButton").addEventListener("click", () => {
    saveCurrentBuild();
  });
  // Save Builds from File
  document
    .getElementById("exportBuildsButton")
    .addEventListener("click", () => {
      const savedBuilds = getSavedBuilds(); // Retrieve all saved builds
      saveBuildsToFile(savedBuilds); // Call the function to save builds to a file
    });

  // Load Builds from File
  document
    .getElementById("loadBuildsInput")
    .addEventListener("change", (event) => {
      loadBuildsFromFile(event);
    });

  // Remove All Builds
  document
    .getElementById("removeAllBuildsButton")
    .addEventListener("click", () => {
      const savedBuilds = getSavedBuilds();
      removeAllBuilds(savedBuilds);
      saveSavedBuildsToLocalStorage();
    });

  // Update YouTube Embed
  document
    .getElementById("videoInput")
    .addEventListener("input", updateYouTubeEmbed);
  /*
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
*/
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
  /*
  document
    .getElementById("videoInput")
    .addEventListener("input", updateYouTubeEmbed);
*/
  // Section toggle logic
  document.addEventListener("DOMContentLoaded", () => {
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
/*
// Interactive Map
document.addEventListener("DOMContentLoaded", () => {
  const mapAnnotations = new MapAnnotations(
    "map-preview-image",
    "map-annotations"
  );

  // Pass mapAnnotations to initializeMapControls
  initializeMapControls(mapAnnotations);
});
*/

// Initialize the toggle functionality for sections
/*
document.addEventListener("DOMContentLoaded", () => {
  initializeSectionToggles();
});
*/

document.addEventListener("DOMContentLoaded", () => {
  populateBuildDetails();
});

document.addEventListener("DOMContentLoaded", () => {
  initializeSectionToggles(); // Ensure toggles are attached globally

  const mapAnnotations = new MapAnnotations(
    "map-preview-image",
    "map-annotations"
  );
  initializeMapControls(mapAnnotations); // Pass mapAnnotations for map controls

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
    .getElementById("videoInput")
    .addEventListener("input", updateYouTubeEmbed);
});
