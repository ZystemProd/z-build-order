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
import { formatActionText } from "./textFormatters.js";

async function fetchCommunityBuilds() {
  const db = getFirestore();
  const buildsRef = collection(db, "communityBuilds");
  const snapshot = await getDocs(buildsRef);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    console.log("📥 FETCHED BUILD DATA:", data); // ✅ Log fetched data

    return {
      id: doc.id,
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

export async function populateCommunityBuilds() {
  const tableBody = document.getElementById("communityBuildsTableBody");
  tableBody.innerHTML = ""; // Clear existing rows

  try {
    communityBuilds = await fetchCommunityBuilds(); // ✅ Ensure builds are stored

    communityBuilds.forEach((build) => {
      const row = document.createElement("tr");
      row.dataset.id = build.id; // Store build ID

      row.innerHTML = `
        <td>
          <button class="view-preview-button" data-id="${
            build.id
          }">👁️ Preview</button>
        </td>
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
        <td>
          <button class="import-button" data-id="${build.id}">Import</button>
          <button class="view-build-button" data-id="${
            build.id
          }">🔍 View</button>
        </td> 
      `;

      tableBody.appendChild(row);
    });

    // ✅ Attach event listeners for preview buttons after rows are created
    attachPreviewButtonEvents();
  } catch (error) {
    console.error("Error loading community builds:", error);
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

  // Format the build order as HTML
  const formattedBuildOrder = Array.isArray(build.buildOrder)
    ? build.buildOrder
        .map((step) => {
          if (!step || !step.action || !step.workersOrTimestamp) return ""; // Skip invalid steps
          return `<p><strong>[${step.workersOrTimestamp}]</strong> ${step.action}</p>`;
        })
        .join("")
    : "<p>No build order available.</p>";

  console.log("🔍 FORMATTED BUILD ORDER:", formattedBuildOrder);

  // ✅ Clear the old content before inserting the new one
  communityBuildPreview.innerHTML = "";

  // ✅ Inject the updated preview content
  communityBuildPreview.innerHTML = `
    <div class="preview-header">
      <h3>${build.title}</h3>
      <p><strong>Matchup:</strong> ${build.matchup}</p>
      <p><strong>Publisher:</strong> ${build.publisher}</p>
      <p><strong>Date:</strong> ${new Date(
        build.datePublished
      ).toLocaleDateString()}</p>
    </div>
    <div class="preview-build-order">
      <h4>Build Order</h4>
      <div id="buildOrderOutput">${formattedBuildOrder}</div>
    </div>
  `;

  console.log(
    "✅ Community Build Preview Updated with Data:",
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

  // Attach event listeners for "View Preview" buttons
  attachPreviewButtonEvents();

  // Attach click events to "View Build" buttons
  document.querySelectorAll(".view-build-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const buildId = event.target.getAttribute("data-id");

      if (!buildId) {
        console.error("❌ Error: No build ID found for view-build-button");
        return;
      }

      console.log("✅ Redirecting to viewBuild.html for build ID:", buildId);
      window.location.href = `viewBuild.html?id=${buildId}`;
    });
  });
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
