import { auth, db } from "../../app.js"; // ✅ Reuse Firebase app
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { formatActionText } from "../modules/textFormatters.js"; // ✅ Format build steps
import { MapAnnotations } from "./interactive_map.js"; // ✅ Map support

const backButton = document.getElementById("backButton");

if (backButton) {
  backButton.addEventListener("click", (e) => {
    e.preventDefault();

    localStorage.setItem("restoreCommunityModal", "true");

    // Save search input
    const searchInput = document.getElementById("communitySearchBar");
    if (searchInput && searchInput.value.trim()) {
      localStorage.setItem("communitySearchQuery", searchInput.value.trim());
    } else {
      localStorage.removeItem("communitySearchQuery");
    }

    // Save active filter
    const activeCategory = document
      .querySelector("#communityModal .filter-category.active")
      ?.getAttribute("data-category");

    const activeSubcategory = document
      .querySelector("#communityModal .subcategory.active")
      ?.getAttribute("data-subcategory");

    if (activeSubcategory) {
      localStorage.setItem("communityFilterType", "subcategory");
      localStorage.setItem("communityFilterValue", activeSubcategory);
    } else if (activeCategory && activeCategory !== "all") {
      localStorage.setItem("communityFilterType", "category");
      localStorage.setItem("communityFilterValue", activeCategory);
    } else {
      localStorage.removeItem("communityFilterType");
      localStorage.removeItem("communityFilterValue");
    }

    window.location.href = "index.html";
  });
}

