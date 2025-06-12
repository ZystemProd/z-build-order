import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db, auth } from "../../app.js";
import {
  getSavedBuilds,
  setSavedBuilds,
  saveSavedBuildsToLocalStorage,
} from "./buildStorage.js";
import { showToast } from "./toastHandler.js";
import { filterBuilds } from "./modal.js";
import { parseBuildOrder } from "./utils.js";
import { mapAnnotations } from "./interactive_map.js";
import { checkPublishButtonVisibility } from "./community.js";
import { logAnalyticsEvent } from "./analyticsHelper.js";

import DOMPurify from "dompurify";

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
  const publishedRef = collection(db, "publishedBuilds");
  const q = query(publishedRef, where("publisherId", "==", user.uid));
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
  let encodedTitle = "";
  console.log("Saving build...");

  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const mapImage = document.getElementById("map-preview-image");

  if (!titleInput || !categoryDropdown || !titleText) {
    console.error("Title or match-up dropdown is missing.");
    showToast("Failed to save. Title or match-up missing.", "error");
    return null;
  }

  let title = DOMPurify.sanitize(titleInput.value.trim());
  const selectedMatchup = DOMPurify.sanitize(categoryDropdown.value);

  // Highlight helpers
  function highlightField(field) {
    field.classList.add("highlight");
    setTimeout(() => field.classList.remove("highlight"), 5000);
  }
  function removeHighlightOnFocus(field) {
    field.addEventListener("focus", () => field.classList.remove("highlight"));
    field.addEventListener("change", () => field.classList.remove("highlight"));
  }
  // Allow title highlight to remain even when input is focused
  removeHighlightOnFocus(categoryDropdown);

  if (!title) {
    showToast("Please provide a title.", "error");
    highlightField(titleInput);
    highlightField(titleText);
    return null;
  }
  if (!selectedMatchup) {
    showToast("Please select a valid match-up.", "error");
    highlightField(categoryDropdown);
    return null;
  }
  titleText.classList.remove("highlight");

  encodedTitle = title.replace(/\//g, "__SLASH__");

  const formattedMatchup = selectedMatchup
    .toLowerCase()
    .replace(/([a-z])([a-z])/g, (match, p1, p2) => `${p1.toUpperCase()}${p2}`);

  const buildOrder = parseBuildOrder(buildOrderInput.value);

  // ✅ Robust map name parsing
  let mapName = "No map selected";
  if (mapImage?.src) {
    try {
      const url = new URL(mapImage.src);
      const parts = url.pathname.split("/");
      const filename = parts.at(-1); // "map_name.webp"
      if (filename) {
        const base = filename.replace(/\.[a-z]+$/i, "");
        mapName = base.replace(/_/g, " ");
      }
    } catch (err) {
      console.warn("🛑 Failed to parse map image:", mapImage.src, err);
    }
  }

  // ✅ Guard against invalid map parsing
  if (mapImage?.src && mapName === "No map selected") {
    console.warn(
      "⚠ Failed to parse map name, proceeding without a valid name."
    );
    // optionally keep the default "No map selected"
  }

  let mapFolder = "current";
  if (mapImage?.src) {
    try {
      const url = new URL(mapImage.src);
      const folderMatch = url.pathname.match(/\/maps\/([^/]+)\//);
      if (folderMatch) mapFolder = folderMatch[1];
    } catch (err) {
      console.warn("🛑 Failed to parse map folder:", mapImage.src, err);
    }
  }

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.error("⚠ Attempted to save without signing in.");
    showToast("⚠ You must sign in to save your build!", "error");
    return null;
  }

  const existingBuilds = await fetchUserBuilds();
  setSavedBuilds(existingBuilds);
  saveSavedBuildsToLocalStorage();
  const lower = title.toLowerCase();
  if (
    existingBuilds.some(
      (b) => !b.imported && b.title.toLowerCase() === lower
    )
  ) {
    showToast("A build with this title already exists.", "error");
    highlightField(titleInput);
    highlightField(titleText);
    return null;
  }

  const db = getFirestore();
  const userRef = doc(db, "users", user.uid);

  let username = "Unknown";
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
  const validReplayPattern = /^https:\/\/drop\.sc\/replay\/\d+$/;

  if (replayUrl && !validReplayPattern.test(replayUrl)) {
    showToast("Please enter a valid Drop.sc replay link.", "error");
    replayLinkInput.classList.add("highlight");
    setTimeout(() => replayLinkInput.classList.remove("highlight"), 5000);
    return null;
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
    subcategoryLowercase: formattedMatchup.toLowerCase(),
    timestamp: Date.now(),
    comment: DOMPurify.sanitize(commentInput?.value.trim() || ""),
    videoLink: DOMPurify.sanitize(videoInput?.value.trim() || ""),
    replayUrl,
    buildOrder,
    map: mapName,
    mapFolder,
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

  try {
    await setDoc(buildDoc, newBuild);
    logAnalyticsEvent("build_saved", {
      race: newBuild.category,
      matchup: newBuild.subcategory,
    });
    showToast("✅ Build saved successfully!", "success");
    console.log("✅ Build saved with title:", title);
    checkPublishButtonVisibility();

    document.getElementById("replayInputWrapper").style.display = "none";
    const viewWrapper = document.getElementById("replayViewWrapper");
    const viewBtn = document.getElementById("replayDownloadBtn");
    if (viewWrapper && viewBtn && replayUrl) {
      viewWrapper.style.display = "block";
      viewBtn.href = replayUrl;
    }

    filterBuilds("all");
    return encodedTitle;
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    showToast("❌ Failed to save build.", "error");
    return null;
  }
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

      const clearBtn = document.querySelector('.clear-annotations-button');
      if (clearBtn) clearBtn.style.display = 'inline-block';
    }
  } else {
    console.error("Build not found!");
  }
}

