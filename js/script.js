import { units } from "./data/units.js";
import { structures } from "./data/structures.js";
import { upgrades } from "./data/upgrades.js";
import { unitImages, structureImages, upgradeImages } from "./data/images.js";
import { updateYouTubeEmbed, toggleTitleInput } from "./modules/uiHandlers.js";
import {
  initializeEventListeners,
  initializeModalEventListeners,
} from "./modules/eventHandlers.js";
import { getSavedBuilds } from "./modules/buildStorage.js";
import {
  showAllBuilds,
  showSubcategories,
  openModal,
} from "./modules/modal.js";
import {
  saveCurrentBuild,
  loadBuildsFromFile,
} from "./modules/buildManagement.js";

document
  .getElementById("saveBuildButton")
  .addEventListener("click", saveCurrentBuild);

// Modify the abbreviation map for specific structures and units
const abbreviationMap = {
  ling: "zergling",
  lings: "zerglings",
  ovi: "overlord",
  ovie: "overlord",
  RW: "roach warren",
  zgas: "extractor",
  tgas: "refinery",
  pgas: "assimilator",
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
  "range attack": "missile attack",
  cannon: "photon cannon",
  cannons: "photon cannons",
  "phoenix range": "anion pulse-crystals",
  "building armor": "Neosteel armor",
  "blue flame": "Infernal pre-igniter",
  pool: "spawning pool",
  ebay: "engineering bay",
  CC: "command center",
  "Bane nest": "baneling nest",
  SG: "stargate",
  "Lurker speed": "adaptive talons",
  rax: "barracks",
  SP: "starport",
  PF: "planetary fortress",
  robo: "robotics facility",
  battery: "shield battery",
  Infestation: "Infestation pit",
  "drop overlord": "ventral sacks",
  "overlord drop": "ventral sacks",
};

function transformAbbreviations(text) {
  // Specific replacements for full phrases to avoid partial matches
  const replacements = {
    "spine crawler": "Spine Crawler",
    "spore crawler": "Spore Crawler",
    "nydus network": "Nydus Network",
    "brood lord": "Brood Lord",
    "siege tank": "Siege Tank",
    "psionic storm": "Psionic Storm", // Prioritize this replacement
    "greater spire": "Greater Spire", // Add specific replacement for Greater Spire
  };

  // Replace full phrases first
  Object.keys(replacements).forEach((phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    text = text.replace(regex, replacements[phrase]);
  });

  // Handle "spire" separately, ensuring no overlap with "Greater Spire"
  text = text.replace(/\bspire\b(?!\s+spire)/gi, (match) => {
    if (!/\bgreater spire\b/gi.test(text)) {
      return "Spire";
    }
    return match;
  });

  // Handle singular forms without affecting plural forms
  text = text.replace(/\broach\b(?!es)/gi, "Roach"); // Only replace singular "roach"
  text = text.replace(/\bzergling\b(?!s)/gi, "Zergling"); // Only replace singular "zergling"
  text = text.replace(/\bqueen\b(?!s)/gi, "Queen"); // Only replace singular "queen"

  // Abbreviations handling for single words only if they are not part of a larger term
  text = text.replace(/\bspine\b(?!\s+crawler)/gi, (match) => {
    if (!/\bspine crawler\b/gi.test(text)) {
      return "Spine Crawler";
    }
    return match;
  });
  text = text.replace(/\bspore\b(?!\s+crawler)/gi, (match) => {
    if (!/\bspore crawler\b/gi.test(text)) {
      return "Spore Crawler";
    }
    return match;
  });
  text = text.replace(/\bnydus\b(?!\s+network)/gi, (match) => {
    if (!/\bnydus network\b/gi.test(text)) {
      return "Nydus Network";
    }
    return match;
  });
  text = text.replace(/\bbrood\b(?!\s+lord)/gi, (match) => {
    if (!/\bbrood lord\b/gi.test(text)) {
      return "Brood Lord";
    }
    return match;
  });
  text = text.replace(/\btank\b(?!\s+tank)/gi, (match) => {
    if (!/\bsiege tank\b/gi.test(text)) {
      return "Siege Tank";
    }
    return match;
  });
  text = text.replace(/\bcaduceus\b(?!\s+reactor)/gi, (match) => {
    if (!/\bcaduceus reactor\b/gi.test(text)) {
      return "Caduceus Reactor";
    }
    return match;
  });

  // Apply other abbreviations from the abbreviationMap only if no previous match occurred
  return Object.keys(abbreviationMap).reduce((updatedText, abbr) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi"); // Word boundary matching
    const replacement = abbreviationMap[abbr];
    return updatedText.replace(regex, (match) => {
      if (!new RegExp(`\\b${replacement}\\b`, "gi").test(updatedText)) {
        return replacement;
      }
      return match;
    });
  }, text);
}

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
  // Avoid capitalizing suffixes like "st," "nd," "rd," "th"
  text = text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num, suffix) => {
    return `${num}${suffix}`; // Keep the number and suffix as-is
  });

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
  // Avoid capitalizing suffixes like "st," "nd," "rd," "th"
  return text.replace(/(?:^|\.\s+)([a-z](?!st|nd|rd|th))/g, (match, group1) => {
    return match.toUpperCase();
  });
}

