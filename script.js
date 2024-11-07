const structures = [
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
];

const units = [
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
];

// Mapping of abbreviations to full names
const abbreviationMap = {
  ling: "zergling",
  lings: "zerglings",
  ovi: "overlord",
  ovie: "overlord",
  RW: "roach warren",
  pool: "spawning pool",
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

// Format structures with yellow bold text
function formatStructureText(actionText) {
  return structures.reduce((formattedText, structure) => {
    const regex = new RegExp(`\\b${structure}\\b`, "gi");
    return formattedText.replace(
      regex,
      `<span class="bold-yellow">${structure}</span>`
    );
  }, actionText);
}

// Format units with purple bold text and apply red color to numbers in the action
function formatActionText(actionText) {
  let formattedText = units.reduce((formattedText, unit) => {
    const regex = new RegExp(`\\b${unit}\\b(?!\\s+\\w+)`, "gi"); // Ensure units don't match structures
    return formattedText.replace(
      regex,
      `<span class="bold-purple">${unit}</span>`
    );
  }, actionText);

  // Apply red color to numbers
  return formattedText.replace(
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
    const match = line.match(/\[(.*?)\]\s*(.*)/);
    if (match) {
      const workersOrTimestamp = match[1];
      let actionText = match[2];

      // Apply abbreviation transformation, then format structures and units
      actionText = transformAbbreviations(actionText);
      actionText = formatStructureText(actionText);
      actionText = formatActionText(actionText);

      // Insert row in the table
      const row = table.insertRow();
      row.insertCell(0).textContent = workersOrTimestamp;
      row.insertCell(1).innerHTML = actionText;
    }
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
  const table = document.getElementById("buildOrderTable");
  const buildOrder = Array.from(table.rows)
    .slice(1)
    .map((row) => ({
      workersOrTimestamp: row.cells[0].textContent,
      action: row.cells[1].innerHTML,
    }));

  const blob = new Blob([JSON.stringify(buildOrder, null, 2)], {
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
    const buildOrder = JSON.parse(e.target.result);
    displayBuildOrder(buildOrder);
  };
  reader.readAsText(file);
}

// Display the build order in the table
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
