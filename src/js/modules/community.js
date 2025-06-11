import {
  getFirestore,
  collection,
  getDocs,
  getCountFromServer,
  doc,
  addDoc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  increment,
  startAfter,
} from "firebase/firestore";
import { formatActionText } from "./textFormatters.js";
import { showToast } from "./toastHandler.js";
import { formatMatchup, formatShortDate } from "./modal.js";
import { populateBuildsModal } from "./buildManagement.js"; // ✅ Corrected import
import { auth, db } from "../../app.js"; // ✅ Ensure auth and db are imported correctly
import DOMPurify from "dompurify";
import { updateTooltips } from "./tooltip.js";

let communitySortMode = "hot"; // default sort mode

const batchSize = 13;

let lastVisibleDoc = null;
let isLoadingMoreBuilds = false;
let hasMoreBuilds = true;
let currentRequestId = 0;
const renderedBuildIds = new Set();

async function updateTotalBuildCount(filter = "all") {
  const db = getFirestore();
  const constraints = [];
  const type = localStorage.getItem("communityBuildType") || "public";

  if (type === "public") {
    constraints.push(where("isPublic", "==", true));
  } else if (type === "clan") {
    const user = auth.currentUser;
    if (!user) return;

    const clansSnap = await getDocs(collection(db, "clans"));
    const clanIds = [];
    clansSnap.forEach((d) => {
      const c = d.data();
      if (c.members?.includes(user.uid)) clanIds.push(d.id);
    });
    if (clanIds.length === 0) {
      const el = document.getElementById("buildCount");
      if (el) el.textContent = "0 builds";
      return;
    }
    constraints.push(where("sharedToClans", "array-contains-any", clanIds));
  }

  const lowerFilter = filter.toLowerCase();
  if (
    ["zvp", "zvt", "zvz", "pvp", "pvt", "pvz", "tvp", "tvt", "tvz"].includes(
      lowerFilter
    )
  ) {
    constraints.push(where("subcategoryLowercase", "==", lowerFilter));
  } else if (["zerg", "protoss", "terran"].includes(lowerFilter)) {
    constraints.push(where("category", "==", capitalize(lowerFilter)));
  }

  try {
    const q = query(collection(db, "publishedBuilds"), ...constraints);
    const snap = await getCountFromServer(q);
    const count = snap.data().count || 0;
    const el = document.getElementById("buildCount");
    if (el) el.textContent = `${count} build${count === 1 ? "" : "s"}`;
  } catch (err) {
    console.error("Failed to fetch build count", err);
  }
}

async function fetchNextCommunityBuilds(batchSize = 20) {
  const requestId = ++currentRequestId;
  if (isLoadingMoreBuilds || !hasMoreBuilds) return [];

  isLoadingMoreBuilds = true;
  const db = getFirestore();

  // ✅ Always use a real field for Firestore sort
  const sortMode = communitySortMode || "hot";
  const firestoreSortField = "datePublished"; // must exist in every doc

  let q = query(
    collection(db, "publishedBuilds"),
    orderBy(firestoreSortField, "desc"),
    limit(batchSize)
  );

  if (lastVisibleDoc) {
    q = query(
      collection(db, "publishedBuilds"),
      orderBy(firestoreSortField, "desc"),
      startAfter(lastVisibleDoc),
      limit(batchSize)
    );
  }

  const snap = await getDocs(q);
  if (requestId !== currentRequestId) {
    isLoadingMoreBuilds = false;
    return [];
  }
  const docs = snap.docs;

  if (docs.length < batchSize) hasMoreBuilds = false;
  lastVisibleDoc = docs[docs.length - 1];

  const now = Date.now();

  const builds = docs.map((doc) => {
    const data = doc.data();
    const upvotes = data.upvotes || 0;
    const downvotes = data.downvotes || 0;

    let datePublishedRaw = now;
    let datePublished = "Unknown";

    try {
      let timestampValue = data.datePublished;

      // Handle Firestore Timestamp object
      if (timestampValue && typeof timestampValue.toMillis === "function") {
        timestampValue = timestampValue.toMillis();
      }

      // Handle numeric timestamp
      if (typeof timestampValue === "number") {
        const parsedDate = new Date(timestampValue);
        if (!isNaN(parsedDate.getTime())) {
          datePublishedRaw = timestampValue;
          datePublished = formatShortDate(parsedDate);
        }
      }
    } catch (err) {
      console.warn("❌ Failed to parse datePublished:", data.datePublished);
    }

    const ageInHours = (now - datePublishedRaw) / (1000 * 60 * 60);
    const gravity = 1.5;

    const hotnessScore =
      (upvotes - downvotes) / Math.pow(ageInHours + 2, gravity);

    return {
      id: doc.id,
      title: data.title || "Untitled Build",
      publisher: data.username || "Anonymous",
      matchup: formatMatchup(data.subcategory),
      category: data.category || "Unknown",
      subcategory: data.subcategory || "Unknown",
      datePublishedRaw,
      datePublished,
      views: data.views || 0,
      upvotes,
      downvotes,
      userVotes: data.userVotes || {},
      buildOrder: data.buildOrder || [],
      hotnessScore,
    };
  });

  // ✅ Sort after fetch (client-side sort only)
  if (sortMode === "top") {
    builds.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
  } else if (sortMode === "hot") {
    builds.sort((a, b) => b.hotnessScore - a.hotnessScore);
  }

  isLoadingMoreBuilds = false;
  return builds;
}

