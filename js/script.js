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

const units = [
  // Zerg Units
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

  // Protoss Units
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

  // Terran Units
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
];

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
function formatActionText(actionText) {
  units.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+warren|\\s+den|\\s+pit|\\s+network)`,
      "gi"
    ); // Match plural forms and exclude multi-word structures
    actionText = actionText.replace(
      regex,
      `<span class="bold-purple">${unit}$1</span>`
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

// Save the build order as a JSON file
function saveBuildOrderAsFile() {
  const title = document.getElementById("buildOrderTitle").value;
  const table = document.getElementById("buildOrderTable");
  const buildOrder = Array.from(table.rows)
    .slice(1)
    .map((row) => ({
      workersOrTimestamp: row.cells[0].textContent,
      action: row.cells[1].innerHTML,
    }));

  const data = {
    title: title,
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

// Load the build order from a JSON file
function loadBuildOrderFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const data = JSON.parse(e.target.result);

    // Set the title if available
    document.getElementById("buildOrderTitle").value = data.title || "";

    // Display the build order in the table
    displayBuildOrder(data.buildOrder);

    // Load the build order text into the textarea with HTML tags removed
    const buildOrderText = data.buildOrder
      .map((step) => {
        const plainTextAction = step.action.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
        return `[${step.workersOrTimestamp}] ${plainTextAction}`;
      })
      .join("\n");

    document.getElementById("buildOrderInput").value = buildOrderText;
  };
  reader.readAsText(file);
}

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
