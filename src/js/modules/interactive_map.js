import DOMPurify from "dompurify";
import { enableSaveButton } from "./utils.js";

// interactive_map.js (FINAL VERSION ✅)

console.log("🗺️ Loading interactive map...");

// Lazy-load maps when interacting with map preview
document.addEventListener("DOMContentLoaded", () => {
  const mapPreviewContainer = document.getElementById("map-preview-container");
  if (!mapPreviewContainer) {
    console.warn(
      "🛑 No map preview container found. Skipping map lazy load setup."
    );
    return;
  }

  let mapsLoaded = false;

  function loadMaps() {
    if (!mapsLoaded) {
      console.log("🔄 Loading maps...");
      loadMapsOnDemand();
      mapsLoaded = true;
    }
  }

  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  if (isMobile) {
    mapPreviewContainer.addEventListener("click", loadMaps, { once: true });
  } else {
    mapPreviewContainer.addEventListener("mouseenter", loadMaps, {
      once: true,
    });
  }

  loadMapsOnDemand();
});

export function loadMapsOnDemand() {
  const mapCards = document.querySelectorAll(".map-card");
  mapCards.forEach((card) => {
    const img = card.querySelector(".map-image");
    const mapSrc = img.getAttribute("data-src");
    if (mapSrc && !img.src) {
      img.src = mapSrc;
      img.removeAttribute("data-src");
    }
  });
  console.log("✅ All maps loaded!");
}

export class MapAnnotations {
  constructor(mapContainerId, annotationsContainerId) {
    this.mapContainer = document.getElementById(mapContainerId);
    this.annotationsContainer = document.getElementById(annotationsContainerId);

    if (!this.mapContainer || !this.annotationsContainer) {
      console.warn("🛑 MapAnnotations initialized but elements missing.");
      return;
    }

    this.circles = [];
    this.arrows = [];
    this.isDrawingArrow = false;
    this.startX = 0;
    this.startY = 0;
    this.mousedownTimer = null;
    this.previewArrow = null;

    this.initializeEventListeners();
  }

  hasActiveMap() {
    try {
      const img = document.getElementById("map-preview-image");
      return !!(img && img.getAttribute("src"));
    } catch (_) {
      return false;
    }
  }

