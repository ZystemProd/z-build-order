// interactive_map.js
export function initializeMapAnnotations() {
  const mapPreviewImage = document.getElementById("map-preview-image");
  const annotationsContainer = document.getElementById("map-annotations");
  const circles = []; // Store circles
  const arrows = []; // Store arrows
  let isDrawingArrow = false;
  let startX = 0;
  let startY = 0;
  let mousedownTimer = null;
  let previewArrow = null;

  function calculateCoordinates(event) {
    const rect = mapPreviewImage.getBoundingClientRect();

    // Calculate coordinates as percentages relative to the image dimensions
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    return { x, y };
  }

  function createCircle(x, y) {
    const container = document.createElement("div");
    container.classList.add("annotation-circle-container");
    container.style.left = `${x}%`;
    container.style.top = `${y}%`;

    const number = document.createElement("span");
    number.classList.add("annotation-number");
    number.textContent = circles.length + 1;

    const circle = document.createElement("div");
    circle.classList.add("annotation-circle");

    // Add click event to remove the circle
    container.addEventListener("click", (e) => {
      e.stopPropagation();
      annotationsContainer.removeChild(container);

      // Remove from circles array
      const index = circles.findIndex((circleData) => circleData.element === container);
      if (index !== -1) circles.splice(index, 1);

      // Update numbers
      updateCircleNumbers();
    });

    container.appendChild(number);
    container.appendChild(circle);
    annotationsContainer.appendChild(container);

    circles.push({ x, y, element: container });
    console.log("one circle added");

  }

  function updateCircleNumbers() {
    circles.forEach((circleData, index) => {
      const number = circleData.element.querySelector(".annotation-number");
      number.textContent = index + 1;
    });
  }

  function createArrow(startX, startY, endX, endY) {
    const arrow = document.createElement("div");
    arrow.classList.add("annotation-arrow");

    updateArrow(arrow, startX, startY, endX, endY);

    // Add click event to remove the arrow
    arrow.addEventListener("click", (e) => {
      e.stopPropagation();
      annotationsContainer.removeChild(arrow);

      // Remove from arrows array
      const index = arrows.findIndex((arrowData) => arrowData.element === arrow);
      if (index !== -1) arrows.splice(index, 1);
    });

    annotationsContainer.appendChild(arrow);
    arrows.push({ startX, startY, endX, endY, element: arrow });
  }

  function updateArrow(arrow, startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI); // Angle in degrees
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY); // Length in percentages

    arrow.style.left = `${startX}%`;
    arrow.style.top = `${startY}%`;
    arrow.style.width = `${length}%`;
    arrow.style.transform = `rotate(${angle}deg)`;
  }

  mapPreviewImage.addEventListener("mousedown", (event) => {
    const { x, y } = calculateCoordinates(event);

    // Start a timer to determine if the action is a circle or arrow
    mousedownTimer = setTimeout(() => {
      isDrawingArrow = true;
      startX = x;
      startY = y;

      // Create a preview arrow
      previewArrow = document.createElement("div");
      previewArrow.classList.add("annotation-arrow", "preview-arrow");
      annotationsContainer.appendChild(previewArrow);
    }, 200); // Hold time (ms) for detecting arrow creation
  });

  mapPreviewImage.addEventListener("mousemove", (event) => {
    if (isDrawingArrow && previewArrow) {
      const { x, y } = calculateCoordinates(event);
      updateArrow(previewArrow, startX, startY, x, y);
    }
  });

  mapPreviewImage.addEventListener("mouseup", (event) => {
    clearTimeout(mousedownTimer);
    mousedownTimer = null;
    const { x, y } = calculateCoordinates(event);

    if (isDrawingArrow) {
      createArrow(startX, startY, x, y);
      isDrawingArrow = false;

      // Remove the preview arrow
      if (previewArrow) {
        annotationsContainer.removeChild(previewArrow);
        previewArrow = null;
      }
    } else {
      createCircle(x, y);
    }
  });

  mapPreviewImage.addEventListener("mouseleave", () => {
    if (isDrawingArrow && previewArrow) {
      annotationsContainer.removeChild(previewArrow);
      previewArrow = null;
    }
    clearTimeout(mousedownTimer);
  });

  // Prevent dragging images
  mapPreviewImage.addEventListener("dragstart", (e) => e.preventDefault());
}

