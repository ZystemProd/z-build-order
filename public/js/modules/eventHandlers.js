import { auth } from "../../app.js";
import { saveCurrentBuild } from "./buildManagement.js";
import { initializeAutoCorrect } from "./autoCorrect.js";
import { populateBuildDetails, analyzeBuildOrder } from "./uiHandlers.js";
import { updateYouTubeEmbed } from "./youtube.js";
import {
  closeModal,
  showSubcategories,
  filterBuilds,
  searchBuilds,
} from "./modal.js";
import {
  MapAnnotations,
  initializeMapControls,
  initializeMapSelection,
  mapAnnotations,
} from "./interactive_map.js";
import {
  initializeSectionToggles,
  initializeTextareaClickHandler,
} from "./uiHandlers.js";
import {
  showTemplatesModal,
  setupTemplateModal,
  showSaveTemplateModal,
  searchTemplates,
} from "./template.js";
import { initializeTooltips } from "./tooltip.js";
import {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
  searchCommunityBuilds,
} from "./community.js";
import { populateBuildsModal } from "./buildManagement.js"; // ✅ Corrected import

setupTemplateModal();

document.addEventListener("DOMContentLoaded", initializeAutoCorrect);

// Initialize event listeners
export function initializeEventListeners() {
  console.log("Initializing event listeners..."); // Debugging
  document
    .getElementById("templateSearchBar")
    .addEventListener("input", (event) => {
      const query = event.target.value;
      searchTemplates(query);
    });

  document
    .getElementById("openTemplatesButton")
    .addEventListener("click", showTemplatesModal);

  document
    .getElementById("saveTemplateButton")
    .addEventListener("click", () => {
      showSaveTemplateModal();
    });

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

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".filter-category").forEach((category) => {
      category.addEventListener("mouseover", () => {
        const submenu = category.querySelector(".submenu");
        if (submenu) {
          submenu.style.display = "block";
        }
      });

      category.addEventListener("mouseout", () => {
        const submenu = category.querySelector(".submenu");
        if (submenu) {
          submenu.style.display = "none";
        }
      });
    });
  });

  const buildSearchBar = document.getElementById("buildSearchBar");
  if (buildSearchBar) {
    buildSearchBar.addEventListener("input", (event) => {
      const query = DOMPurify.sanitize(event.target.value.trim());
      searchBuilds(query);
    });
  }

  // Template Search Bar
  const templateSearchBar = document.getElementById("templateSearchBar");
  if (templateSearchBar) {
    templateSearchBar.addEventListener("input", (event) => {
      const query = DOMPurify.sanitize(event.target.value.trim());
      searchTemplates(query);
    });
  }

  // Community Search Bar
  const communitySearchBar = document.getElementById("communitySearchBar");
  if (communitySearchBar) {
    communitySearchBar.addEventListener("input", (event) => {
      const query = DOMPurify.sanitize(event.target.value.trim());
      searchCommunityBuilds(query);
    });
  }

  // Handle Category Click
  document.querySelectorAll(".filter-category").forEach((element) => {
    element.addEventListener("click", () => {
      const category = DOMPurify.sanitize(
        element.getAttribute("data-category")
      );
      if (category) {
        if (buildSearchBar) buildSearchBar.value = ""; // Clear search bar
        filterBuilds(category);

        // Highlight active category
        document
          .querySelectorAll(".filter-category")
          .forEach((el) => el.classList.remove("active"));
        element.classList.add("active");
      }
    });
  });

  // Handle Subcategory Click
  document.querySelectorAll(".subcategory").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent triggering parent category click
      const subcategory = DOMPurify.sanitize(
        element.getAttribute("data-subcategory")
      );
      if (subcategory) {
        if (buildSearchBar) buildSearchBar.value = ""; // Clear search bar
        filterBuilds(subcategory);

        // Highlight active subcategory
        document
          .querySelectorAll(".subcategory")
          .forEach((el) => el.classList.remove("active"));
        element.classList.add("active");
      }
    });
  });

  document.getElementById("closeBuildsModal").addEventListener("click", () => {
    closeBuildsModal();
  });

  // Save Build
  document.getElementById("saveBuildButton").addEventListener("click", () => {
    console.log("Save button clicked!"); // Debugging
    saveCurrentBuild();
  });

  // Update YouTube Embed
  document.getElementById("videoInput").addEventListener("input", (event) => {
    const videoLink = event.target.value.trim(); // Extract the input value
    updateYouTubeEmbed(videoLink); // Pass the extracted value
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

document.addEventListener("DOMContentLoaded", () => {
  initializeTextareaClickHandler();
});

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

document.addEventListener("DOMContentLoaded", () => {
  const mapPreviewContainer = document.getElementById("map-preview-container");
  const mapSelectionModal = document.getElementById("mapSelectionModal");
  const mapPreviewImage = document.getElementById("map-preview-image");

  // Track whether a map is selected
  let isMapSelected = false;

  if (mapPreviewContainer && mapSelectionModal) {
    mapPreviewContainer.addEventListener("click", () => {
      // Open modal only if no map is selected
      if (!isMapSelected) {
        mapSelectionModal.style.display = "block";
      }
    });

    // Example: Set the state when a map is selected
    document
      .querySelector(".builds-container")
      .addEventListener("click", (event) => {
        const mapCard = event.target.closest(".map-card");
        if (mapCard) {
          const mapImageSrc = DOMPurify.sanitize(
            mapCard.getAttribute("data-map")
          );
          const mapName = DOMPurify.sanitize(
            mapCard.querySelector(".map-card-title").innerText
          );

          // Update the map preview
          mapPreviewImage.src = mapImageSrc;
          mapPreviewImage.style.display = "block";
          document.getElementById("selected-map-text").innerText = `${mapName}`;

          // Set the map as selected
          isMapSelected = true;

          // Close the modal
          mapSelectionModal.style.display = "none";
        }
      });

    // Optional: Close modal when clicking outside
    window.addEventListener("click", (event) => {
      if (event.target === mapSelectionModal) {
        mapSelectionModal.style.display = "none";
      }
    });
  } else {
    console.error("Map Preview Container or Map Selection Modal not found!");
  }
});

document
  .getElementById("closeBuildsModal")
  .addEventListener("click", closeBuildsModal);

document.addEventListener("DOMContentLoaded", () => {
  populateBuildDetails();
});

document.addEventListener("DOMContentLoaded", () => {
  initializeSectionToggles(); // Ensure toggles are attached globally

  document
    .getElementById("videoInput")
    .addEventListener("input", updateYouTubeEmbed);
});

document.addEventListener("DOMContentLoaded", () => {
  // Initialize map controls and selection only once
  initializeMapControls(mapAnnotations);
  initializeMapSelection(mapAnnotations);
});

document.addEventListener("DOMContentLoaded", () => {
  // Initialize tooltips
  initializeTooltips();
});

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🔥 Loading community and user builds...");
  await populateCommunityBuilds();
  await populateBuildsModal(); // ✅ Ensure builds are loaded after importing
});

document
  .getElementById("showCommunityModalButton")
  .addEventListener("click", () => {
    document.getElementById("communityModal").style.display = "block";
    populateCommunityBuilds();
  });

document.getElementById("closeCommunityModal").addEventListener("click", () => {
  document.getElementById("communityModal").style.display = "none";
});

document.addEventListener("DOMContentLoaded", () => {
  checkPublishButtonVisibility(); // Ensure button is checked on page load
});

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("buildOrderInput")
    .addEventListener("input", (event) => {
      analyzeBuildOrder(event.target.value);
    });
});

// Then enable it when DOM is fully loaded and auth is resolved
document.addEventListener("DOMContentLoaded", () => {
  // Check if auth is ready or wait for onAuthStateChanged
  auth.onAuthStateChanged((user) => {
    if (user) {
      document.getElementById("showCommunityModalButton").disabled = false;
    }
  });
});
