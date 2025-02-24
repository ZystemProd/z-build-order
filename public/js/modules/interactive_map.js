document.addEventListener("DOMContentLoaded", () => {
  const mapPreviewContainer = document.getElementById("map-preview-container");
  let mapsLoaded = false;

  function loadMaps() {
    if (!mapsLoaded) {
      console.log("🔄 Loading maps...");
      loadMapsOnDemand();
      mapsLoaded = true; // Prevent multiple loads
    }
  }

  // ✅ Detect if the user is on a mobile device
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  if (isMobile) {
    // 🛠 For mobile: Load maps on the first tap
    mapPreviewContainer.addEventListener("click", loadMaps, { once: true });
  } else {
    // 🖥 For desktops: Load maps on hover
    mapPreviewContainer.addEventListener("mouseenter", loadMaps, {
      once: true,
    });
  }

  function loadMapsOnDemand() {
    const mapCards = document.querySelectorAll(".map-card");

    mapCards.forEach((card) => {
      const img = card.querySelector(".map-image");
      const mapSrc = img.getAttribute("data-src"); // Get stored lazy source
      if (mapSrc && !img.src) {
        img.src = mapSrc; // Load actual image
        img.removeAttribute("data-src"); // Prevent duplicate loads
      }
    });

    console.log("✅ All maps loaded!");
  }
});

export class MapAnnotations {
  constructor(mapContainerId, annotationsContainerId) {
    this.mapContainer = document.getElementById(mapContainerId);
    this.annotationsContainer = document.getElementById(annotationsContainerId);
    this.circles = [];
    this.arrows = [];
    this.isDrawingArrow = false;
    this.startX = 0;
    this.startY = 0;
    this.mousedownTimer = null;
    this.previewArrow = null;

    this.initializeEventListeners();
  }

  calculateCoordinates(event) {
    const rect = this.mapContainer.getBoundingClientRect();

    // Calculate coordinates as percentages relative to the image dimensions
    const x = ((event.clientX - rect.left - 6) / rect.width) * 100;
    const y = ((event.clientY - rect.top - 2) / rect.height) * 100;

    return { x, y };
  }

  createCircle(x, y) {
    console.log("createCircle");
    const container = document.createElement("div");
    container.classList.add("annotation-circle-container");
    container.style.left = `${x}%`;
    container.style.top = `${y}%`;

    const number = document.createElement("span");
    number.classList.add("annotation-number");

    // Assign the number based on the current count of circles
    number.textContent = this.circles.length + 1;

    const circle = document.createElement("div");
    circle.classList.add("annotation-circle");

    container.addEventListener("click", (e) => {
      e.stopPropagation();
      this.annotationsContainer.removeChild(container);
      const index = this.circles.findIndex(
        (circleData) => circleData.element === container
      );
      if (index !== -1) this.circles.splice(index, 1);
      this.updateCircleNumbers(); // Recalculate numbers
    });

    container.appendChild(number);
    container.appendChild(circle);
    this.annotationsContainer.appendChild(container);

    // Add to circles array with the correct element reference
    this.circles.push({ x, y, element: container });
  }

  updateCircleNumbers() {
    this.circles.forEach((circleData, index) => {
      if (circleData.element) {
        // Ensure the element exists
        const number = circleData.element.querySelector(".annotation-number");
        if (number) {
          number.textContent = index + 1; // Reassign correct number
        }
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
      const index = this.arrows.findIndex(
        (arrowData) => arrowData.element === arrow
      );
      if (index !== -1) this.arrows.splice(index, 1);
    });

    this.annotationsContainer.appendChild(arrow);
    this.arrows.push({ startX, startY, endX, endY, element: arrow });
  }

  updateArrow(arrow, startX, startY, endX, endY) {
    const rect = this.mapContainer.getBoundingClientRect();

    // Ensure coordinates are calculated as percentages of the map container
    const mapWidth = rect.width;
    const mapHeight = rect.height;

    const startXPixels = (startX / 100) * mapWidth;
    const startYPixels = (startY / 100) * mapHeight;
    const endXPixels = (endX / 100) * mapWidth;
    const endYPixels = (endY / 100) * mapHeight;

    const deltaX = endXPixels - startXPixels;
    const deltaY = endYPixels - startYPixels;

    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI); // Calculate angle in degrees
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY); // Calculate length

