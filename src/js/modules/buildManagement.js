import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
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
import { getUserMainClanInfo } from "./clan.js";
import { getCurrentBuildId, setCurrentBuildId } from "./states/buildState.js";

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
      ...data, // keep isPublished as stored
    };
  });

  return builds;
}

export async function saveCurrentBuild() {
  let encodedTitle = "";
  console.log("Saving build...");

  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const descriptionInput = document.getElementById("descriptionInput");
  const videoInput = document.getElementById("videoInput");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const mapImage = document.getElementById("map-preview-image");
  // ✅ Get map mode dropdown value
  const modeDropdown = document.getElementById("mapModeDropdown");
  const mapMode = modeDropdown ? DOMPurify.sanitize(modeDropdown.value) : "1v1";

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

  // Collect DOM-based variations (hidden textareas)
  function collectDomVariations() {
    const stack = document.getElementById("boEditorsStack");
    if (!stack) return [];
    const editors = Array.from(stack.querySelectorAll('.bo-editor'))
      .filter((ed) => ed.dataset.editorId !== 'main');
    return editors.slice(0, 5).map((ed, idx) => ({
      id: ed.dataset.editorId || `var_${idx + 1}`,
      name: ed.dataset.editorName || `Variation ${idx + 1}`,
      text: String(ed.value || ""),
      buildOrder: parseBuildOrder(String(ed.value || "")),
    }));
  }
  const domVariations = collectDomVariations();

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

  if (
    !mapImage?.src ||
    mapName.toLowerCase() === "index" ||
    mapName.toLowerCase() === "no map selected"
  ) {
    mapName = "";
  }

  let mapFolder = mapName ? `current/${mapMode || "1v1"}` : "";
  if (mapImage?.src && mapName) {
    try {
      const url = new URL(mapImage.src);
      const folderMatch = url.pathname.match(/\/maps\/(.+)\/[\w\-.'%()]+\.(?:webp|png|jpg|jpeg)$/i);
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
    existingBuilds.some((b) => !b.imported && b.title.toLowerCase() === lower)
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
    description: DOMPurify.sanitize(descriptionInput?.value.trim() || ""),
    videoLink: DOMPurify.sanitize(videoInput?.value.trim() || ""),
    replayUrl,
    buildOrder,
    variations: domVariations,
    map: mapName,
    mapFolder,
    mapMode: mapMode,
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
    favorite: false,
    publisher: username,
  };

  const buildsRef = collection(db, `users/${user.uid}/builds`);

  try {
    const docRef = await addDoc(buildsRef, newBuild);
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
    // Set the current build context if not already set
    try { setCurrentBuildId(docRef.id); } catch (_) {}

    return docRef.id;
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    showToast("❌ Failed to save build.", "error");
    return null;
  }
}

// --- Variations / Branching helpers ---

function genId(prefix = "grp_") {
  const part = Math.random().toString(36).slice(2, 10);
  return `${prefix}${part}`;
}

/**
 * Fetch builds that share the same groupId (variations of a build)
 */
export async function fetchVariationsForGroup(groupId) {
  const user = getAuth().currentUser;
  if (!user || !groupId) return [];
  const database = getFirestore();
  const baseRef = collection(database, `users/${user.uid}/builds`);
  const q = query(baseRef, where("groupId", "==", groupId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Create a new branch build from the current editor state.
 * - Ensures the current build is saved as the main (if not already)
 * - Assigns/propagates a groupId
 * - Prompts for a branch name and creates a new build with that suffix in title
 * Returns the new branch build id on success.
 */
export async function branchCurrentBuild() {
  const authObj = getAuth();
  const user = authObj.currentUser;
  if (!user) {
    showToast("You must sign in to branch a build.", "error");
    return null;
  }

  // Read inputs
  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const origTitle = (titleInput?.value || "").trim();
  if (!origTitle) {
    showToast("Please enter a title before branching.", "error");
    return null;
  }

  // Ensure original is saved
  let mainId = getCurrentBuildId();
  if (!mainId) {
    mainId = await saveCurrentBuild();
    if (!mainId) return null;
  }

  // Ensure original has a groupId
  const database = getFirestore();
  const mainRef = doc(database, `users/${user.uid}/builds/${mainId}`);
  const mainSnap = await getDoc(mainRef);
  if (!mainSnap.exists()) return null;
  let groupId = mainSnap.data().groupId;
  if (!groupId) {
    groupId = genId();
    await setDoc(
      mainRef,
      { groupId, isMain: true, variantName: "Main", parentId: null },
      { merge: true }
    );
  }

  // Prompt for branch name
  let branchName = window.prompt("Name this branch", "Variation");
  if (!branchName) return null;
  branchName = branchName.trim();
  if (!branchName) return null;

  // Compose new title (keep simple suffix)
  const newTitle = `${origTitle} — ${branchName}`;

  // Update UI title fields to new branch title for saving
  if (titleInput) titleInput.value = newTitle;
  if (titleText) {
    titleText.textContent = newTitle;
    titleText.classList.remove("dimmed");
  }

  // Save the branch as a new build
  const branchId = await saveCurrentBuild();
  if (!branchId) return null;

  // Tag the branch with linkage
  const branchRef = doc(database, `users/${user.uid}/builds/${branchId}`);
  await setDoc(
    branchRef,
    {
      groupId,
      parentId: mainId,
      isMain: false,
      variantName: branchName,
    },
    { merge: true }
  );

  // Keep editing the branch
  try { setCurrentBuildId(branchId); } catch (_) {}

  showToast("Branch created — now editing branch.", "success");
  return branchId;
}

// --- Local Variations -> DB save on demand ---
function getLocalVarKey(idOverride = null) {
  const id = idOverride || getCurrentBuildId() || "unsaved";
  return "zbo_variations_" + id;
}
async function saveLocalVariationsAsBuilds({ mainId, baseBuild }) {
  try {
    const authObj = getAuth();
    const user = authObj.currentUser;
    if (!user) return;
    const database = getFirestore();

    // Read variations from DOM editors (hide/show approach)
    const stack = document.getElementById("boEditorsStack");
    if (!stack) return;
    const editors = Array.from(stack.querySelectorAll('.bo-editor')).filter(ed => ed.dataset.editorId !== 'main');
    if (editors.length === 0) return;

    // Assign/ensure groupId on main
    let groupId = genId();
    const mainRef = doc(database, `users/${user.uid}/builds/${mainId}`);
    await setDoc(
      mainRef,
      { groupId, isMain: true, variantName: "Main", parentId: null },
      { merge: true }
    );

    // Create each variation as a separate build
    const buildsRef = collection(database, `users/${user.uid}/builds`);
    for (let i = 0; i < Math.min(5, editors.length); i++) {
      const ed = editors[i];
      const title = `${baseBuild.title} — ${ed.dataset.editorName || `Variation ${i + 1}`}`;
      const buildOrder = parseBuildOrder(String(ed.value || ""));
      const newBuild = {
        ...baseBuild,
        title,
        buildOrder,
        timestamp: Date.now(),
      };
      const ref = await addDoc(buildsRef, newBuild);
      await setDoc(
        doc(database, `users/${user.uid}/builds/${ref.id}`),
        { groupId, isMain: false, variantName: ed.dataset.editorName || `Variation ${i + 1}`, parentId: mainId },
        { merge: true }
      );
    }
  } catch (_) {
    // silent fail to avoid breaking save
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

      const clearBtn = document.querySelector(".clear-annotations-button");
      if (clearBtn) clearBtn.style.display = "inline-block";
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
  const descriptionInput = document.getElementById("descriptionInput");
  const videoInput = document.getElementById("videoInput");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  const buildOrderInput = document.getElementById("buildOrderInput");
  const replayInput = document.getElementById("replayLinkInput");
  const mapImage = document.getElementById("map-preview-image");
  const modeDropdown = document.getElementById("mapModeDropdown");
  const mapMode = modeDropdown ? DOMPurify.sanitize(modeDropdown.value) : "1v1";

  // Collect DOM variations on update as well
  function collectDomVariations() {
    const stack = document.getElementById("boEditorsStack");
    if (!stack) return [];
    const editors = Array.from(stack.querySelectorAll('.bo-editor'))
      .filter((ed) => ed.dataset.editorId !== 'main');
    return editors.slice(0, 5).map((ed, idx) => ({
      id: ed.dataset.editorId || `var_${idx + 1}`,
      name: ed.dataset.editorName || `Variation ${idx + 1}`,
      text: String(ed.value || ""),
      buildOrder: parseBuildOrder(String(ed.value || "")),
    }));
  }
  const domVariations = collectDomVariations();

  const updatedData = {
    description: DOMPurify.sanitize(descriptionInput?.value.trim() || ""),
    videoLink: DOMPurify.sanitize(videoInput?.value.trim() || ""),
    replayUrl: DOMPurify.sanitize(replayInput?.value.trim() || ""),
    buildOrder: parseBuildOrder(buildOrderInput.value),
    variations: domVariations,
    subcategory: DOMPurify.sanitize(categoryDropdown.value || ""),
    mapMode, // ✅ add this line
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

  // Preserve replay link from view button if input was empty
  if (!updatedData.replayUrl) {
    const replayBtn = document.getElementById("replayDownloadBtn");
    const fallback = replayBtn?.getAttribute("href") || replayBtn?.href || "";
    if (fallback) updatedData.replayUrl = DOMPurify.sanitize(fallback.trim());
  }

  // Robustly derive map name and folder
  if (mapImage?.src) {
    try {
      const url = new URL(mapImage.src);
      const parts = url.pathname.split("/");
      const filename = parts.at(-1);
      let mapName = "";
      if (filename) {
        const base = filename.replace(/\.[a-z]+$/i, "");
        mapName = base.replace(/_/g, " ");
      }
      if (
        mapName &&
        mapName.toLowerCase() !== "index" &&
        mapName.toLowerCase() !== "no map selected"
      ) {
        updatedData.map = mapName;
        const folderMatch = url.pathname.match(/\/maps\/(.+)\/[\w\-.'%()]+\.(?:webp|png|jpg|jpeg)$/i);
        if (folderMatch) updatedData.mapFolder = folderMatch[1];
      }
    } catch (_) {
      // ignore parse errors
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
  const localIndex = localBuilds.findIndex((b) => b.id === buildId);
  if (localIndex !== -1) {
    localBuilds[localIndex] = {
      ...localBuilds[localIndex],
      ...updatedData,
    };
    saveSavedBuildsToLocalStorage();
  }

  // 🔄 Sync to published copy if needed
  const updatedSnap = await getDoc(buildDocRef);
  if (updatedSnap.exists()) {
    await syncToPublishedBuild(buildId, updatedSnap.data());
  }

  checkPublishButtonVisibility();
  return true;
}

export async function updateBuildFavorite(buildId, favorite) {
  const user = getAuth().currentUser;
  if (!user) return;
  const db = getFirestore();
  const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
  await updateDoc(buildRef, { favorite });
}

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

export async function syncToPublishedBuild(buildId, buildData) {
  const db = getFirestore();
  const user = getAuth().currentUser;
  if (!user) return;

  const publishedRef = doc(db, "publishedBuilds", buildId);
  const existingSnap = await getDoc(publishedRef);

  const shouldPublish =
    buildData.isPublic || (buildData.sharedToClans || []).length > 0;

  if (shouldPublish) {
    const metrics = existingSnap.exists()
      ? {
          views: existingSnap.data().views || 0,
          upvotes: existingSnap.data().upvotes || 0,
          downvotes: existingSnap.data().downvotes || 0,
          userVotes: existingSnap.data().userVotes || {},
          datePublished: existingSnap.data().datePublished || Timestamp.now(),
        }
      : {
          views: 0,
          upvotes: 0,
          downvotes: 0,
          userVotes: {},
          datePublished: Timestamp.now(),
        };

    let publisherClan = null;
    try {
      const clan = await getUserMainClanInfo(user.uid);
      if (clan) {
        publisherClan = {
          name: clan.name,
          tag: clan.abbreviation || clan.tag || "",
          logoUrl: clan.logoUrl || null,
        };
      }
    } catch (e) {
      console.error("Failed to fetch main clan info", e);
    }

    // Explicitly propagate variation metadata needed by the View page
    const variationMeta = {
      groupId: buildData.groupId || null,
      isMain: buildData.isMain || false,
      variantName: buildData.variantName || null,
      parentId: buildData.parentId || null,
      // Inline variations array for published fallback (read-only)
      variations: Array.isArray(buildData.variations) ? buildData.variations.slice(0, 5) : [],
    };

    await setDoc(
      publishedRef,
      {
        ...buildData,
        ...variationMeta,
        publisherId: user.uid,
        username: buildData.publisher || buildData.username || "Unknown",
        publisherClan,
        ...metrics,
      },
      { merge: true }
    );
  } else if (existingSnap.exists()) {
    await deleteDoc(publishedRef);
  }
}
