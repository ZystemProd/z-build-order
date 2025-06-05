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
let currentAdvancedPlayer = "player1";
let advancedStage = "veto"; // stages: veto, pick
let pickOrder = 1;

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

  document
    .getElementById("advancedToggle")
    .addEventListener("click", toggleAdvancedView);

  const p1Input = document.getElementById("player1NameInput");
  const p2Input = document.getElementById("player2NameInput");
  if (p1Input) p1Input.addEventListener("input", updateStageIndicator);
  if (p2Input) p2Input.addEventListener("input", updateStageIndicator);
  updateStageIndicator();
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

  const advList = document.getElementById("advanced-map-list");
  const p1 = document.getElementById("player1-list");
  const p2 = document.getElementById("player2-list");
  const picks = document.getElementById("picked-maps");
  if (advList && p1 && p2 && picks) {
    advList.innerHTML = "";
    p1.innerHTML = "";
    p2.innerHTML = "";
    picks.innerHTML = "";
    picks.classList.add("hidden");
    const startSel = document.getElementById("startingPlayerSelect");
    if (startSel) currentAdvancedPlayer = startSel.value;
    advancedStage = "veto";
    pickOrder = 1;
    renderAdvancedMapList();
    updateStageIndicator();
  }
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

function moveElementWithAnimation(element, target, afterAppend) {
  const startRect = element.getBoundingClientRect();
  target.appendChild(element);
  const endRect = element.getBoundingClientRect();
  const dx = startRect.left - endRect.left;
  const dy = startRect.top - endRect.top;
  element.style.transform = `translate(${dx}px, ${dy}px)`;
  element.style.transition = "transform 0.3s ease";
  requestAnimationFrame(() => {
    element.style.transform = "translate(0, 0)";
  });
  element.addEventListener(
    "transitionend",
    () => {
      element.style.transition = "";
      element.style.transform = "";
      if (afterAppend) afterAppend();
    },
    { once: true }
  );
}

function animateVetoDirection(element, direction) {
  const cls = direction === "left" ? "veto-left" : "veto-right";
  element.classList.add(cls);
  element.addEventListener(
    "transitionend",
    () => {
      element.style.display = "none";
    },
    { once: true }
  );
}

function updateStageIndicator() {
  const indicator = document.getElementById("stageIndicator");
  const p1Input = document.getElementById("player1NameInput");
  const p2Input = document.getElementById("player2NameInput");
  const p1Name = p1Input && p1Input.value ? p1Input.value : "Player 1";
  const p2Name = p2Input && p2Input.value ? p2Input.value : "Player 2";
  const currentName =
    currentAdvancedPlayer === "player1" ? p1Name : p2Name;
  const stageText =
    advancedStage === "veto"
      ? "Veto"
      : advancedStage === "pick"
      ? "Pick"
      : "Done";
  if (indicator)
    indicator.innerHTML = `<span class="stage-text ${stageText.toLowerCase()}">${stageText}</span> - ${currentName}`;
  const h1 = document.querySelector("#player1-column h3");
  const h2 = document.querySelector("#player2-column h3");
  if (h1) h1.textContent = p1Name;
  if (h2) h2.textContent = p2Name;
}

// -------- Advanced View --------
function toggleAdvancedView() {
  const adv = document.getElementById("advanced-view");
  const list = document.getElementById("map-list");
  const preview = document.querySelector(".map-preview");
  const toggleBtn = document.getElementById("advancedToggle");
  if (!adv || !list) return;
  
  if (adv.classList.contains("hidden")) {
    const startSel = document.getElementById("startingPlayerSelect");
    if (startSel) currentAdvancedPlayer = startSel.value;
    advancedStage = "veto";
    pickOrder = 1;
    adv.classList.remove("hidden");
    adv.style.display = "flex";
    list.style.display = "none";
    if (preview) preview.style.display = "none";
    const picks = document.getElementById("picked-maps");
    if (picks) picks.style.display = picks.classList.contains("hidden") ? "none" : "flex";
    renderAdvancedMapList();
    if (toggleBtn) toggleBtn.textContent = "Basic Mode";
    updateStageIndicator();
  } else {
    adv.classList.add("hidden");
    adv.style.display = "none";
    list.style.display = "block";
    if (preview) preview.style.display = "block";
    const picks = document.getElementById("picked-maps");
    if (picks) picks.style.display = "none";
    if (toggleBtn) toggleBtn.textContent = "Advanced Mode";
  }
}

