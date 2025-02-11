import { getSavedBuilds } from "./buildStorage.js";
import { closeModal, populateBuildList } from "./modal.js";
import { updateYouTubeEmbed } from "./youtube.js";
import {
  formatActionText,
  formatWorkersOrTimestampText,
} from "./textFormatters.js";

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
    console.log("Build not found at index:", index);
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
  <h3>${DOMPurify.sanitize(build.title)}</h3>
  <p>${DOMPurify.sanitize(build.comment || "No comments provided.")}</p>
  <pre>${build.buildOrder
    .map(
      (step) =>
        `[${DOMPurify.sanitize(step.workersOrTimestamp)}] ${DOMPurify.sanitize(
          step.action
        )}`
    )
    .join("\n")}</pre>
  ${
    build.videoLink
      ? `<iframe src="${DOMPurify.sanitize(
          build.videoLink
        )}" frameborder="0"></iframe>`
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

    // Validate step data before formatting
    const workersOrTimestamp = step.workersOrTimestamp
      ? DOMPurify.sanitize(
          formatWorkersOrTimestampText(step.workersOrTimestamp)
        )
      : "-";

    const actionText = step.action
      ? DOMPurify.sanitize(formatActionText(step.action))
      : "Unknown Action"; // Prevents errors

    // Insert formatted data into table
    row.insertCell(0).innerHTML = workersOrTimestamp;
    row.insertCell(1).innerHTML = actionText;
  });
}

export function formatWorkersOrTimestamp(
  workersOrTimestamp,
  minerals = 0,
  gas = 0
) {
  if (!workersOrTimestamp) workersOrTimestamp = "-";

  // Create formatted resources
  const formattedResources = `
    <span class="resources">
      <span class="minerals">${minerals}</span>
      <span class="gas">${gas}</span>
    </span>
  `;

  // Combine workers/timestamp with resources
  return `
    <span class="workers-timestamp">
      ${workersOrTimestamp} ${formattedResources}
    </span>
  `;
}

// Function to analyze and update the build order table automatically
export function analyzeBuildOrder(inputText) {
  console.log("Updating build order: ", inputText);
  requestAnimationFrame(() => {
    // Ensures real-time UI update
    const lines = inputText.split("\n");
    const table = document.getElementById("buildOrderTable");

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

      actionText = actionText.replace(/->/g, "→").replace(/<-/g, "←");

      // Format using Trie-based formatting
      actionText = formatActionText(actionText);

      const row = table.insertRow();
      row.insertCell(0).innerHTML = DOMPurify.sanitize(workersOrTimestamp);
      row.insertCell(1).innerHTML = DOMPurify.sanitize(actionText);
    });
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
  ${type === "error" || type === "warning" ? "⚠ " : ""} ${DOMPurify.sanitize(
    message
  )}
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

export function initializeTextareaClickHandler() {
  const textarea = document.getElementById("buildOrderInput"); // Ensure this matches your textarea's ID
  if (!textarea) {
    console.error("Textarea with ID 'buildOrderInput' not found!"); // Logs an error if the textarea is not found
    return;
  }

  textarea.addEventListener("click", function () {
    if (textarea.value.trim() === "") {
      // If the textarea is empty, set its value to "[]"
      textarea.value = "[]";
      // Position the caret inside the brackets
      textarea.selectionStart = 1;
      textarea.selectionEnd = 1;
    } else {
    }
  });
}

window.addEventListener("popstate", () => {
  const lastViewedBuild = sessionStorage.getItem("lastViewedBuild");
  if (lastViewedBuild) {
    refreshBuildList(lastViewedBuild);
  }
});

function refreshBuildList(lastViewedBuild) {
  const savedBuilds = getSavedBuilds();
  const updatedBuild = savedBuilds.find(
    (build) => build.id === lastViewedBuild
  );

  if (updatedBuild) {
    console.log("Updating build list after navigation:", updatedBuild);

    // Find and update the correct build in the UI
    document.querySelectorAll(".build-card").forEach((card) => {
      if (card.dataset.buildId === lastViewedBuild) {
        card.querySelector(".build-card-title").innerText = updatedBuild.title;
      }
    });

    // Optionally, reload the entire build list if needed
    populateBuildList(savedBuilds);
  }
}
