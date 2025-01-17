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
function formatMatchedTerm(term, imageSrc, cssClass, category) {
  // If the category is "pos", return only the image tag with no surrounding text
  if (category === "pos") {
    return imageSrc
      ? `<img src="${imageSrc}" alt="${term}" class="pos-image">`
      : "";
  }

  // For other categories, return the term and image
  const imageTag = imageSrc
    ? `<img src="${imageSrc}" alt="${term}" class="term-image">`
    : "";
  return `<span class="${cssClass}">${capitalizeFirstLetter(
    term
  )}${imageTag}</span>`;
}

// Ensure consistent key generation for image lookup
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

// Match Actors Using the Trie
function matchActorsWithTrie(actionText, actorTrie) {
  const words = actionText.split(/\s+/);
  const result = [];
  let i = 0;

  while (i < words.length) {
    let currentNode = actorTrie;
    let match = null;
    let end = i;

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
      const imageSrc =
        category === "unit"
          ? unitImages[key]
          : category === "structure"
          ? structureImages[key]
          : category === "upgrade"
          ? upgradeImages[key]
          : category === "pos"
          ? `img/pos/${key}.png`
          : "";

      const cssClass =
        category === "unit"
          ? "bold-purple"
          : category === "structure"
          ? "bold-yellow"
          : category === "upgrade"
          ? "upgrade-highlight"
          : category === "pos"
          ? "pos-image"
          : "";

      result.push(formatMatchedTerm(term, imageSrc, cssClass));
      i = end + 1;
    } else {
      result.push(words[i]);
      i++;
    }
  }

  return result.join(" ");
}

// Preprocess abbreviations
function preprocessAbbreviations(actionText) {
  Object.entries(abbreviationMap).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    actionText = actionText.replace(regex, full);
  });
  return actionText;
}

// Main Function to Format Action Text
export function formatActionText(actionText) {
  const actorData = [
    ...units.zerg.map((name) => ({ term: name, category: "unit" })),
    ...units.protoss.map((name) => ({ term: name, category: "unit" })),
    ...units.terran.map((name) => ({ term: name, category: "unit" })),
    ...structures.map((name) => ({ term: name, category: "structure" })),
    ...upgrades.map((name) => ({ term: name, category: "upgrade" })),
    { term: "Caduceus Reactor", category: "upgrade" },
    { term: "Greater Spire", category: "structure" },
    { term: "Research Warp Gate", category: "upgrade" },
    { term: "Drop Overlord", category: "unit" },
    ...Array.from({ length: 9 }, (_, i) => ({
      term: `pos${i + 1}`,
      category: "pos",
    })),
  ];

  const actorTrie = buildActorTrie(actorData);

  // Preprocess abbreviations first
  actionText = preprocessAbbreviations(actionText);

  // Process action text with the actor trie after preprocessing abbreviations
  actionText = matchActorsWithTrie(actionText, actorTrie);

  return actionText;
}
