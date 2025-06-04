// Map Data (New Map Pool)
let mapData = [];
let mapImages = {};

// Best of Settings
const BEST_OF_SETTINGS = {
  None: 0,
  BO2: 2,
  BO3: 3,
  BO5: 5,
  BO7: 7,
  BO9: 9,
};

const bestOfOptions = ["None", "BO2", "BO3", "BO5", "BO7", "BO9"];
let currentBestOfIndex = 0;
let currentMap = null;
let lastHoveredMap = null;

// DOM Content Loaded
window.addEventListener("DOMContentLoaded", () => {
  renderMapList();
  updateDisplayedMap();
  updateDisplayedBestOf();

  document.getElementById("prevMapButton").addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + mapData.length) % mapData.length;
    updateDisplayedMap();
  });

  document.getElementById("nextMapButton").addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % mapData.length;
    updateDisplayedMap();
  });

  document.getElementById("prevBestOfButton").addEventListener("click", () => {
    currentBestOfIndex =
      (currentBestOfIndex - 1 + bestOfOptions.length) % bestOfOptions.length;
    updateDisplayedBestOf();
    checkUnvetoedMapsForBestOf();
  });

  document.getElementById("nextBestOfButton").addEventListener("click", () => {
    currentBestOfIndex = (currentBestOfIndex + 1) % bestOfOptions.length;
    updateDisplayedBestOf();
    checkUnvetoedMapsForBestOf();
  });

  document.getElementById("resetButton").addEventListener("click", resetAll);

  document
    .getElementById("toggleVisibilityButton")
    .addEventListener("click", toggleElementsVisibility);

  document
    .getElementById("mapFileInput")
    .addEventListener("change", updateMapPreview);
});

// Map Rendering
function renderMapList() {
  const mapList = document.querySelector(".map-list ul");
  mapData.forEach((map) => {
    const li = document.createElement("li");
    li.id = `map${map.id}`;

    const labelSpan = document.createElement("span");
    labelSpan.id = `label${map.id}`;
    labelSpan.textContent = map.name;

    const indicatorSpan = document.createElement("span");
    indicatorSpan.classList.add("order-indicator");

    li.appendChild(labelSpan);
    li.appendChild(indicatorSpan);

    // Event listeners instead of inline attributes
    li.addEventListener("click", () => toggleVeto(map.id));
    li.addEventListener("mouseover", () => showPreview(map.id));
    li.addEventListener("mouseout", () => keepHoveredMap());
    indicatorSpan.addEventListener("click", (event) =>
      cycleOrder(map.id, event)
    );

    mapList.appendChild(li);
  });
}

// Map Preview on Hover
function showPreview(mapNumber) {
  const previewImage = document.getElementById("previewImage");
  previewImage.src = mapImages[mapNumber];
  previewImage.alt = `Map ${mapNumber} Preview`;
  lastHoveredMap = mapNumber;
}

function keepHoveredMap() {
  if (lastHoveredMap) showPreview(lastHoveredMap);
}

// Veto Logic
function toggleVeto(mapNumber) {
  const li = document.getElementById(`map${mapNumber}`);
  const indicator = li.querySelector(".order-indicator");

  if (li.classList.contains("vetoed-map")) {
    li.classList.remove("vetoed-map");
    indicator.style.display =
      currentBestOfIndex === 0 ? "none" : "inline-block";
    indicator.textContent = "";
  } else {
    if (!canVetoMoreMaps()) return;
    li.classList.add("vetoed-map");
    indicator.style.display = "none";
  }

  currentMap = mapNumber;
  const previewImage = document.getElementById("previewImage");
  if (currentMap) previewImage.src = mapImages[currentMap];

  checkUnvetoedMapsForBestOf();
}

function canVetoMoreMaps() {
  const unvetoed = [...document.querySelectorAll(".map-list li")].filter(
    (li) => !li.classList.contains("vetoed-map")
  ).length;
  const bestOfLimit = BEST_OF_SETTINGS[bestOfOptions[currentBestOfIndex]];
  return unvetoed > bestOfLimit;
}

function checkUnvetoedMapsForBestOf() {
  const unvetoed = [...document.querySelectorAll(".map-list li")].filter(
    (li) => !li.classList.contains("vetoed-map")
  );
  document
    .querySelectorAll(".map-list li")
    .forEach((li) => li.classList.remove("pulsing-border"));

  const target = BEST_OF_SETTINGS[bestOfOptions[currentBestOfIndex]];
  if (target && unvetoed.length === target) {
    unvetoed.forEach((li) => li.classList.add("pulsing-border"));
  }
}

