import { getSavedBuilds } from "./buildStorage.js";
import { closeModal, populateBuildList } from "./modal.js";
import { updateYouTubeEmbed } from "./youtube.js";

import { formatActionText, capitalizeFirstLetter } from "./textFormatters.js";

// Function to toggle the title input field
export function toggleTitleInput(showInput) {
  const titleText = document.getElementById("buildOrderTitleText");
  const titleInput = document.getElementById("buildOrderTitleInput");

  if (showInput) {
    titleText.style.display = "none";
    titleInput.style.display = "inline-block";
    titleInput.value = titleText.classList.contains("dimmed")
      ? ""
      : titleText.textContent;
    titleInput.focus();
    titleText.classList.remove("dimmed");
  } else {
    const titleValue = titleInput.value.trim();
    titleText.textContent = titleValue || "Enter build order title here...";
    titleInput.style.display = "none";
    titleText.style.display = "inline-block";

    if (!titleValue) {
      titleText.classList.add("dimmed");
    }
  }
}

window.toggleTitleInput = toggleTitleInput;

// Function to toggle visibility of a section using data-section attribute
export function toggleSection(header) {
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
export function initializeSectionToggles() {
  document.querySelectorAll(".toggle-title").forEach((header) => {
    header.addEventListener("click", () => toggleSection(header));
  });
}

export function populateBuildDetails(index) {
  const savedBuilds = getSavedBuilds();
  const build = savedBuilds[index];

  if (!build) {
    console.error("Build not found at index:", index);
    return;
  }

  // Update comment and video input fields
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");

  if (commentInput) {
    commentInput.value = build.comment || "";
  } else {
    console.warn("commentInput not found!");
  }

  if (videoInput) {
    videoInput.value = build.videoLink || "";
  } else {
    console.warn("videoInput not found!");
  }

  // Update video embed
  updateYouTubeEmbed();

  // Populate the modal details section
  const buildDetailsContainer = document.getElementById(
    "buildDetailsContainer"
  );

  if (!buildDetailsContainer) {
    console.error("buildDetailsContainer not found!");
    return;
  }

  buildDetailsContainer.innerHTML = `
    <h3>${build.title}</h3>
    <p>${build.comment || "No comments provided."}</p>
    <pre>${build.buildOrder
      .map((step) => `[${step.workersOrTimestamp}] ${step.action}`)
      .join("\n")}</pre>
    ${
      build.videoLink
        ? `<iframe src="${build.videoLink}" frameborder="0"></iframe>`
        : ""
    }
  `;
}

export function displayBuildOrder(buildOrder) {
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

export function updateBuildPreview(buildData) {
  const previewContainer = document.getElementById("buildPreview");
  if (!buildData) {
    previewContainer.innerHTML = "<p>Select a build to view details here.</p>";
    return;
  }

  previewContainer.innerHTML = `
    <h4>${buildData.title}</h4>
    <p>${buildData.description || "No description available."}</p>
    <pre>${buildData.content || "No build content available."}</pre>
  `;
}
/*
function formatWorkersOrTimestamp(text) {
  return text.replace(/(\d+)\s+(gas|minerals)/gi, (match, num, resource) => {
    console.log(`Matched resource: ${resource} with quantity: ${num}`); // Debugging
    const colorClass =
      resource.toLowerCase() === "gas" ? "green-text" : "blue-text";
    const imageSrc =
      resource.toLowerCase() === "gas"
        ? "img/resources/gas.png"
        : "img/resources/minerals.png";

    if (!imageSrc) {
      console.warn(`Image for ${resource} not found!`);
    }

    const imageTag = `<img src="${imageSrc}" alt="${resource}" class="resource-image">`;

    return `<span class="${colorClass}">${num} ${capitalizeFirstLetter(
      resource
    )}</span> ${imageTag}`;
  });
}
*/
// Function to analyze and update the build order table automatically
export function analyzeBuildOrder(inputText) {
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

    // Replace `->` and `<-` with arrows
    actionText = actionText.replace(/->/g, "→").replace(/<-/g, "←");

    // Format using Trie-based formatting
    actionText = formatActionText(actionText);

    // Insert row into the table
    const row = table.insertRow();
    row.insertCell(0).innerHTML = workersOrTimestamp;
    row.insertCell(1).innerHTML = actionText;
  });
}

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

export function showToast(message, type = "success", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${type === "error" || type === "warning" ? "⚠ " : ""}
    ${message}
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => {
      if (toast.parentElement === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, duration);
}
