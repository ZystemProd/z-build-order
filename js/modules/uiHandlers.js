import { getSavedBuilds } from "./buildStorage.js";
import { closeModal } from "./modal.js";
import { updateYouTubeEmbed } from "./youtube.js";

import {
  formatActionText,
  transformAbbreviations,
  formatStructureText,
  capitalizeFirstLetter,
} from "./textFormatters.js";
/*
export function updateYouTubeEmbed() {
  const videoInput = document.getElementById("videoInput");
  const videoIframe = document.getElementById("videoIframe");

  const videoURL = videoInput.value.trim();
  const videoID = getYouTubeVideoID(videoURL);

  if (videoID) {
    // Show iframe with the video
    videoIframe.src = `https://www.youtube.com/embed/${videoID}`;
    videoIframe.style.display = "block";
  } else {
    // Hide iframe if the URL is invalid
    videoIframe.style.display = "none";
    videoIframe.src = "";
  }
}
*/
/*
function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
*/
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

// Function to filter builds by category or subcategory
export function filterBuilds(category) {
  const buildList = document.getElementById("modalBuildsContainer");
  const modalTitle = document.querySelector(".modal-content h3");

  // Clear existing cards
  buildList.innerHTML = "";

  // Fetch saved builds
  const savedBuilds = getSavedBuilds();

  // Filter builds by category
  const filteredBuilds =
    category === "all"
      ? savedBuilds
      : savedBuilds.filter((build) => build.category === category);

  // Sort by timestamp (newest first)
  const sortedBuilds = filteredBuilds.sort((a, b) => b.timestamp - a.timestamp);

  // Update the modal title
  const categoryTitles = {
    all: "All Builds",
    zerg: "Zerg Builds",
    protoss: "Protoss Builds",
    terran: "Terran Builds",
    zvp: "ZvP Builds",
    zvt: "ZvT Builds",
    zvz: "ZvZ Builds",
    pvp: "PvP Builds",
    pvz: "PvZ Builds",
    pvt: "PvT Builds",
    tvp: "TvP Builds",
    tvt: "TvT Builds",
    tvz: "TvZ Builds",
  };
  modalTitle.textContent = categoryTitles[category] || "Builds";

  // Render filtered builds
  sortedBuilds.forEach((build, index) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");

    buildCard.innerHTML = `
        <div class="delete-icon" onclick="deleteBuild(${index})">×</div>
        <h4 class="build-card-title">${build.title}</h4>
        <button onclick="viewBuild(${index})">View</button>
      `;

    buildList.appendChild(buildCard);
  });
}

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

export function populateBuildDetails(build = {}) {
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");

  // Assign safe defaults
  commentInput.value = build.comment || "";
  videoInput.value = build.videoLink || "";

  // Update video embed
  updateYouTubeEmbed();
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

    // Replace `->` and `<-` with arrows in the action text
    actionText = actionText.replace(/->/g, "→").replace(/<-/g, "←");

    // Replace `posX` with images
    actionText = actionText.replace(/pos(\d+)/g, (_, number) => {
      const imagePath = `img/pos/pos${number}.png`; // Adjust path if needed
      return `<img src="${imagePath}" alt="Position ${number}" class="pos-image">`;
    });

    // Ensure other formatting does not overwrite `posX` replacement
    if (!actionText.includes("pos")) {
      actionText = transformAbbreviations(actionText);
      actionText = formatStructureText(actionText);
      actionText = formatActionText(actionText);
    }

    // Insert row in the table
    const row = table.insertRow();
    row.insertCell(0).innerHTML = formatWorkersOrTimestamp(workersOrTimestamp);
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
  // Ensure the toast container exists
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.position = "fixed";
    container.style.top = "20px"; // Near the top
    container.style.left = "50%"; // Center horizontally
    container.style.transform = "translate(-50%, 0)"; // Adjust for perfect centering
    container.style.zIndex = "9999"; // High priority
    container.style.pointerEvents = "none"; // Avoid blocking clicks
    document.body.appendChild(container);
  }

  // Clear any existing notification
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Create a toast element
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background-color: ${type === "success" ? "#4CAF50" : "#f44336"};
    color: white;
    padding: 10px 20px;
    margin: 10px 0;
    border-radius: 5px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    text-align: center;
    max-width: 300px; /* Limit width */
    word-wrap: break-word;
    position: relative; /* Ensure proper positioning */
    display: inline-block;
    position: fixed;
  `;

  // Append the toast to the container
  container.appendChild(toast);

  // Animate the toast (fade in and slide down)
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  // Remove the toast after the duration
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => {
      if (toast.parentElement === container) {
        container.removeChild(toast);
      }
    }, 300); // Ensure the fade-out animation completes
  }, duration);
}
