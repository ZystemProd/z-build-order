const structures = [
  // Zerg Structures
  "baneling nest",
  "evolution chamber",
  "extractor",
  "greater spire",
  "hatchery",
  "hive",
  "hydralisk den",
  "lair",
  "lurker den",
  "nydus network",
  "roach warren",
  "spawning pool",
  "spine crawler",
  "spire",
  "spore crawler",
  "infestation pit",
  "pool",

  // Protoss Structures
  "assimilator",
  "cybernetics core",
  "dark shrine",
  "fleet beacon",
  "forge",
  "gateway",
  "nexus",
  "photon cannon",
  "pylon",
  "robotics bay",
  "robotics facility",
  "shield battery",
  "stargate",
  "templar archives",
  "twilight council",
  "warp gate",

  // Terran Structures
  "armory",
  "barracks",
  "bunker",
  "command center",
  "engineering bay",
  "fusion core",
  "ghost academy",
  "missile turret",
  "orbital command",
  "planetary fortress",
  "reactor",
  "refinery",
  "sensor tower",
  "starport",
  "supply depot",
  "tech lab",
  "fusion core",
  "factory",
  "command center",
];

const units = {
  zerg: [
    "overlord",
    "overlords",
    "zergling",
    "zerglings",
    "queen",
    "queens",
    "drone",
    "drones",
    "lurker",
    "lurkers",
    "hydra",
    "hydras",
    "swarm host",
    "swarm hosts",
    "roach",
    "roaches",
    "baneling",
    "banelings",
    "corruptor",
    "corruptors",
    "infestor",
    "infestors",
    "ultralisk",
    "ultralisks",
    "mutalisk",
    "mutalisks",
    "viper",
    "vipers",
    "brood lord",
    "brood lords",
  ],
  protoss: [
    "probe",
    "probes",
    "zealot",
    "zealots",
    "stalker",
    "stalkers",
    "sentry",
    "sentries",
    "observer",
    "observers",
    "immortal",
    "immortals",
    "warp prism",
    "warp prisms",
    "colossus",
    "colossi",
    "phoenix",
    "phoenixes",
    "void ray",
    "void rays",
    "high templar",
    "high templars",
    "dark templar",
    "dark templars",
    "archon",
    "archons",
    "carrier",
    "carriers",
    "mothership",
    "mothership core",
    "oracle",
    "oracles",
    "tempest",
    "tempests",
    "adept",
    "adepts",
    "disruptor",
    "disruptors",
  ],
  terran: [
    "scv",
    "scvs",
    "marine",
    "marines",
    "marauder",
    "marauders",
    "reaper",
    "reapers",
    "ghost",
    "ghosts",
    "hellion",
    "hellions",
    "siege tank",
    "siege tanks",
    "thor",
    "thors",
    "viking",
    "vikings",
    "medivac",
    "medivacs",
    "banshee",
    "banshees",
    "raven",
    "ravens",
    "battlecruiser",
    "battlecruisers",
    "widow mine",
    "widow mines",
    "hellbat",
    "hellbats",
    "cyclone",
    "cyclones",
    "liberator",
    "liberators",
  ],
};

// Mapping of abbreviations to full names
const abbreviationMap = {
  ling: "zergling",
  lings: "zerglings",
  ovi: "overlord",
  ovie: "overlord",
  RW: "roach warren",
  spore: "spore crawler",
  spine: "spine crawler",
  nydus: "nydus network",
  gas: "extractor",
  hydra: "hydralisk",
  hatch: "hatchery",
  tank: "siege tank",
  tanks: "siege tanks",
  brood: "brood lord",
  broods: "brood lords",
  bc: "battlecruiser",
  evo: "evolution chamber",
};

// Utility to transform abbreviations in the input text
function transformAbbreviations(text) {
  return Object.keys(abbreviationMap).reduce((updatedText, abbr) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    return updatedText.replace(regex, abbreviationMap[abbr]);
  }, text);
}

// Function to format specific structures with styling
function formatStructureText(actionText) {
  // Process multi-word structures first
  structures.forEach((structure) => {
    const regex = new RegExp(`\\b${structure}\\b`, "gi");
    actionText = actionText.replace(
      regex,
      `<span class="bold-yellow">${structure}</span>`
    );
  });
  return actionText;
}

