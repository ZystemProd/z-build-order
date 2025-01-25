import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getSavedBuilds,
  setSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";
import { showToast } from "./uiHandlers.js";
import { filterBuilds } from "./modal.js";
import { parseBuildOrder } from "./utils.js";
import { mapAnnotations } from "./interactive_map.js"; // Ensure this export exists

export async function fetchUserBuilds() {
  const auth = getAuth();
  const db = getFirestore();

  const user = auth.currentUser;
  if (!user) {
    console.error("User not logged in.");
    return [];
  }

  const buildsRef = collection(db, `users/${user.uid}/builds`);
  const snapshot = await getDocs(buildsRef);

  const builds = snapshot.docs.map((doc) => ({
    id: doc.id, // Document ID
    ...doc.data(), // Document data
  }));

  return builds;
}

export function saveCurrentBuild() {
  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const mapImage = document.getElementById("map-preview-image");

  const title = titleInput.value.trim();
  const comment = commentInput.value.trim();
  const videoLink = videoInput.value.trim();
  const buildOrderText = buildOrderInput.value.trim();
  const selectedMatchup = categoryDropdown.value;
  const selectedMapPath = mapImage.src; // Capture the map path

  // Missing title handling
  if (!title) {
    titleText.classList.add("highlight");
    showToast("Please provide a title for the build.", "error");

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
    categoryDropdown.classList.add("highlight");
    showToast("Please select a match-up.", "error");

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

  const buildOrder = parseBuildOrder(buildOrderText);
  if (buildOrder.length === 0) {
    showToast("Build order cannot be empty.", "error");
    return;
  }

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
    category,
    subcategory,
    timestamp: Date.now(),
    map: selectedMapPath, // Save map path
    interactiveMap: {
      circles: mapAnnotations.circles.map(({ x, y }) => ({ x, y })),
      arrows: mapAnnotations.arrows.map(({ startX, startY, endX, endY }) => ({
        startX,
        startY,
        endX,
        endY,
      })),
    },
  };

  // Save locally
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

  // Save to Firestore
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    showToast("You must be signed in to save builds to the database.", "error");
    return;
  }

  const buildsRef = collection(db, `users/${user.uid}/builds`);
  const buildDoc = doc(buildsRef, title); // Use title as the document ID for easy lookup

  setDoc(buildDoc, newBuild)
    .then(() => {
      showToast("Build saved to database successfully!", "success");
    })
    .catch((error) => {
      console.error("Error saving build to Firestore:", error);
      showToast("Failed to save build to the database.", "error");
    });

  showToast("Build saved successfully!", "success");
  filterBuilds("all");
}
// maybe remove, is not used anywhere
export async function loadBuildAnnotations(buildId) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    return;
  }

  const buildDoc = doc(db, `users/${user.uid}/builds`, buildId);
  const buildSnapshot = await getDoc(buildDoc);

  if (buildSnapshot.exists()) {
    const data = buildSnapshot.data();
    const { interactiveMap } = data;

    if (interactiveMap) {
      mapAnnotations.circles = interactiveMap.circles || [];
      mapAnnotations.arrows = interactiveMap.arrows || [];

      // Render circles and arrows on the map
      mapAnnotations.circles.forEach(({ x, y }) =>
        mapAnnotations.createCircle(x, y)
      );
      mapAnnotations.arrows.forEach(({ startX, startY, endX, endY }) =>
        mapAnnotations.createArrow(startX, startY, endX, endY)
      );
    }
  } else {
    console.error("Build not found!");
  }
}
// ........................
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