  calculateCoordinates(event) {
    const rect = this.mapContainer.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  nearestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return { x: x1, y: y1 };
    const t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
    );
    return { x: x1 + t * dx, y: y1 + t * dy };
  }

  snapToNearbyPoint(x, y, threshold = 2) {
    let snapped = { x, y };
    let minDist = threshold;

    const checkPoint = (px, py) => {
      const dist = Math.hypot(x - px, y - py);
      if (dist < minDist) {
        snapped = { x: px, y: py };
        minDist = dist;
      }
    };

    this.circles.forEach((c) => checkPoint(c.x, c.y));

    this.arrows.forEach((a) => {
      checkPoint(a.startX, a.startY);
      checkPoint(a.endX, a.endY);
      const nearest = this.nearestPointOnSegment(
        x,
        y,
        a.startX,
        a.startY,
        a.endX,
        a.endY
      );
      checkPoint(nearest.x, nearest.y);
    });

    return snapped;
  }

  createCircle(x, y) {
    ({ x, y } = this.snapToNearbyPoint(x, y));
    const container = document.createElement("div");
    container.classList.add("annotation-circle-container");
    container.style.left = `${x}%`;
    container.style.top = `${y}%`;

    const number = document.createElement("span");
    number.classList.add("annotation-number");
    number.textContent = this.circles.length + 1;

    const circle = document.createElement("div");
    circle.classList.add("annotation-circle");

    container.appendChild(number);
    container.appendChild(circle);
    this.annotationsContainer.appendChild(container);

    enableSaveButton();

    container.addEventListener("click", (e) => {
      e.stopPropagation();
      this.annotationsContainer.removeChild(container);
      const index = this.circles.findIndex((c) => c.element === container);
      if (index !== -1) this.circles.splice(index, 1);
      this.updateCircleNumbers();
      enableSaveButton();
    });

    this.circles.push({ x, y, element: container });
  }

  updateCircleNumbers() {
    this.circles.forEach((circleData, index) => {
      if (circleData.element) {
        const number = circleData.element.querySelector(".annotation-number");
        if (number) number.textContent = index + 1;
      }
    });
  }

  createArrow(startX, startY, endX, endY) {
    const arrow = document.createElement("div");
    arrow.classList.add("annotation-arrow");
    this.updateArrow(arrow, startX, startY, endX, endY);

    arrow.addEventListener("click", (e) => {
      e.stopPropagation();
      this.annotationsContainer.removeChild(arrow);
      const index = this.arrows.findIndex((a) => a.element === arrow);
      if (index !== -1) this.arrows.splice(index, 1);
      enableSaveButton();
    });

    this.annotationsContainer.appendChild(arrow);
    this.arrows.push({ startX, startY, endX, endY, element: arrow });

    enableSaveButton();
  }

  updateArrow(arrow, startX, startY, endX, endY) {
    const rect = this.mapContainer.getBoundingClientRect();
    const mapWidth = rect.width;
    const mapHeight = rect.height;

    const startXPixels = (startX / 100) * mapWidth;
    const startYPixels = (startY / 100) * mapHeight;
    const endXPixels = (endX / 100) * mapWidth;
    const endYPixels = (endY / 100) * mapHeight;

    const deltaX = endXPixels - startXPixels;
    const deltaY = endYPixels - startYPixels;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    arrow.style.left = `${startXPixels}px`;
    arrow.style.top = `${startYPixels}px`;
    arrow.style.width = `${length}px`;
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.style.transformOrigin = "0 50%";
  }

  initializeEventListeners() {
    if (!this.mapContainer) return;

    this.mapContainer.removeEventListener("mousedown", this.handleMouseDown);
    this.mapContainer.removeEventListener("mouseup", this.handleMouseUp);
    this.mapContainer.removeEventListener("mousemove", this.handleMouseMove);
    this.mapContainer.removeEventListener("mouseleave", this.handleMouseLeave);

    this.handleMouseDown = (event) => {
      if (!this.hasActiveMap()) return;
      let { x, y } = this.calculateCoordinates(event);
      ({ x, y } = this.snapToNearbyPoint(x, y));
      this.startX = x;
      this.startY = y;
      this.mousedownTimer = setTimeout(() => {
        this.isDrawingArrow = true;
        this.previewArrow = document.createElement("div");
        this.previewArrow.classList.add("annotation-arrow", "preview-arrow");
        this.annotationsContainer.appendChild(this.previewArrow);
      }, 200);
    };

    this.handleMouseUp = (event) => {
      if (!this.hasActiveMap()) return;
      clearTimeout(this.mousedownTimer);
      let { x, y } = this.calculateCoordinates(event);
      ({ x, y } = this.snapToNearbyPoint(x, y));

      if (this.isDrawingArrow) {
        this.createArrow(this.startX, this.startY, x, y);
        this.isDrawingArrow = false;
        if (this.previewArrow) {
          this.annotationsContainer.removeChild(this.previewArrow);
          this.previewArrow = null;
        }
      } else {
        const clickedArrow = event.target.closest(".annotation-arrow");
        const clickedCircle = event.target.closest(
          ".annotation-circle-container"
        );
        if (!clickedArrow && !clickedCircle) {
          this.createCircle(x, y);
        }
      }
    };

    this.handleMouseMove = (event) => {
      if (!this.hasActiveMap()) return;
      if (this.isDrawingArrow && this.previewArrow) {
        let { x, y } = this.calculateCoordinates(event);
        ({ x, y } = this.snapToNearbyPoint(x, y));
        this.updateArrow(this.previewArrow, this.startX, this.startY, x, y);
      }
    };

    this.handleMouseLeave = () => {
      if (this.isDrawingArrow && this.previewArrow) {
        this.annotationsContainer.removeChild(this.previewArrow);
        this.previewArrow = null;
      }
      clearTimeout(this.mousedownTimer);
    };

    this.mapContainer.addEventListener("mousedown", this.handleMouseDown);
    this.mapContainer.addEventListener("mouseup", this.handleMouseUp);
    this.mapContainer.addEventListener("mousemove", this.handleMouseMove);
    this.mapContainer.addEventListener("mouseleave", this.handleMouseLeave);
    this.mapContainer.addEventListener("dragstart", (e) => e.preventDefault());
  }
}