export async function populateCommunityBuilds() {
  currentRequestId++;
  const container = document.getElementById("communityBuildsContainer");
  container.innerHTML = "";
  renderedBuildIds.clear();

  lastVisibleDoc = null;
  hasMoreBuilds = true;

  try {
    const heading = document.querySelector("#communityModal h3");
    if (heading) {
      let title = "Community Builds";

      const filterValue = localStorage.getItem("communityFilterValue");
      const searchQuery = document
        .getElementById("communitySearchBar")
        ?.value.trim();

      if (filterValue && filterValue !== "all") {
        title += ` - ${capitalize(filterValue)}`;
      }

      if (searchQuery) {
        title += ` - ${searchQuery}`;
      }

      heading.textContent = title;
    }

    const firstBatch = await fetchNextCommunityBuilds(batchSize);
    renderCommunityBuildBatch(firstBatch);
    await updateTotalBuildCount(
      localStorage.getItem("communityFilterValue") || "all"
    );

    const scrollContainer = document.getElementById("communityBuildsContainer");
    if (scrollContainer) {
      scrollContainer.removeEventListener("scroll", handlePaginatedScroll);
      scrollContainer.addEventListener("scroll", handlePaginatedScroll);
    }
  } catch (error) {
    console.error("❌ Error loading community builds:", error);
  }
}

function handlePaginatedScroll(e) {
  const el = e.target;
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;

  if (nearBottom && hasMoreBuilds && !isLoadingMoreBuilds) {
    fetchNextCommunityBuilds(batchSize).then(renderCommunityBuildBatch);
  }
}

async function incrementBuildViews(db, buildId) {
  try {
    const buildRef = doc(db, "publishedBuilds", buildId);

    // ✅ Increment views directly using Firestore's `increment()` function
    await updateDoc(buildRef, { views: increment(1) });

    // ✅ Update UI immediately
    const viewElement = document.querySelector(
      `.view-chip[data-id="${buildId}"] .view-count`
    );
    if (viewElement) {
      viewElement.textContent = parseInt(viewElement.textContent) + 1;
    }

    console.log(`👀 View count updated for Build ID: ${buildId}`);
  } catch (error) {
    console.error("❌ Error updating view count:", error);
  }
}

// ✅ Update Build Preview
function showBuildPreview(build) {
  const communityBuildPreview = document.getElementById(
    "communityBuildPreview"
  );

  if (!communityBuildPreview) {
    console.error("❌ Error: communityBuildPreview element not found!");
    return;
  }

  const formattedBuildOrder = Array.isArray(build.buildOrder)
    ? build.buildOrder
        .map((step, index) => {
          if (!step || typeof step !== "object") {
            console.warn("❗ Bad step format at index", index, step);
            return `<p style="color:red;"><em>Malformed step at index ${index}</em></p>`;
          }

          const bracket = step.workersOrTimestamp || "";
          const action = step.action || "";

          // Skip completely empty lines
          if (!bracket && !action) return "";

          return `<p><strong>${
            bracket ? `[${bracket}]` : ""
          }</strong> ${formatActionText(action)}</p>`;
        })
        .join("")
    : "<p>No build order available.</p>";

  communityBuildPreview.innerHTML = `
    <div class="preview-header">
      <h3>${build.title}</h3>
    </div>
    <div class="preview-build-order">
      <div id="buildOrderOutput">${formattedBuildOrder}</div>
    </div>
  `;

  communityBuildPreview.style.display = "block";
}

