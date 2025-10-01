// Map Data (New Map Pool)
let mapData = [];
let mapImages = {};

// Best of Settings
let bestOfValue = 3; // Default best of setting
let currentMap = null;
let lastHoveredMap = null;
let currentAdvancedPlayer = "player1";
let advancedStage = "veto"; // stages: veto, pick
let pickOrder = 1;
let actionHistory = [];

function showBestOfModal() {
  const modal = document.getElementById("bestOfModal");
  const input = document.getElementById("bestOfInput");
  if (modal && input) {
    input.value = bestOfValue;
    modal.style.display = "flex";
    input.focus();
  }
}

function confirmBestOf(inputEl) {
  if (!inputEl) return;
  const val = parseInt(inputEl.value, 10);
  if (val >= 1 && val <= 9) {
    bestOfValue = val;
    const modal = document.getElementById("bestOfModal");
    if (modal) modal.style.display = "none";
    updateDisplayedBestOf();
    checkUnvetoedMapsForBestOf();
    if (document.getElementById("advanced-map-list")) {
      recalcAdvancedStage();
      updateStageIndicator();
    }
  } else {
    alert("Please enter a number between 1 and 9.");
  }
}

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

  const confirmBtn = document.getElementById("confirmBestOfButton");
  const bestOfInput = document.getElementById("bestOfInput");
  if (confirmBtn)
    confirmBtn.addEventListener("click", () => confirmBestOf(bestOfInput));
  if (bestOfInput)
    bestOfInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmBestOf(bestOfInput);
    });

  showBestOfModal();

  document.getElementById("resetButton").addEventListener("click", resetAll);
  const undoBtn = document.getElementById("undoButton");
  if (undoBtn) undoBtn.addEventListener("click", undoLastAction);
  const mobileReset = document.getElementById("resetButtonMobile");
  if (mobileReset) mobileReset.addEventListener("click", resetAll);
  const mobileUndo = document.getElementById("undoButtonMobile");
  if (mobileUndo) mobileUndo.addEventListener("click", undoLastAction);

  document
    .getElementById("toggleVisibilityButton")
    .addEventListener("click", toggleElementsVisibility);

  document
    .getElementById("mapFileInput")
    .addEventListener("change", updateMapPreview);

  document
    .getElementById("advancedToggle")
    .addEventListener("click", toggleAdvancedView);

  const startSel = document.getElementById("startingPlayerSelect");
  if (startSel) {
    startSel.addEventListener("change", (e) => {
      currentAdvancedPlayer = e.target.value;
      updateStageIndicator();
    });
  }

  const startWrapper = document.getElementById("startPlayerWrapper");
  const nameInputs = document.querySelector(".name-inputs");
  if (startWrapper) startWrapper.classList.add("hidden");
  if (nameInputs) nameInputs.classList.add("hidden");

  const p1Input = document.getElementById("player1NameInput");
  const p2Input = document.getElementById("player2NameInput");
  if (p1Input) p1Input.addEventListener("input", updateStageIndicator);
  if (p2Input) p2Input.addEventListener("input", updateStageIndicator);
  updateStageIndicator();
});

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

  const prevVetoed = li.classList.contains("vetoed-map");
  const prevText = indicator.textContent;
  const prevDisplay = indicator.style.display;

  if (prevVetoed) {
    li.classList.remove("vetoed-map");
    indicator.style.display = bestOfValue <= 1 ? "none" : "inline-block";
    indicator.textContent = "";
  } else {
    if (!canVetoMoreMaps()) return;
    // Choose direction based on currentAdvancedPlayer
    const direction = currentAdvancedPlayer === "player1" ? "left" : "right";
    animateVetoDirection(li, direction);
    li.classList.add("vetoed-map");
    indicator.style.display = "none";
  }

  actionHistory.push({
    action: "basicToggle",
    mapId: mapNumber,
    prevVetoed,
    prevText,
    prevDisplay,
  });

  currentMap = mapNumber;
  const previewImage = document.getElementById("previewImage");
  if (currentMap) previewImage.src = mapImages[currentMap];

  checkUnvetoedMapsForBestOf();
}