export function initializeMapControls(mapAnnotations) {
  const clearAnnotationsButton = document.querySelector(
    ".clear-annotations-button"
  );
  if (clearAnnotationsButton) {
    clearAnnotationsButton.addEventListener("click", () => {
      while (mapAnnotations.annotationsContainer.firstChild) {
        mapAnnotations.annotationsContainer.removeChild(
          mapAnnotations.annotationsContainer.firstChild
        );
      }
      mapAnnotations.circles = [];
      mapAnnotations.arrows = [];
      enableSaveButton();
    });
  }
}

export function initializeInteractiveMap() {
  if (window.mapAnnotations && window.mapAnnotations.mapContainer) {
    return window.mapAnnotations;
  }
  const inst = new MapAnnotations("map-preview-container", "map-annotations");
  initializeMapControls(inst);
  window.mapAnnotations = inst;
  return inst;
}

export function initializeMapSelection(mapAnnotations) {
  const modal = document.getElementById("mapSelectionModal");
  const closeModal = document.getElementById("closeMapModal");
  const buildsContainer = modal?.querySelector(".builds-container");

  if (!modal || !closeModal || !buildsContainer) {
    console.warn("⚠️ Skipping map selection setup — missing elements.");
    return;
  }

  // Ensure there is a mode dropdown in the modal; if not, create it
  let modeDropdown = document.getElementById("mapModeDropdown");
  if (!modeDropdown) {
    const wrapper = document.createElement("div");
    wrapper.className = "map-mode-selector";
    wrapper.innerHTML = `
      <label for="mapModeDropdown">Mode:</label>
      <select id="mapModeDropdown">
        <option value="1v1">1v1</option>
        <option value="2v2">2v2</option>
        <option value="3v3">3v3</option>
        <option value="4v4">4v4</option>
      </select>
    `;
    // insert before the builds container
    buildsContainer.parentNode.insertBefore(wrapper, buildsContainer);
    modeDropdown = document.getElementById("mapModeDropdown");
  }

  const getActiveFolder = () => {
    const active = document.querySelector(".toggle-folder.active");
    return active ? active.dataset.folder : "current";
  };

  // initial load using active folder + selected mode
  (async () => {
    await renderMapCards(getActiveFolder());
    loadMapsOnDemand();
  })();

  // Re-render maps when mode changes (delegated on the modal so we don't miss a late DOM)
  // When mode dropdown changes
  modal.addEventListener("change", (e) => {
    if (!e.target || e.target.id !== "mapModeDropdown") return;
    const selectedMode = e.target.value;
    renderMapCards("current").then(() => loadMapsOnDemand());
  });

  // Map card clicks — set preview + attach metadata (folder/mode/name) on the preview image
  buildsContainer.addEventListener("click", (event) => {
    const card = event.target.closest(".map-card");
    if (!card) return;

    const selectedMapPath = card.getAttribute("data-map");
    const selectedMapName =
      card.dataset.mapName ||
      card.querySelector(".map-card-title")?.innerText ||
      "";
    const selectedFolder = card.dataset.folder || getActiveFolder();
    const selectedMode =
      card.dataset.mode ||
      document.getElementById("mapModeDropdown")?.value ||
      "1v1";

    const mapImage = document.getElementById("map-preview-image");
    const selectedMapText = document.getElementById("selected-map-text");

    if (mapImage) {
      mapImage.src = selectedMapPath;
      // attach metadata for later saving
      mapImage.dataset.mapName = selectedMapName;
      mapImage.dataset.mapFolder = selectedFolder;
      mapImage.dataset.mapMode = selectedMode;
    }
    if (selectedMapText) selectedMapText.innerText = selectedMapName;

    // clear annotations
    if (mapAnnotations) {
      mapAnnotations.circles = [];
      mapAnnotations.arrows = [];
      if (mapAnnotations.annotationsContainer)
        mapAnnotations.annotationsContainer.innerHTML = "";
    }

    const clearBtn = document.querySelector(".clear-annotations-button");
    if (clearBtn) clearBtn.style.display = "inline-block";

    modal.style.display = "none";
    enableSaveButton();
  });

  // open/close hooks
  document
    .getElementById("openMapModalButton")
    ?.addEventListener("click", () => {
      modal.style.display = "block";
    });
  closeModal.addEventListener("click", () => (modal.style.display = "none"));

  // click outside closes modal
  window.addEventListener("click", (event) => {
    if (event.target === modal) modal.style.display = "none";
  });
}

