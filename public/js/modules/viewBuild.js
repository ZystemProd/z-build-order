import { auth, db } from "../../app.js"; // ✅ Reuse Firebase app
import {
  doc,
  getDoc,
  collection,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { formatActionText } from "../modules/textFormatters.js"; // ✅ Format build steps
import { MapAnnotations } from "./interactive_map.js"; // ✅ Map support

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
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.includes("viewBuild.html")) return;

  const importBtn = document.getElementById("importBuildButton");
  const buildId = new URLSearchParams(window.location.search).get("id");

  if (importBtn) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        importBtn.style.display = "inline-block";
      } else {
        importBtn.style.display = "none";
      }
    });

    importBtn.addEventListener("click", async () => {
      try {
        const communitySnap = await getDoc(doc(db, "communityBuilds", buildId));
        if (!communitySnap.exists()) throw new Error("Build not found");

        const data = communitySnap.data();
        const userBuildRef = doc(
          collection(db, `users/${auth.currentUser.uid}/builds`),
          buildId
        );
        await setDoc(userBuildRef, {
          ...data,
          imported: true,
          timestamp: Date.now(),
        });

        alert("✅ Build imported to your library!");
      } catch (e) {
        console.error(e);
        alert("❌ Failed to import build.");
      }
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
