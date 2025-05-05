import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
import { getSavedBuilds, setSavedBuilds } from "./buildStorage.js";
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

  const builds = snapshot.docs.map((doc) => {
    const data = doc.data();
    const decodedTitle = doc.id.replace(/__SLASH__/g, "/");

    return {
      id: doc.id,
      title: decodedTitle,
      ...data,
      isPublished: false, // default
    };
  });

  // 🔍 Now fetch community builds by this user
  const communityRef = collection(db, "communityBuilds");
  const q = query(communityRef, where("publisherId", "==", user.uid));
  const communitySnapshot = await getDocs(q);
  const publishedTitles = new Set(
    communitySnapshot.docs.map((doc) => doc.data().title)
  );

  // ✅ Update each build with actual publish status
  builds.forEach((build) => {
    if (publishedTitles.has(build.title)) {
      build.isPublished = true;
    }
  });

  return builds;
}

export async function saveCurrentBuild() {
  console.log("Saving build..."); // Debugging
  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText"); // Title Text
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const mapImage = document.getElementById("map-preview-image");

  if (!titleInput || !categoryDropdown || !titleText) {
    console.error("Title or match-up dropdown is missing.");
    showToast("Failed to save. Title or match-up missing.", "error");
    return;
  }

  let title = DOMPurify.sanitize(titleInput.value.trim());
  const selectedMatchup = DOMPurify.sanitize(categoryDropdown.value);

  // ✅ ADD BORDER ANIMATION FOR EMPTY FIELDS
  function highlightField(field) {
    field.classList.add("highlight"); // Add highlight class
    setTimeout(() => field.classList.remove("highlight"), 5000); // Remove after 5s
  }

  function removeHighlightOnFocus(field) {
    field.addEventListener("focus", () => field.classList.remove("highlight"));
    field.addEventListener("change", () => field.classList.remove("highlight")); // For dropdowns
  }

  // Apply remove highlight on focus
  removeHighlightOnFocus(titleInput);
  removeHighlightOnFocus(categoryDropdown);

  if (!title) {
    showToast("Please provide a title.", "error");
    highlightField(titleInput);
    highlightField(titleText); // Highlight `buildOrderTitleText`
    return;
  }

  if (!selectedMatchup) {
    showToast("Please select a valid match-up.", "error");
    highlightField(categoryDropdown);
    return;
  }

  // ✅ Fix: Remove highlight when user selects a category
  titleText.classList.remove("highlight");

  // ✅ Encode "/" as "__SLASH__" for Firestore document ID
  const encodedTitle = title.replace(/\//g, "__SLASH__");

  const formattedMatchup = selectedMatchup
    .toLowerCase()
    .replace(/([a-z])([a-z])/g, (match, p1, p2) => `${p1.toUpperCase()}${p2}`);

  const buildOrder = parseBuildOrder(buildOrderInput.value);

  let mapName = "No map selected";
  if (mapImage?.src) {
    const match = mapImage.src.match(/\/img\/maps\/(.+)\.webp/);
    if (match) {
      mapName = match[1].replace(/_/g, " "); // Convert underscores to spaces
    }
  }

  const auth = getAuth();
  const user = auth.currentUser;

  // 🔴 If user is not signed in, show toast warning and prevent save
  if (!user) {
    console.error("⚠ Attempted to save without signing in.");
    showToast("⚠ You must sign in to save your build!", "error");
    return;
  }

  const db = getFirestore();
  const userRef = doc(db, "users", user.uid);
  let username = "Unknown"; // Default if username is not found

  try {
    const userSnapshot = await getDoc(userRef);
    if (userSnapshot.exists() && userSnapshot.data().username) {
      username = userSnapshot.data().username;
    }
  } catch (error) {
    console.error("Error fetching username:", error);
  }

  const replayLinkInput = document.getElementById("replayLinkInput");
  const replayUrl = DOMPurify.sanitize(replayLinkInput?.value.trim() || "");

  // ✅ Validate Drop.sc link format
  const validReplayPattern = /^https:\/\/drop\.sc\/replay\/\d+$/;
  if (replayUrl && !validReplayPattern.test(replayUrl)) {
    showToast("Please enter a valid Drop.sc replay link.", "error");
    replayLinkInput.classList.add("highlight");
    setTimeout(() => replayLinkInput.classList.remove("highlight"), 5000);
    return;
  }

  const newBuild = {
    title: title,
    encodedTitle: encodedTitle,
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
    replayUrl: replayUrl, // ✅ Now this will be correctly set
    buildOrder,
    map: mapName,
    interactiveMap: {
      circles: mapAnnotations.circles.map(({ x, y }) => ({ x, y })),
      arrows: mapAnnotations.arrows.map(({ startX, startY, endX, endY }) => ({
        startX,
        startY,
        endX,
        endY,
      })),
    },
    isPublished: false,
    publisher: username,
  };
  const buildsRef = collection(db, `users/${user.uid}/builds`);
  const buildDoc = doc(buildsRef, encodedTitle);

  await setDoc(buildDoc, newBuild)
    .then(() => {
      showToast("✅ Build saved successfully!", "success");
      console.log("✅ Build saved with title:", title);
      checkPublishButtonVisibility();

      // ✅ Move this UI toggle here (after successful save)
      document.getElementById("replayInputWrapper").style.display = "none";
      const viewWrapper = document.getElementById("replayViewWrapper");
      const viewBtn = document.getElementById("replayDownloadBtn");
      if (viewWrapper && viewBtn && replayUrl) {
        viewWrapper.style.display = "block";
        viewBtn.href = replayUrl;
      }
    })
    .catch((error) => {
      console.error("Error saving to Firestore:", error);
      showToast("Failed to save build.", "error");
    });

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

export async function populateBuildsModal() {
  const auth = getAuth();
  if (!auth.currentUser) return;

  const userId = auth.currentUser.uid;
  const buildsRef = collection(getFirestore(), `users/${userId}/builds`);
  const snapshot = await getDocs(buildsRef);

  const tableBody = document.getElementById("buildList");
  if (!tableBody) return;

  tableBody.innerHTML = ""; // Clear existing builds

  snapshot.docs.forEach((doc) => {
    const build = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${build.title}</td>
      <td>${build.category}</td>
      <td>${
        build.timestamp ? new Date(build.timestamp).toLocaleString() : "Unknown"
      }</td>
      <td>
        <button class="view-build-button" data-id="${doc.id}">🔍 View</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  console.log("✅ User's builds updated in modal.");
}