const communitySearchInput = document.getElementById("communitySearchBar");
if (communitySearchInput) {
  communitySearchInput.addEventListener("input", async function () {
    const query = this.value;
    await searchCommunityBuilds(query);
  });
}

function updateVoteUI(buildId, upvotes, downvotes, userVote) {
  const upvoteButton = document.querySelector(`.vote-up[data-id="${buildId}"]`);
  const downvoteButton = document.querySelector(
    `.vote-down[data-id="${buildId}"]`
  );
  const votePercentage = document.querySelector(
    `.vote-percentage[data-id="${buildId}"]`
  );
  const voteCount = document.querySelector(`.vote-count[data-id="${buildId}"]`);

  if (!upvoteButton || !downvoteButton || !votePercentage) return;

  // Update SVG icons
  upvoteButton.querySelector("img").src =
    userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";
  downvoteButton.querySelector("img").src =
    userVote === "down"
      ? "./img/SVG/voted-down.svg"
      : "./img/SVG/vote-down.svg";

  // Highlight selected vote
  upvoteButton.classList.toggle("voted-up", userVote === "up");
  downvoteButton.classList.toggle("voted-down", userVote === "down");

  // Calculate vote percentage
  const totalVotes = upvotes + downvotes;
  const percentage =
    totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 0;
  votePercentage.textContent = `${percentage}%`;

  // Update vote count text
  if (voteCount) {
    voteCount.textContent = `${totalVotes} votes`;
  }
}

// Close modal when clicking outside of modal content
document.addEventListener("click", (event) => {
  const modal = document.getElementById("communityModal");
  const modalContent = document.querySelector(".modal-content-template");
  if (event.target === modal && !modalContent.contains(event.target)) {
    modal.style.display = "none";
  }
});

// Show publish button only when a build is saved in Firestore
export async function checkPublishButtonVisibility() {
  const publishButton = document.getElementById("publishBuildButton");
  if (!publishButton) return;

  const user = auth.currentUser;
  if (!user) {
    publishButton.style.display = "none";
    return;
  }

  const db = getFirestore();
  const buildsRef = collection(db, `users/${user.uid}/builds`);
  const snapshot = await getDocs(buildsRef);

  if (snapshot.docs.length === 0) {
    publishButton.style.display = "none";
    return;
  }

  const latestBuild = snapshot.docs[0].data();
  const publishedBuildsRef = collection(db, "publishedBuilds");

  // ✅ Query the community builds collection for this specific user's build
  const userCommunityBuildQuery = query(
    publishedBuildsRef,
    where("publisherId", "==", user.uid),
    where("title", "==", latestBuild.title) // Only check if this specific title exists
  );
  const userCommunityBuildSnapshot = await getDocs(userCommunityBuildQuery);

  if (!userCommunityBuildSnapshot.empty) {
    // ✅ Build is already published
    publishButton.innerText = "✅ Published";
    publishButton.disabled = true;
  } else {
    // ✅ Build is not published yet, show the button
    publishButton.innerText = "📢 Publish Build";
    publishButton.disabled = false;
    publishButton.style.display = "block"; // ✅ Ensure button is visible
  }
}

const publishButton = document.getElementById("publishBuildButton");
if (publishButton) {
  publishButton.addEventListener("click", async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("You must be signed in to publish builds.");
      return;
    }

    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists() || !userSnapshot.data().username) {
      alert("You must set a username before publishing.");
      return;
    }

    const username = userSnapshot.data().username;
    const buildsRef = collection(db, `users/${user.uid}/builds`);
    const q = query(buildsRef, orderBy("timestamp", "desc"), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("No saved builds available for publishing.");
      return;
    }

    const buildToPublish = snapshot.docs[0].data();
    const publishedBuildsRef = collection(db, "publishedBuilds");

    try {
      const docRef = await addDoc(publishedBuildsRef, {
        ...buildToPublish,
        publisherId: user.uid,
        username: username,
        isPublished: true,
        datePublished: new Date().toISOString(),
      });

      console.log(`✅ Build published with ID: ${docRef.id}`);
      alert("Build successfully published to the community!");

      const buildDocRef = snapshot.docs[0].ref;
      await setDoc(buildDocRef, { ...buildToPublish, isPublished: true });

      publishButton.innerText = "✅ Published";
      publishButton.disabled = true;
    } catch (error) {
      console.error("❌ Error publishing build:", error);
      alert("Failed to publish build. Please check your permissions.");
    }
  });
}

