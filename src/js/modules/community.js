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
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { formatActionText } from "./textFormatters.js";
import { showToast } from "./toastHandler.js";
import { formatMatchup, formatShortDate } from "./modal.js";

import { auth, db } from "../../app.js"; // ✅ Ensure auth and db are imported correctly
import DOMPurify from "dompurify";
import { updateTooltips } from "./tooltip.js";
import { getUserMainClanInfo } from "./clan.js";

let communitySortMode = "hot"; // default sort mode

const batchSize = 13;

let lastVisibleDoc = null;
let isLoadingMoreBuilds = false;
let hasMoreBuilds = true;

const publisherClanCache = {};
//
// Clan info for the publisher is stored directly on each published build.
// Older builds might not have it. To provide a fallback without violating
// Firestore security rules, we query the public `clans` collection and
// return the first clan that lists the user as a member.
//
export async function getPublisherClanInfo(uid) {
  if (uid in publisherClanCache) return publisherClanCache[uid];

  try {
    const db = getFirestore();
    const q = query(
      collection(db, "clans"),
      where("members", "array-contains", uid),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const clanDoc = snap.docs[0];
      const info = { id: clanDoc.id, ...clanDoc.data() };
      publisherClanCache[uid] = info;
      return info;
    }
  } catch (e) {
    console.error("Failed to fetch clan info", e);
  }

  publisherClanCache[uid] = null;
  return null;
}

async function getUserClansMap() {
  const map = {};
  const user = auth.currentUser;
  if (!user) return map;

  const clansSnap = await getDocs(collection(db, "clans"));
  clansSnap.forEach((doc) => {
    const clan = doc.data();
    if (clan.members?.includes(user.uid)) {
      map[doc.id] = { name: clan.name, logoUrl: clan.logoUrl };
    }
  });
  return map;
}

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
  const docs = snap.docs;

  if (docs.length < batchSize) hasMoreBuilds = false;
  lastVisibleDoc = docs[docs.length - 1];

  const now = Date.now();

  const builds = await Promise.all(
    docs.map(async (doc) => {
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

      const publisherClan =
        data.publisherClan || (await getPublisherClanInfo(data.publisherId));
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
        publisherClan,
      };
    })
  );

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
  const container = document.getElementById("communityBuildsContainer");
  container.innerHTML = "";

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
      publisherClan: null,
      isPublished: true,
      datePublished: new Date().toISOString(),
      subcategory: formattedSubcategory, // for display ("ZvP")
      subcategoryLowercase: subcategoryLowercase, // for query ("zvp")
    };

    try {
      const clan = await getUserMainClanInfo(user.uid);
      if (clan) {
        newBuildData.publisherClan = {
          name: clan.name,
          tag: clan.abbreviation || clan.tag || "",
          logoUrl: clan.logoUrl || null,
        };
      }
    } catch (e) {
      console.error("Failed to fetch main clan info", e);
    }

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

window.publishBuildToCommunity = async function (
  buildId,
  { isPublic, sharedToClans }
) {
  const { getFirestore, doc, getDoc, collection, addDoc, setDoc } =
    await import(
      "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js"
    );
  const { getAuth } = await import(
    "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js"
  );

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

  // Required fields
  buildToPublish.title = build.title || "Untitled Build";
  buildToPublish.category = build.category || "Zerg";
  buildToPublish.subcategory = build.subcategory || "ZvP";
  buildToPublish.publisherId = user.uid;
  buildToPublish.username = build.publisher || "Anonymous";
  buildToPublish.publisherClan = null;
  buildToPublish.isPublished = true;
  buildToPublish.datePublished = new Date().toISOString();

  // NEW: Publish Settings
  buildToPublish.isPublic = isPublic;
  buildToPublish.sharedToClans = sharedToClans;

  try {
    const { getUserMainClanInfo } = await import("./clan.js");
    const clan = await getUserMainClanInfo(user.uid);
    if (clan) {
      buildToPublish.publisherClan = {
        name: clan.name,
        tag: clan.abbreviation || clan.tag || "",
        logoUrl: clan.logoUrl || null,
      };
    }
  } catch (e) {
    console.error("Failed to fetch main clan info", e);
  }

  // Analytics
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

    showToast("✅ Build published to community!", "success");
  } catch (err) {
    console.error("❌ Failed to publish:", err);
    alert("❌ Failed to publish build. Check your connection or permissions.");
  }
};

