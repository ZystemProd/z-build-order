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
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { formatActionText } from "./textFormatters.js";
import { showToast } from "./uiHandlers.js";
import { populateBuildsModal } from "./buildManagement.js"; // ✅ Corrected import
import { auth, db } from "../../app.js"; // ✅ Ensure auth and db are imported correctly

let allCommunityBuilds = []; // master dataset
let communityBuilds = []; // filtered or active dataset

async function fetchCommunityBuilds() {
  const db = getFirestore();
  const buildsRef = collection(db, "communityBuilds");
  const snapshot = await getDocs(buildsRef);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const rawMatchup = data.subcategory?.trim().toLowerCase() || "unknown";

    const formattedMatchup =
      rawMatchup.length === 3
        ? rawMatchup.charAt(0).toUpperCase() +
          rawMatchup.charAt(1).toLowerCase() +
          rawMatchup.charAt(2).toUpperCase()
        : "Unknown";

    return {
      id: doc.id,
      title: data.title || "Untitled Build",
      publisher: data.username || "Anonymous",
      matchup: formattedMatchup,
      category: data.category || "Unknown",
      subcategory: data.subcategory || "Unknown",
      datePublished: data.datePublished
        ? new Date(data.datePublished).toLocaleDateString()
        : "Unknown",
      views: data.views || 0,
      upvotes: data.upvotes || 0,
      downvotes: data.downvotes || 0,
      userVotes: data.userVotes || {},
      buildOrder: data.buildOrder || [],
    };
  });
}

export async function populateCommunityBuilds(buildList = null) {
  const container = document.getElementById("communityBuildsContainer");
  container.innerHTML = "";

  try {
    const builds = buildList || (await fetchCommunityBuilds());
    if (!buildList) allCommunityBuilds = builds;
    communityBuilds = builds;

    const db = getFirestore();

    builds.forEach((build) => {
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
  } catch (error) {
    console.error("❌ Error loading community builds:", error);
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
        publishInfo.innerHTML = `<img src="./img/SVG/checkmark2.svg" alt="Published" class="publish-icon">`;
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

export function searchCommunityBuilds(query) {
  const lowerQuery = DOMPurify.sanitize(query.toLowerCase());

  if (!allCommunityBuilds || allCommunityBuilds.length === 0) {
    console.error("No community builds available.");
    return;
  }

  const filtered = allCommunityBuilds.filter((build) =>
    build.title.toLowerCase().includes(lowerQuery)
  );

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

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
