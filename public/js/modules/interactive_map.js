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
  const mapContainer = document.querySelector(".floating-container");
  const mapImage = document.getElementById("map-preview-container");
  const clearAnnotationsButton = document.querySelector(
    ".clear-annotations-button"
  );
  const closeMapButton = document.querySelector(".close-map-button");
  const showMapButton = document.getElementById("showMapButton");

  // Initially hide the map
  mapContainer.style.display = "none";

  // Show/hide Clear All Annotations button
  mapImage.addEventListener("mouseenter", () => {
    clearAnnotationsButton.style.display = "block";
  });

  mapImage.addEventListener("mouseleave", () => {
    clearAnnotationsButton.style.display = "none";
  });

  // Clear annotations
  clearAnnotationsButton.addEventListener("click", () => {
    while (mapAnnotations.annotationsContainer.firstChild) {
      mapAnnotations.annotationsContainer.removeChild(
        mapAnnotations.annotationsContainer.firstChild
      );
    }
    mapAnnotations.circles = [];
  });

  // Close map
  closeMapButton.addEventListener("click", () => {
    mapContainer.style.display = "none";
    showMapButton.textContent = "Show Map";
  });

  // Show/hide map
  showMapButton.addEventListener("click", () => {
    const isHidden = mapContainer.style.display === "none";
    mapContainer.style.display = isHidden ? "block" : "none";
    showMapButton.textContent = isHidden ? "Hide Map" : "Show Map";
  });

  // Floating map draggable functionality
  const titleBar = document.getElementById("map-title-bar");
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  // Helper function to handle dragging
  function startDragging(event, element) {
    isDragging = true;
    offsetX = event.clientX - element.offsetLeft;
    offsetY = event.clientY - element.offsetTop;
    document.body.style.userSelect = "none"; // Prevent text selection
  }

  // Add listeners for starting drag
  titleBar.addEventListener("mousedown", (event) =>
    startDragging(event, mapContainer)
  );
  mapContainer.addEventListener("mousedown", (event) => {
    if (event.target === mapContainer) startDragging(event, mapContainer);
  });

  // Handle mouse movement
  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    const x = event.clientX - offsetX;
    const y = event.clientY - offsetY;
    mapContainer.style.left = `${x}px`;
    mapContainer.style.top = `${y}px`;
  });

  // Stop dragging on mouseup
  document.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = ""; // Re-enable text selection
  });
}

export function initializeInteractiveMap() {
  const mapAnnotations = new MapAnnotations(
    "map-preview-image",
    "map-annotations"
  );
  initializeMapControls();
  return mapAnnotations;
}

export function initializeMapSelection(mapAnnotations) {
  const modal = document.getElementById("mapSelectionModal");
  const closeModal = document.getElementById("closeMapModal");
  const buildsContainer = modal.querySelector(".builds-container");
  const mapImage = document.getElementById("map-preview-image");

  // List of maps with paths
  const maps = [
    { name: "Abyssal Reef", imagePath: "img/maps/abyssal_reef.jpg" },
    { name: "Amygdala", imagePath: "img/maps/amygdala.jpg" },
    { name: "El Dorado", imagePath: "img/maps/el_dorado.jpg" },
    { name: "Frostline", imagePath: "img/maps/frostline.jpg" },
    { name: "King's Cove", imagePath: "img/maps/king's_cove.jpg" },
    { name: "Ley Lines", imagePath: "img/maps/ley_lines.jpg" },
    {
      name: "Neon Violet Square",
      imagePath: "img/maps/neon_violet_square.jpg",
    },
    { name: "Ultralove", imagePath: "img/maps/ultralove.jpg" },
    { name: "Whispers of Gold", imagePath: "img/maps/whispers_of_gold.jpg" },
  ];

  // Populate modal with map cards
  buildsContainer.innerHTML = maps
    .map(
      (map) => `
      <div class="build-card" data-map="${map.imagePath}">
        <div class="build-card-title">${map.name}</div>
        <img src="${map.imagePath}" alt="${map.name}" class="map-image">
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
    if (event.target === mapSelectionModal) {
      mapSelectionModal.style.display = "none";
    }
  });

  // Update map on card click
  buildsContainer.addEventListener("click", (event) => {
    const card = event.target.closest(".build-card");
    if (card) {
      const selectedMapPath = card.getAttribute("data-map");
      mapImage.src = selectedMapPath;

      // Clear existing annotations
      mapAnnotations.circles = [];
      mapAnnotations.arrows = [];
      mapAnnotations.annotationsContainer.innerHTML = "";

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
