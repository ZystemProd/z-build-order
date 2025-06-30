// Import required data and utilities

import { loadGameData } from "../data/getGameData.js";

import DOMPurify from "dompurify";

const {
  units,
  structures,
  upgrades,
  unitImages,
  structureImages,
  upgradeImages,
  abbreviationMap,
} = await loadGameData();

// Utility: Capitalize the first letter of a string
export function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Utility: Format matched terms with images and styles
function formatMatchedTerm(
  term,
  imageSrc,
  cssClass,
  category,
  previousWord = null
) {
  if (category === "pos") {
    return imageSrc
      ? `<img src="${imageSrc}" alt="${term}" class="pos-image">`
      : "";
  }
  if (category === "resource") {
    const numberPrefix =
      previousWord && !isNaN(previousWord)
        ? `<span class="${cssClass}">${previousWord}</span> `
        : "";
    return `${numberPrefix}<span class="${cssClass}">${term} <img src="${imageSrc}" alt="${term}" class="resource-image"></span>`;
  }
  const imageTag = imageSrc
    ? `<img src="${DOMPurify.sanitize(imageSrc)}" alt="${DOMPurify.sanitize(
        term
      )}" class="term-image">`
    : "";
  return `<span class="${DOMPurify.sanitize(cssClass)}">${capitalizeFirstLetter(
    DOMPurify.sanitize(term)
  )}${imageTag}</span>`;
}

// Generate key for consistent lookup
function generateKey(term) {
  return term.toLowerCase().replace(/\s+/g, "_");
}

// Build a Trie from actor data
function buildActorTrie(actorData) {
  const root = { children: {}, isActor: false, actorData: null };

  actorData.forEach(({ term, category }) => {
    const words = term.toLowerCase().split(" ");
    let currentNode = root;

    words.forEach((word, index) => {
      if (!currentNode.children[word]) {
        currentNode.children[word] = {
          children: {},
          isActor: false,
          actorData: null,
        };
      }
      currentNode = currentNode.children[word];
      if (index === words.length - 1) {
        currentNode.isActor = true;
        currentNode.actorData = { term, category };
      }
    });
  });

  return root;
}

// Match actors using the Trie
function matchActorsWithTrie(actionText, actorTrie) {
  const words = actionText.split(/\s+/);
  const result = [];
  let i = 0;
  let underlineNextWord = false;
  let orangeUnderlineNextWord = false;

  while (i < words.length) {
    let currentNode = actorTrie;
    let match = null;
    let end = i;
    let previousWord = i > 0 ? words[i - 1] : null;

    // Loop through words to find a match, stripping punctuation for lookup
    for (let j = i; j < words.length; j++) {
      const originalWord = words[j];
      // Remove trailing punctuation for the lookup
      const cleanWord = originalWord.replace(/[.,;!?]+$/, "").toLowerCase();
      if (currentNode.children[cleanWord]) {
        currentNode = currentNode.children[cleanWord];
        if (currentNode.isActor) {
          match = currentNode.actorData;
          end = j;
        }
      } else {
        break;
      }
    }

    if (match) {
      const { term, category } = match;
      const key = generateKey(term);
      let imageSrc;
      let cssClass;

      if (category === "unit") {
        imageSrc = unitImages[key];
        cssClass = determineUnitClass(term);
      } else if (category === "structure") {
        imageSrc = structureImages[key];
        cssClass = "bold-yellow";
      } else if (category === "upgrade") {
        imageSrc = upgradeImages[key];
        cssClass = "upgrade-highlight";
      } else if (category === "resource") {
        imageSrc =
          term === "minerals"
            ? "img/resources/minerals.webp"
            : "img/resources/gas.webp";
        cssClass = term === "minerals" ? "blue-text" : "green-text";
      } else if (category === "pos") {
        imageSrc = `img/pos/${key}.webp`;
        cssClass = "pos-image";
      }

      // Format the matched term
      const formattedTerm = formatMatchedTerm(
        term,
        imageSrc,
        cssClass,
        category,
        category === "resource" ? previousWord : null
      );

      let finalFormattedTerm = formattedTerm;

      if (underlineNextWord) {
        finalFormattedTerm = `<span class="done-underline">${formattedTerm}</span>`;
        underlineNextWord = false;
      } else if (orangeUnderlineNextWord) {
        finalFormattedTerm = `<span class="producing-underline">${formattedTerm}</span>`;
        orangeUnderlineNextWord = false;
      }

      // Retrieve any punctuation from the last word and append it
      let lastOriginalWord = words[end];
      let cleanLastWord = lastOriginalWord.replace(/[.,;!?]+$/, "");
      let punctuation = lastOriginalWord.slice(cleanLastWord.length);

      // Remove previous word if it's a number for resource category
      if (category === "resource" && !isNaN(previousWord)) {
        result.pop();
      }

      result.push(finalFormattedTerm + punctuation);
      i = end + 1;
    } else {
      const rawWord = words[i];
      const cleanWord = rawWord.replace(/[.,;!?]+$/, "").toLowerCase();
      let punctuation = rawWord.slice(cleanWord.length);

      // NEW: Swap image
      if (cleanWord === "swap") {
        result.push(
          `<span data-tooltip="Swap"><img src="img/SVG/swap.svg" alt="swap" class="inline-icon"></span>`
        );
        i++;
        continue;
      }

      // NEW: Arrow Right image for "-->"
      if (rawWord === "-->") {
        result.push(
          `<img src="img/SVG/arrow_right.svg" alt="arrow" class="inline-icon">`
        );
        i++;
        continue;
      }

      // NEW: Arrow Right image for "-->"
      if (rawWord === "<--") {
        result.push(
          `<img src="img/SVG/arrow_left.svg" alt="arrow" class="inline-icon">`
        );
        i++;
        continue;
      }

      if (/^(@100|@100%|100%)$/.test(cleanWord)) {
        // ✅ DONE: Green Underline + Checkmark SVG
        result.push(
          `
          <svg xmlns="http://www.w3.org/2000/svg" class="inline-icon" height="20px" viewBox="0 -960 960 960" width="20px" fill="#75FB4C" data-tooltip="100%">
            <path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
          </svg>${punctuation}
        `.trim()
        );

        underlineNextWord = true;
        i++;
      } else if (/^@?\d{1,3}%$/.test(cleanWord)) {
        // 🟠 PRODUCING: Orange Underline + Producing SVG + Show Number
        const percentNumber = cleanWord.replace("@", "");
        result.push(
          `
          <svg xmlns="http://www.w3.org/2000/svg" class="inline-icon" height="20px" viewBox="0 -960 960 960" width="20px" fill="#F19E39" data-tooltip="${percentNumber}%">
            <path d="M200-360q-50 0-85-35t-35-85q0-50 35-85t85-35h560q50 0 85 35t35 85q0 50-35 85t-85 35H200Zm360-80h200q17 0 28.5-11.5T800-480q0-17-11.5-28.5T760-520H560v80Z"/>
          </svg>
          <span class="producing-percent">${percentNumber}</span>${punctuation}
        `.trim()
        );

        orangeUnderlineNextWord = true;
        i++;
      } else {
        // Check if the word matches supply pattern like [15/14]
        const supplyMatch = rawWord.match(/^\[(\d{1,3})\/(\d{1,3})\]$/);

        if (supplyMatch) {
          const current = parseInt(supplyMatch[1], 10);
          const max = parseInt(supplyMatch[2], 10);

          const supplyClass =
            current > max ? "supply-overcap" : "supply-normal";

          result.push(
            `<span class="${supplyClass}">[${current}/${max}]</span>${punctuation}`
          );
        } else {
          result.push(rawWord);
        }
        i++;
      }
    }
  }

  return result.join(" ");
}

