let savedBuilds = [];

export function getSavedBuilds() {
  return savedBuilds;
}

export function setSavedBuilds(builds) {
  savedBuilds = builds;
}

export function saveSavedBuildsToLocalStorage() {
  localStorage.setItem("savedBuilds", JSON.stringify(savedBuilds));
}

export function saveBuilds(builds) {
  localStorage.setItem("savedBuilds", JSON.stringify(builds));
}

// Add this function to delete a build by index
export function deleteBuildFromStorage(index) {
  if (index >= 0 && index < savedBuilds.length) {
    savedBuilds.splice(index, 1); // Remove the build at the specified index
    saveSavedBuildsToLocalStorage(); // Save the updated builds to localStorage
  }
}

export function saveBuild() {
  const buildTitle = document.getElementById("buildTitle").value.trim();
  const buildComment = document.getElementById("buildComment").value.trim();
  const buildOrderInput = document
    .getElementById("buildOrderInput")
    .value.trim();
  const videoLink = document.getElementById("videoLink").value.trim();
  const buildCategory = document.getElementById("buildCategoryDropdown").value; // Dropdown selection

  if (!buildTitle) {
    console.error("Build title is required!");
    return;
  }

  // Determine race and matchup
  let category = "";
  let subcategory = "";

  // Matchups
  const zergMatchups = ["zvz", "zvp", "zvt"];
  const protossMatchups = ["pvp", "pvz", "pvt"];
  const terranMatchups = ["tvt", "tvz", "tvp"];

  if (zergMatchups.includes(buildCategory)) {
    category = "Zerg";
    subcategory = buildCategory;
  } else if (protossMatchups.includes(buildCategory)) {
    category = "Protoss";
    subcategory = buildCategory;
  } else if (terranMatchups.includes(buildCategory)) {
    category = "Terran";
    subcategory = buildCategory;
  } else {
    category = buildCategory; // For generic race selection like "Zerg"
    subcategory = undefined;
  }

  // Create build object
  const newBuild = {
    title: buildTitle,
    comment: buildComment || "",
    buildOrder: parseBuildOrder(buildOrderInput), // Assuming a parseBuildOrder function exists
    videoLink: videoLink || null,
    category: category,
    subcategory: subcategory,
  };

  // Save the new build to storage
  const savedBuilds = getSavedBuilds();
  savedBuilds.push(newBuild);
  saveBuilds(savedBuilds); // Assuming saveBuilds persists the data

  console.log("Build saved:", newBuild);
  populateBuildList(savedBuilds); // Refresh the displayed list
}
