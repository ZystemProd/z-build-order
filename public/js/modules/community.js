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

    if (!doc.id) {
      console.error("❌ Error: Build is missing an ID", data);
    }

    return {
      id: doc.id || null, // ✅ Ensure ID is assigned
      title: data.title || "Untitled Build",
      matchup: data.subcategory || "Unknown",
      publisher: data.username || "Anonymous",
      datePublished: data.datePublished || "Unknown",
      buildOrder: Array.isArray(data.buildOrder)
        ? data.buildOrder
        : typeof data.buildOrder === "string"
        ? data.buildOrder.split("\n")
        : ["No build order available"],
    };
  });
}

// Function to populate the community builds table
let communityBuilds = []; // Global variable to store builds

export async function populateCommunityBuilds(filteredBuilds = null) {
  const tableBody = document.getElementById("communityBuildsTableBody");
  tableBody.innerHTML = ""; // Clear existing rows

  try {
    if (!filteredBuilds) {
      communityBuilds = await fetchCommunityBuilds();
    }

    const buildsToShow = filteredBuilds || communityBuilds;

    if (buildsToShow.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='7'>No builds found.</td></tr>";
      return;
    }

    const user = auth.currentUser;
    const userId = user ? user.uid : null;

    buildsToShow.forEach((build) => {
      const row = document.createElement("tr");
      row.dataset.id = build.id; // ✅ Ensure build ID is stored

      const formattedMatchup = build.matchup
        ? build.matchup.charAt(0).toUpperCase() +
          build.matchup.slice(1, -1).toLowerCase() +
          build.matchup.charAt(build.matchup.length - 1).toUpperCase()
        : "Unknown";

      const upvotes = build.upvotes || 0;
      const downvotes = build.downvotes || 0;
      const totalVotes = upvotes + downvotes;
      const votePercentage =
        totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 0;

      const userVote =
        build.userVotes && userId ? build.userVotes[userId] : null;

      row.innerHTML = `
        <td>
            <button class="view-preview-button" data-id="${
              build.id
            }" data-tooltip="Preview">
                <img src="./img/SVG/preview.svg" alt="Preview" class="community-icon">
            </button>
        </td>
        <td>${DOMPurify.sanitize(build.title)}</td>
        <td>${DOMPurify.sanitize(formattedMatchup)}</td>
        <td>${DOMPurify.sanitize(build.publisher)}</td>
        <td>${new Date(build.datePublished).toLocaleDateString()}</td>
        <td>
            <button class="vote-button vote-up" data-id="${
              build.id
            }" data-tooltip="Upvote">
                <img src="./img/SVG/${
                  userVote === "up" ? "voted-up" : "vote-up"
                }.svg" alt="Upvote" class="community-icon">
            </button>
            <button class="vote-button vote-down" data-id="${
              build.id
            }" data-tooltip="Downvote">
                <img src="./img/SVG/${
                  userVote === "down" ? "voted-down" : "vote-down"
                }.svg" alt="Downvote" class="community-icon">
            </button>
            <span class="vote-percentage" data-id="${
              build.id
            }">${votePercentage}%</span>
        </td>
        <td>
            <button class="import-button" data-id="${
              build.id
            }" data-tooltip="Import">
                <img src="./img/SVG/import.svg" alt="Import" class="community-icon">
            </button>
            <button class="view-build-button" data-id="${
              build.id
            }" data-tooltip="View Build">
                <img src="./img/SVG/view.svg" alt="View" class="community-icon">
            </button>
        </td> 
      `;

      tableBody.appendChild(row);
    });

    initializeCommunityBuildEvents(); // ✅ Attach event listeners for all buttons
  } catch (error) {
    console.error("Error loading community builds:", error);
    tableBody.innerHTML =
      "<tr><td colspan='7'>Failed to load builds.</td></tr>";
  }
}

function attachPreviewButtonEvents() {
  document.querySelectorAll(".view-preview-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const buildId = event.target.getAttribute("data-id");
      console.log("🔍 Preview Button Clicked - Build ID:", buildId); // ✅ Debugging

      const build = communityBuilds.find((b) => b.id === buildId);

      if (build) {
        console.log("✅ Found Build:", build.title); // ✅ Debugging
        showBuildPreview(build);
      } else {
        console.error("❌ Error: Build not found with ID", buildId);
      }
    });
  });
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

  console.log("✅ Displaying build preview for:", build);

  // Ensure the preview container is visible
  communityBuildPreview.style.display = "block";

  console.log("📝 RAW BUILD ORDER:", build.buildOrder);

  // ✅ Format each build action using `formatActionText()`
  const formattedBuildOrder = Array.isArray(build.buildOrder)
    ? build.buildOrder
        .map((step) => {
          if (!step || !step.action || !step.workersOrTimestamp) return ""; // Skip invalid steps
          const formattedAction = formatActionText(step.action); // ✅ Format Action
          return `<p><strong>[${step.workersOrTimestamp}]</strong> ${formattedAction}</p>`;
        })
        .join("")
    : "<p>No build order available.</p>";

  console.log("🔍 FORMATTED BUILD ORDER:", formattedBuildOrder);

  // ✅ Clear old content before inserting new one
  communityBuildPreview.innerHTML = "";

  // ✅ Inject the formatted preview content
  communityBuildPreview.innerHTML = `
    <div class="preview-header">
      <h3>${build.title}</h3>
    <div class="preview-build-order">
      <div id="buildOrderOutput">${formattedBuildOrder}</div>
    </div>
  `;

  console.log(
    "✅ Community Build Preview Updated with Formatted Data:",
    communityBuildPreview.innerHTML
  );
}

// ✅ Clear Build Preview
function clearBuildPreview() {
  const buildPreview = document.getElementById("buildPreview");
  if (!buildPreview) return;
  buildPreview.innerHTML = `<p>Hover over a build to see the details.</p>`;
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
      // Remove vote if user clicks the same button again
      if (voteType === "up") upvotes--;
      if (voteType === "down") downvotes--;
      delete userVotes[userId];
    } else {
      // If switching vote, adjust counts accordingly
      if (previousVote === "up" && voteType === "down") {
        upvotes--;
        downvotes++;
      } else if (previousVote === "down" && voteType === "up") {
        downvotes--;
        upvotes++;
      } else {
        // First time voting
        if (voteType === "up") upvotes++;
        if (voteType === "down") downvotes++;
      }
      userVotes[userId] = voteType;
    }

    await updateDoc(buildRef, { upvotes, downvotes, userVotes });
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

  if (!upvoteButton || !downvoteButton || !votePercentage) return;

  // ✅ Update SVG icons
  upvoteButton.querySelector("img").src =
    userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";

  downvoteButton.querySelector("img").src =
    userVote === "down"
      ? "./img/SVG/voted-down.svg"
      : "./img/SVG/vote-down.svg";

  // ✅ Highlight selected vote
  upvoteButton.classList.toggle("voted-up", userVote === "up");
  downvoteButton.classList.toggle("voted-down", userVote === "down");

  // ✅ Calculate vote percentage
  const totalVotes = upvotes + downvotes;
  const percentage =
    totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 0;
  votePercentage.textContent = `${percentage}%`;
}

document
  .getElementById("communityBuildsTableBody")
  .addEventListener("mouseout", () => {
    clearBuildPreview();
  });

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
