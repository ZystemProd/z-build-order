export function parseBuildOrder(buildOrderText) {
  if (typeof buildOrderText !== "string") {
    console.error(
      "Expected buildOrderText to be a string, but got:",
      typeof buildOrderText
    );
    return [];
  }

  // Proceed with parsing if it's a valid string
  const steps = buildOrderText
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(.*?)\]\s*(.*)/); // Example: [01:00] Build structure
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

  return adjustOversupply(steps);
}

function adjustOversupply(steps) {
  let cap = null;
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const m = /^\s*(\d{1,3})(?:\/(\d{1,3}))?\s*$/.exec(step.workersOrTimestamp);
    if (!m) continue;

    const used = parseInt(m[1], 10);
    const explicitCap = m[2] ? parseInt(m[2], 10) : null;

    if (explicitCap !== null) {
      cap = explicitCap;
    } else if (cap === null) {
      cap = used;
    } else if (used > cap) {
      step.workersOrTimestamp = `${used}/${cap}`;
    } else {
      cap = used;
    }
  }
  return steps;
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

  const reparseBtn = document.getElementById("reparseLastReplayButton");
  if (reparseBtn) reparseBtn.style.display = "none";
  if (typeof window !== "undefined") window.lastReplayFile = null;

  console.log("✅ All inputs reset.");
}

export function enableSaveButton() {
  const btn = document.getElementById("saveBuildButton");
  if (btn) {
    btn.disabled = false;
  }
}