async function loadBuild() {
  const urlParams = new URLSearchParams(window.location.search);
  const buildId = urlParams.get("id");

  if (!buildId) {
    document.getElementById("buildTitle").innerText = "Build not found.";
    console.error("❌ Error: No build ID in URL.");
    return;
  }

  console.log("🔍 Loading build with ID:", buildId);

  const buildRef = doc(db, "communityBuilds", buildId);
  const buildSnapshot = await getDoc(buildRef);

  if (buildSnapshot.exists()) {
    const build = buildSnapshot.data();
    console.log("✅ Build Loaded:", build);

    // Set basic build info
    document.getElementById("buildTitle").innerText =
      build.title || "Untitled Build";
    document.getElementById("buildCategory").innerText =
      build.category || "Unknown";
    document.getElementById("buildMatchup").innerText =
      build.subcategory || "Unknown";
    document.getElementById("buildPublisher").innerText =
      build.username || "Anonymous";
    document.getElementById("buildDate").innerText = new Date(
      build.datePublished
    ).toLocaleDateString();

    // Set build order
    const buildOrderContainer = document.getElementById("buildOrder");
    if (!buildOrderContainer) {
      console.error("❌ Error: 'buildOrder' container not found!");
      return;
    }

    buildOrderContainer.innerHTML = "";

    if (Array.isArray(build.buildOrder) && build.buildOrder.length > 0) {
      build.buildOrder.forEach((step) => {
        if (typeof step === "string") {
          buildOrderContainer.innerHTML += `<p>${formatActionText(step)}</p>`;
        } else if (
          typeof step === "object" &&
          step.action &&
          step.action.trim() !== ""
        ) {
          const bracket = step.workersOrTimestamp
            ? `<strong>[${step.workersOrTimestamp}]</strong> `
            : "";
          buildOrderContainer.innerHTML += `<p>${bracket}${formatActionText(
            step.action
          )}</p>`;
        }
      });
    } else {
      buildOrderContainer.innerHTML = "<p>No build order available.</p>";
    }

    // Set comment
    const commentElement = document.getElementById("buildComment");
    if (commentElement && build.comment) {
      commentElement.innerText = build.comment;
    }

    // Set YouTube link
    const youtubeEmbed = document.getElementById("videoIframe");
    if (youtubeEmbed && build.youtube) {
      youtubeEmbed.src = build.youtube;
    }

    // Set map image
    const mapImage = document.getElementById("map-preview-image");
    const selectedMapText = document.getElementById("selected-map-text");

    if (build.map && mapImage) {
      const formattedMapName = build.map
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w\-]+/g, ""); // Clean filename
      const mapPath = `img/maps/${formattedMapName}.webp`;

      mapImage.src = mapPath;
    }

    if (build.map && selectedMapText) {
      selectedMapText.innerText = build.map; // Display readable map name
    }

    // Setup map and annotations
    const mapContainer = document.getElementById("map-preview-image");
    const annotationsContainer = document.getElementById("map-annotations");

    if (mapContainer && annotationsContainer) {
      const viewMapAnnotations = new MapAnnotations(
        "map-preview-image",
        "map-annotations"
      );

      // 🔥 Disable all user interactions
      viewMapAnnotations.mapContainer.removeEventListener(
        "mousedown",
        viewMapAnnotations.handleMouseDown
      );
      viewMapAnnotations.mapContainer.removeEventListener(
        "mouseup",
        viewMapAnnotations.handleMouseUp
      );
      viewMapAnnotations.mapContainer.removeEventListener(
        "mousemove",
        viewMapAnnotations.handleMouseMove
      );
      viewMapAnnotations.mapContainer.removeEventListener(
        "mouseleave",
        viewMapAnnotations.handleMouseLeave
      );

      // 🔥 Load saved circles
      // After creating circles from build
      if (build.interactiveMap && Array.isArray(build.interactiveMap.circles)) {
        build.interactiveMap.circles.forEach((circle) => {
          if (circle.x !== undefined && circle.y !== undefined) {
            viewMapAnnotations.createCircle(circle.x, circle.y);
          }
        });

        // 🛡 Disable click delete by replacing circles
        viewMapAnnotations.circles.forEach((circleData, index) => {
          const cleanClone = circleData.element.cloneNode(true);
          circleData.element.parentNode.replaceChild(
            cleanClone,
            circleData.element
          );
          viewMapAnnotations.circles[index].element = cleanClone;
        });
      }

      // 🔥 Load saved arrows
      if (build.interactiveMap && Array.isArray(build.interactiveMap.arrows)) {
        build.interactiveMap.arrows.forEach((arrow) => {
          if (
            arrow.startX !== undefined &&
            arrow.startY !== undefined &&
            arrow.endX !== undefined &&
            arrow.endY !== undefined
          ) {
            // Create an arrow manually
            const newArrow = document.createElement("div");
            newArrow.classList.add("annotation-arrow");

            // Calculate placement
            const rect = mapContainer.getBoundingClientRect();
            const mapWidth = rect.width;
            const mapHeight = rect.height;

            const startXPixels = (arrow.startX / 100) * mapWidth;
            const startYPixels = (arrow.startY / 100) * mapHeight;
            const endXPixels = (arrow.endX / 100) * mapWidth;
            const endYPixels = (arrow.endY / 100) * mapHeight;

            const deltaX = endXPixels - startXPixels;
            const deltaY = endYPixels - startYPixels;
            const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Style the arrow
            newArrow.style.position = "absolute";
            newArrow.style.left = `${startXPixels}px`;
            newArrow.style.top = `${startYPixels}px`;
            newArrow.style.width = `${length}px`;
            newArrow.style.height = "2px"; // thin line
            newArrow.style.background = "#00bcd4"; // arrow color
            newArrow.style.transform = `rotate(${angle}deg)`;
            newArrow.style.transformOrigin = "0 0";

            annotationsContainer.appendChild(newArrow);
          }
        });

        // No onclick events needed for arrows (since they are manually added)
      }

      // Disable all interaction with annotations
      annotationsContainer.style.pointerEvents = "none"; // block any user interaction over the annotations
    }
  } else {
    console.error("❌ Build not found in Firestore:", buildId);
    document.getElementById("buildTitle").innerText = "Build not found.";
  }

  // ✅ Setup voting system (inject data-id and update icons)
  const votingButtons = document.querySelectorAll(".vote-button");
  votingButtons.forEach((btn) => {
    btn.setAttribute("data-id", buildId);
    btn.addEventListener("click", async () => {
      const isUpvote = btn.classList.contains("vote-up");
      try {
        await handleVote(buildId, isUpvote ? "up" : "down");
        updateVoteButtonIcons(buildId);
      } catch (err) {
        console.error("❌ Vote error:", err);
      }
    });
  });

  // ✅ Initial icon + count state
  updateVoteButtonIcons(buildId);
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

