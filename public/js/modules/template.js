//import * as DOMPurify from "./dompurify/dist/purify.min.js";
import { analyzeBuildOrder } from "./uiHandlers.js";

const predefinedTemplates = [
  {
    title: "15/15/15 no gas",
    category: "zerg",
    image: "img/race/zerg.png",
    data: "[12] Overlord\n[14] Spawning Pool\n[16] Zergling Rush",
  },
  {
    title: "2-1-1",
    category: "terran",
    image: "img/race/terran.png",
    data: "[12] Supply Depot\n[13] Barracks\n[16] Marine Push",
  },
  {
    title: "fast expand",
    category: "protoss",
    image: "img/race/protoss.png",
    data: "[13] Pylon\n[14] Gateway\n[16] Zealot Push",
  },
  {
    title: "14gas 14pool",
    category: "zerg",
    image: "img/race/zerg.png",
    data: "[12] Overlord\n[14] Spawning Pool\n[16] Zergling Rush",
  },

  {
    title: "2 gate opener",
    category: "protoss",
    image: "img/race/protoss.png",
    data: "[13] Pylon\n[14] Gateway\n[16] Zealot Push",
  },
  {
    title: "16 hatch",
    category: "zerg",
    image: "img/race/zerg.png",
    data: "[12] Overlord\n[14] Spawning Pool\n[16] Zergling Rush",
  },
  {
    title: "7",
    category: "terran",
    image: "img/race/terran.png",
    data: "[12] Supply Depot\n[13] Barracks\n[16] Marine Push",
  },
  {
    title: "Cannon rush into void rays",
    category: "protoss",
    image: "img/race/protoss.png",
    data: "[13] Pylon\n[14] Gateway\n[16] Zealot Push",
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
    templateCard.addEventListener("click", () => loadTemplate(index));

    templateListDiv.appendChild(templateCard);
  });
}

export function previewTemplate(template) {
  const previewDiv = document.getElementById("templatePreview");
  previewDiv.innerHTML = `
      <h4>${DOMPurify.sanitize(template.title)}</h4>
      <p>${DOMPurify.sanitize(template.data).replace(/\n/g, "<br>")}</p>
    `;
}

document
  .getElementById("templateList")
  .addEventListener("mouseover", (event) => {
    const templateCard = event.target.closest(".template-card");
    if (templateCard) {
      const templateData = JSON.parse(
        templateCard.getAttribute("data-template")
      );
      previewTemplate(templateData);
    }
  });

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

    const raceImage = `img/race/${selectedRace}.png`;

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

export function loadTemplate(index) {
  const template = templates[index];
  const inputField = document.getElementById("buildOrderInput");

  // Set the template data in the input field
  inputField.value = DOMPurify.sanitize(template.data);

  // Analyze and update the output
  analyzeBuildOrder(inputField.value);

  // Close the modal
  closeTemplateModal();
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

  // Close modal when clicking the close button
  closeBtn.addEventListener("click", () => {
    templateModal.style.display = "none";
  });

  // Close modal when clicking outside the modal content
  window.addEventListener("click", (event) => {
    if (event.target === templateModal) {
      templateModal.style.display = "none";
    }
  });
}

export function searchTemplates(query) {
  const lowerCaseQuery = query.toLowerCase();
  const filteredTemplates = templates.filter((template) =>
    template.title.toLowerCase().includes(lowerCaseQuery)
  );
  populateTemplateList(filteredTemplates);
}

// Call this function during initialization
setupTemplateModal();

window.showTemplatesModal = showTemplatesModal;
window.closeTemplateModal = closeTemplateModal;
window.saveTemplate = saveTemplate;
window.loadTemplate = loadTemplate;
window.deleteTemplate = deleteTemplate;
window.filterTemplates = filterTemplates;