export async function publishBuildToCommunity(buildId) {
  try {
    const user = auth.currentUser;

    if (!user) {
      alert("You must be signed in to publish builds.");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists() || !userSnapshot.data().username) {
      alert("You must set a username before publishing.");
      return;
    }

    const username = userSnapshot.data().username;

    const buildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
    const buildSnapshot = await getDoc(buildRef);

    if (!buildSnapshot.exists()) {
      alert("Build not found.");
      return;
    }

    const buildData = buildSnapshot.data();

    const publishedBuildsRef = collection(db, "publishedBuilds");
    const subcategory = buildData.subcategory || "";
    const formattedSubcategory = formatMatchup(subcategory);
    const subcategoryLowercase = subcategory.toLowerCase();

    const newBuildData = {
      ...buildData,
      publisherId: user.uid,
      username: username,
      isPublished: true,
      datePublished: new Date().toISOString(),
      subcategory: formattedSubcategory, // for display ("ZvP")
      subcategoryLowercase: subcategoryLowercase, // for query ("zvp")
    };

    await addDoc(publishedBuildsRef, newBuildData);
    console.log(`✅ Published build ID ${buildId} to community`);

    // ✅ Mark user build as published
    await setDoc(
      buildRef,
      { ...buildData, isPublished: true },
      { merge: true }
    );

    // ✅ Toast
    showToast("✅ Build published to Community!", "success");

    // ✅ Update UI immediately
    const buildCard = document.querySelector(
      `.build-card[data-id="${buildId}"]`
    );
    if (buildCard) {
      const publishInfo = buildCard.querySelector(".build-publish-info");
      if (publishInfo) {
        publishInfo.innerHTML = `<img src="./img/SVG/checkmark2.svg" alt="Published" class="publish-icon">`;
        publishInfo.dataset.tooltip = "published";
        publishInfo.classList.remove("publish-unpublished");
        publishInfo.classList.add("publish-published");
        publishInfo.onclick = (event) => {
          event.stopPropagation();
          openPublishSettingsModal(buildId);
        };
      }
    }

    showToast("✅ Build published to Community!", "success");
  } catch (error) {
    console.error("❌ Error publishing build:", error.message, error.stack);
    alert("Failed to publish build. Please check your permissions.");
  }
}

window.publishBuildToCommunity = async function (buildId) {
  const { getFirestore, doc, getDoc, collection, addDoc, setDoc } =
    await import("firebase/firestore");
  const { getAuth } = await import("firebase/auth");

  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    alert("You must be signed in to publish.");
    return;
  }

  const userBuildRef = doc(db, `users/${user.uid}/builds/${buildId}`);
  const userBuildSnap = await getDoc(userBuildRef);

  if (!userBuildSnap.exists()) {
    alert("❌ Build not found.");
    return;
  }

  const build = userBuildSnap.data();

  const { encodedTitle, isPublished, timestamp, imported, ...buildToPublish } =
    build;

  // Required for Firestore rule compliance
  buildToPublish.title = build.title || "Untitled Build";
  buildToPublish.category = build.category || "Zerg";
  buildToPublish.subcategory = build.subcategory || "ZvP";
  buildToPublish.publisherId = user.uid;
  buildToPublish.username = build.publisher || "Anonymous";
  buildToPublish.isPublished = true;
  buildToPublish.datePublished = new Date().toISOString();

  // Analytics fields
  buildToPublish.views = 0;
  buildToPublish.upvotes = 0;
  buildToPublish.downvotes = 0;
  buildToPublish.userVotes = {};

  try {
    await addDoc(collection(db, "publishedBuilds"), buildToPublish);

    // ✅ Mark original build as published
    await setDoc(
      userBuildRef,
      { ...build, isPublished: true },
      { merge: true }
    );

    // ✅ Update publish icon in build card
    const buildCard = document.querySelector(
      `.build-card[data-id="${buildId}"]`
    );
    if (buildCard) {
      const publishInfo = buildCard.querySelector(".build-publish-info");
      if (publishInfo) {
        publishInfo.innerHTML = `<img src="./img/SVG/checkmark2.svg" alt="Published" class="publish-icon">`;
        publishInfo.dataset.tooltip = "published";
        publishInfo.classList.remove("publish-unpublished");
        publishInfo.classList.add("publish-published");
        publishInfo.onclick = (event) => {
          event.stopPropagation();
          openPublishSettingsModal(buildId); // Optional: if you support publish settings
        };
      }
    }

    // ✅ Close modal if open
    const modal = document.querySelector(
      ".modal-content.small-modal"
    )?.parentElement;
    if (modal) modal.style.display = "none";

    // ✅ Show toast
    showToast("✅ Build published to community!", "success");
  } catch (err) {
    console.error("❌ Failed to publish:", err);
    alert("❌ Failed to publish build. Check your connection or permissions.");
  }
};