function formatStructureText(actionText) {
  // Handle multi-word upgrades as exceptions first
  const exceptions = [
    {
      regex: /\bcaduceus reactor\b/gi,
      replacement: `<span class="upgrade-highlight">Caduceus Reactor</span>`,
    },
    {
      regex: /\bresearch warp gate\b/gi,
      replacement: `<span class="upgrade-highlight">Research Warp Gate</span>`,
    },
  ];

  // Replace exceptions first
  exceptions.forEach((exception) => {
    actionText = actionText.replace(exception.regex, exception.replacement);
  });

  // Process remaining structures, ensuring no conflicts with exceptions
  structures.forEach((structure) => {
    const regex = new RegExp(`\\b${structure}\\b`, "gi");
    actionText = actionText.replace(regex, (match) => {
      // Avoid duplicating replacements
      const alreadyProcessed = actionText.includes(
        `<span class="bold-yellow">${match}`
      );
      if (alreadyProcessed) {
        return match; // Skip if already processed
      }

      // Get image path if available
      const imageSrc = structureImages[structure.toLowerCase()] || "";
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${structure}" class="structure-image">`
        : "";

      return `<span class="bold-yellow">${structure}${imageTag}</span>`;
    });
  });

  return actionText;
}

// Function to format specific units with styling, handling plural forms and exceptions
function formatUnits(actionText) {
  // Zerg Units - Purple
  units.zerg.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+warren|\\s+den|\\s+pit|\\s+network|\\s+speed|\\s+armor|\\s+nest)`,
      "gi"
    );
    actionText = actionText.replace(regex, (match, plural) => {
      const imageSrc = unitImages[unit.toLowerCase()] || ""; // Get image path if available
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${unit}" class="unit-image">`
        : "";
      return `<span class="bold-purple">${capitalizeFirstLetter(unit)}${
        plural || ""
      }${imageTag}</span>`;
    });
  });

  // Protoss Units - Bright Blue
  units.protoss.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+core|\\s+shrine|\\s+gate|\\s+forge|\\s+range)`,
      "gi"
    );
    actionText = actionText.replace(regex, (match, plural) => {
      const imageSrc = unitImages[unit.toLowerCase()] || ""; // Get image path if available
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${unit}" class="unit-image">`
        : "";
      return `<span class="bold-blue">${capitalizeFirstLetter(unit)}${
        plural || ""
      }${imageTag}</span>`;
    });
  });

  // Terran Units - Bright Red
  units.terran.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+barracks|\\s+command|\\s+reactor|\\s+academy)`,
      "gi"
    );
    actionText = actionText.replace(regex, (match, plural) => {
      const imageSrc = unitImages[unit.toLowerCase()] || ""; // Get image path if available
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${unit}" class="unit-image">`
        : "";
      return `<span class="bold-red">${capitalizeFirstLetter(unit)}${
        plural || ""
      }${imageTag}</span>`;
    });
  });

  return actionText;
}

// Function to format specific units and structures with styling
function formatActionText(actionText) {
  actionText = transformAbbreviations(actionText); // Transform abbreviations first
  actionText = formatStructureText(actionText); // Format structures
  actionText = formatUnits(actionText); // Format units
  actionText = formatUpgrades(actionText); // Format upgrades

  // Capitalize first letter of each sentence
  actionText = capitalizeSentences(actionText);

  // Capitalize the first letter of each word for units, structures, and upgrades
  actionText = capitalizeWords(actionText);

  // Highlight numbers followed by "gas" or "minerals" (with or without space)
  actionText = actionText.replace(
    /(\d+)\s*(gas|minerals)/gi,
    (match, num, resource) => {
      const colorClass =
        resource.toLowerCase() === "gas" ? "green-text" : "blue-text";
      const imageSrc =
        resource.toLowerCase() === "gas"
          ? "img/resources/gas.png"
          : "img/resources/minerals.png";
      const imageTag = `<img src="${imageSrc}" alt="${resource}" class="resource-image">`;

      return `<span class="${colorClass}">${num} ${capitalizeFirstLetter(
        resource
      )}</span> ${imageTag}`;
    }
  );

  // Highlight other numbers (including those attached to words like "1x marine")
  actionText = actionText.replace(
    /(\d+)(\s*x\s*)?([a-z]+)/gi,
    (match, num, x, word) => {
      const colorClass = "red-text"; // Default red for general numbers
      const formattedWord = capitalizeFirstLetter(word);

      if (x) {
        return `<span class="${colorClass}">${num}${x}${formattedWord}</span>`;
      }

      return `<span class="${colorClass}">${num}</span> ${formattedWord}`;
    }
  );

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

    // Replace `->` and `<-` with arrows in the action text
    actionText = actionText.replace(/->/g, "→").replace(/<-/g, "←");

    // Format Workers/Timestamp
    workersOrTimestamp = formatWorkersOrTimestamp(workersOrTimestamp);

    // Apply additional formatting to action text
    actionText = transformAbbreviations(actionText);
    actionText = formatStructureText(actionText);
    actionText = formatActionText(actionText);

    // Insert row in the table
    const row = table.insertRow();
    row.insertCell(0).innerHTML = workersOrTimestamp;
    row.insertCell(1).innerHTML = actionText;
  });
}