function cycleOrder(mapNumber, event) {
  event.stopPropagation();
  const li = document.getElementById(`map${mapNumber}`);
  const indicator = li.querySelector(".order-indicator");

  if (
    li.classList.contains("vetoed-map") ||
    bestOfOptions[currentBestOfIndex] === "None"
  )
    return;

  const maxOrders = BEST_OF_SETTINGS[bestOfOptions[currentBestOfIndex]];
  const currentOrder = parseInt(indicator.textContent) || 0;
  indicator.textContent =
    currentOrder < maxOrders ? `${currentOrder + 1}.` : "";
}

// UI Controls
let currentIndex = 0;

function updateDisplayedMap() {
  const mapTextEl = document.getElementById("selectedMapText");
  const currentMap = mapData[currentIndex];

  if (mapTextEl && currentMap) {
    mapTextEl.textContent = `Selected Map: ${currentMap.name}`;
  } else if (mapTextEl) {
    mapTextEl.textContent = "No map selected";
  }
}

function updateDisplayedBestOf() {
  document.getElementById(
    "selectedBestOfText"
  ).textContent = `Best of: ${bestOfOptions[currentBestOfIndex]}`;
}

function resetAll() {
  document.querySelectorAll(".map-list li").forEach((li) => {
    li.classList.remove("vetoed-map", "pulsing-border");
    const indicator = li.querySelector(".order-indicator");
    indicator.textContent = "";
    indicator.style.display = "inline-block";
  });
  currentMap = null;
  lastHoveredMap = null;
  resetPreview();
  currentBestOfIndex = 0;
  updateDisplayedBestOf();
}

function resetPreview() {
  const previewImage = document.getElementById("previewImage");
  previewImage.src = mapImages[1];
  previewImage.alt = "Map Preview";
}

// Upload Map Preview + Rename Map
function updateMapPreview(event) {
  const file = event.target.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const selectedName = document
        .getElementById("selectedMapText")
        .textContent.replace("Selected Map: ", "")
        .trim();
      const selectedMap = mapData.find((map) => map.name === selectedName);

      if (selectedMap) {
        mapImages[selectedMap.id] = e.target.result;
        const previewImage = document.getElementById("previewImage");
        previewImage.src = e.target.result;
        previewImage.alt = `Map ${selectedMap.name} Preview`;

        // ➡️ Suggest a name based on the file name
        let suggestedName = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
        suggestedName = suggestedName.replace(/[_-]/g, " "); // Replace underscores/dashes with spaces
        suggestedName = suggestedName.replace(/\s+/g, " ").trim(); // Clean up extra spaces

        // ➡️ Capitalize the first letter of each word
        suggestedName = suggestedName
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const newName = prompt(
          "Enter a new name for this map (or leave blank to keep current name):",
          suggestedName || selectedMap.name
        );

        if (newName && newName.trim() !== "") {
          selectedMap.name = newName.trim();
          document.getElementById(`label${selectedMap.id}`).textContent =
            selectedMap.name;
          updateDisplayedMap();
        }
      } else {
        alert("No map selected. Please select a map to update.");
      }
    };
    reader.readAsDataURL(file);
  }
}

// Show/Hide Left Control Panel
function toggleElementsVisibility() {
  const elements = [
    document.querySelector(".button-container"),
    document.getElementById("ChangeMapPreview"),
    document.getElementById("custom-checkbox"),
  ];

  let allHidden = elements.every((el) => el.classList.contains("hidden"));
  elements.forEach((el) => el.classList.toggle("hidden"));
  document.getElementById("toggleVisibilityButton").textContent = allHidden
    ? "Hide"
    : "Show";
}

function toggleMapPreviewVisibility() {
  const preview = document.querySelector(".map-preview");
  const checkbox = document.getElementById("hidePreviewCheckbox");
  if (preview && checkbox) {
    preview.style.display = checkbox.checked ? "none" : "block";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // Load current maps from maps.json
  try {
    const response = await fetch("/data/maps.json");
    const allMaps = await response.json();
    const currentMaps = allMaps.filter((map) => map.folder === "current");

    mapData = currentMaps.map((map, index) => ({
      id: index + 1,
      name: map.name,
      file: map.file,
    }));

    mapImages = {};
    mapData.forEach((map) => {
      mapImages[map.id] = `img/maps/current/${map.file}`;
    });

    renderMapList();
    updateDisplayedMap();
    updateDisplayedBestOf();
  } catch (err) {
    console.error("❌ Failed to load maps.json or process maps:", err);
  }

  // Attach hide preview checkbox listener
  const checkbox = document.getElementById("hidePreviewCheckbox");
  if (checkbox) {
    checkbox.addEventListener("change", toggleMapPreviewVisibility);
  }

  // Your other listeners...
});

document
  .getElementById("hidePreviewCheckbox")
  .addEventListener("change", toggleMapPreviewVisibility);