// Determine the CSS class for a unit based on its race
function determineUnitClass(unitName) {
  const unit = unitName.toLowerCase();
  if (units.zerg.includes(unit)) return "bold-purple";
  if (units.protoss.includes(unit)) return "bold-blue";
  if (units.terran.includes(unit)) return "bold-red";
  return ""; // Default: No class
}

// Preprocess abbreviations before matching actors
function preprocessAbbreviations(actionText) {
  if (!actionText || typeof actionText !== "string") return ""; // Ensure input is valid

  Object.values(abbreviationMap).forEach((category) => {
    Object.entries(category).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, "gi");
      actionText = actionText.replace(regex, full);
    });
  });

  return actionText;
}

// Format addon actions like "Tech Lab on Barracks"
export function formatAddonInAction(text) {
  return text.replace(
    /(Tech Lab|Reactor)\s+on\s+(Barracks|Factory|Starport)/gi,
    (match, addon, structure) => {
      const cleanAddon = DOMPurify.sanitize(addon);
      const cleanStructure = DOMPurify.sanitize(structure);
      return `${cleanAddon} <sup class="addon-sup">(${cleanStructure})</sup>`;
    }
  );
}

// Main function to format action text
export function formatActionText(actionText) {
  const actorData = [
    ...units.zerg.map((name) => ({ term: name, category: "unit" })),
    ...units.protoss.map((name) => ({ term: name, category: "unit" })),
    ...units.terran.map((name) => ({ term: name, category: "unit" })),
    ...structures.map((name) => ({ term: name, category: "structure" })),
    ...upgrades.map((name) => ({ term: name, category: "upgrade" })),
    { term: "minerals", category: "resource" },
    { term: "gas", category: "resource" },
    ...Array.from({ length: 9 }, (_, i) => ({
      term: `pos${i + 1}`,
      category: "pos",
    })),
  ];

  const actorTrie = buildActorTrie(actorData);

  // Preprocess abbreviations and addon formatting first
  actionText = preprocessAbbreviations(actionText);
  actionText = formatAddonInAction(actionText);

  // Match actors with the Trie
  actionText = matchActorsWithTrie(actionText, actorTrie);

  return actionText;
}

export function formatWorkersOrTimestampText(workersOrTimestamp) {
  if (!workersOrTimestamp) return "-";

  // Match optional brackets around the supply like [15/14] or 15/14
  const supplyMatch = workersOrTimestamp.match(
    /^(\[)?(\d{1,3})\/(\d{1,3})(\])?$/
  );
  if (supplyMatch) {
    const openBracket = supplyMatch[1] || "";
    const current = parseInt(supplyMatch[2], 10);
    const max = parseInt(supplyMatch[3], 10);
    const closeBracket = supplyMatch[4] || "";

    const currentStyled =
      current > max
        ? `<span class="supply-overcap">${current}</span>`
        : `${current}`;

    return `${openBracket}${currentStyled}/${max}${closeBracket}`;
  }

  // Handle resources
  const actorData = [
    { term: "minerals", category: "resource" },
    { term: "gas", category: "resource" },
  ];
  const actorTrie = buildActorTrie(actorData);

  workersOrTimestamp = preprocessAbbreviations(workersOrTimestamp);
  workersOrTimestamp = matchActorsWithTrie(workersOrTimestamp, actorTrie);

  return workersOrTimestamp;
}
