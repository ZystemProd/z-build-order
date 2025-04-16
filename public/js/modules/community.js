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
import { populateBuildsModal } from "./buildManagement.js"; // ✅ Corrected import
import { auth, db } from "../../app.js"; // ✅ Ensure auth and db are imported correctly

async function fetchCommunityBuilds() {
  const db = getFirestore();
  const buildsRef = collection(db, "communityBuilds");
  const snapshot = await getDocs(buildsRef);

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    // ✅ Use `subcategory` for matchup instead of `matchup`
    let rawMatchup = data.subcategory
      ? data.subcategory.trim().toLowerCase()
      : "unknown";

    // ✅ Ensure the first and last letter are uppercase
    let formattedMatchup = "Unknown";
    if (rawMatchup.length === 3) {
      formattedMatchup =
        rawMatchup.charAt(0).toUpperCase() +
        rawMatchup.charAt(1).toLowerCase() +
        rawMatchup.charAt(2).toUpperCase();
    }

    console.log(
      `🔍 Fetching build: ${
        data.title || "Untitled Build"
      }, Matchup: ${formattedMatchup}`
    ); // Debugging log

    return {
      id: doc.id,
      title: data.title || "Untitled Build",
      publisher: data.username || "Anonymous",
      matchup: formattedMatchup, // ✅ Now properly formatted
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

// Function to populate the community builds table
let communityBuilds = []; // Global variable to store builds
let communityBuildsLoaded = false;
let isPopulatingCommunityBuilds = false;

export async function populateCommunityBuilds() {
  const container = document.getElementById("communityBuildsContainer");
  container.innerHTML = ""; // Clear existing builds

  try {
    const builds = await fetchCommunityBuilds();
    const db = getFirestore();

    builds.forEach((build) => {
      const totalVotes = build.upvotes + build.downvotes;
      const votePercentage =
        totalVotes > 0 ? Math.round((build.upvotes / totalVotes) * 100) : 0;

      console.log(
        `🔍 Processing build: ${build.title}, Matchup: ${build.matchup}`
      );

      // ✅ Determine matchup image based on the matchup
      let matchupImage = "./img/race/unknown.webp"; // Default image
      if (
        build.matchup.includes("ZvZ") ||
        build.matchup.includes("ZvT") ||
        build.matchup.includes("ZvP")
      ) {
        matchupImage = "./img/race/zerg.webp";
      } else if (
        build.matchup.includes("PvP") ||
        build.matchup.includes("PvZ") ||
        build.matchup.includes("PvT")
      ) {
        matchupImage = "./img/race/protoss.webp";
      } else if (
        build.matchup.includes("TvP") ||
        build.matchup.includes("TvT") ||
        build.matchup.includes("TvZ")
      ) {
        matchupImage = "./img/race/terran.webp";
      }

      const buildEntry = document.createElement("div");
      buildEntry.classList.add("build-entry");
      buildEntry.dataset.id = build.id;

      // ✅ Increment view count when clicked
      buildEntry.addEventListener("click", async () => {
        window.location.href = `viewBuild.html?id=${build.id}`;
        await incrementBuildViews(db, build.id); // Increase views in Firestore
      });

      buildEntry.addEventListener("mouseover", () => {
        showBuildPreview(build);
      });

      buildEntry.innerHTML = `
        <div class="build-left">
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
            <div class="vote-info">
              <span class="vote-percentage">${votePercentage}%</span>
              <span class="vote-count">${totalVotes} votes</span>
            </div>
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

communityBuilds.forEach((build) => {
  const row = document.createElement("tr");
  row.dataset.id = build.id; // Store build ID for reference

  row.innerHTML = `
    <td>${build.title}</td>
    <td>${build.matchup}</td>
    <td>${build.publisher}</td>
    <td>${new Date(build.datePublished).toLocaleDateString()}</td>
    <td>
        <button class="vote-button thumbs-up" data-id="${build.id}">👍</button>
        <button class="vote-button thumbs-down" data-id="${
          build.id
        }">👎</button>
        <span class="vote-percentage" data-id="${build.id}">0%</span>
    </td>
    <td>
      <button class="import-button" data-id="${build.id}">Import</button>
      <button class="view-build-button" data-id="${build.id}">🔍 View</button>
    </td> 
  `;

  tableBody.appendChild(row);
});

// ✅ Update Build Preview
function showBuildPreview(build) {
  const communityBuildPreview = document.getElementById(
    "communityBuildPreview"
  );

  if (!communityBuildPreview) {
    console.error("❌ Error: communityBuildPreview element not found!");
    return;
  }

  // ✅ Format each build action properly using `formatActionText()`
  const formattedBuildOrder = Array.isArray(build.buildOrder)
    ? build.buildOrder
        .map((step) => {
          if (!step || !step.action || !step.workersOrTimestamp) return "";
          return `<p><strong>[${
            step.workersOrTimestamp
          }]</strong> ${formatActionText(step.action)}</p>`;
        })
        .join("")
    : "<p>No build order available.</p>";

  // ✅ Inject formatted content
  communityBuildPreview.innerHTML = `
    <div class="preview-header">
      <h3>${build.title}</h3>
    </div>
    <div class="preview-build-order">
      <div id="buildOrderOutput">${formattedBuildOrder}</div>
    </div>
  `;

  // ✅ Ensure the preview container is visible
  communityBuildPreview.style.display = "block";
}

// ✅ Clear Build Preview
function clearBuildPreview() {
  const communityBuildPreview = document.getElementById(
    "communityBuildPreview"
  );
  if (communityBuildPreview) {
    communityBuildPreview.innerHTML =
      "<p>Hover over a build to preview details.</p>";
  }
}

function initializeCommunityBuildEvents() {
  console.log("✅ Initializing event listeners for community builds...");

  // ✅ Attach event listeners for "View Preview" buttons
  document.querySelectorAll(".view-preview-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const buildId = event.currentTarget.getAttribute("data-id");

      if (!buildId) {
        console.error("❌ Error: No Build ID found for preview.");
        return;
      }

      console.log("🔍 Preview Button Clicked - Build ID:", buildId);
      const build = communityBuilds.find((b) => b.id === buildId);

      if (build) {
        console.log("✅ Found Build:", build.title);
        showBuildPreview(build);
      } else {
        console.error("❌ Error: Build not found with ID", buildId);
      }
    });
  });

  // ✅ Attach event listeners for "View Build" buttons
  document.querySelectorAll(".view-build-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const buildId = event.currentTarget.getAttribute("data-id");

      if (!buildId) {
        console.error("❌ Error: No Build ID found for view-build-button");
        return;
      }

      console.log("✅ Redirecting to viewBuild.html for build ID:", buildId);
      window.location.href = `viewBuild.html?id=${buildId}`;
    });
  });

  // ✅ Attach event listeners for "Import" buttons
  document.querySelectorAll(".import-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const buildId = event.currentTarget.getAttribute("data-id");
      console.log("📥 Import Button Clicked - Build ID:", buildId);

      if (!auth.currentUser) {
        alert("You must be signed in to import builds.");
        return;
      }

      const userId = auth.currentUser.uid;
      const communityBuildRef = doc(db, "communityBuilds", buildId);
      const userBuildsRef = collection(db, `users/${userId}/builds`);

      try {
        const buildDoc = await getDoc(communityBuildRef);
        if (!buildDoc.exists()) {
          console.error("❌ Build not found in community builds.");
          alert("Build not found.");
          return;
        }

        const buildData = buildDoc.data();
        const userBuildDocRef = doc(userBuildsRef, buildData.title);

        await setDoc(userBuildDocRef, {
          ...buildData,
          publisher: buildData.username || buildData.publisher || "Unknown",
          imported: true,
          timestamp: Date.now(),
        });

        console.log("✅ Build imported successfully!", buildData);
        alert("Build successfully imported!");
        populateBuildsModal(); // ✅ Refresh user's builds
      } catch (error) {
        console.error("❌ Error importing build:", error);
        alert("Failed to import build. Please try again.");
      }
    });
  });

  // ✅ Attach event listeners for voting buttons (with SVG update)
  document.querySelectorAll(".vote-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const buildId = event.currentTarget.getAttribute("data-id");
      const isUpvote = event.currentTarget.classList.contains("vote-up");
      console.log(
        `${isUpvote ? "👍 Upvote" : "👎 Downvote"} clicked - Build ID:`,
        buildId
      );

      try {
        await handleVote(buildId, isUpvote ? "up" : "down");

        // ✅ After voting, update the SVG icon immediately
        updateVoteButtonIcons(buildId);
      } catch (error) {
        console.error("❌ Error voting:", error);
      }
    });
  });
}

function filterCommunityBuilds(query) {
  const container = document.getElementById("communityBuildsContainer");
  const allBuilds = container.getElementsByClassName("build-entry");

  // Loop through all build entries and hide those that don't match the search query
  Array.from(allBuilds).forEach((buildEntry) => {
    const title = buildEntry
      .querySelector(".build-title")
      .textContent.toLowerCase();
    const matchup = buildEntry
      .querySelector(".meta-chip.matchup-chip")
      .textContent.toLowerCase();

    // Show the build if the title or matchup matches the query, else hide it
    if (title.includes(query) || matchup.includes(query)) {
      buildEntry.style.display = "flex";
    } else {
      buildEntry.style.display = "none";
    }
  });
}

document
  .getElementById("communitySearchBar")
  .addEventListener("input", function () {
    const query = this.value.toLowerCase();
    filterCommunityBuilds(query);
  });

// ✅ Update Vote Button Icons After Voting
function updateVoteButtonIcons(buildId) {
  const upvoteButton = document.querySelector(`.vote-up[data-id="${buildId}"]`);
  const downvoteButton = document.querySelector(
    `.vote-down[data-id="${buildId}"]`
  );

  if (!upvoteButton || !downvoteButton) return;

  // ✅ Fetch the user's vote from Firestore
  getDoc(doc(db, "communityBuilds", buildId)).then((buildDoc) => {
    if (buildDoc.exists()) {
      const user = auth.currentUser;
      if (!user) return;

      const buildData = buildDoc.data();
      const userVote = buildData.userVotes?.[user.uid];

      // ✅ Change icons based on user vote
      upvoteButton.querySelector("img").src =
        userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";

      downvoteButton.querySelector("img").src =
        userVote === "down"
          ? "./img/SVG/voted-down.svg"
          : "./img/SVG/vote-down.svg";
    }
  });
}

async function handleVote(buildId, voteType) {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be signed in to vote.");
    return;
  }

  const userId = user.uid;
  const buildRef = doc(db, "communityBuilds", buildId);

  try {
    const buildDoc = await getDoc(buildRef);
    if (!buildDoc.exists()) {
      console.error("❌ Error: Build not found.");
      return;
    }

    const buildData = buildDoc.data();
    const userVotes = buildData.userVotes || {};
    let upvotes = buildData.upvotes || 0;
    let downvotes = buildData.downvotes || 0;

    const previousVote = userVotes[userId];

    if (previousVote === voteType) {
      // Toggle off: remove vote if user clicks the same button again
      if (voteType === "up") upvotes--;
      else if (voteType === "down") downvotes--;
      delete userVotes[userId];
    } else {
      // If switching vote, first remove the previous vote if any
      if (previousVote === "up") {
        upvotes--;
      } else if (previousVote === "down") {
        downvotes--;
      }

      // Now add the new vote
      if (voteType === "up") {
        upvotes++;
      } else if (voteType === "down") {
        downvotes++;
      }
      userVotes[userId] = voteType;
    }

    // Update Firestore with the new vote counts and userVotes
    await updateDoc(buildRef, { upvotes, downvotes, userVotes });

    // Update UI accordingly
    updateVoteUI(buildId, upvotes, downvotes, userVotes[userId] || null);
  } catch (error) {
    console.error("❌ Error updating vote:", error);
  }
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

// Publish build function
document
  .getElementById("publishBuildButton")
  .addEventListener("click", async () => {
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
    const communityBuildsRef = collection(db, "communityBuilds"); // ✅ Collection reference

    try {
      // ✅ Correct Usage of addDoc - Adds to the collection with an auto-generated ID
      const docRef = await addDoc(communityBuildsRef, {
        ...buildToPublish,
        publisherId: user.uid, // ✅ Ensure publisher ID is included
        username: username, // ✅ Ensure username is included
        isPublished: true, // ✅ Mark as published
        datePublished: new Date().toISOString(),
      });

      console.log(`✅ Build published with ID: ${docRef.id}`);

      alert("Build successfully published to the community!");

      // ✅ Update Local Firestore Build
      const buildDocRef = snapshot.docs[0].ref;
      await setDoc(buildDocRef, { ...buildToPublish, isPublished: true });

      // ✅ Update the Publish Button UI
      const publishButton = document.getElementById("publishBuildButton");
      if (publishButton) {
        publishButton.innerText = "✅ Published";
        publishButton.disabled = true; // Disable button after publishing
      }
    } catch (error) {
      console.error("❌ Error publishing build:", error);
      alert("Failed to publish build. Please check your permissions.");
    }
  });

export function searchCommunityBuilds(query) {
  const lowerCaseQuery = DOMPurify.sanitize(query.toLowerCase());

  // Ensure we have community builds loaded
  if (!communityBuilds || communityBuilds.length === 0) {
    console.error("No community builds available.");
    return;
  }

  // Filter builds based on title
  const filteredBuilds = communityBuilds.filter((build) =>
    build.title.toLowerCase().includes(lowerCaseQuery)
  );

  console.log("🔍 Filtered Builds:", filteredBuilds.length); // Debugging

  // Update UI
  populateCommunityBuilds(filteredBuilds);
}

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