function canVetoMoreMaps() {
  const unvetoed = [...document.querySelectorAll(".map-list li")].filter(
    (li) => !li.classList.contains("vetoed-map")
  ).length;
  const bestOfLimit = bestOfValue;
  return unvetoed > bestOfLimit;
}

function checkUnvetoedMapsForBestOf() {
  const unvetoed = [...document.querySelectorAll(".map-list li")].filter(
    (li) => !li.classList.contains("vetoed-map")
  );
  document
    .querySelectorAll(".map-list li")
    .forEach((li) => li.classList.remove("pulsing-border"));
  const indicators = document.querySelectorAll(".order-indicator");
  const target = bestOfValue;
  if (target && unvetoed.length === target) {
    unvetoed.forEach((li) => li.classList.add("pulsing-border"));
    indicators.forEach((ind) => (ind.style.background = "#555"));
  } else {
    indicators.forEach((ind) => (ind.style.background = ""));
  }
}

function cycleOrder(mapNumber, event) {
  event.stopPropagation();
  const li = document.getElementById(`map${mapNumber}`);
  const indicator = li.querySelector(".order-indicator");

  if (li.classList.contains("vetoed-map") || bestOfValue <= 1) return;

  const maxOrders = bestOfValue;
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
  const el = document.getElementById("bestOfIndicator");
  if (el) el.textContent = `Best of: ${bestOfValue}`;
}