export async function updateCurrentBuild(buildId) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not logged in.");
    showToast("⚠ You must be signed in to update your build!", "error");
    return;
  }

  const db = getFirestore();
  const buildDocRef = doc(db, `users/${user.uid}/builds/${buildId}`);
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const replayInput = document.getElementById("replayLinkInput");
  const mapImage = document.getElementById("map-preview-image");

  const updatedData = {
    comment: DOMPurify.sanitize(commentInput?.value.trim() || ""),
    videoLink: DOMPurify.sanitize(videoInput?.value.trim() || ""),
    replayUrl: DOMPurify.sanitize(replayInput?.value.trim() || ""),
    buildOrder: parseBuildOrder(buildOrderInput.value),
    subcategory: DOMPurify.sanitize(categoryDropdown.value || ""),
    interactiveMap: {
      circles: mapAnnotations.circles.map(({ x, y }) => ({ x, y })),
      arrows: mapAnnotations.arrows.map(({ startX, startY, endX, endY }) => ({
        startX,
        startY,
        endX,
        endY,
      })),
    },
    timestamp: Date.now(),
  };

  // 🗺 Map name update (if selected)
  if (mapImage?.src) {
    const match = mapImage.src.match(/\/img\/maps\/(.+)\.webp/);
    if (match) {
      updatedData.map = match[1].replace(/_/g, " ");
    }
  }

  await setDoc(buildDocRef, updatedData, { merge: true });
  const matchup = updatedData.subcategory || "";
  const race = matchup.startsWith("Zv")
    ? "Zerg"
    : matchup.startsWith("Pv")
    ? "Protoss"
    : matchup.startsWith("Tv")
    ? "Terran"
    : "Unknown";
  logAnalyticsEvent("build_updated", { race, matchup });

  const localBuilds = getSavedBuilds();
  const localIndex = localBuilds.findIndex((b) => b.encodedTitle === buildId);
  if (localIndex !== -1) {
    localBuilds[localIndex] = {
      ...localBuilds[localIndex],
      ...updatedData,
    };
    saveSavedBuildsToLocalStorage();
  }

  // 🔄 Also update community version if published
  const publishedRef = doc(db, "publishedBuilds", buildId);
  const communitySnap = await getDoc(publishedRef);

  if (communitySnap.exists()) {
    await setDoc(publishedRef, updatedData, { merge: true });
    console.log("🌍 Community build updated as well.");
  }

  checkPublishButtonVisibility();
  return true;
}

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

/**
 * Load builds shared to the user's clan
 */
export async function loadClanBuilds() {
  const user = auth.currentUser;
  if (!user) return [];

  const clansSnap = await getDocs(collection(db, "clans"));
  const userClanIds = [];

  clansSnap.forEach((doc) => {
    const data = doc.data();
    if (data.members?.includes(user.uid)) {
      userClanIds.push(doc.id);
    }
  });

  if (userClanIds.length === 0) return [];

  const publishedSnap = await getDocs(collection(db, "publishedBuilds"));
  const clanBuilds = [];

  publishedSnap.forEach((doc) => {
    const data = doc.data();
    const isSharedToClan = data.sharedToClans?.some((clanId) =>
      userClanIds.includes(clanId)
    );
    if (isSharedToClan) {
      clanBuilds.push({
        id: doc.id,
        ...data,
        source: "published",
      });
    }
  });

  return clanBuilds;
}

export async function fetchPublishedUserBuilds(filter = "all") {
  const db = getFirestore();
  const user = getAuth().currentUser;
  if (!user) return [];

  const baseRef = collection(db, "publishedBuilds");
  let q;

  if (filter === "all") {
    q = query(baseRef, where("publisherId", "==", user.uid));
  } else if (/^[zpt]v[zpt]$/i.test(filter)) {
    q = query(
      baseRef,
      where("publisherId", "==", user.uid),
      where("subcategoryLowercase", "==", filter)
    );
  } else {
    q = query(
      baseRef,
      where("publisherId", "==", user.uid),
      where("category", "==", filter)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
