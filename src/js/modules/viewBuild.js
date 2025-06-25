import { auth, db, initializeAuthUI } from "../../app.js"; // ✅ Reuse Firebase app
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { formatActionText } from "../modules/textFormatters.js"; // ✅ Format build steps
import {
  MapAnnotations,
  renderMapCards,
  loadMapsOnDemand,
} from "./interactive_map.js"; // ✅ Map support
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import { getUserMainClanInfo } from "./clan.js";

initializeAuthUI();

const backButton = document.getElementById("backButton");
const pageBackButton = document.getElementById("pageBackButton");
const ratingItem = document.getElementById("ratingItem");
const infoGrid = document.querySelector(".build-info-grid");
const mainLayout = document.querySelector(".main-layout");

function adjustRatingPosition() {
  if (!ratingItem || !infoGrid || !mainLayout) return;
  if (window.innerWidth <= 768) {
    if (ratingItem.parentElement !== mainLayout.parentNode) {
      mainLayout.insertAdjacentElement("afterend", ratingItem);
    }
  } else {
    if (!infoGrid.contains(ratingItem)) {
      infoGrid.appendChild(ratingItem);
    }
  }
}

function handleBackClick(e) {
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
}

if (backButton) {
  backButton.addEventListener("click", handleBackClick);
}

if (pageBackButton) {
  pageBackButton.addEventListener("click", handleBackClick);
}

async function incrementBuildViews(buildId) {
  try {
    const buildRef = doc(db, "publishedBuilds", buildId);
    await updateDoc(buildRef, { views: increment(1) });
    console.log(`👀 View count updated for Build ID: ${buildId}`);
  } catch (error) {
    console.error("❌ Error updating view count:", error);
  }
}