// ✅ Update Vote Button Icons After Voting
function updateVoteButtonIcons(buildId) {
  const upvoteButton = document.querySelector(`.vote-up[data-id="${buildId}"]`);
  const downvoteButton = document.querySelector(
    `.vote-down[data-id="${buildId}"]`
  );

  if (!upvoteButton || !downvoteButton) return;

  getDoc(doc(db, "communityBuilds", buildId)).then((buildDoc) => {
    if (buildDoc.exists()) {
      const user = auth.currentUser;
      if (!user) return;

      const buildData = buildDoc.data();
      const userVote = buildData.userVotes?.[user.uid];

      // ✅ This must exist to update the percentage & vote count
      updateVoteUI(
        buildId,
        buildData.upvotes || 0,
        buildData.downvotes || 0,
        userVote
      );

      // ✅ Set the icons
      upvoteButton.querySelector("img").src =
        userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";
      downvoteButton.querySelector("img").src =
        userVote === "down"
          ? "./img/SVG/voted-down.svg"
          : "./img/SVG/vote-down.svg";
    }
  });
}

function updateVoteUI(buildId, upvotes, downvotes, userVote) {
  const upvoteButton = document.querySelector(`.vote-up[data-id="${buildId}"]`);
  const downvoteButton = document.querySelector(
    `.vote-down[data-id="${buildId}"]`
  );
  const votePercentage = document.getElementById("vote-percentage-text");
  const voteCount = document.getElementById("vote-count-text");

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

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.includes("viewBuild.html")) return;

  const importBtn = document.getElementById("importBuildButton");

  if (importBtn) {
    auth.onAuthStateChanged(async (user) => {
      const importBtn = document.getElementById("importBuildButton");
      if (!importBtn) return;

      if (!user) {
        importBtn.style.display = "none";
        return;
      }

      // Don't show the button until we know the status
      importBtn.style.display = "none";

      const urlParams = new URLSearchParams(window.location.search);
      const buildId = urlParams.get("id");
      if (!buildId) return;

      const buildRef = doc(db, "communityBuilds", buildId);
      const buildSnap = await getDoc(buildRef);
      if (!buildSnap.exists()) return;

      const buildData = buildSnap.data();
      const encodedTitle = buildData.title.replace(/\//g, "__SLASH__");
      const userBuildRef = doc(db, `users/${user.uid}/builds/${encodedTitle}`);
      const userBuildSnap = await getDoc(userBuildRef);

      if (userBuildSnap.exists()) {
        importBtn.disabled = true;
        importBtn.textContent = "Imported";
        importBtn.classList.add("imported");
      } else {
        importBtn.disabled = false;
        importBtn.textContent = "Import";
      }

      // ✅ Show the button only after the above logic
      importBtn.style.display = "inline-block";
    });
  } else {
    console.warn("⚠️ Import button not found.");
  }

  // ✅ Load build data after DOM ready
  await loadBuild();

  // ✅ Initialize MapAnnotations readonly
  const mapContainer = document.getElementById("map-preview-image");
  const annotationsContainer = document.getElementById("map-annotations");

  if (mapContainer && annotationsContainer) {
    const viewMapAnnotations = new MapAnnotations(
      "map-preview-image",
      "map-annotations"
    );
    annotationsContainer.style.pointerEvents = "none"; // 🔥 Disable interaction
  }
});

window.addEventListener("popstate", () => {
  loadBuild();
});
