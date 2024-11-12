// Structures and Units Data
const structures = [
  "baneling nest",
  "evolution chamber",
  "extractor",
  "greater spire",
  "hatchery",
  "hatcheries",
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
    "zergling",
    "queen",
    "drone",
    "lurker",
    "hydralisk",
    "swarm host",
    "roach",
    "baneling",
    "corruptor",
    "infestor",
    "ultralisk",
    "mutalisk",
    "viper",
    "brood lord",
  ],
  protoss: [
    "probe",
    "zealot",
    "stalker",
    "sentry",
    "observer",
    "immortal",
    "warp prism",
    "colossus",
    "colossi",
    "phoenix",
    "void ray",
    "high templar",
    "dark templar",
    "archon",
    "carrier",
    "mothership",
    "oracle",
    "tempest",
    "adept",
    "disruptor",
  ],
  terran: [
    "scv",
    "marine",
    "marauder",
    "reaper",
    "ghost",
    "hellion",
    "siege tank",
    "thor",
    "viking",
    "medivac",
    "banshee",
    "raven",
    "battlecruiser",
    "widow mine",
    "hellbat",
    "cyclone",
    "liberator",
  ],
};

const upgrades = [
  // Zerg Upgrades
  "metabolic boost",
  "adrenal glands",
  "glial reconstitution",
  "tunneling claws",
  "grooved spines",
  "muscular augments",
  "chitinous plating",
  "anabolic synthesis",
  "neural parasite",
  "range attack",
  "baneling speed",
  "centrifugal Hooks",
  "overlord speed",
  "borrow",
  "carapace",
  "melee attack",
  "missile attack",
  "flyer armor",
  "flyer attack",
  "adaptive talons",
  "seismic spines",

  // Protoss Upgrades
  "research warp gate",
  "shield",
  "ground weapons",
  "ground armor",
  "air weapons",
  "air armor",
  "blink",
  "charge",
  "resonation glaives",
  "psionic storm",
  "storm",
  "anion pulse crystals",
  "phonix range",
  "colossus range",
  "extended thermal lances",
  "thermal lanes",
  "gravitic boosters",
  "gravitic drive",
  "flux vanes",
  "tectonic destabilizers",

  // Terran Upgrades
  "stimpack",
  "combat shields",
  "concussive shells",
  "terrans infantry armor",
  "terrans infantry weapons",
  "building armor",
  "banshee cloak",
  "emp round",
  "cloak",
  "battlecruiser yamato cannon",
];

// Modify the abbreviation map for specific structures and units
const abbreviationMap = {
  ling: "zergling",
  lings: "zerglings",
  ovi: "overlord",
  ovie: "overlord",
  RW: "roach warren",
  gas: "extractor",
  hydra: "hydralisk",
  hatch: "hatchery",
  bc: "battlecruiser",
  evo: "evolution chamber",
  "zergling speed": "Metabolic Boost",
  "roach speed": "glial reconstitution",
  "hydralsik range": "grooved spines",
  "hydralsik speed": "muscular augments",
  "ultralisk armor": "chitinous plating",
  "ultralisk speed": "anabolic synthesis",
  "lurker range": "seismic spines",
  gate: "gateway",
  gates: "gateways",
  cannon: "photon cannon",
  cannons: "photon cannons",
};

