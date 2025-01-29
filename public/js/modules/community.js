import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// Function to populate the community builds table
export async function populateCommunityBuilds() {
  const tableBody = document.getElementById("communityBuildsTableBody");
  const buildPreview = document.getElementById("buildPreview");

  tableBody.innerHTML = ""; // Clear existing rows

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
    const buildsRef = collection(db, `users/${user.uid}/builds`);
    const snapshot = await getDocs(buildsRef);
    if (snapshot.empty) {
      alert("No saved builds available for publishing.");
      return;
    }

    const buildToPublish = snapshot.docs[snapshot.docs.length - 1].data();
    const communityBuildsRef = collection(db, "communityBuilds");

    try {
      await setDoc(
        doc(communityBuildsRef, buildToPublish.title),
        buildToPublish
      );
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
