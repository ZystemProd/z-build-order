import { units } from "../data/units.js";
import { structures } from "../data/structures.js";
import { upgrades } from "../data/upgrades.js";
import { abilities } from "../data/abilities.js";
import {
  unitImages,
  structureImages,
  upgradeImages,
  abilitiesImages,
} from "../data/images.js";
import { analyzeBuildOrder } from "./uiHandlers.js";

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

export function transformAbbreviations(text) {
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
export function capitalizeFirstLetter(text) {
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

export function formatStructureText(actionText) {
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

export function formatActionText(actionText) {
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

// Function to position the autocomplete popup below the caret
function positionPopupAtCaret(inputField, popup) {
  const { selectionStart, selectionEnd, scrollTop, scrollLeft } = inputField;

  // If there's no caret or selection range, don't position the popup
  if (
    selectionStart === null ||
    selectionEnd === null ||
    selectionStart !== selectionEnd
  ) {
    popup.style.visibility = "hidden";
    return;
  }

  // Create a temporary div element to calculate caret position
  const tempDiv = document.createElement("div");
  const styles = window.getComputedStyle(inputField);

  // Copy styles from the textarea to the temporary div
  Array.from(styles).forEach((key) => {
    tempDiv.style[key] = styles[key];
  });

  // Mimic the `textarea` behavior in the temporary div
  tempDiv.style.position = "absolute";
  tempDiv.style.whiteSpace = "pre-wrap";
  tempDiv.style.visibility = "hidden";
  tempDiv.style.top = `${inputField.offsetTop}px`;
  tempDiv.style.left = `${inputField.offsetLeft}px`;
  tempDiv.style.width = `${inputField.offsetWidth}px`;

  // Adjust the content up to the caret position
  const textBeforeCaret = inputField.value.slice(0, selectionStart);
  tempDiv.textContent = textBeforeCaret;

  // Add a marker span at the caret position
  const markerSpan = document.createElement("span");
  markerSpan.textContent = "|"; // Placeholder character for caret
  tempDiv.appendChild(markerSpan);

  // Append the temporary div to the document
  document.body.appendChild(tempDiv);

  // Get the marker's position relative to the `textarea`
  const markerRect = markerSpan.getBoundingClientRect();
  const textareaRect = inputField.getBoundingClientRect();

  // Calculate the position of the popup, including scroll adjustments
  const popupTop =
    markerRect.top - textareaRect.top + inputField.offsetTop - scrollTop;
  const popupLeft =
    markerRect.left - textareaRect.left + inputField.offsetLeft - scrollLeft;

  // Set the popup position
  popup.style.top = `${popupTop + markerRect.height + window.scrollY}px`;
  popup.style.left = `${popupLeft + window.scrollX}px`;

  // Remove the temporary div from the document
  document.body.removeChild(tempDiv);
}

// Function to initialize the autocomplete feature
export function initializeAutoCorrect() {
  const inputField = document.getElementById("buildOrderInput");
  const popup = document.getElementById("autocomplete-popup");

  // Flatten data into a single list for suggestions
  const suggestions = [
    ...units.zerg.map((name) => ({ category: "Units", name, type: "unit" })),
    ...units.protoss.map((name) => ({ category: "Units", name, type: "unit" })),
    ...units.terran.map((name) => ({ category: "Units", name, type: "unit" })),
    ...structures.map((name) => ({
      category: "Structures",
      name,
      type: "structure",
    })),
    ...upgrades.map((name) => ({
      category: "Upgrades",
      name,
      type: "upgrade",
    })),
  ];

  let activeIndex = 0; // Index of the currently active suggestion

  function updateActiveSuggestion(index) {
    const allSuggestions = popup.querySelectorAll(".suggestion");
    allSuggestions.forEach((suggestion, i) => {
      suggestion.classList.toggle("active", i === index);
    });
  }

  function applySuggestion() {
    const activeSuggestion = popup.querySelector(".suggestion.active");
    if (activeSuggestion) {
      const currentWordRegex = /\b(\w+)$/; // Match the last word before the caret
      const cursorPosition = inputField.selectionStart;
      const textBeforeCaret = inputField.value.substring(0, cursorPosition);
      const textAfterCaret = inputField.value.substring(cursorPosition);

      inputField.value =
        textBeforeCaret.replace(
          currentWordRegex,
          activeSuggestion.textContent
        ) + textAfterCaret;

      popup.style.visibility = "hidden";
      inputField.focus();
      activeIndex = 0; // Reset active index

      // Call analyzeBuildOrder to update the buildOrderTable
      analyzeBuildOrder(inputField.value);
    }
  }

  function insertNewRow() {
    const cursorPosition = inputField.selectionStart;
    const textBeforeCaret = inputField.value.substring(0, cursorPosition);
    const textAfterCaret = inputField.value.substring(cursorPosition);

    inputField.value = textBeforeCaret + "\n[]" + textAfterCaret;

    // Move the cursor inside the newly inserted brackets
    inputField.selectionStart = inputField.selectionEnd = cursorPosition + 3;

    // Call analyzeBuildOrder to update the buildOrderTable
    analyzeBuildOrder(inputField.value);
  }

  inputField.addEventListener("input", () => {
    const text = inputField.value;
    const cursorPosition = inputField.selectionStart;
    const wordBoundaryRegex = /\b(\w+)$/; // Match the last word before the cursor

    // Get the current word being typed
    const match = text.substring(0, cursorPosition).match(wordBoundaryRegex);
    if (!match) {
      popup.style.visibility = "hidden";
      return;
    }

    const currentWord = match[1];
    const matches = suggestions.filter((item) =>
      item.name.toLowerCase().startsWith(currentWord.toLowerCase())
    );

    if (matches.length === 0) {
      popup.style.visibility = "hidden";
      return;
    }

    // Populate popup with matches
    popup.innerHTML = "";
    matches.forEach((match, index) => {
      const suggestion = document.createElement("div");
      suggestion.classList.add("suggestion");

      if (index === 0) suggestion.classList.add("active"); // Mark first suggestion as active

      const img = document.createElement("img");
      img.src = `img/${match.type}/${match.name
        .toLowerCase()
        .replace(/ /g, "_")}.png`;
      img.alt = match.name;

      const text = document.createElement("span");
      text.textContent = match.name;

      suggestion.appendChild(img);
      suggestion.appendChild(text);

      suggestion.addEventListener("click", () => {
        const start = inputField.value
          .substring(0, cursorPosition)
          .replace(wordBoundaryRegex, match.name);
        const end = inputField.value.substring(cursorPosition);
        inputField.value = start + end;

        popup.style.visibility = "hidden";
        inputField.focus(); // Refocus the input field

        // Call analyzeBuildOrder to update the buildOrderTable
        analyzeBuildOrder(inputField.value);
      });

      popup.appendChild(suggestion);
    });

    activeIndex = 0; // Reset active index
    positionPopupAtCaret(inputField, popup);
    popup.style.visibility = "visible";
  });

  inputField.addEventListener("keydown", (event) => {
    const allSuggestions = popup.querySelectorAll(".suggestion");
    if (!popup.style.visibility || popup.style.visibility === "hidden") {
      if (event.key === "Enter") {
        event.preventDefault(); // Prevent default new-line behavior
        insertNewRow(); // Insert new row
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        activeIndex = (activeIndex + 1) % allSuggestions.length;
        updateActiveSuggestion(activeIndex);
        break;
      case "ArrowUp":
        event.preventDefault();
        activeIndex =
          (activeIndex - 1 + allSuggestions.length) % allSuggestions.length;
        updateActiveSuggestion(activeIndex);
        break;
      case "Enter":
        event.preventDefault(); // Prevent moving to the next line
        applySuggestion();
        break;
      case "Escape":
        popup.style.visibility = "hidden";
        break;
    }
  });

  inputField.addEventListener("blur", () => {
    setTimeout(() => {
      popup.style.visibility = "hidden";
    }, 100);
  });
}
