export function parseBuildOrder(buildOrderText) {
  return buildOrderText
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(.*?)\]\s*(.*)/);
      return match
        ? { workersOrTimestamp: match[1], action: match[2] }
        : { workersOrTimestamp: "", action: line };
    })
    .filter((step) => step.action.trim() !== ""); // Filter out empty lines
}

export function resetBuildInputs() {
  console.log("🔄 Resetting inputs..."); // Debugging log

  // ✅ Reset Title
  const titleInput = document.getElementById("buildOrderTitleInput");
  if (titleInput) titleInput.value = "";

  // ✅ Reset Match-Up Selection
  const categoryDropdown = document.getElementById("buildCategoryDropdown");
  if (categoryDropdown) categoryDropdown.value = "";

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

  console.log("✅ All inputs reset.");
}
