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