export function initializeMapControls() {
  const mapContainer = document.querySelector(".map-preview");
  const clearAnnotationsButton = document.querySelector(".clear-annotations-button");
  const annotationsContainer = document.getElementById("map-annotations");

  mapContainer.addEventListener("mouseenter", () => {
    clearAnnotationsButton.style.display = "block";
  });

  mapContainer.addEventListener("mouseleave", () => {
    clearAnnotationsButton.style.display = "none";
  });

  clearAnnotationsButton.addEventListener("click", () => {
    while (annotationsContainer.firstChild) {
      annotationsContainer.removeChild(annotationsContainer.firstChild);
    }
  });
}

export function initializeInteractiveMap() {
  initializeMapAnnotations();
  initializeMapControls();
}


// Function to update the map preview with a given name and image path
export function updateMapPreview(mapName, imagePath) {
  const mapPreviewContainer = document.getElementById("map-preview-container");
  const mapPreviewImage = document.getElementById("map-preview-image");
  const mapPreviewTitle = document.getElementById("map-preview-title");

  // Update the preview with the map name and image
  mapPreviewImage.src = imagePath;
  mapPreviewTitle.textContent = mapName;

  // Show the map preview
  mapPreviewContainer.classList.remove("hidden");
}

// Function to hide the map preview
export function hideMapPreview() {
  const mapPreviewContainer = document.getElementById("map-preview-container");
  mapPreviewContainer.classList.add("hidden");
}

// Initialize draggable functionality for the floating map
export function initializeFloatingMap() {
  const floatingMap = document.getElementById("floating-map");
  const mapImage = document.getElementById("map-preview-image");
  const titleBar = document.getElementById("map-title-bar");

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  // Adjust the container size to match the map image
  mapImage.onload = () => {
    const rect = mapImage.getBoundingClientRect();
    floatingMap.style.width = `${rect.width}px`;
    floatingMap.style.height = `${rect.height + titleBar.offsetHeight}px`; // Include title bar height
  };

  // Handle mousedown
  titleBar.addEventListener("mousedown", (event) => {
    isDragging = true;
    offsetX = event.clientX - floatingMap.offsetLeft;
    offsetY = event.clientY - floatingMap.offsetTop;
    document.body.style.userSelect = "none"; // Prevent text selection
  });

  // Handle mousemove
  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const x = event.clientX - offsetX;
    const y = event.clientY - offsetY;

    floatingMap.style.left = `${x}px`;
    floatingMap.style.top = `${y}px`;
  });

  // Handle mouseup
  document.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = ""; // Re-enable text selection
  });
}

// Toggle map visibility
export function initializeMapToggle() {
  const showMapButton = document.getElementById("showMapButton");
  const floatingMap = document.getElementById("floating-map");

  showMapButton.addEventListener("click", () => {
    const isHidden = floatingMap.style.display === "none";
    floatingMap.style.display = isHidden ? "block" : "none";
    showMapButton.textContent = isHidden ? "Hide Map" : "Show Map";
  });

  floatingMap.style.display = "none"; // Initially hide the map
}

// Initialize the close map button
export function initializeCloseMapButton() {
  const floatingContainer = document.querySelector(".floating-container");
  const closeMapButton = document.querySelector(".close-map-button");
  const showMapButton = document.getElementById("showMapButton");

  closeMapButton.addEventListener("click", () => {
    floatingContainer.style.display = "none";
    showMapButton.textContent = "Show Map";
  });
}