    // Apply styles to position and transform the arrow
    arrow.style.left = `${startXPixels}px`;
    arrow.style.top = `${startYPixels}px`;
    arrow.style.width = `${length}px`;
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.style.transformOrigin = "0 0"; // Ensure arrow anchors from start point
  }

  initializeEventListeners() {
    // Remove existing listeners to avoid duplicates
    this.mapContainer.removeEventListener("mousedown", this.handleMouseDown);
    this.mapContainer.removeEventListener("mouseup", this.handleMouseUp);
    this.mapContainer.removeEventListener("mousemove", this.handleMouseMove);
    this.mapContainer.removeEventListener("mouseleave", this.handleMouseLeave);

    // Define handlers as class properties to ensure they are only bound once
    this.handleMouseDown = (event) => {
      const { x, y } = this.calculateCoordinates(event);
      this.mousedownTimer = setTimeout(() => {
        this.isDrawingArrow = true;
        this.startX = x;
        this.startY = y;
        this.previewArrow = document.createElement("div");
        this.previewArrow.classList.add("annotation-arrow", "preview-arrow");
        this.annotationsContainer.appendChild(this.previewArrow);
      }, 200);
    };

    this.handleMouseUp = (event) => {
      clearTimeout(this.mousedownTimer);
      const { x, y } = this.calculateCoordinates(event);

      if (this.isDrawingArrow) {
        this.createArrow(this.startX, this.startY, x, y);
        this.isDrawingArrow = false;
        if (this.previewArrow) {
          this.annotationsContainer.removeChild(this.previewArrow);
          this.previewArrow = null;
        }
      } else {
        this.createCircle(x, y);
      }
    };

    this.handleMouseMove = (event) => {
      if (this.isDrawingArrow && this.previewArrow) {
        const { x, y } = this.calculateCoordinates(event);
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

    // Add listeners
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

  // Clear annotations
  clearAnnotationsButton.addEventListener("click", () => {
    while (mapAnnotations.annotationsContainer.firstChild) {
      mapAnnotations.annotationsContainer.removeChild(
        mapAnnotations.annotationsContainer.firstChild
      );
    }
    mapAnnotations.circles = [];
    mapAnnotations.arrows = [];
  });
}

export function initializeInteractiveMap() {
  const mapAnnotations = new MapAnnotations(
    "map-preview-image",
    "map-annotations"
  );

  // Remove floating container logic
  initializeMapControls(mapAnnotations);
  return mapAnnotations;
}

export function initializeMapSelection(mapAnnotations) {
  const modal = document.getElementById("mapSelectionModal");
  const closeModal = document.getElementById("closeMapModal");
  const buildsContainer = modal.querySelector(".builds-container");

  if (!buildsContainer) {
    console.error(
      "Error: .builds-container not found inside #mapSelectionModal"
    );
    return;
  }

  // List of maps with paths
  const maps = [
    { name: "Abyssal Reef", imagePath: "img/maps/abyssal_reef.webp" },
    { name: "Amygdala", imagePath: "img/maps/amygdala.webp" },
    { name: "El Dorado", imagePath: "img/maps/el_dorado.webp" },
    { name: "Frostline", imagePath: "img/maps/frostline.webp" },
    { name: "King's Cove", imagePath: "img/maps/king's_cove.webp" },
    { name: "Ley Lines", imagePath: "img/maps/ley_lines.webp" },
    {
      name: "Neon Violet Square",
      imagePath: "img/maps/neon_violet_square.webp",
    },
    { name: "Ultralove", imagePath: "img/maps/ultralove.webp" },
    { name: "Whispers of Gold", imagePath: "img/maps/whispers_of_gold.webp" },
  ];

  // Populate modal with map cards
  buildsContainer.innerHTML = maps
    .map(
      (map) => `
    <div class="map-card" data-map="${DOMPurify.sanitize(map.imagePath)}">
      <div class="map-card-title">${DOMPurify.sanitize(map.name)}</div>
      <img data-src="${DOMPurify.sanitize(
        map.imagePath
      )}" alt="${DOMPurify.sanitize(map.name)}" class="map-image">
    </div>`
    )
    .join("");

  // Open the modal
  document
    .getElementById("openMapModalButton")
    .addEventListener("click", () => {
      modal.style.display = "block";
    });

  // Close the modal
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Close modal when clicking outside the modal content
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Update map on card click
  buildsContainer.addEventListener("click", (event) => {
    const card = event.target.closest(".map-card");
    if (card) {
      const selectedMapPath = card.getAttribute("data-map");
      const selectedMapName = card.querySelector(".map-card-title").innerText;
      const mapImage = document.getElementById("map-preview-image");
      const selectedMapText = document.getElementById("selected-map-text");
      const clearAnnotationsButton = document.querySelector(
        ".clear-annotations-button"
      );

      // Update map image and selected map text
      selectedMapText.innerText = DOMPurify.sanitize(selectedMapName);
      mapImage.src = DOMPurify.sanitize(selectedMapPath);

      // Clear existing annotations
      mapAnnotations.circles = [];
      mapAnnotations.arrows = [];
      mapAnnotations.annotationsContainer.innerHTML = "";

      // Show the Clear Annotations button
      clearAnnotationsButton.style.display = "inline-block";

      // Close the modal
      modal.style.display = "none";
    }
  });
}

// Export the instantiated `MapAnnotations` object
export const mapAnnotations = new MapAnnotations(
  "map-preview-image",
  "map-annotations"
);
