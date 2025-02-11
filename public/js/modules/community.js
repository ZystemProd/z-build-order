import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
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
    initializeCommunityBuildEvents();
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

// Call check function on page load
document.addEventListener("DOMContentLoaded", checkPublishButtonVisibility);

// Export default
export default {
  populateCommunityBuilds,
  checkPublishButtonVisibility,
};
