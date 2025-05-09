export const predefinedTemplates = [
  {
    title: "Zerg Rush",
    buildOrder: ["12 Pool", "12 Spawning Pool", "12 Lings"],
    category: "Zerg",
    image: "img/templates/zerg.webp",
  },
  {
    title: "Terran Bio",
    buildOrder: ["Rax Expand", "Stimpack", "Bio Army"],
    category: "Terran",
    image: "img/templates/terran.webp",
  },
  {
    title: "Protoss All-In",
    buildOrder: ["4 Gate", "Warp-In Units", "Push"],
    category: "Protoss",
    image: "img/templates/protoss.webp",
  },
];

let savedTemplates = [];

// Get saved templates
export function getSavedTemplates() {
  return savedTemplates;
}

// Save a new template
export function saveTemplate(template) {
  savedTemplates.push(template);
}

// Delete a template
export function deleteTemplate(index) {
  savedTemplates.splice(index, 1);
}
