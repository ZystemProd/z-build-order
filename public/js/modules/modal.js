import {
  getDoc,
  doc,
  getFirestore,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { displayBuildOrder, showToast } from "./uiHandlers.js";
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import {
  getSavedBuilds,
  saveBuilds,
  deleteBuildFromStorage,
} from "./buildStorage.js";
import { fetchUserBuilds } from "./buildManagement.js";
import { mapAnnotations } from "./interactive_map.js";

export async function deleteBuildFromFirestore(buildId) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    showToast("You must be signed in to delete a build.", "error");
    return;
  }

  try {
    const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    await deleteDoc(buildRef);
    showToast("Build deleted successfully!", "success");

    // Refresh the build list
    populateBuildList();
  } catch (error) {
    console.error("Error deleting build:", error);
    showToast("Failed to delete the build. Please try again.", "error");
  }
}

// Helper to sanitize potentially unsafe HTML input
function sanitizeHTML(str) {
  const tempDiv = document.createElement("div");
  tempDiv.textContent = str;
  return tempDiv.innerHTML;
}

export function viewBuild(buildId) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    return;
  }

  const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
  getDoc(buildRef)
    .then((docSnap) => {
      if (docSnap.exists()) {
        const build = docSnap.data();
        const mapImage = document.getElementById("map-preview-image");
        console.log("Loaded build:", build);

        // Check for mandatory fields
        if (!build.title || !build.subcategory) {
          console.error(
            "Mandatory fields (Title or Match-Up) are missing in the build data."
          );
          showToast(
            "This build cannot be viewed due to missing mandatory fields.",
            "error"
          );
          return;
        }

        // Display the selected map
        if (build.map) {
          mapImage.src = build.map; // Set map image source
        }

        if (build.interactiveMap) {
          // Clear existing annotations and DOM elements
          mapAnnotations.circles = [];
          mapAnnotations.annotationsContainer.innerHTML = "";

          // Load circles
          build.interactiveMap.circles.forEach(({ x, y }) => {
            mapAnnotations.createCircle(x, y);
          });

          // Load arrows (Insert your code here)
          if (build.interactiveMap.arrows) {
            console.log("Arrow Data Loaded:", build.interactiveMap.arrows);
            build.interactiveMap.arrows.forEach(
              ({ startX, startY, endX, endY }) => {
                console.log("Creating Arrow:", { startX, startY, endX, endY });
                mapAnnotations.createArrow(startX, startY, endX, endY);
              }
            );
          }

          // Recalculate numbering to ensure consistency
          mapAnnotations.updateCircleNumbers();
        }

        // Retrieve or recreate DOM elements
        const titleInput =
          document.getElementById("buildOrderTitleInput") ||
          recreateInput("buildOrderTitleInput");
        const titleText =
          document.getElementById("buildOrderTitleText") ||
          recreateText("buildOrderTitleText");
        const categoryDropdown =
          document.getElementById("buildCategoryDropdown") ||
          recreateDropdown("buildCategoryDropdown");
        const commentInput =
          document.getElementById("commentInput") ||
          recreateInput("commentInput");
        const videoInput =
          document.getElementById("videoInput") || recreateInput("videoInput");
        const buildOrderInput =
          document.getElementById("buildOrderInput") ||
          recreateInput("buildOrderInput");

        // Populate title
        titleInput.value = build.title || "";
        titleText.textContent = build.title || "";
        titleText.classList.remove("dimmed");

        // Populate match-up dropdown
        categoryDropdown.value = build.subcategory || "";

        // Populate comment and video link
        commentInput.value = build.comment || "";
        videoInput.value = build.videoLink || "";

        // Update YouTube embed
        if (build.videoLink) {
          updateYouTubeEmbed(build.videoLink);
        } else {
          clearYouTubeEmbed();
        }

        // Populate build order
        const formattedBuildOrder = build.buildOrder
          .map((step) => `[${step.workersOrTimestamp}] ${step.action}`)
          .join("\n");
        buildOrderInput.value = formattedBuildOrder;

        // Update build order table
        displayBuildOrder(build.buildOrder);

        // Close the modal
        closeModal();
      } else {
        console.error("No such build found.");
      }
    })
    .catch((error) => {
      console.error("Error loading build:", error);
    });
}

// Helper to recreate missing elements
function recreateInput(id) {
  const input = document.createElement("input");
  input.id = id;
  document.body.appendChild(input); // Adjust this to append to the correct parent
  return input;
}

function recreateText(id) {
  const text = document.createElement("span");
  text.id = id;
  document.body.appendChild(text); // Adjust this to append to the correct parent
  return text;
}

function recreateDropdown(id) {
  const dropdown = document.createElement("select");
  dropdown.id = id;
  document.body.appendChild(dropdown); // Adjust this to append to the correct parent
  return dropdown;
}

window.viewBuild = viewBuild;

