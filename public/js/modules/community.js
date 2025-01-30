import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

async function fetchCommunityBuilds() {
  const db = getFirestore();
  const buildsRef = collection(db, "communityBuilds");
  const snapshot = await getDocs(buildsRef);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Untitled Build",
      matchup: data.subcategory || "Unknown",
      publisher: data.username || "Anonymous", // Fetch username instead of publisherId
      datePublished: data.timestamp
        ? new Date(data.timestamp).toISOString()
        : "Unknown",
      buildOrder: Array.isArray(data.buildOrder)
        ? data.buildOrder.join("\n")
        : data.buildOrder || "No build order available.",
    };
  });
}

// Function to populate the community builds table
export async function populateCommunityBuilds() {
  const tableBody = document.getElementById("communityBuildsTableBody");
  const buildPreview = document.getElementById("buildPreview");

  tableBody.innerHTML = ""; // Clear existing rows

  try {
    const builds = await fetchCommunityBuilds();

    builds.forEach((build) => {
      const row = document.createElement("tr");
      row.dataset.id = build.id; // Store build ID for reference

      row.innerHTML = `
        <td>${build.title}</td>
        <td>${build.matchup}</td>
        <td>${build.publisher}</td>
        <td>${new Date(build.datePublished).toLocaleDateString()}</td>
        <td>
            <button class="vote-button thumbs-up" data-id="${
              build.id
            }">👍</button>
            <button class="vote-button thumbs-down" data-id="${
              build.id
            }">👎</button>
            <span class="vote-percentage" data-id="${build.id}">0%</span>
        </td>
        <td><button class="import-button" data-id="${
          build.id
        }">Import</button></td>
      `;

      tableBody.appendChild(row);
    });

    initializeCommunityBuildEvents();
  } catch (error) {
    console.error("Error loading community builds:", error);
  }
}

function initializeCommunityBuildEvents() {
  document.querySelectorAll(".thumbs-up").forEach((button) => {
    button.addEventListener("click", (event) => handleVote(event, 1));
  });

  document.querySelectorAll(".thumbs-down").forEach((button) => {
    button.addEventListener("click", (event) => handleVote(event, -1));
  });

  document.querySelectorAll(".import-button").forEach((button) => {
    button.addEventListener("click", (event) => handleImport(event));
  });
}

// Attach a single event listener to the table body for hover functionality
document
  .getElementById("communityBuildsTableBody")
  .addEventListener("mouseover", (event) => {
    const row = event.target.closest("tr"); // Get the row element
    if (!row) return;

    const buildId = row.dataset.id;
    const build = builds.find((build) => build.id.toString() === buildId);
    if (build) showBuildPreview(build);
  });

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

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    publishButton.style.display = "none";
    return;
  }

  const db = getFirestore();
  const buildsRef = collection(db, `users/${user.uid}/builds`);
  const snapshot = await getDocs(buildsRef);

  // ✅ Show button only if there are saved builds
  publishButton.style.display = snapshot.docs.length > 0 ? "block" : "none";
}

// Publish build function
document
  .getElementById("publishBuildButton")
  .addEventListener("click", async () => {
    const auth = getAuth();
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

    // Get the latest saved build
    const buildToPublish = snapshot.docs[0].data();
    const communityBuildsRef = collection(db, "communityBuilds");

    try {
      // Ensure Firestore document ID is valid (replace spaces with underscores)
      const docId = buildToPublish.title.replace(/\s+/g, "_");

      await setDoc(doc(communityBuildsRef, docId), {
        title: buildToPublish.title || "Untitled Build",
        category: buildToPublish.category || "Unknown",
        subcategory: buildToPublish.subcategory || "Unknown",
        publisherId: user.uid,
        username: username,
        datePublished: new Date().toISOString(),
        buildOrder: Array.isArray(buildToPublish.buildOrder)
          ? buildToPublish.buildOrder
          : buildToPublish.buildOrder
          ? buildToPublish.buildOrder.split("\n")
          : ["No build order available"],
      });

      alert("Build successfully published to the community!");
    } catch (error) {
      console.error("Error publishing build:", error);
      alert("Failed to publish build. Please try again.");
    }
  });

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
