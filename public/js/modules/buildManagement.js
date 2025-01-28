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
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const mapImage = document.getElementById("map-preview-image");

  // Check if required elements exist
  if (!titleInput || !categoryDropdown) {
    console.error("Title or match-up dropdown is missing from the DOM.");
    showToast(
      "Failed to save the build. Title or match-up is missing.",
      "error"
    );
    return;
  }

  const title = DOMPurify.sanitize(titleInput.value.trim());
  const selectedMatchup = DOMPurify.sanitize(categoryDropdown.value);

  // Validation: Ensure title is not empty
  if (!title) {
    showToast("Please provide a title for the build.", "error");
    titleInput.classList.add("highlight");
    titleInput.addEventListener("input", () => {
      titleInput.classList.remove("highlight");
    });
    return;
  }

  // Validation: Ensure a match-up is selected
  if (!selectedMatchup) {
    showToast("Please select a valid match-up.", "error");
    categoryDropdown.classList.add("highlight");
    categoryDropdown.addEventListener("change", () => {
      categoryDropdown.classList.remove("highlight");
    });
    return;
  }

  // Helper function to format match-up (e.g., zvp -> ZvP)
  const formatMatchup = (matchup) => {
    return matchup
      .toLowerCase()
      .replace(
        /([a-z])([a-z])/g,
        (match, p1, p2) => `${p1.toUpperCase()}${p2}`
      );
  };

  const formattedMatchup = formatMatchup(selectedMatchup);

  // Extract optional fields
  const comment = DOMPurify.sanitize(commentInput?.value.trim() || "");
  const videoLink = DOMPurify.sanitize(videoInput?.value.trim() || "");
  const buildOrderText = DOMPurify.sanitize(
    buildOrderInput?.value.trim() || ""
  );
  const buildOrder = buildOrderText ? parseBuildOrder(buildOrderText) : []; // Parse build order if provided
  const mapSrc = mapImage?.src || "";
  const mapName = mapSrc
    ? mapSrc
        .split("/")
        .pop()
        .replace(/_/g, " ")
        .replace(".jpg", "")
        .toLowerCase()
    : "";

  // Prepare the build object
  const newBuild = {
    title,
    category: formattedMatchup.startsWith("Zv")
      ? "Zerg"
      : formattedMatchup.startsWith("Pv")
      ? "Protoss"
      : "Terran",
    subcategory: formattedMatchup, // Save formatted match-up
    timestamp: Date.now(),
    comment,
    videoLink,
    buildOrder,
    map: mapName, // Save only the cleaned map name
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
      //showToast("Build saved to database successfully!", "success");
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
      mapAnnotations.circles = (interactiveMap.circles || []).map(
        ({ x, y }) => ({
          x,
          y,
        })
      );
      mapAnnotations.arrows = (interactiveMap.arrows || []).map(
        ({ startX, startY, endX, endY }) => ({
          startX,
          startY,
          endX,
          endY,
        })
      );

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