export async function searchCommunityBuilds(searchTerm) {
  const lower = searchTerm.toLowerCase().trim();
  const requestId = ++currentRequestId;

  // Revert to existing filter when search is cleared
  if (!lower) {
    const stored = localStorage.getItem("communityFilterValue") || "all";
    await filterCommunityBuilds(stored);
    return;
  }

  // Reset race/matchup filters to avoid conflicts
  localStorage.setItem("communityFilterValue", "all");
  const buttons = document.querySelectorAll(
    "#communityModal .filter-category, #communityModal .subcategory"
  );
  buttons.forEach((btn) => btn.classList.remove("active"));
  const allBtn = document.querySelector(
    '#communityModal .filter-category[data-category="all"]'
  );
  if (allBtn) allBtn.classList.add("active");

  const db = getFirestore();
  const type = localStorage.getItem("communityBuildType") || "public";
  const constraints = [orderBy("datePublished", "desc"), limit(50)];

  if (type === "public") {
    constraints.push(where("isPublic", "==", true));
  } else if (type === "clan") {
    const user = auth.currentUser;
    if (!user) return;

    const clansSnap = await getDocs(collection(db, "clans"));
    const clanIds = [];
    clansSnap.forEach((doc) => {
      const clan = doc.data();
      if (clan.members?.includes(user.uid)) clanIds.push(doc.id);
    });

    if (clanIds.length === 0) {
      renderCommunityBuildBatch([]);
      return;
    }

    constraints.push(where("sharedToClans", "array-contains-any", clanIds));
  }

  const q = query(collection(db, "publishedBuilds"), ...constraints);
  const snap = await getDocs(q);
  if (requestId !== currentRequestId) return;

  const now = Date.now();

  const builds = snap.docs.map((doc) => {
    const data = doc.data();
    const upvotes = data.upvotes || 0;
    const downvotes = data.downvotes || 0;

    let datePublishedRaw = now;
    let datePublished = "Unknown";

    try {
      let ts = data.datePublished;
      if (ts && typeof ts.toMillis === "function") ts = ts.toMillis();
      if (typeof ts === "number") {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          datePublishedRaw = ts;
          datePublished = formatShortDate(d);
        }
      }
    } catch (err) {
      console.warn("❌ Failed to parse datePublished:", data.datePublished);
    }

    const ageInHours = (now - datePublishedRaw) / (1000 * 60 * 60);
    const gravity = 1.5;
    const hotnessScore =
      (upvotes - downvotes) / Math.pow(ageInHours + 2, gravity);

    return {
      id: doc.id,
      title: data.title || "Untitled Build",
      publisher: data.username || "Anonymous",
      matchup: formatMatchup(
        data.subcategoryLowercase || data.subcategory || ""
      ),
      category: data.category || "Unknown",
      subcategory: data.subcategory || "Unknown",
      datePublishedRaw,
      datePublished,
      views: data.views || 0,
      upvotes,
      downvotes,
      hotnessScore,
    };
  });

  const filteredBuilds = builds.filter(
    (b) =>
      (b.title && b.title.toLowerCase().includes(lower)) ||
      (b.publisher && b.publisher.toLowerCase().includes(lower))
  );

  const sortMode = communitySortMode || "new";
  if (sortMode === "top") {
    filteredBuilds.sort(
      (a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes)
    );
  } else if (sortMode === "hot") {
    filteredBuilds.sort((a, b) => b.hotnessScore - a.hotnessScore);
  } else {
  filteredBuilds.sort((a, b) => b.datePublishedRaw - a.datePublishedRaw);
  }

  const heading = document.querySelector("#communityModal h3");
  if (heading) heading.textContent = `Community Builds - ${searchTerm}`;

  const container = document.getElementById("communityBuildsContainer");
  if (container) {
    container.innerHTML = "";
    renderedBuildIds.clear();
  }

  // Disable infinite scroll when searching to prevent duplicate batches
  const scrollContainer = document.getElementById("communityBuildsContainer");
  if (scrollContainer) {
    scrollContainer.removeEventListener("scroll", handlePaginatedScroll);
  }
  lastVisibleDoc = null;
  hasMoreBuilds = false;

  renderCommunityBuildBatch(filteredBuilds);
  const countEl = document.getElementById("buildCount");
  if (countEl) countEl.textContent = `${filteredBuilds.length} build${
    filteredBuilds.length === 1 ? "" : "s"}`;
}
/*
export function filterCommunityBuilds(categoryOrSubcat = "all") {
  const lowerFilter = categoryOrSubcat.toLowerCase();

  if (!allCommunityBuilds || allCommunityBuilds.length === 0) {
    console.error("No community builds available.");
    return;
  }

  const filtered = allCommunityBuilds.filter((build) => {
    const categoryMatch =
      ["zerg", "protoss", "terran"].includes(lowerFilter) &&
      build.category?.toLowerCase() === lowerFilter;

    const subcategoryMatch =
      ["zvp", "zvt", "zvz", "pvp", "pvt", "pvz", "tvt", "tvp", "tvz"].includes(
        lowerFilter
      ) && build.subcategory?.toLowerCase() === lowerFilter;

    return lowerFilter === "all" || categoryMatch || subcategoryMatch;
  });

  populateCommunityBuilds(filtered);
}
*/
function renderCommunityBuildBatch(builds) {
  const container = document.getElementById("communityBuildsContainer");
  const nextBatch = builds;

  nextBatch.forEach((build) => {
    if (renderedBuildIds.has(build.id)) {
      return;
    }
    renderedBuildIds.add(build.id);
    const totalVotes = build.upvotes + build.downvotes;
    const votePercentage =
      totalVotes > 0 ? Math.round((build.upvotes / totalVotes) * 100) : 0;

    // 🧠 Normalize matchup for image + meta display
    const matchup = build.matchup || build.subcategory || "Unknown";
    console.log("🧪 Build:", build.title, "| Matchup:", matchup);

    let matchupImage = "./img/race/unknown.webp";
    let matchupClass = "matchup-unknown";

    if (["ZvZ", "ZvT", "ZvP"].includes(matchup)) {
      matchupImage = "./img/race/zerg2.webp";
      matchupClass = "matchup-zerg";
    } else if (["PvP", "PvZ", "PvT"].includes(matchup)) {
      matchupImage = "./img/race/protoss2.webp";
      matchupClass = "matchup-protoss";
    } else if (["TvP", "TvT", "TvZ"].includes(matchup)) {
      matchupImage = "./img/race/terran2.webp";
      matchupClass = "matchup-terran";
    }

    const buildEntry = document.createElement("div");
    buildEntry.classList.add("build-entry");
    buildEntry.dataset.id = build.id;

    buildEntry.addEventListener("click", async () => {
      window.location.href = `viewBuild.html?id=${build.id}`;
      await incrementBuildViews(db, build.id);
    });

    buildEntry.addEventListener("mouseover", () => showBuildPreview(build));

    buildEntry.innerHTML = `
      <div class="build-left ${matchupClass}">
        <img src="${matchupImage}" alt="${matchup}" class="matchup-icon">
      </div>
      <div class="build-right">
        <div class="build-title">${build.title}</div>
        <div class="build-meta">
          <span class="meta-chip matchup-chip">${formatMatchup(matchup)}</span>
          <span class="meta-chip publisher-chip">
            <img src="./img/SVG/user-svgrepo-com.svg" alt="Publisher" class="meta-icon">
            ${build.publisher}
          </span>
          <span class="meta-chip">
            <img src="./img/SVG/time.svg" alt="Date" class="meta-icon">
            ${formatShortDate(build.datePublished)}
          </span>
          <span class="meta-chip view-chip" data-id="${build.id}">
            <img src="./img/SVG/preview.svg" alt="Views" class="meta-icon">
            <span class="view-count">${build.views}</span> Views
          </span>
          <span class="meta-chip vote-info">
            <span class="vote-percentage">${votePercentage}%</span>
            <span class="vote-count">${totalVotes} votes</span>
          </span>
        </div>
      </div>
    `;

    container.appendChild(buildEntry);
  });
  updateTooltips();
}