function renderAdvancedMapList() {
  const advList = document.getElementById("advanced-map-list");
  if (!advList) return;
  advList.innerHTML = "";
  mapData.forEach((map) => {
    const li = document.createElement("li");
    li.id = `adv-map${map.id}`;

    const img = document.createElement("img");
    img.src = mapImages[map.id];
    img.alt = map.name;
    img.addEventListener("click", () => advancedVetoByTurn(map.id));

    const span = document.createElement("span");
    span.className = "adv-map-label";
    span.textContent = map.name;

    li.appendChild(img);
    li.appendChild(span);
    advList.appendChild(li);
  });
}

function advancedVeto(mapId, playerListId) {
  const li = document.getElementById(`adv-map${mapId}`);
  const target = document.getElementById(playerListId);
  if (!li || !target) return;
  moveElementWithAnimation(li, target, () => li.classList.add("vetoed-map"));
  checkAdvancedCompletion();
  updateStageIndicator();
}

function advancedVetoByTurn(mapId) {
  const playerListId =
    currentAdvancedPlayer === "player1" ? "player1-list" : "player2-list";
  if (advancedStage === "veto") {
    advancedVeto(mapId, playerListId);
  } else if (advancedStage === "pick") {
    pickMap(mapId);
  }
  currentAdvancedPlayer =
    currentAdvancedPlayer === "player1" ? "player2" : "player1";
  updateStageIndicator();
}

function checkAdvancedCompletion() {
  const advList = document.getElementById("advanced-map-list");
  const picks = document.getElementById("picked-maps");
  if (!advList || !picks) return;
  const remaining = advList.querySelectorAll("li");
  const limit = BEST_OF_SETTINGS[bestOfOptions[currentBestOfIndex]];
  if (advancedStage === "veto" && limit && remaining.length === limit) {
    picks.innerHTML = "";
    picks.classList.remove("hidden");
    picks.style.display = "flex";
    advancedStage = "pick";
    updateStageIndicator();
  }
  if (advancedStage === "pick" && remaining.length === 0) {
    advancedStage = "done";
    updateStageIndicator();
  }
}

function pickMap(mapId) {
  const li = document.getElementById(`adv-map${mapId}`);
  const advList = document.getElementById("advanced-map-list");
  const picks = document.getElementById("picked-maps");
  if (!li || !picks || !advList) return;
  li.classList.remove("vetoed-map");
  const startRect = li.getBoundingClientRect();
  const img = li.querySelector("img").cloneNode();
  const div = document.createElement("div");
  div.className = "pick-item";
  const num = document.createElement("span");
  num.className = "pick-number";
  num.textContent = pickOrder;
  pickOrder++;
  const label = document.createElement("span");
  label.className = "pick-label";
  label.textContent = li.querySelector(".adv-map-label").textContent;
  div.appendChild(img);
  div.appendChild(num);
  div.appendChild(label);
  picks.appendChild(div);
  const endRect = div.getBoundingClientRect();
  const dx = startRect.left - endRect.left;
  const dy = startRect.top - endRect.top;
  div.style.transform = `translate(${dx}px, ${dy}px)`;
  div.style.transition = "transform 0.3s ease";
  requestAnimationFrame(() => {
    div.style.transform = "translate(0, 0)";
  });
  div.addEventListener(
    "transitionend",
    () => {
      div.style.transition = "";
      div.style.transform = "";
    },
    { once: true }
  );
  li.remove();
  checkAdvancedCompletion();
  updateStageIndicator();
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
