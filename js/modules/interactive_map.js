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
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  createCircle(x, y) {
    const container = document.createElement("div");
    container.classList.add("annotation-circle-container");
    container.style.left = `${x}%`;
    container.style.top = `${y}%`;

    const number = document.createElement("span");
    number.classList.add("annotation-number");
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
      this.updateCircleNumbers();
    });

    container.appendChild(number);
    container.appendChild(circle);
    this.annotationsContainer.appendChild(container);
    this.circles.push({ x, y, element: container });
  }

  updateCircleNumbers() {
    this.circles.forEach((circleData, index) => {
      const number = circleData.element.querySelector(".annotation-number");
      number.textContent = index + 1;
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
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    arrow.style.left = `${startX}%`;
    arrow.style.top = `${startY}%`;
    arrow.style.width = `${length}%`;
    arrow.style.transform = `rotate(${angle}deg)`;
  }

  initializeEventListeners() {
    this.mapContainer.addEventListener("mousedown", (event) => {
      const { x, y } = this.calculateCoordinates(event);
      this.mousedownTimer = setTimeout(() => {
        this.isDrawingArrow = true;
        this.startX = x;
        this.startY = y;
        this.previewArrow = document.createElement("div");
        this.previewArrow.classList.add("annotation-arrow", "preview-arrow");
        this.annotationsContainer.appendChild(this.previewArrow);
      }, 200);
    });

    this.mapContainer.addEventListener("mouseup", (event) => {
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
    });

    this.mapContainer.addEventListener("mousemove", (event) => {
      if (this.isDrawingArrow && this.previewArrow) {
        const { x, y } = this.calculateCoordinates(event);
        this.updateArrow(this.previewArrow, this.startX, this.startY, x, y);
      }
    });

    this.mapContainer.addEventListener("mouseleave", () => {
      if (this.isDrawingArrow && this.previewArrow) {
        this.annotationsContainer.removeChild(this.previewArrow);
        this.previewArrow = null;
      }
      clearTimeout(this.mousedownTimer);
    });

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