// Utility to transform abbreviations in the input text
function transformAbbreviations(text) {
  // Prevent duplicated replacements by marking transformed phrases
  const replacements = {
    "spine crawler": "Spine Crawler",
    "spore crawler": "Spore Crawler",
    "nydus network": "Nydus Network",
    "brood lord": "Brood Lord",
    "siege tank": "Siege Tank",
    "psionic storm": "Psionic Storm",
  };

  // Specific replacements for full phrases to avoid partial matches
  Object.keys(replacements).forEach((phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    text = text.replace(regex, replacements[phrase]);
  });

  // Abbreviations handling for single words only if they are not part of a larger term
  text = text.replace(/\bspine\b(?!\s+crawler)/gi, "Spine Crawler");
  text = text.replace(/\bspore\b(?!\s+crawler)/gi, "Spore Crawler");
  text = text.replace(/\bnydus\b(?!\s+network)/gi, "Nydus Network");
  text = text.replace(/\bbrood\b(?!\s+lord)/gi, "Brood Lord");
  text = text.replace(/\btank\b(?!\s+tank)/gi, "Siege Tank");
  text = text.replace(/\bstorm\b(?!\s+storm)/gi, "Psionic Storm");

  // Apply other abbreviations from the abbreviationMap only if no previous match occurred
  return Object.keys(abbreviationMap).reduce((updatedText, abbr) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi"); // Word boundary matching
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

const upgradeImages = {
  "metabolic boost": "img/upgrade/metabolic_boost.png",
  "adrenal glands": "img/upgrade/adrenal_glands.png",
  "glial reconstitution": "img/upgrade/glial_reconstitution.png",
  "tunneling claws": "img/upgrade/tunneling_claws.png",
  "overlord speed": "img/upgrade/overlord_speed.png",
  "muscular augments": "img/upgrade/muscular_augments.png",
  "chitinous plating": "img/upgrade/chitinous_plating.png",
  "grooved spines": "img/upgrade/grooved_spines.png",
  burrow: "img/upgrade/burrow.png",
  "anabolic synthesis": "img/upgrade/anabolic_synthesis.png",
  "flyer attack": "img/upgrade/flyer_attack.png",
  "flyer armor": "img/upgrade/flyer_armor.png",
  "melee attack": "img/upgrade/melee_attack.png",
  carapace: "img/upgrade/carapace.png",
  "missile attack": "img/upgrade/missile_attack.png",
  "centrifugal hooks": "img/upgrade/centrifugal_hooks.png",
  "baneling speed": "img/upgrade/centrifugal_hooks.png",
  "adaptive talons": "img/upgrade/adaptive_talons.png",
  "seismic spines": "img/upgrade/seismic_spines.png",
  "neural parasite": "img/upgrade/neural_parasite.png",
};

// Function to format action text with upgrade images
// Function to format action text with upgrade images
function formatUpgrades(actionText) {
  const upgrades = Object.keys(upgradeImages);

  upgrades.forEach((upgrade) => {
    const escapedUpgrade = upgrade.replace(/\+/g, "\\+"); // Escape special characters
    const regex = new RegExp(`\\b${escapedUpgrade}\\b`, "gi");

    // Only replace once to avoid duplication
    actionText = actionText.replace(regex, (match) => {
      // Check if the upgrade is "flyer carapace" to handle its image properly
      if (upgrade === "flyer carapace") {
        const imageSrc = upgradeImages[upgrade];
        return `<span class="upgrade-highlight">${upgrade} <img src="${imageSrc}" alt="${upgrade}" class="upgrade-image"></span>`;
      }

      // For other upgrades, use the default formatting
      const imageSrc = upgradeImages[upgrade];
      return `<span class="upgrade-highlight">${upgrade} <img src="${imageSrc}" alt="${upgrade}" class="upgrade-image"></span>`;
    });
  });

  return actionText;
}

// Capitalize the first letter of the text
function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Capitalize the first letter of each word for units, structures, and upgrades
function capitalizeWords(text) {
  // Capitalize specific terms (Units, Structures, Upgrades)
  const allUnitsAndStructures = [
    ...units.zerg,
    ...units.protoss,
    ...units.terran,
    ...structures,
    ...upgrades,
  ];

  allUnitsAndStructures.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    text = text.replace(regex, (match) => capitalizeFirstLetter(match));
  });

  return text;
}

// Capitalize the first letter of each sentence
function capitalizeSentences(text) {
  return text.replace(/(?:^|\.\s+)([a-z])/g, (match, group1) => {
    return match.toUpperCase();
  });
}

