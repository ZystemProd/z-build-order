import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { auth, db } from "../../app.js"; // ✅ Remove duplicate Firebase init
import { formatActionText } from "../modules/textFormatters.js";

// ✅ Function to get build ID from URL
function getBuildIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

// ✅ Load build details
async function loadBuild() {
  const buildId = getBuildIdFromURL();
  if (!buildId) {
    document.getElementById("buildTitle").innerText = "Build not found.";
    console.error("❌ Error: No build ID in URL.");
    return;
  }

  console.log("🔍 Loading build with ID:", buildId);
  const buildRef = doc(db, "communityBuilds", buildId);
  const buildDoc = await getDoc(buildRef);

  if (!buildDoc.exists()) {
    console.error("❌ Build not found.");
    document.getElementById("buildTitle").innerText = "Build not found.";
    return;
  }

  const build = buildDoc.data();
  console.log("✅ Build Loaded:", build);

  // ✅ Populate Build Data
  document.getElementById("buildTitle").innerText =
    build.title || "Untitled Build";
  document.getElementById("buildPublisher").innerText =
    build.username || "Anonymous";
  document.getElementById("buildDate").innerText = new Date(
    build.datePublished
  ).toLocaleDateString();
  document.getElementById(
    "votePercentage"
  ).innerText = `${calculateVotePercentage(build.upvotes, build.downvotes)}%`;
  document.getElementById("voteCount").innerText = `${
    build.upvotes + build.downvotes
  } votes`;

  // ✅ Update voting buttons
  updateVoteUI(buildId, build);

  // ✅ Load Build Order
  const buildOrderContainer = document.getElementById("buildOrder");
  buildOrderContainer.innerHTML =
    build.buildOrder
      .map((step) => `<p>${formatActionText(step)}</p>`)
      .join("") || "<p>No build order available.</p>";
}

// ✅ Function to calculate vote percentage
function calculateVotePercentage(upvotes, downvotes) {
  const totalVotes = upvotes + downvotes;
  return totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 0;
}

// ✅ Update voting UI dynamically
function updateVoteUI(buildId, build) {
  const user = auth.currentUser;
  const userVote = build.userVotes?.[user?.uid] || null;

  document.getElementById("voteUp").src =
    userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";
  document.getElementById("voteDown").src =
    userVote === "down"
      ? "./img/SVG/voted-down.svg"
      : "./img/SVG/vote-down.svg";
}

// ✅ Handle voting system
async function handleVote(voteType) {
  const buildId = getBuildIdFromURL();
  const user = auth.currentUser;
  if (!user) {
    alert("You must be signed in to vote.");
    return;
  }

  const buildRef = doc(db, "communityBuilds", buildId);
  const buildDoc = await getDoc(buildRef);

  if (!buildDoc.exists()) {
    console.error("❌ Build not found.");
    return;
  }

  const buildData = buildDoc.data();
  let { upvotes, downvotes, userVotes } = buildData;
  userVotes = userVotes || {};

  const previousVote = userVotes[user.uid];

  // ✅ Toggle vote
  if (previousVote === voteType) {
    if (voteType === "up") upvotes--;
    else downvotes--;
    delete userVotes[user.uid];
  } else {
    if (previousVote === "up") upvotes--;
    else if (previousVote === "down") downvotes--;

    if (voteType === "up") upvotes++;
    else downvotes++;

    userVotes[user.uid] = voteType;
  }

  await updateDoc(buildRef, { upvotes, downvotes, userVotes });

  // ✅ Update UI
  updateVoteUI(buildId, { upvotes, downvotes, userVotes });
  document.getElementById(
    "votePercentage"
  ).innerText = `${calculateVotePercentage(upvotes, downvotes)}%`;
  document.getElementById("voteCount").innerText = `${
    upvotes + downvotes
  } votes`;
}

// ✅ Handle Import Build Function
async function importBuild() {
  const buildId = getBuildIdFromURL();
  const user = auth.currentUser;
  if (!user) {
    alert("You must be signed in to import builds.");
    return;
  }

  const buildRef = doc(db, "communityBuilds", buildId);
  const userBuildRef = doc(db, `users/${user.uid}/builds`, buildId);

  try {
    const buildDoc = await getDoc(buildRef);
    if (!buildDoc.exists()) {
      alert("Build not found.");
      return;
    }

    const buildData = buildDoc.data();
    await setDoc(userBuildRef, {
      ...buildData,
      imported: true,
      timestamp: Date.now(),
    });

    alert("✅ Build successfully imported to your library!");
  } catch (error) {
    console.error("❌ Error importing build:", error);
    alert("Failed to import build.");
  }
}

// ✅ Attach Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadBuild();
  document
    .getElementById("voteUp")
    .addEventListener("click", () => handleVote("up"));
  document
    .getElementById("voteDown")
    .addEventListener("click", () => handleVote("down"));
  document
    .getElementById("importButton")
    .addEventListener("click", importBuild);
});