function formatWorkersOrTimestamp(text) {
  // Highlight numbers followed by "gas" or "minerals"
  return text.replace(/(\d+)\s+(gas|minerals)/gi, (match, num, resource) => {
    const colorClass =
      resource.toLowerCase() === "gas" ? "green-text" : "blue-text";
    const imageSrc =
      resource.toLowerCase() === "gas"
        ? "img/resources/gas.png"
        : "img/resources/minerals.png";
    const imageTag = `<img src="${imageSrc}" alt="${resource}" class="resource-image">`;

    return `<span class="${colorClass}">${num} ${capitalizeFirstLetter(
      resource
    )}</span> ${imageTag}`;
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

document.getElementById("loadBuildsButton").addEventListener("click", () => {
  document.getElementById("loadBuildsInput").click();
});

document
  .getElementById("loadBuildsInput")
  .addEventListener("change", loadBuildsFromFile);

function viewBuild(index) {
  const savedBuilds = getSavedBuilds(); // Retrieve builds
  const build = savedBuilds[index];
  if (!build) return;

  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");
  const categoryDropdown = document.getElementById("buildCategoryDropdown");

  // Update the title input and text display
  titleInput.value = build.title;
  titleText.textContent = build.title;
  titleText.classList.remove("dimmed");

  // Populate the match-up dropdown
  if (build.category) {
    categoryDropdown.value = build.category;
    const selectedOption =
      categoryDropdown.options[categoryDropdown.selectedIndex];
    const optgroup = selectedOption.parentElement;

    // Update the dropdown text color to match the selected category
    if (optgroup && optgroup.style.color) {
      categoryDropdown.style.color = optgroup.style.color;
    }
  }

  // Populate comment and video link
  document.getElementById("commentInput").value = build.comment || "";
  document.getElementById("videoInput").value = build.videoLink || "";

  // Update the YouTube embed with the new video link
  updateYouTubeEmbed();

  // Populate build order input as a formatted string
  const buildOrderInput = document.getElementById("buildOrderInput");
  const formattedBuildOrder = build.buildOrder
    .map(
      (step) =>
        `[${step.workersOrTimestamp}] ${step.action.replace(
          /<\/?[^>]+(>|$)/g,
          ""
        )}`
    )
    .join("\n");
  buildOrderInput.value = formattedBuildOrder;

  // Populate the build order table
  displayBuildOrder(build.buildOrder);

  closeModal();
}

// Expose to global scope
window.viewBuild = viewBuild;

// Function to display the build order in the table
function displayBuildOrder(buildOrder) {
  const table = document.getElementById("buildOrderTable");

  // Clear existing rows (except the header)
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  buildOrder.forEach((step) => {
    const row = table.insertRow();
    row.insertCell(0).innerHTML = formatWorkersOrTimestamp(
      step.workersOrTimestamp
    );
    row.insertCell(1).innerHTML = step.action;
  });
}

// Build storage example
let builds = [
  { title: "ZvP Build 1", category: "zvp" },
  { title: "ZvT Build 2", category: "zvt" },
  { title: "PvP Build 1", category: "pvp" },
  { title: "TvT Build 1", category: "tvt" },
  { title: "ZvZ Build 1", category: "zvz" },
];

function highlightActiveTab(category) {
  document
    .querySelectorAll("#buildCategoryTabs button, #buildSubCategoryTabs button")
    .forEach((button) => {
      button.classList.remove("active-tab");
    });
  document
    .querySelector(`[onclick="filterBuilds('${category}')"]`)
    .classList.add("active-tab");
}

// Optional: Hide subcategories when the mouse leaves the category tab
document
  .getElementById("buildCategoryTabs")
  .addEventListener("mouseleave", () => {
    const subcategories = document.querySelectorAll(".subcategory-container");
    subcategories.forEach((container) => {
      container.style.display = "none"; // Hide all subcategories
    });
  });

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

document
  .getElementById("buildCategoryDropdown")
  .addEventListener("change", function () {
    const dropdown = this;
    const selectedValue = dropdown.value;

    if (!selectedValue) {
      // Handle cases where no match-up is selected
      console.warn("No match-up selected.");
      return;
    }

    // Proceed with normal logic for selected match-up
    console.log(`Selected match-up: ${selectedValue}`);
  });

window.showSubcategories = showSubcategories;

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  initializeModalEventListeners();
});