export async function renderMapCards(folder = "current") {
  const buildsContainer = document.querySelector(".builds-container");
  const modeDropdown = document.getElementById("mapModeDropdown");
  const selectedMode = modeDropdown ? modeDropdown.value : "1v1";

  if (!buildsContainer) return;

  try {
    const response = await fetch("/data/maps.json");
    const maps = await response.json();

    // Clear container
    buildsContainer.innerHTML = "";

    const seen = new Set();

    maps
      .filter((map) => {
        if (!map.folder) return false;
        // Respect requested folder (e.g., current or archive)
        if (folder) {
          // startsWith to allow subfolders like current/1v1, archive/1v1
          if (!map.folder.startsWith(folder)) return false;
        }
        // Ensure map mode matches selectedMode
        const mapMode = Array.isArray(map.mode)
          ? map.mode
          : map.mode
          ? [map.mode]
          : ["1v1"];
        return mapMode.includes(selectedMode);
      })
      .forEach((map) => {
        const fileName =
          map.file ||
          `${(map.name || "").replace(/\s+/g, "_").toLowerCase()}.webp`;

        const dataMapPath = `img/maps/${map.folder}/${fileName}`;

        // Deduplicate by name + file
        const dedupeKey = `${(map.name || "").toLowerCase()}|${fileName}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const mapCard = document.createElement("div");
        mapCard.className = "map-card";

        mapCard.dataset.mapName = map.name || "";
        // store folder and mode on element for later use
        mapCard.dataset.folder = folder || "current";
        mapCard.dataset.mode = selectedMode;
        mapCard.dataset.file = fileName;
        mapCard.setAttribute("data-map", dataMapPath);

        mapCard.innerHTML = `
          <div class="map-card-title">${map.name || ""}</div>
          <img class="map-image" data-src="${dataMapPath}" alt="${
          map.name || ""
        }">
        `;

        buildsContainer.appendChild(mapCard);
      });
  } catch (err) {
    console.error("❌ Failed to load maps.json", err);
  }
}

const toggleButtons = Array.from(
  document.querySelectorAll(".toggle-folder") || []
);

toggleButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const folder = btn.dataset.folder || "current";

    // Toggle active class
    toggleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Render maps from selected folder
    await renderMapCards(folder);
    loadMapsOnDemand();
  });
});

// Safe export default mapAnnotations
export const mapAnnotations =
  window.mapAnnotations ||
  (document.getElementById("map-preview-container") &&
  document.getElementById("map-annotations")
    ? new MapAnnotations("map-preview-container", "map-annotations")
    : null);

if (mapAnnotations) {
  window.mapAnnotations = mapAnnotations;
}
