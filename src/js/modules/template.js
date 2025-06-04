import { analyzeBuildOrder } from "./uiHandlers.js";
import { formatActionText } from "./textFormatters.js";
import DOMPurify from "dompurify";

const predefinedTemplates = [
  {
    title: "16 hatch",
    category: "zerg",
    image: "img/race/zerg.webp",
    data: "[15/14] Overlord\n[16] Hatchery\n[18] extractor\n[17] Spawning Pool",
  },
  {
    title: "15/15/15 gasless",
    category: "zerg",
    image: "img/race/zerg.webp",
    data: "[15/14] hatchery\n[15/14] overlord\n[15/14] spawning pool\n[20] 2 queen\n[24] zergling\n[27] overlord\n[28] hatchery",
  },
  {
    title: "14gas 14pool",
    category: "zerg",
    image: "img/race/zerg.webp",
    data: "[12] Overlord\n[14] Spawning Pool\n[16] Zergling Rush",
  },
  {
    title: "Double Gas",
    category: "terran",
    image: "img/race/terran.webp",
    data: "[14] Supply Depot\n[15] Barracks\n[16] Refinery\n[17] refinery\n100% rax upgrade orbital command + 1 reaper\n[20] factory",
  },
  {
    title: "Reaper Expand",
    category: "terran",
    image: "img/race/terran.webp",
    data: "[14] Supply Depot\n[16] Barracks\n[16] Refinery\n100% rax upgrade orbital command + 1 reaper\n[20] command center",
  },
  {
    title: "Gate|Core|Nexus",
    category: "protoss",
    image: "img/race/protoss.webp",
    data: "[14] Pylon\n[16] Gateway\n[17] Assimilator\n[20] Cybernetics Core\n[21] Nexus",
  },
  {
    title: "Gate|Nexus|Core",
    category: "protoss",
    image: "img/race/protoss.webp",
    data: "[14] Pylon\n[16] Gateway\n[17] Assimilator\n[20] Nexus\n[20] cybernetics core\n",
  },
];

let templates = [...predefinedTemplates];

export function showTemplatesModal() {
  const templateModal = document.getElementById("templateModal");
  templateModal.style.display = "block";
  populateTemplateList(templates);
}

export function closeTemplateModal() {
  const templateModal = document.getElementById("templateModal");
  templateModal.style.display = "none";
}

export function populateTemplateList(templateList) {
  const templateListDiv = document.getElementById("templateList");
  templateListDiv.innerHTML = ""; // Clear existing templates

  templateList.forEach((template, index) => {
    const templateCard = document.createElement("div");
    templateCard.className = "template-card";

    templateCard.setAttribute("data-template", JSON.stringify(template));

    templateCard.innerHTML = `
    <div class="template-card-header" style="background-image: url('${DOMPurify.sanitize(
      template.image
    )}');"></div>
    <div class="template-card-title">${DOMPurify.sanitize(template.title)}</div>
    `;

    // Click to load the template
    templateCard.addEventListener("click", () =>
      loadTemplateFromTemplateData(template)
    );

    templateListDiv.appendChild(templateCard);
  });
}

export function previewTemplate(template) {
  const previewDiv = document.getElementById("templatePreview");

  const formattedLines = DOMPurify.sanitize(template.data)
    .split("\n")
    .map((line) => {
      const match = line.match(/^\[(.*?)\]\s*(.*)$/);
      if (match) {
        const [, bracket, action] = match;
        return `<div class="template-line"><span class="template-bracket">[${bracket}]</span> ${formatActionText(
          action
        )}</div>`;
      } else {
        return `<div class="template-line">${formatActionText(line)}</div>`;
      }
    })
    .join("");

  previewDiv.innerHTML = `
    <h4>${DOMPurify.sanitize(template.title)}</h4>
    <div class="template-preview-block">${formattedLines}</div>
  `;
}

function updateTemplatePreview(templateData) {
  const previewContainer = document.getElementById("templatePreview");
  previewContainer.innerHTML = `
  <h4>${DOMPurify.sanitize(templateData.title)}</h4>
  <p>${DOMPurify.sanitize(
    templateData.description || "No description available."
  )}</p>
  <textarea readonly>${DOMPurify.sanitize(
    templateData.input || "No input available."
  )}</textarea>
`;
}

export function showSaveTemplateModal() {
  const modal = document.getElementById("saveTemplateModal");
  modal.style.display = "block";

  const closeButton = document.getElementById("closeSaveTemplateModal");
  closeButton.onclick = () => {
    modal.style.display = "none";
  };

  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  };

  const saveButton = document.getElementById("saveTemplateConfirmButton");
  saveButton.onclick = () => {
    const title = document.getElementById("templateTitleInput").value.trim();
    const sanitizedTitle = DOMPurify.sanitize(title);

    const selectedRace = document.querySelector(
      'input[name="templateRace"]:checked'
    )?.value;

    if (!sanitizedTitle || !selectedRace) {
      alert("Please provide a title and select a race.");
      return;
    }

    const buildOrderInput = document
      .getElementById("buildOrderInput")
      .value.trim();
    const sanitizedBuildOrderInput = DOMPurify.sanitize(buildOrderInput);

    if (!sanitizedBuildOrderInput) {
      alert("Build order input cannot be empty.");
      return;
    }

    const raceImage = `img/race/${selectedRace}.webp`;

    // Save the new template
    templates.push({
      title: sanitizedTitle,
      category: selectedRace,
      image: raceImage,
      data: sanitizedBuildOrderInput,
    });

    populateTemplateList(templates);
    modal.style.display = "none";
  };
}

// Update saveTemplate to call the custom modal
export function saveTemplate() {
  showSaveTemplateModal();
}

export function deleteTemplate(index) {
  templates.splice(index, 1);
  populateTemplateList(templates);
}

export function filterTemplates(category) {
  const filteredTemplates =
    category === "all"
      ? templates
      : templates.filter((template) => template.category === category);
  populateTemplateList(filteredTemplates);
}

export function setupTemplateModal() {
  const templateModal = document.getElementById("templateModal");
  const closeBtn = document.getElementById("closeTemplateModal");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (templateModal) templateModal.style.display = "none";
    });
  }

  window.addEventListener("click", (event) => {
    if (templateModal && event.target === templateModal) {
      templateModal.style.display = "none";
    }
  });
}

export function searchTemplates(query) {
  const lowerCaseQuery = query.toLowerCase();
  const filteredTemplates = templates.filter((template) =>
    template.title.toLowerCase().includes(lowerCaseQuery)
  );
  populateTemplateList(filteredTemplates); // Update template UI
}

function setupTemplateFiltering() {
  const buttons = document.querySelectorAll(
    "#templateFilters .filter-category"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.getAttribute("data-category");

      // Highlight active
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Trigger filtering
      filterTemplates(category.toLowerCase()); // assumes lowercase categories
    });
  });
}

export function loadTemplateFromTemplateData(template) {
  const inputField = document.getElementById("buildOrderInput");
  inputField.value = DOMPurify.sanitize(template.data);
  analyzeBuildOrder(inputField.value);
  closeTemplateModal();
}

// Run this on init
setupTemplateFiltering();

// Call this function during initialization
setupTemplateModal();

window.showTemplatesModal = showTemplatesModal;
window.closeTemplateModal = closeTemplateModal;
window.saveTemplate = saveTemplate;
window.deleteTemplate = deleteTemplate;
window.filterTemplates = filterTemplates;