function resetAll() {
  document.querySelectorAll(".map-list li").forEach((li) => {
    li.classList.remove("vetoed-map", "pulsing-border");
    li.classList.remove("veto-left", "veto-right");
    li.style.display = "";
    const indicator = li.querySelector(".order-indicator");
    indicator.textContent = "";
    indicator.style.display = "inline-block";
    indicator.style.background = "";
  });
  currentMap = null;
  lastHoveredMap = null;
  resetPreview();
  bestOfValue = 3;
  showBestOfModal();

  const advList = document.getElementById("advanced-map-list");
  const p1 = document.getElementById("player1-list");
  const p2 = document.getElementById("player2-list");
  const picks = document.getElementById("picked-maps");
  const startWrapper = document.getElementById("startPlayerWrapper");
  const nameInputs = document.querySelector(".name-inputs");
  if (advList && p1 && p2 && picks) {
    advList.innerHTML = "";
    p1.innerHTML = "";
    p2.innerHTML = "";
    picks.innerHTML = "";
    const adv = document.getElementById("advanced-view");
    if (adv && adv.classList.contains("hidden")) {
      picks.style.display = "none";
      if (startWrapper) startWrapper.classList.add("hidden");
      if (nameInputs) nameInputs.classList.add("hidden");
    } else {
      picks.style.display = "flex";
      if (startWrapper) startWrapper.classList.remove("hidden");
      if (nameInputs) nameInputs.classList.remove("hidden");
    }
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

  const clone = element.cloneNode(true);
  const cloneStyle = clone.style;

  // Force same size and layout
  cloneStyle.position = "fixed";
  cloneStyle.top = `${startRect.top}px`;
  cloneStyle.left = `${startRect.left}px`;
  cloneStyle.width = `${startRect.width}px`;
  cloneStyle.height = `${startRect.height}px`;
  cloneStyle.margin = "0";
  cloneStyle.zIndex = "1000";
  cloneStyle.pointerEvents = "none";
  cloneStyle.transition = "transform 0.3s ease, opacity 0.3s ease";
  cloneStyle.borderRadius = getComputedStyle(element).borderRadius;
  cloneStyle.overflow = "hidden";

  // Match image size inside
  const img = clone.querySelector("img");
  if (img) {
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
  }

  document.body.appendChild(clone);

  // Hide original, append to target
  element.style.opacity = "0";
  target.appendChild(element);

  // Get end position
  const endRect = element.getBoundingClientRect();
  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;

  requestAnimationFrame(() => {
    cloneStyle.transform = `translate(${dx}px, ${dy}px)`;
  });

  clone.addEventListener(
    "transitionend",
    () => {
      document.body.removeChild(clone);
      element.style.opacity = "1";
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
  const currentName = currentAdvancedPlayer === "player1" ? p1Name : p2Name;
  const stageText =
    advancedStage === "veto"
      ? "Veto"
      : advancedStage === "pick"
      ? "Pick"
      : "Done";
  if (indicator) {
    if (advancedStage === "done") {
      indicator.innerHTML = `<span class="stage-text done">Done</span>`;
    } else {
      indicator.innerHTML = `<span class="stage-text ${stageText.toLowerCase()}">${stageText}</span> - ${currentName}`;
    }
  }
  const h1 = document.querySelector("#player1-column h3");
  const h2 = document.querySelector("#player2-column h3");
  if (h1) h1.textContent = p1Name;
  if (h2) h2.textContent = p2Name;
  if (h1) h1.classList.remove("active-player-name");
  if (h2) h2.classList.remove("active-player-name");
  if (advancedStage !== "done") {
    if (currentAdvancedPlayer === "player1" && h1) {
      h1.classList.add("active-player-name");
    } else if (currentAdvancedPlayer === "player2" && h2) {
      h2.classList.add("active-player-name");
    }
  }
}

// -------- Advanced View --------
function toggleAdvancedView() {
  const adv = document.getElementById("advanced-view");
  const list = document.getElementById("map-list");
  const preview = document.querySelector(".map-preview");
  const toggleBtn = document.getElementById("advancedToggle");
  const startWrapper = document.getElementById("startPlayerWrapper");
  const nameInputs = document.querySelector(".name-inputs");
  if (!adv || !list) return;

  if (adv.classList.contains("hidden")) {
    const startSel = document.getElementById("startingPlayerSelect");
    if (startSel && actionHistory.length === 0)
      currentAdvancedPlayer = startSel.value;
    const advListEl = document.getElementById("advanced-map-list");
    if (advListEl && advListEl.childElementCount === 0) {
      advancedStage = "veto";
      pickOrder = 1;
      renderAdvancedMapList();
      recalcAdvancedStage();
    }
    adv.classList.remove("hidden");
    adv.style.display = "flex";
    list.style.display = "none";
    if (preview) preview.style.display = "none";
    const picks = document.getElementById("picked-maps");
    if (picks) picks.style.display = "flex";
    if (startWrapper) startWrapper.classList.remove("hidden");
    if (nameInputs) nameInputs.classList.remove("hidden");
    if (toggleBtn) toggleBtn.textContent = "Basic Mode";
    updateStageIndicator();
  } else {
    adv.classList.add("hidden");
    adv.style.display = "none";
    list.style.display = "block";
    if (preview) preview.style.display = "block";
    const picks = document.getElementById("picked-maps");
    if (picks) picks.style.display = "none";
    if (startWrapper) startWrapper.classList.add("hidden");
    if (nameInputs) nameInputs.classList.add("hidden");
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

function advancedVeto(mapId, playerListId, player) {
  const li = document.getElementById(`adv-map${mapId}`);
  const target = document.getElementById(playerListId);
  if (!li || !target) return;
  actionHistory.push({
    action: "veto",
    mapId,
    player,
    playerListId,
    element: li,
  });
  moveElementWithAnimation(li, target, () => li.classList.add("vetoed-map"));
  checkAdvancedCompletion();
  updateStageIndicator();
}

function advancedVetoByTurn(mapId) {
  const playerListId =
    currentAdvancedPlayer === "player1" ? "player1-list" : "player2-list";
  if (advancedStage === "veto") {
    advancedVeto(mapId, playerListId, currentAdvancedPlayer);
  } else if (advancedStage === "pick") {
    pickMap(mapId, currentAdvancedPlayer);
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
  const limit = bestOfValue;
  if (advancedStage === "veto" && limit && remaining.length === limit) {
    picks.innerHTML = "";
    picks.style.display = "flex";
    advancedStage = "pick";
    updateStageIndicator();
  }
  if (advancedStage === "pick" && remaining.length === 0) {
    advancedStage = "done";
    updateStageIndicator();
  }
}

function pickMap(mapId, player) {
  const li = document.getElementById(`adv-map${mapId}`);
  const advList = document.getElementById("advanced-map-list");
  const picks = document.getElementById("picked-maps");
  if (!li || !picks || !advList) return;

  const startRect = li.getBoundingClientRect();
  const img = li.querySelector("img").cloneNode();
  const label = li.querySelector(".adv-map-label")?.textContent || "";

  const div = document.createElement("div");
  div.className = "pick-item";
  const num = document.createElement("span");
  num.className = "pick-number";
  num.textContent = pickOrder;
  pickOrder++;

  const labelSpan = document.createElement("span");
  labelSpan.className = "pick-label";
  labelSpan.textContent = label;

  const p1Input = document.getElementById("player1NameInput");
  const p2Input = document.getElementById("player2NameInput");
  const banner = document.createElement("span");
  banner.className = "pick-player-banner";
  banner.textContent =
    player === "player1"
      ? p1Input && p1Input.value
        ? p1Input.value
        : "Player 1"
      : p2Input && p2Input.value
      ? p2Input.value
      : "Player 2";

  div.appendChild(img);
  div.appendChild(num);
  div.appendChild(labelSpan);
  div.appendChild(banner);
  picks.appendChild(div);

  const endRect = div.getBoundingClientRect();

  // 📦 Clone with matching size and style
  const clone = li.cloneNode(true);
  const cloneStyle = clone.style;
  cloneStyle.position = "fixed";
  cloneStyle.top = `${startRect.top}px`;
  cloneStyle.left = `${startRect.left}px`;
  cloneStyle.width = `${startRect.width}px`;
  cloneStyle.height = `${startRect.height}px`;
  cloneStyle.margin = "0";
  cloneStyle.zIndex = "1000";
  cloneStyle.pointerEvents = "none";
  cloneStyle.transition = "transform 0.4s ease, opacity 0.4s ease";
  cloneStyle.borderRadius = getComputedStyle(li).borderRadius;
  cloneStyle.overflow = "hidden";

  // Match image inside
  const cloneImg = clone.querySelector("img");
  if (cloneImg) {
    cloneImg.style.width = "100%";
    cloneImg.style.height = "100%";
    cloneImg.style.objectFit = "cover";
  }

  document.body.appendChild(clone);

  // Animate to destination
  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;

  requestAnimationFrame(() => {
    cloneStyle.transform = `translate(${dx}px, ${dy}px)`;
    cloneStyle.opacity = "0";
  });

  clone.addEventListener(
    "transitionend",
    () => {
      document.body.removeChild(clone);
    },
    { once: true }
  );

  actionHistory.push({ action: "pick", mapId, player, li, pickEl: div });
  li.remove();
  checkAdvancedCompletion();
  updateStageIndicator();
}

function recalcAdvancedStage() {
  const advList = document.getElementById("advanced-map-list");
  const remaining = advList ? advList.querySelectorAll("li").length : 0;
  const limit = bestOfValue;
  if (remaining === 0) {
    advancedStage = "done";
  } else if (limit && remaining === limit) {
    advancedStage = "pick";
  } else {
    advancedStage = "veto";
  }
}

function undoLastAction() {
  const last = actionHistory.pop();
  if (!last) return;
  if (last.action === "pick") {
    const picks = document.getElementById("picked-maps");
    const advList = document.getElementById("advanced-map-list");
    if (picks && last.pickEl) picks.removeChild(last.pickEl);
    if (advList && last.li) advList.appendChild(last.li);
    pickOrder = Math.max(1, pickOrder - 1);
  } else if (last.action === "veto") {
    const advList = document.getElementById("advanced-map-list");
    const playerList = document.getElementById(last.playerListId);
    if (playerList && advList && last.element) {
      playerList.removeChild(last.element);
      last.element.classList.remove("vetoed-map");
      advList.appendChild(last.element);
    }
  } else if (last.action === "basicToggle") {
    const li = document.getElementById(`map${last.mapId}`);
    const indicator = li.querySelector(".order-indicator");
    if (li && indicator) {
      li.classList.remove("veto-left", "veto-right");
      if (last.prevVetoed) {
        li.classList.add("vetoed-map");
        li.style.display = "none";
      } else {
        li.classList.remove("vetoed-map");
        li.style.display = "";
      }
      indicator.textContent = last.prevText;
      indicator.style.display = last.prevDisplay;
      checkUnvetoedMapsForBestOf();
    }
  }
  if (last.player) currentAdvancedPlayer = last.player;
  recalcAdvancedStage();
  updateStageIndicator();
}

// Load maps by mode (only current maps)
async function loadMapsByMode(mode) {
  try {
    const response = await fetch("/data/maps.json");
    const allMaps = await response.json();

    // Filter maps: current maps only, matching mode
    const selectedMaps = allMaps.filter(
      (map) => map.mode === mode && map.folder.startsWith("current")
    );

    mapData = selectedMaps.map((map, index) => ({
      id: index + 1,
      name: map.name, // only show the name
      file: map.file,
      folder: map.folder,
      mode: map.mode,
    }));

    // Setup map images
    mapImages = {};
    mapData.forEach((map) => {
      // Use "current" folder in path
      mapImages[map.id] = `img/maps/current/${mode}/${map.file}`;
    });

    // Reset & render
    resetAll();
    const list = document.querySelector(".map-list ul");
    if (list) list.innerHTML = "";
    renderMapList();
    updateDisplayedMap();

    if (mapData.length > 0) {
      const previewImage = document.getElementById("previewImage");
      previewImage.src = mapImages[mapData[0].id];
      previewImage.alt = `Map ${mapData[0].name} Preview`;
    }
  } catch (err) {
    console.error("❌ Failed to load maps.json:", err);
  }
}

function renderMapList() {
  const mapList = document.querySelector(".map-list ul");
  mapList.innerHTML = ""; // Clear previous maps
  mapData.forEach((map) => {
    const li = document.createElement("li");
    li.id = `map${map.id}`;

    const labelSpan = document.createElement("span");
    labelSpan.id = `label${map.id}`;
    labelSpan.textContent = map.name; // only show the name

    const indicatorSpan = document.createElement("span");
    indicatorSpan.classList.add("order-indicator");

    li.appendChild(labelSpan);
    li.appendChild(indicatorSpan);

    li.addEventListener("click", () => toggleVeto(map.id));
    li.addEventListener("mouseover", () => showPreview(map.id));
    li.addEventListener("mouseout", () => keepHoveredMap());
    indicatorSpan.addEventListener("click", (event) =>
      cycleOrder(map.id, event)
    );

    mapList.appendChild(li);
  });
}

// Attach dropdown change
window.addEventListener("DOMContentLoaded", () => {
  const modeDropdown = document.getElementById("modeDropdown");
  if (modeDropdown) {
    modeDropdown.addEventListener("change", async (e) => {
      const mode = e.target.value; // "1v1", "2v2", etc.
      await loadMapsByMode(mode);

      // Refresh advanced list if exists
      const modalList = document.getElementById("advanced-map-list");
      if (modalList) {
        modalList.innerHTML = "";
        renderAdvancedMapList();
      }
    });
  }

  // Default load = current 1v1
  loadMapsByMode("1v1");
});

document
  .getElementById("hidePreviewCheckbox")
  .addEventListener("change", toggleMapPreviewVisibility);