document
  .getElementById("communitySortDropdown")
  ?.addEventListener("change", (e) => {
    const mode = e.target.value;
    setCommunitySortMode(mode);
  });

function setCommunitySortMode(mode) {
  communitySortMode = mode;
  const searchValue = document.getElementById("communitySearchBar")?.value.trim();
  if (searchValue) {
    searchCommunityBuilds(searchValue);
  } else {
    populateCommunityBuilds(); // re-fetch from Firestore using new sort mode
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function filterCommunityBuilds(filter = "all") {
  const requestId = ++currentRequestId;
  const db = getFirestore();
  const container = document.getElementById("communityBuildsContainer");
  container.innerHTML = "";
  renderedBuildIds.clear();

  // Disable infinite scroll when filtering to avoid duplicate builds
  const scrollContainer = document.getElementById("communityBuildsContainer");
  if (scrollContainer) {
    scrollContainer.removeEventListener("scroll", handlePaginatedScroll);
  }
  lastVisibleDoc = null;
  hasMoreBuilds = false;

  const lowerFilter = filter.toLowerCase();
  const type = localStorage.getItem("communityBuildType") || "public";

  let baseQuery = collection(db, "publishedBuilds");
  const constraints = [];

  // ✅ Public builds
  if (type === "public") {
    constraints.push(where("isPublic", "==", true));
  }

  // ✅ Clan builds
  else if (type === "clan") {
    const user = auth.currentUser;
    if (!user) return;

    const clansSnap = await getDocs(collection(db, "clans"));
    const userClanIds = [];

    clansSnap.forEach((doc) => {
      const clan = doc.data();
      if (clan.members?.includes(user.uid)) {
        userClanIds.push(doc.id);
      }
    });

    if (userClanIds.length === 0) {
      renderCommunityBuildBatch([]); // No clan access = no builds
      return;
    }

    constraints.push(where("sharedToClans", "array-contains-any", userClanIds));
  }

  // ✅ Subcategory filter (e.g., ZvP, TvT)
  if (
    ["zvp", "zvt", "zvz", "pvp", "pvt", "pvz", "tvp", "tvt", "tvz"].includes(
      lowerFilter
    )
  ) {
    constraints.push(where("subcategoryLowercase", "==", lowerFilter));
  }

  // ✅ Race category filter (Zerg, Protoss, Terran)
  else if (["zerg", "protoss", "terran"].includes(lowerFilter)) {
    constraints.push(where("category", "==", capitalize(lowerFilter)));
  }

  constraints.push(orderBy("datePublished", "desc"), limit(20));

  const q = query(baseQuery, ...constraints);

  try {
    const snap = await getDocs(q);
    if (requestId !== currentRequestId) return;

    const builds = snap.docs.map((doc) => {
      const data = doc.data();

      let datePublishedRaw = Date.now();
      let datePublished = "Unknown";

      try {
        let timestampValue = data.datePublished;

        if (timestampValue && typeof timestampValue.toMillis === "function") {
          timestampValue = timestampValue.toMillis();
        }

        if (typeof timestampValue === "number") {
          const parsed = new Date(timestampValue);
          if (!isNaN(parsed.getTime())) {
            datePublishedRaw = timestampValue;
            datePublished = formatShortDate(parsed);
          }
        }
      } catch (err) {
        console.warn("❌ Failed to parse datePublished:", data.datePublished);
      }

      return {
        id: doc.id,
        ...data,
        matchup: formatMatchup(
          data.subcategoryLowercase || data.subcategory || ""
        ),
        datePublished,
        views: data.views || 0,
        upvotes: data.upvotes || 0,
        downvotes: data.downvotes || 0,
      };
    });

    renderCommunityBuildBatch(builds);

    await updateTotalBuildCount(filter);

    // 📝 Update heading
    const heading = document.querySelector("#communityModal h3");
    let displayLabel = capitalize(type); // Public or Clan
    if (
      ["zvp", "zvt", "zvz", "pvp", "pvt", "pvz", "tvp", "tvt", "tvz"].includes(
        lowerFilter
      )
    ) {
      displayLabel += " - " + formatMatchup(lowerFilter);
    } else if (["zerg", "protoss", "terran"].includes(lowerFilter)) {
      displayLabel += " - " + capitalize(lowerFilter);
    }

    heading.textContent = `Community Builds - ${displayLabel}`;
  } catch (err) {
    console.error("Error filtering community builds:", err);
  }
}

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
