export function parseBuildOrder(buildOrderText) {
  if (typeof buildOrderText !== "string") {
    console.error(
      "Expected buildOrderText to be a string, but got:",
      typeof buildOrderText
    );
    return [];
  }

  // Proceed with parsing if it's a valid string
  return buildOrderText
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(\S+)\]\s*(.*)/); // Example: [01:00] Build structure
      if (match) {
        return {
          workersOrTimestamp: match[1],
          action: match[2],
        };
      }
      if (line.trim() !== "") {
        return { workersOrTimestamp: "", action: line };
      }
      return null; // Return null if empty line
    })
    .filter((step) => step !== null); // Filter out invalid steps
}

export function applySmartSupply(text) {
  const SUPPLY_GAINS = {
    overlord: 8,
    hatchery: 6,
    'command center': 15,
    nexus: 15,
    pylon: 8,
    'supply depot': 8,
  };

  let maxSupply = 0;
  const lines = text.split('\n').map((line) => {
    const match = line.match(/^\[(\d+)(?:\/(\d+))?\]\s*(.+)$/i);
    if (!match) return line;
    let current = parseInt(match[1], 10);
    if (match[2]) {
      maxSupply = parseInt(match[2], 10);
    }
    const action = match[3].trim();
    const gain = SUPPLY_GAINS[action.toLowerCase()] || 0;
    if (gain && !match[2]) {
      maxSupply += gain;
    }
    if (!match[2]) {
      return `[${current}/${maxSupply}] ${action}`;
    }
    return line;
  });

  return lines.join('\n');
}

export function resetBuildInputs() {
  console.log("🔄 Resetting inputs..."); // Debugging log

  // ✅ Reset Title
  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");

  if (titleInput) titleInput.value = "";
  if (titleText) {
    titleText.textContent = "Enter build order title here...";
    titleText.classList.add("dimmed");
  }

  // ✅ Reset Match-Up Selection + Dropdown Color
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  if (categoryDropdown) {
    categoryDropdown.value = "";
    categoryDropdown.style.color = ""; // 🔁 Reset custom color
  }

  // ✅ Reset Comment and Video Inputs
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");
  if (commentInput) commentInput.value = "";
  if (videoInput) videoInput.value = "";

  // ✅ Reset Build Order Input
  const buildOrderInput = document.getElementById("buildOrderInput");
  if (buildOrderInput) buildOrderInput.value = "";

  // ✅ Reset Build Order Output Table
  const buildOrderTable = document.getElementById("buildOrderTable");
  if (buildOrderTable) {
    while (buildOrderTable.rows.length > 1) {
      buildOrderTable.deleteRow(1);
    }
  }

  // ✅ Reset Selected Map Preview
  const mapImage = document.getElementById("map-preview-image");
  const selectedMapText = document.getElementById("selected-map-text");
  if (mapImage) mapImage.src = "";
  if (selectedMapText) selectedMapText.innerText = "No map selected";

  // ✅ Reset Annotations (Circles & Arrows)
  if (window.mapAnnotations) {
    mapAnnotations.circles = [];
    mapAnnotations.arrows = [];
    const annotationsContainer = document.getElementById("map-annotations");
    if (annotationsContainer) annotationsContainer.innerHTML = "";
  }

  // ✅ Reset Publish Button
  const publishButton = document.getElementById("publishBuildButton");
  if (publishButton) {
    publishButton.innerText = "📢 Publish Build";
    publishButton.disabled = false;
    publishButton.style.display = "none";
  }

  // ✅ Disable Save/Update Button + reset color
  const saveBtn = document.getElementById("saveBuildButton");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.style.backgroundColor = "";
  }

  console.log("✅ All inputs reset.");
}