// Close the modal
export function closeModal() {
  const modal = document.getElementById("buildsModal");
  if (modal) {
    modal.style.display = "none"; // Only hide the modal
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
//window.showAllBuilds = showAllBuilds;

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
  const buildModal = document.getElementById("buildsModal");

  if (!buildModal) {
    console.error("Build modal not found!");
    return;
  }

  // Clear and populate the build list
  populateBuildList();

  // Open the modal
  buildModal.style.display = "block";

  // Close modal logic
  document.getElementById("closeBuildsModal").onclick = () => {
    buildModal.style.display = "none";
  };

  window.onclick = (event) => {
    if (event.target === buildModal) {
      buildModal.style.display = "none";
    }
  };
}

// Attach to the global window object
window.showBuildsModal = showBuildsModal;

export async function populateBuildList(filteredBuilds = null) {
  const buildList = document.getElementById("buildList");
  const buildPreview = document.getElementById("buildPreview");

  if (!buildList || !buildPreview) {
    console.error("Build modal elements not found!");
    return;
  }

  // Clear the current list
  buildList.innerHTML = "";

  // If no filtered builds are provided, fetch all builds
  const builds = filteredBuilds || (await fetchUserBuilds());

  if (builds.length === 0) {
    buildList.innerHTML = "<p>No builds available.</p>";
    return;
  }

  const fragment = document.createDocumentFragment();

  builds.forEach((build) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");

    buildCard.innerHTML = `
      <div class="card-header">
        <h4>${build.title}</h4>
        <button class="delete-build-btn" title="Delete Build">&times;</button>
      </div>
      <p>${build.comment || "No comments provided."}</p>
      <button class="view-build-btn">View Build</button>
    `;

    // Add hover functionality for preview
    buildCard.addEventListener("mouseover", () => updateBuildPreview(build));
    buildCard.addEventListener("mouseleave", () => clearBuildPreview());

    // Add delete functionality
    const deleteButton = buildCard.querySelector(".delete-build-btn");
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteBuildFromFirestore(build.id);
      populateBuildList(filteredBuilds); // Refresh the list after deletion
    });

    // Add view build functionality
    const viewBuildButton = buildCard.querySelector(".view-build-btn");
    viewBuildButton.addEventListener("click", () => viewBuild(build.id));

    fragment.appendChild(buildCard);
  });

  buildList.appendChild(fragment);
}

function updateBuildPreview(build) {
  const buildPreview = document.getElementById("buildPreview");

  if (!buildPreview) {
    console.error("Build preview element not found.");
    return;
  }

  const formattedBuildOrder = build.buildOrder
    .map((step) => `[${step.workersOrTimestamp}] ${step.action}`)
    .join("\n");

  buildPreview.innerHTML = `
    <h4>${build.title}</h4>
    <p><strong>Comment:</strong> ${build.comment || "No comments provided."}</p>
    <p><strong>Match-Up:</strong> ${build.subcategory || "Unknown"}</p>
    <pre>${formattedBuildOrder}</pre>
    ${
      build.videoLink
        ? `<iframe src="${build.videoLink}" frameborder="0" allowfullscreen></iframe>`
        : ""
    }
  `;
}

function clearBuildPreview() {
  const buildPreview = document.getElementById("buildPreview");

  if (!buildPreview) {
    console.error("Build preview element not found.");
    return;
  }

  buildPreview.innerHTML = "<p>Hover over a build to see its details here.</p>";
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

export async function filterBuilds(
  categoryOrSubcategory = "all",
  searchQuery = ""
) {
  const builds = await fetchUserBuilds(); // Fetch all builds from Firestore
  const lowerCaseQuery = searchQuery.toLowerCase();

  // Filter builds based on category or subcategory
  const filteredBuilds = builds.filter((build) => {
    const matchesCategory =
      categoryOrSubcategory === "all" ||
      (["zvz", "zvp", "zvt", "pvp", "pvz", "pvt", "tvt", "tvz", "tvp"].includes(
        categoryOrSubcategory.toLowerCase()
      ) &&
        build.subcategory.toLowerCase() ===
          categoryOrSubcategory.toLowerCase()) ||
      (["zerg", "protoss", "terran"].includes(
        categoryOrSubcategory.toLowerCase()
      ) &&
        build.category.toLowerCase() === categoryOrSubcategory.toLowerCase());

    const matchesSearch =
      build.title.toLowerCase().includes(lowerCaseQuery) ||
      (build.comment && build.comment.toLowerCase().includes(lowerCaseQuery));

    return matchesCategory && matchesSearch;
  });

  // Populate the filtered list
  populateBuildList(filteredBuilds);
}

export async function searchBuilds(query) {
  const lowerCaseQuery = query.toLowerCase();

  // Fetch all builds
  const builds = await fetchUserBuilds();

  // Filter builds based on the query
  const filteredBuilds = builds.filter((build) =>
    build.title.toLowerCase().includes(lowerCaseQuery)
  );

  // Populate the build list with filtered results
  populateBuildList(filteredBuilds);
}

export { closeBuildsModal };