// Function to format specific units and structures with styling
function formatActionText(actionText) {
  actionText = formatUpgrades(actionText); // Apply upgrade formatting first
  actionText = formatStructureText(actionText); // Format structures
  actionText = formatUnits(actionText); // Format units

  // Capitalize first letter of each sentence
  actionText = capitalizeSentences(actionText);

  // Capitalize the first letter of each word for units, structures, and upgrades
  actionText = capitalizeWords(actionText);

  // Apply red color to numbers in the action column
  return actionText.replace(
    /\d+/g,
    (match) => `<span class="red-text">${match}</span>`
  );
}

// Function to format specific units with styling, handling plural forms and exceptions
function formatUnits(actionText) {
  // Zerg Units - Purple
  units.zerg.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+warren|\\s+den|\\s+pit|\\s+network|\\s+speed|\\s+armor|\\s+nest)`,
      "gi"
    );
    actionText = actionText.replace(
      regex,
      (match, plural) =>
        `<span class="bold-purple">${capitalizeFirstLetter(unit)}${
          plural || ""
        }</span>`
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
      (match, plural) =>
        `<span class="bold-blue">${capitalizeFirstLetter(unit)}${
          plural || ""
        }</span>`
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
      (match, plural) =>
        `<span class="bold-red">${capitalizeFirstLetter(unit)}${
          plural || ""
        }</span>`
    );
  });

  return actionText;
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

    let workersOrTimestamp = "";
    let actionText = "";

    if (match) {
      workersOrTimestamp = match[1];
      actionText = match[2];
    } else {
      actionText = line;
    }

    // Apply abbreviation transformation, then format structures, units, and upgrades
    actionText = transformAbbreviations(actionText);
    actionText = formatStructureText(actionText);
    actionText = formatActionText(actionText);

    // Insert row in the table
    const row = table.insertRow();
    row.insertCell(0).textContent = workersOrTimestamp;
    row.insertCell(1).innerHTML = actionText;
  });
}

function capitalizeFirstWord(text) {
  // Capitalize only the first word of the actionText
  return text.replace(/^\w/, (char) => char.toUpperCase());
}

// Automatically trigger analysis when the user types in the buildOrderInput field
document
  .getElementById("buildOrderInput")
  .addEventListener("input", (event) => {
    analyzeBuildOrder(event.target.value);
  });

// Function to toggle visibility of a section using data-section attribute
function toggleSection(header) {
  const sectionId = header.getAttribute("data-section");
  const section = document.getElementById(sectionId);
  const arrow = header.querySelector(".arrow");

  if (section.style.display === "none" || !section.style.display) {
    section.style.display = "block";
    arrow.classList.add("open"); // Rotate arrow down
  } else {
    section.style.display = "none";
    arrow.classList.remove("open"); // Rotate arrow right
  }
}

// Add event listeners to headers with the class "toggle-title"
document.querySelectorAll(".toggle-title").forEach((header) => {
  header.addEventListener("click", () => toggleSection(header));
});

// Add event listeners for each header
document.querySelectorAll(".toggle-header").forEach((header) => {
  header.addEventListener("click", () => toggleSection(header));
});

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

document.addEventListener("DOMContentLoaded", function () {
  const toggleHeaders = document.querySelectorAll(".toggle-title");
  toggleHeaders.forEach((header) => {
    const sectionId = header.getAttribute("data-section");
    const section = document.getElementById(sectionId);
    const arrow = header.querySelector(".arrow");

    // Set arrow based on initial display state
    if (section.style.display === "block") {
      arrow.classList.add("open"); // Rotate down if section is open
    } else {
      arrow.classList.remove("open"); // Keep right if section is closed
    }
  });
});

document
  .getElementById("buildOrderInput")
  .addEventListener("keydown", function (event) {
    // Check if Enter key is pressed
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default new line behavior

      let textarea = event.target;
      let currentValue = textarea.value;

      // Insert the current line with [] at the end of it
      let newLine = "[]"; // Define the symbol you want to add at the new line

      // Split the text by newlines, and add the new line with '[]' at the end
      let lines = currentValue.split("\n");

      // Add the new line with '[]' symbol at the end
      lines.push(newLine);

      // Update the textarea value by joining the lines with a newline
      textarea.value = lines.join("\n");

      // Move the cursor to the end of the new line
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }
  });
