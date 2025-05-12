import {
  getFirestore,
  collection,
  getDocs,
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
import { formatMatchup } from "./modal.js";
import { populateBuildsModal } from "./buildManagement.js"; // ✅ Corrected import
import { auth, db } from "../../app.js"; // ✅ Ensure auth and db are imported correctly
import DOMPurify from "dompurify";

let communitySortMode = "hot"; // default sort mode

const batchSize = 13;

let lastVisibleDoc = null;
let isLoadingMoreBuilds = false;
let hasMoreBuilds = true;

async function fetchNextCommunityBuilds(batchSize = 20) {
  if (isLoadingMoreBuilds || !hasMoreBuilds) return [];

  isLoadingMoreBuilds = true;
  const db = getFirestore();

  // ✅ Always use a real field for Firestore sort
  const sortMode = communitySortMode || "hot";
  const firestoreSortField = "datePublished"; // must exist in every doc

  let q = query(
    collection(db, "communityBuilds"),
    orderBy(firestoreSortField, "desc"),
    limit(batchSize)
  );

  if (lastVisibleDoc) {
    q = query(
      collection(db, "communityBuilds"),
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

  const builds = docs.map((doc) => {
    const data = doc.data();
    const upvotes = data.upvotes || 0;
    const downvotes = data.downvotes || 0;

    let datePublishedRaw = now;
    let datePublished = "Unknown";

    if (data.datePublished) {
      const parsed = new Date(data.datePublished);
      if (!isNaN(parsed.getTime())) {
        datePublishedRaw = parsed.getTime();
        datePublished = parsed.toLocaleDateString();
      }
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
    const buildRef = doc(db, "communityBuilds", buildId);

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
  communitySearchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    filterCommunityBuilds(query);
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
  const communityBuildsRef = collection(db, "communityBuilds");

  // ✅ Query the community builds collection for this specific user's build
  const userCommunityBuildQuery = query(
    communityBuildsRef,
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
    const communityBuildsRef = collection(db, "communityBuilds");

    try {
      const docRef = await addDoc(communityBuildsRef, {
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

    const communityBuildsRef = collection(db, "communityBuilds");

    const newBuildData = {
      ...buildData,
      publisherId: user.uid,
      username: username,
      isPublished: true,
      datePublished: new Date().toISOString(),
    };

    await addDoc(communityBuildsRef, newBuildData);
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
        publishInfo.innerHTML = `
        <span class="publish-label">Published</span>
        <img src="./img/SVG/checkmark2.svg" alt="Published" class="publish-icon">
      `;
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
    await addDoc(collection(db, "communityBuilds"), buildToPublish);

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
        publishInfo.innerHTML = `
        <span class="publish-label">Published</span>
        <img src="./img/SVG/checkmark2.svg" alt="Published" class="publish-icon">
      `;
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

export function searchCommunityBuilds(query) {
  const lowerQuery = DOMPurify.sanitize(query.toLowerCase());

  if (!allCommunityBuilds || allCommunityBuilds.length === 0) {
    console.error("No community builds available.");
    return;
  }

  const filtered = allCommunityBuilds.filter((build) => {
    const titleMatch = build.title?.toLowerCase().includes(lowerQuery);
    const publisherMatch = build.publisher?.toLowerCase().includes(lowerQuery);
    return titleMatch || publisherMatch;
  });

  populateCommunityBuilds(filtered);
}

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

function renderCommunityBuildBatch(builds) {
  const container = document.getElementById("communityBuildsContainer");
  const nextBatch = builds;

  nextBatch.forEach((build) => {
    const totalVotes = build.upvotes + build.downvotes;
    const votePercentage =
      totalVotes > 0 ? Math.round((build.upvotes / totalVotes) * 100) : 0;

    let matchupImage = "./img/race/unknown.webp";
    let matchupClass = "matchup-unknown";

    if (["ZvZ", "ZvT", "ZvP"].includes(build.matchup)) {
      matchupImage = "./img/race/zerg2.webp";
      matchupClass = "matchup-zerg";
    } else if (["PvP", "PvZ", "PvT"].includes(build.matchup)) {
      matchupImage = "./img/race/protoss2.webp";
      matchupClass = "matchup-protoss";
    } else if (["TvP", "TvT", "TvZ"].includes(build.matchup)) {
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
        <img src="${matchupImage}" alt="${build.matchup}" class="matchup-icon">
      </div>
      <div class="build-right">
        <div class="build-title">${build.title}</div>
        <div class="build-meta">
          <span class="meta-chip matchup-chip">${build.matchup}</span>
          <span class="meta-chip publisher-chip">
            <img src="./img/SVG/user-svgrepo-com.svg" alt="Publisher" class="meta-icon">
            ${build.publisher}
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
  });
}

document
  .getElementById("communitySortDropdown")
  ?.addEventListener("change", (e) => {
    const mode = e.target.value;
    setCommunitySortMode(mode);
  });

function setCommunitySortMode(mode) {
  communitySortMode = mode;
  populateCommunityBuilds(); // re-fetch from Firestore using new sort mode
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