async function loadBuild() {
  const pathParts = window.location.pathname.split("/");
  const buildId = pathParts[2]; // because URL is /build/abc123

  if (!buildId) {
    document.getElementById("buildTitle").innerText = "Build not found.";
    console.error("❌ Error: No build ID in URL.");
    return;
  }

  console.log("🔍 Loading build with ID:", buildId);

  // Clear existing map annotations and image before loading new build
  const existingMapImage = document.getElementById("map-preview-image");
  const existingAnnotations = document.getElementById("map-annotations");
  if (existingMapImage) existingMapImage.removeAttribute("src");
  if (existingAnnotations) existingAnnotations.innerHTML = "";

  const buildRef = doc(db, "publishedBuilds", buildId);
  const buildSnapshot = await getDoc(buildRef);

  if (buildSnapshot.exists()) {
    const build = buildSnapshot.data();
    await incrementBuildViews(buildId);
    console.log("✅ Build Loaded:", build);

    // Set basic build info
    document.getElementById("buildTitle").innerText =
      build.title || "Untitled Build";
    const categoryText = build.category || "Unknown";
    const matchupText =
      build.subcategory && build.subcategory.length === 3
        ? build.subcategory.charAt(0).toUpperCase() +
          build.subcategory.charAt(1) +
          build.subcategory.charAt(2).toUpperCase()
        : build.subcategory || "Unknown";
    const publisherText = build.username || "Anonymous";
    const dateText = new Date(build.datePublished).toLocaleDateString();

    const clanInfo = await getUserMainClanInfo(build.publisherId);
    const iconEl = document.getElementById("buildPublisherIcon");
    if (iconEl && clanInfo?.logoUrl) iconEl.src = clanInfo.logoUrl;
    const iconElMob = document.getElementById("buildPublisherIconMobile");
    if (iconElMob && clanInfo?.logoUrl) iconElMob.src = clanInfo.logoUrl;

    document.getElementById("buildCategory").innerText = categoryText;
    document.getElementById("buildMatchup").innerText = matchupText;
    document.getElementById("buildPublisher").innerText = publisherText;
    document.getElementById("buildDate").innerText = dateText;

    const mobileCat = document.getElementById("buildCategoryMobile");
    if (mobileCat) mobileCat.innerText = categoryText;
    const mobileMatch = document.getElementById("buildMatchupMobile");
    if (mobileMatch) mobileMatch.innerText = matchupText;
    const mobilePub = document.getElementById("buildPublisherMobile");
    if (mobilePub) mobilePub.innerText = publisherText;
    const mobileDate = document.getElementById("buildDateMobile");
    if (mobileDate) mobileDate.innerText = dateText;

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

    // Set replay link
    const replayWrapper = document.getElementById("replayViewWrapper");
    const replayHeader = document.getElementById("replayHeader");
    const replayBtn = document.getElementById("replayDownloadBtn");
    if (replayWrapper && replayHeader && replayBtn) {
      if (build.replayUrl && build.replayUrl.trim() !== "") {
        replayBtn.href = build.replayUrl;
        replayWrapper.style.display = "block";
        replayHeader.style.display = "block";
      } else {
        replayWrapper.style.display = "none";
        replayHeader.style.display = "none";
      }
    }

    // Set comment
    const commentElement = document.getElementById("buildComment");
    const commentHeader = document.getElementById("commentHeader");
    if (commentElement && commentHeader) {
      if (build.comment && build.comment.trim() !== "") {
        commentElement.innerText = build.comment;
        commentElement.style.display = "block";
        commentHeader.style.display = "block";
      } else {
        commentElement.style.display = "none";
        commentHeader.style.display = "none";
      }
    }

    // Set YouTube link
    const youtubeEmbed = document.getElementById("videoIframe");
    const videoHeader = document.getElementById("videoHeader");
    if (youtubeEmbed && videoHeader) {
      const link = build.videoLink || build.youtube;
      if (link && link.trim() !== "") {
        updateYouTubeEmbed(link);
        videoHeader.style.display = "block";
      } else {
        clearYouTubeEmbed();
        videoHeader.style.display = "none";
      }
    }
    // Set map image
    const mapImage = document.getElementById("map-preview-image");
    const selectedMapText = document.getElementById("selected-map-text");

    const mapName = (build.map || "").trim();
    const isValidMap =
      mapName &&
      mapName.toLowerCase() !== "index" &&
      mapName.toLowerCase() !== "no map selected";

    let mapExists = false;
    // Map display for view-only
    if (mapImage) {
      if (isValidMap) {
        let mapPath = "";
        try {
          const response = await fetch("/data/maps.json");
          const maps = await response.json();

          const entry = maps.find(
            (m) => m.name.toLowerCase() === mapName.toLowerCase()
          );

          if (entry) {
            mapPath = `img/maps/${entry.folder}/${entry.file}`;
          }
        } catch (err) {
          console.warn("⚠️ Could not load maps.json");
        }

        if (mapPath) {
          mapImage.setAttribute("src", mapPath);
          mapExists = true;
        } else {
          mapImage.removeAttribute("src");
        }
        mapImage.removeAttribute("data-src");
      } else {
        mapImage.removeAttribute("src");
      }
    }

    if (selectedMapText) {
      selectedMapText.innerText = isValidMap && mapExists ? mapName : "";
    }

    const mapContainerWrapper = document.getElementById("map-container");
    if (mapContainerWrapper) {
      mapContainerWrapper.style.display = mapExists ? "block" : "none";
    }

    // Ensure additional section is visible before rendering annotations
    if (mapExists) {
      const secondRow = document.getElementById("secondRow");
      const secondRowHeader = document.querySelector(
        '[data-section="secondRow"]'
      );
      if (secondRow) {
        secondRow.classList.remove("hidden");
        secondRow.classList.add("visible");
      }
      if (secondRowHeader) {
        const arrowIcon = secondRowHeader.querySelector(".arrow");
        if (arrowIcon) arrowIcon.classList.add("open");
      }
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

      const renderAnnotations = () => {
        // 🔥 Load saved circles
        if (
          build.interactiveMap &&
          Array.isArray(build.interactiveMap.circles)
        ) {
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
        if (
          build.interactiveMap &&
          Array.isArray(build.interactiveMap.arrows)
        ) {
          build.interactiveMap.arrows.forEach((arrow) => {
            if (
              arrow.startX !== undefined &&
              arrow.startY !== undefined &&
              arrow.endX !== undefined &&
              arrow.endY !== undefined
            ) {
              viewMapAnnotations.createArrow(
                arrow.startX,
                arrow.startY,
                arrow.endX,
                arrow.endY
              );
              const last =
                viewMapAnnotations.arrows[viewMapAnnotations.arrows.length - 1];
              if (last && last.element) {
                const clone = last.element.cloneNode(true);
                last.element.parentNode.replaceChild(clone, last.element);
                last.element = clone;
              }
            }
          });
        }

        annotationsContainer.style.pointerEvents = "none";
      };

      if (mapImage.complete && mapImage.naturalWidth > 0) {
        renderAnnotations();
      } else {
        mapImage.addEventListener("load", renderAnnotations, { once: true });
      }
    }
    const additionalHeader = document.getElementById(
      "additionalSettingsHeader"
    );
    const mainLayout = document.querySelector(".main-layout");
    if (additionalHeader || mainLayout) {
      const commentVisible =
        commentElement && commentElement.style.display !== "none";
      const videoVisible =
        youtubeEmbed && youtubeEmbed.style.display !== "none";
      const mapVisible =
        mapContainerWrapper && mapContainerWrapper.style.display !== "none";
      const replayVisible =
        replayWrapper && replayWrapper.style.display !== "none";

      const anyVisible =
        commentVisible || videoVisible || mapVisible || replayVisible;

      const secondRow = document.getElementById("secondRow");
      const secondRowHeader = document.querySelector(
        '[data-section="secondRow"]'
      );
      if (secondRow) {
        if (anyVisible) {
          secondRow.classList.remove("hidden");
          secondRow.classList.add("visible");
        } else {
          secondRow.classList.add("hidden");
          secondRow.classList.remove("visible");
        }
      }
      if (secondRowHeader) {
        const arrowIcon = secondRowHeader.querySelector(".arrow");
        if (arrowIcon) {
          if (anyVisible) {
            arrowIcon.classList.add("open");
          } else {
            arrowIcon.classList.remove("open");
          }
        }
      }

      if (additionalHeader) {
        additionalHeader.style.display = anyVisible ? "block" : "none";
      }
      if (mainLayout) {
        mainLayout.style.display = anyVisible ? "block" : "none";
      }
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

  injectSchemaMarkup(build);
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
  const buildRef = doc(db, "publishedBuilds", buildId);

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

  getDoc(doc(db, "publishedBuilds", buildId)).then((buildDoc) => {
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
  if (!window.location.pathname.startsWith("/build/")) return;

  adjustRatingPosition();
  window.addEventListener("resize", adjustRatingPosition);

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

      const pathParts = window.location.pathname.split("/");
      const buildId = pathParts[2]; // because URL is /build/abc123
      if (!buildId) return;

      const buildRef = doc(db, "publishedBuilds", buildId);
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

function injectSchemaMarkup(build) {
  const steps = (build.buildOrder || []).map((step) => {
    const bracket = step.workersOrTimestamp
      ? `[${step.workersOrTimestamp}]`
      : "";
    const action = typeof step === "string" ? step : step.action || "";
    return {
      "@type": "HowToStep",
      text: `${bracket} ${action}`.trim(),
    };
  });

  const schema = {
    "@context": "https://schema.org/",
    "@type": "HowTo",
    name: build.title || "StarCraft 2 Build Order",
    author: {
      "@type": "Person",
      name: build.username || "Unknown",
    },
    datePublished: build.datePublished
      ? new Date(build.datePublished).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    description: `StarCraft 2 build order for ${
      build.subcategory || "Unknown"
    } matchup.`,
    step: steps,
  };

  // Remove existing schema if present
  const oldSchema = document.querySelector(
    'script[type="application/ld+json"]'
  );
  if (oldSchema) oldSchema.remove();

  // Inject new schema
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema, null, 2);
  document.head.appendChild(script);
}

window.addEventListener("popstate", () => {
  loadBuild();
});