// Function to format specific units with styling, handling plural forms and exceptions
// Function to format specific units with distinct faction colors
function formatActionText(actionText) {
  // Zerg Units - Purple
  units.zerg.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+warren|\\s+den|\\s+pit|\\s+network)`,
      "gi"
    );
    actionText = actionText.replace(
      regex,
      `<span class="bold-purple">${unit}$1</span>`
    );
  });

  // Protoss Units - Bright Blue
  units.protoss.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+core|\\s+shrine|\\s+gate|\\s+forge)`,
      "gi"
    );
    actionText = actionText.replace(
      regex,
      `<span class="bold-blue">${unit}$1</span>`
    );
  });

  // Terran Units - Bright Red
  units.terran.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+barracks|\\s+command|\\s+reactor)`,
      "gi"
    );
    actionText = actionText.replace(
      regex,
      `<span class="bold-red">${unit}$1</span>`
    );
  });

  // Apply red color to numbers in the action column
  return actionText.replace(
    /\d+/g,
    (match) => `<span class="red-text">${match}</span>`
  );
}

// Function to analyze and update the build order table automatically
function analyzeBuildOrder(inputText) {
  const lines = inputText.split("\n");
  const table = document.getElementById("buildOrderTable");

  // Clear existing rows (except the header)
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  lines.forEach((line) => {
    // Check if the line contains a timestamp (text in square brackets)
    const match = line.match(/\[(.*?)\]\s*(.*)/);

    let workersOrTimestamp = "";
    let actionText = "";

    if (match) {
      // If brackets are present, treat as a regular build order line
      workersOrTimestamp = match[1];
      actionText = match[2];
    } else {
      // If no brackets, treat as a comment line
      actionText = line;
    }

    // Apply abbreviation transformation, then format structures and units
    actionText = transformAbbreviations(actionText);
    actionText = formatStructureText(actionText);
    actionText = formatActionText(actionText);

    // Insert row in the table
    const row = table.insertRow();
    row.insertCell(0).textContent = workersOrTimestamp; // Empty if it's a comment
    row.insertCell(1).innerHTML = actionText;
  });
}

// Automatically trigger analysis when the user types in the buildOrderInput field
document
  .getElementById("buildOrderInput")
  .addEventListener("input", (event) => {
    analyzeBuildOrder(event.target.value);
  });

// Function to toggle visibility of a section
// Function to toggle the visibility of any section
function toggleSection(sectionId, arrowId) {
  const section = document.getElementById(sectionId);
  const arrow = document.getElementById(arrowId);

  // Toggle visibility of the section
  if (section.style.display === "none") {
    section.style.display = "block";
    arrow.classList.remove("down");
  } else {
    section.style.display = "none";
    arrow.classList.add("down");
  }
}

// Save the build order as a JSON file, including comment, video link, and input text
function saveBuildOrderAsFile() {
  const title = document.getElementById("buildOrderTitleInput").value; // Get title input value
  const comment = document.getElementById("commentInput").value;
  const videoLink = document.getElementById("videoInput").value;
  const buildOrderInput = document.getElementById("buildOrderInput").value; // Get build order input text
  const table = document.getElementById("buildOrderTable");

  const buildOrder = Array.from(table.rows)
    .slice(1)
    .map((row) => ({
      workersOrTimestamp: row.cells[0].textContent,
      action: row.cells[1].innerHTML,
    }));

  const data = {
    title: title,
    comment: comment,
    videoLink: videoLink,
    buildOrderInput: buildOrderInput,
    buildOrder: buildOrder,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `build_order_${Date.now()}.json`;
  downloadLink.click();
  URL.revokeObjectURL(url);
}

// Load the build order from a JSON file, including comment, video link, and input text
function loadBuildOrderFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const data = JSON.parse(e.target.result);

    // Set the title, comment, video link, and input text if available
    document.getElementById("buildOrderTitleInput").value = data.title || "";
    document.getElementById("buildOrderTitleText").textContent =
      data.title || "Enter build order title here...";
    document.getElementById("commentInput").value = data.comment || "";
    document.getElementById("videoInput").value = data.videoLink || "";
    document.getElementById("buildOrderInput").value =
      data.buildOrderInput || ""; // Load input text

    // Display the build order in the table
    displayBuildOrder(data.buildOrder);

    // Update video iframe if there is a valid link
    updateVideoIframe(data.videoLink);
  };
  reader.readAsText(file);
}

// Update the video iframe with the YouTube link
function updateVideoIframe(link) {
  const videoIframe = document.getElementById("videoIframe");
  const videoId = link ? link.split("v=")[1] : null;
  if (videoId) {
    videoIframe.src = `https://www.youtube.com/embed/${videoId}`;
    videoIframe.style.display = "block";
  } else {
    videoIframe.src = "";
    videoIframe.style.display = "none";
  }
}

// Event listener to update iframe when video link is changed
document.getElementById("videoInput").addEventListener("input", (event) => {
  updateVideoIframe(event.target.value);
});

function displayBuildOrder(buildOrder) {
  const table = document.getElementById("buildOrderTable");

  // Clear existing rows (except header)
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  buildOrder.forEach((step) => {
    const row = table.insertRow();
    row.insertCell(0).textContent = step.workersOrTimestamp;
    row.insertCell(1).innerHTML = formatActionText(
      transformAbbreviations(step.action)
    );
  });
}
function toggleTitleInput(showInput) {
  const titleText = document.getElementById("buildOrderTitleText");
  const titleInput = document.getElementById("buildOrderTitleInput");

  if (showInput) {
    // Show input box, hide text span, remove dimmed effect, and clear input for typing
    titleText.style.display = "none";
    titleInput.style.display = "inline-block";
    titleInput.value = titleText.classList.contains("dimmed")
      ? ""
      : titleText.textContent; // Clear if it's dimmed placeholder
    titleInput.focus();
    titleText.classList.remove("dimmed"); // Remove dimmed class
  } else {
    // Hide input box, show text span, and restore placeholder if empty
    titleText.textContent =
      titleInput.value || "Enter build order title here...";
    titleInput.style.display = "none";
    titleText.style.display = "inline-block";

    // Add dimmed effect if no title was entered
    if (!titleInput.value) {
      titleText.classList.add("dimmed");
    }
  }
}
