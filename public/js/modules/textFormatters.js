// Import required data and utilities
import { units } from "../data/units.js";
import { structures } from "../data/structures.js";
import { upgrades } from "../data/upgrades.js";
import { unitImages, structureImages, upgradeImages } from "../data/images.js";
import { abbreviationMap } from "../data/abbreviationMap.js";

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

  while (i < words.length) {
    let currentNode = actorTrie;
    let match = null;
    let end = i;
    let previousWord = i > 0 ? words[i - 1] : null;

    for (let j = i; j < words.length; j++) {
      const word = words[j].toLowerCase();
      if (currentNode.children[word]) {
        currentNode = currentNode.children[word];
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
        cssClass = determineUnitClass(term); // Determine the CSS class based on the race
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

      // Include previous word for resource category
      const formattedTerm = formatMatchedTerm(
        term,
        imageSrc,
        cssClass,
        category,
        category === "resource" ? previousWord : null
      );

      // Replace the previous word if it's a number and the current match is a resource
      if (category === "resource" && !isNaN(previousWord)) {
        result.pop();
      }

      result.push(formattedTerm);
      i = end + 1;
    } else {
      result.push(words[i]);
      i++;
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

  Object.entries(abbreviationMap).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    actionText = actionText.replace(regex, full);
  });

  return actionText;
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

  // Preprocess abbreviations first
  actionText = preprocessAbbreviations(actionText);

  // Match actors with the Trie
  actionText = matchActorsWithTrie(actionText, actorTrie);

  return actionText;
}

export function formatWorkersOrTimestampText(workersOrTimestamp) {
  const resourceData = [
    { term: "minerals", category: "resource" },
    { term: "gas", category: "resource" },
  ];

  const resourceTrie = buildActorTrie(resourceData);

  // Preprocess abbreviations if necessary
  workersOrTimestamp = preprocessAbbreviations(workersOrTimestamp);

  // Match resources with the Trie
  workersOrTimestamp = matchActorsWithTrie(workersOrTimestamp, resourceTrie);

  return workersOrTimestamp;
}