export async function searchCommunityBuilds(searchTerm) {
  const lower = searchTerm.toLowerCase().trim();

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
  let userClanMap = {};

  if (type === "public") {
    constraints.push(where("isPublic", "==", true));
  } else if (type === "clan") {
    userClanMap = await getUserClansMap();
    const clanIds = Object.keys(userClanMap);

    if (clanIds.length === 0) {
      renderCommunityBuildBatch([]);
      return;
    }

    constraints.push(where("sharedToClans", "array-contains-any", clanIds));
  }

  const q = query(collection(db, "publishedBuilds"), ...constraints);
  const snap = await getDocs(q);

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
      if (typeof ts === "number" || typeof ts === "string") {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          datePublishedRaw = d.getTime();
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

    const clanId = (data.sharedToClans || []).find((cid) => userClanMap[cid]);
    const clanInfo = clanId ? userClanMap[clanId] : null;

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
      clanInfo,
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
  if (container) container.innerHTML = "";

  renderCommunityBuildBatch(filteredBuilds);
  const countEl = document.getElementById("buildCount");
  if (countEl)
    countEl.textContent = `${filteredBuilds.length} build${
      filteredBuilds.length === 1 ? "" : "s"
    }`;
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
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function renderCommunityBuildBatch(builds) {
  const container = document.getElementById("communityBuildsContainer");
  const nextBatch = builds;

  // ✅ Track already-rendered builds to avoid duplication
  const existingIds = new Set(
    Array.from(container.children).map((el) => el.dataset.id)
  );

  nextBatch.forEach((build) => {
    if (existingIds.has(build.id)) return; // 🛑 Skip duplicate

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
      await incrementBuildViews(db, build.id);

      const matchup = build.subcategory?.toLowerCase() || "unknown";
      const slug = slugify(build.title || "untitled");

      window.location.href = `/build/${matchup}/${slug}/${build.id}`;
    });

    buildEntry.addEventListener("mouseover", () => showBuildPreview(build));

    const clanChip =
      localStorage.getItem("communityBuildType") === "clan" && build.clanInfo
        ? `<span class="meta-chip clan-chip"><img src="${
            build.clanInfo.logoUrl || "./img/clan/logo.webp"
          }" alt="${
            build.clanInfo.name
          }" class="meta-icon" style="width:16px;height:16px;">${DOMPurify.sanitize(
            build.clanInfo.name
          )}</span>`
        : "";

    buildEntry.innerHTML = `
      <div class="build-left ${matchupClass}">
        <img src="${matchupImage}" alt="${matchup}" class="matchup-icon">
      </div>
      <div class="build-right">
        <div class="build-title">${DOMPurify.sanitize(build.title)}</div>
        <div class="build-meta">
          <span class="meta-chip matchup-chip">${formatMatchup(matchup)}</span>
          ${clanChip}
          <span class="meta-chip publisher-chip">
            <img src="${
              build.publisherClan?.logoUrl || "./img/SVG/user-svgrepo-com.svg"
            }" alt="Publisher" class="meta-icon" style="width:16px;height:16px;">
            ${DOMPurify.sanitize(build.publisher)}
          </span>
          <span class="meta-chip">
            <img src="./img/SVG/time.svg" alt="Date" class="meta-icon">
            ${build.datePublished}
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

    const publisherChip = buildEntry.querySelector(".publisher-chip");
    if (publisherChip) {
      publisherChip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const searchInput = document.getElementById("communitySearchBar");
        if (searchInput) searchInput.value = build.publisher;
        searchCommunityBuilds(build.publisher);
      });
    }
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
  const searchValue = document
    .getElementById("communitySearchBar")
    ?.value.trim();
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
  const db = getFirestore();
  const container = document.getElementById("communityBuildsContainer");
  container.innerHTML = "";

  const lowerFilter = filter.toLowerCase();
  const type = localStorage.getItem("communityBuildType") || "public";

  let baseQuery = collection(db, "publishedBuilds");
  const constraints = [];
  let userClanMap = {};

  // ✅ Public builds
  if (type === "public") {
    constraints.push(where("isPublic", "==", true));
  }

  // ✅ Clan builds
  else if (type === "clan") {
    userClanMap = await getUserClansMap();
    const userClanIds = Object.keys(userClanMap);

    if (userClanIds.length === 0) {
      renderCommunityBuildBatch([]); // No clan access = no builds
      return;
    }

    constraints.push(where("sharedToClans", "array-contains-any", userClanIds));
  }

  // ✅ All builds — load user clans so clan tag can show
  else if (type === "all") {
    userClanMap = await getUserClansMap();
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

    const builds = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();

        let datePublishedRaw = Date.now();
        let datePublished = "Unknown";

        try {
          let timestampValue = data.datePublished;

          if (timestampValue && typeof timestampValue.toMillis === "function") {
            timestampValue = timestampValue.toMillis();
          }

          if (
            typeof timestampValue === "number" ||
            typeof timestampValue === "string"
          ) {
            const parsed = new Date(timestampValue);
            if (!isNaN(parsed.getTime())) {
              datePublishedRaw = parsed.getTime();
              datePublished = formatShortDate(parsed);
            }
          }
        } catch (err) {
          console.warn("❌ Failed to parse datePublished:", data.datePublished);
        }

        const clanId = (data.sharedToClans || []).find((id) => userClanMap[id]);
        const clanInfo = clanId ? userClanMap[clanId] : null;
        const publisherClan =
          data.publisherClan || (await getPublisherClanInfo(data.publisherId));

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
          clanInfo,
          publisherClan,
        };
      })
    );

    renderCommunityBuildBatch(builds);

    await updateTotalBuildCount(filter);

    // 📝 Update heading
    const heading = document.querySelector("#communityModal h3");
    let displayLabel = capitalize(type); // Public, Clan, All
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

  localStorage.removeItem("communityFilterValue");
}

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
