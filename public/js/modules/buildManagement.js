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
import { mapAnnotations } from "./interactive_map.js";
import { checkPublishButtonVisibility } from "./community.js";

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

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export function saveCurrentBuild() {
  console.log("Saving build..."); // Debugging
  const titleInput = document.getElementById("buildOrderTitleInput");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const mapImage = document.getElementById("map-preview-image");

  if (!titleInput || !categoryDropdown) {
    console.error("Title or match-up dropdown is missing.");
    showToast("Failed to save. Title or match-up missing.", "error");
    return;
  }

  const title = DOMPurify.sanitize(titleInput.value.trim());
  const selectedMatchup = DOMPurify.sanitize(categoryDropdown.value);

  if (!title) {
    showToast("Please provide a title.", "error");
    return;
  }

  if (!selectedMatchup) {
    showToast("Please select a valid match-up.", "error");
    return;
  }

  const formattedMatchup = selectedMatchup
    .toLowerCase()
    .replace(/([a-z])([a-z])/g, (match, p1, p2) => `${p1.toUpperCase()}${p2}`);

  // ✅ Use `parseBuildOrder` instead of manual parsing
  const buildOrder = parseBuildOrder(buildOrderInput.value);

  // ✅ Extract only the map name instead of full image URL
  let mapName = "No map selected";
  if (mapImage?.src) {
    const match = mapImage.src.match(/\/img\/maps\/(.+)\.jpg/);
    if (match) {
      mapName = match[1].replace(/_/g, " "); // Convert underscores to spaces
    }
  }

  const newBuild = {
    title,
    category: formattedMatchup.startsWith("Zv")
      ? "Zerg"
      : formattedMatchup.startsWith("Pv")
      ? "Protoss"
      : formattedMatchup.startsWith("Tv")
      ? "Terran"
      : "Unknown",
    subcategory: formattedMatchup,
    timestamp: Date.now(),
    comment: DOMPurify.sanitize(commentInput?.value.trim() || ""),
    videoLink: DOMPurify.sanitize(videoInput?.value.trim() || ""),
    buildOrder, // ✅ Save as structured objects
    map: mapName, // ✅ Save only the map name
    interactiveMap: {
      circles: mapAnnotations.circles.map(({ x, y }) => ({ x, y })),
      arrows: mapAnnotations.arrows.map(({ startX, startY, endX, endY }) => ({
        startX,
        startY,
        endX,
        endY,
      })),
    },
    isPublished: false, // Resets published status when re-saved
  };

  const savedBuilds = getSavedBuilds();
  const existingIndex = savedBuilds.findIndex((build) => build.title === title);

  if (existingIndex !== -1) {
    const overwrite = confirm(`Overwrite existing build "${title}"?`);
    if (!overwrite) return;
    savedBuilds[existingIndex] = newBuild;
  } else {
    savedBuilds.push(newBuild);
  }

  setSavedBuilds(savedBuilds);
  saveSavedBuildsToLocalStorage(); // ✅ Ensure local storage is updated

  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    showToast("Sign in to save builds to the database.", "error");
    return;
  }

  const buildsRef = collection(db, `users/${user.uid}/builds`);
  const buildDoc = doc(buildsRef, title);

  setDoc(buildDoc, newBuild)
    .then(() => {
      showToast("Build saved successfully!", "success");

      // ✅ Wait before checking visibility to ensure Firestore update
      setTimeout(() => {
        checkPublishButtonVisibility();
      }, 500); // Small delay to let Firestore update properly
    })
    .catch((error) => {
      console.error("Error saving to Firestore:", error);
      showToast("Failed to save build.", "error");
    });

  // ✅ Ensure UI updates after saving
  filterBuilds("all");
}

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
        ({ x, y }) => ({ x, y })
      );
      mapAnnotations.arrows = (interactiveMap.arrows || []).map(
        ({ startX, startY, endX, endY }) => ({
          startX,
          startY,
          endX,
          endY,
        })
      );

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

export function deleteBuild(index) {
  const deleteModal = document.getElementById("deleteConfirmationModal");
  const confirmButton = document.getElementById("confirmDeleteButton");
  const cancelButton = document.getElementById("cancelDeleteButton");

  deleteModal.style.display = "flex";
  confirmButton.focus();

  confirmButton.onclick = () => {
    const savedBuilds = getSavedBuilds();
    if (index >= 0 && index < savedBuilds.length) {
      savedBuilds.splice(index, 1);
      setSavedBuilds(savedBuilds);
      showToast("Build deleted.", "success");
    }
    deleteModal.style.display = "none";
  };

  cancelButton.onclick = () => {
    deleteModal.style.display = "none";
  };
}

window.deleteBuild = deleteBuild;

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
