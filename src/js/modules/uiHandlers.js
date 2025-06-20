import DOMPurify from "dompurify";

import { getSavedBuilds } from "./buildStorage.js";
import { closeModal, populateBuildList } from "./modal.js";
import { updateYouTubeEmbed } from "./youtube.js";
import {
  formatActionText,
  formatWorkersOrTimestampText,
} from "./textFormatters.js";
import { abbreviationMap } from "../data/abbreviationMap.js";
import { setCurrentBuildId } from "./states/buildState.js";
import { parseBuildOrder } from "./utils.js";
import { isBracketInputEnabled } from "./settings.js";

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
  const catBox = document.getElementById("box");

  if (section.classList.contains("hidden")) {
    section.classList.remove("hidden");
    section.classList.add("visible");
    arrow.classList.add("open");
    if (sectionId === "buildOrderInputField" && catBox) {
      catBox.style.display = "inline-block";
    }
  } else {
    section.classList.remove("visible");
    section.classList.add("hidden");
    arrow.classList.remove("open");
    if (sectionId === "buildOrderInputField" && catBox) {
      catBox.style.display = "none";
    }
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

  setCurrentBuildId(build.encodedTitle); // or build.id if that's how you're storing it

  const saveBuildButton = document.getElementById("saveBuildButton");
  if (saveBuildButton) {
    saveBuildButton.innerText = "Update Build";
    saveBuildButton.removeAttribute("data-tooltip");
    void saveBuildButton.offsetWidth; // force reflow
    saveBuildButton.setAttribute("data-tooltip", "Update Current Build");
  }

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

  // 🔄 Setup replay view toggle
  const replayUrl = build.replayUrl?.trim();
  const replayWrapper = document.getElementById("replayInputWrapper");
  const replayView = document.getElementById("replayViewWrapper");
  const replayBtn = document.getElementById("replayDownloadBtn");

  if (replayUrl && replayWrapper && replayView && replayBtn) {
    replayWrapper.style.display = "none";
    replayView.style.display = "block";
    replayBtn.href = replayUrl;
    replayBtn.innerText = "Download Replay on Drop.sc";
  } else if (replayWrapper && replayView) {
    replayWrapper.style.display = "flex";
    replayView.style.display = "none";
  }

  console.log("🔍 Loaded build object:", build);
  console.log("🎮 Replay URL:", build.replayUrl);

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

// Function to load and display build order
export function displayBuildOrder(buildOrderText) {
  const buildOrderInput = document.getElementById("buildOrderInput");
  const tableBody = document.getElementById("buildOrderTable");

  // Clear the table first
  tableBody.innerHTML = "";

  // Ensure the text is present in the buildOrderInput
  if (buildOrderInput) {
    buildOrderInput.value = buildOrderText; // Put the build order text in the input field
  }

  // Now, format the text from buildOrderInput into a table format
  const steps = buildOrderText.split("\n").map((step) => {
    const [timestamp, ...actionParts] = step.split(" ");
    const action = actionParts.join(" ");
    return { workersOrTimestamp: timestamp.replace(/[\[\]]/g, ""), action }; // Clean the timestamp
  });

  // Iterate over the steps and create table rows
  steps.forEach((step) => {
    const row = document.createElement("tr");

    const workersOrTimestampCell = document.createElement("td");
    workersOrTimestampCell.textContent = step.workersOrTimestamp || "-";

    const actionCell = document.createElement("td");
    actionCell.textContent = step.action || "-";

    row.appendChild(workersOrTimestampCell);
    row.appendChild(actionCell);

    // Append the row to the table body
    tableBody.appendChild(row);
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
  requestAnimationFrame(() => {
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
        // If no brackets, consider the entire line as the action text
        workersOrTimestamp = "";
        actionText = line;
      }

      // Format using Trie-based formatting
      actionText = formatActionText(actionText);

      const row = table.insertRow();
      row.insertCell(0).innerHTML = workersOrTimestamp
        ? formatWorkersOrTimestampText(workersOrTimestamp)
        : "-"; // Display '-' if no timestamp/worker info
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

export function initializeTextareaClickHandler() {
  const textarea = document.getElementById("buildOrderInput"); // Ensure this matches your textarea's ID
  if (!textarea) {
    console.error("Textarea with ID 'buildOrderInput' not found!"); // Logs an error if the textarea is not found
    return;
  }

  textarea.addEventListener("click", function () {
    if (!isBracketInputEnabled()) return;
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

// Helper text examples
function createExample(example) {
  let formattedHTML;

  // Handle the special case for Time/Worker Supply Format
  if (example.title === "Time/Worker Supply Format") {
    const timeInput = example.inputTime || ""; // Default to empty string if undefined
    const supplyInput = example.inputSupply || ""; // Default to empty string if undefined

    // Extract only the time or supply number (remove any additional text)
    const cleanedTime = timeInput.match(/\[(\d{1,2}:\d{2}|\d+)\]/)?.[1] || ""; // Extracts the time or supply number without the brackets
    const cleanedSupply = supplyInput.match(/\[(\d+)\]/)?.[1] || ""; // Extracts only the number, not the action name

    // Create the formatted HTML table
    formattedHTML = `
      <table class="buildOrderTable">
        <thead>
          <tr>
            <th>Supply/Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${cleanedTime}</td>
            <td>${formatActionText(example.actionTime)}</td>
          </tr>
          <tr>
            <td>${cleanedSupply}</td>
            <td>${formatActionText(example.actionSupply)}</td>
          </tr>
        </tbody>
      </table>
    `;
  } else {
    // Default handling for other examples
    formattedHTML = formatActionText(example.input || ""); // Ensure input is always defined
  }

  // Return the complete example block with subtitle and description
  return `
  <div class="example-block">
    <h4 class="example-subtitle">${example.title}</h4>
    <div class="example-flex">
      <div class="example-left">
        <p><strong>Input:</strong></p>
        <pre class="example-input">
${example.input || `${example.inputTime || ""}\n${example.inputSupply || ""}`}
        </pre>
        <p><strong>Output:</strong></p>
        <div class="formatted-preview">${formattedHTML}</div>
      </div>
      <div class="example-right">
        <p class="example-description"><em>${example.description}</em></p>
      </div>
    </div>
  </div>
  <hr />
`;
}

// Function to generate abbreviation sections for structures, units, and upgrades
function generateAbbrSection(title, abbrObj) {
  return `
    <h5>${title}</h5>
    <div class="abbreviation-list">
      ${Object.entries(abbrObj)
        .map(([abbr, full]) => {
          const formatted = formatActionText(full);
          return `
            <div class="abbr-row">
              <div class="abbr-left"><code>${abbr}</code></div>
              <div class="arrow"></div>
              <div class="abbr-right">${formatted}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

export function showBuildOrderHelpModal() {
  const modal = document.getElementById("buildOrderHelpModal");
  const contentDiv = document.getElementById("buildOrderHelpContent");

  const examples = [
    {
      title: "Time/Worker Supply Format",
      inputTime: "[01:10] Overlord",
      inputSupply: "[24] Hatchery",
      actionTime: "overlord",
      actionSupply: "hatchery",
      description:
        "This format showcases two types: one for time-based actions (e.g., [01:10] for timestamp) and one for supply-based actions (e.g., [24] for worker supply).",
    },
    {
      title: "Completed Upgrade with Percent",
      input: "@100% stimpack push opponent third base",
      description:
        "Using <code><u>@100%</u>, <u>@100</u> or <u>100%</u></code> marks the action as fully completed and visually emphasizes the upgrade status.",
    },
    {
      title: "Progress Indicator",
      input: "75% hatchery",
      description:
        "Typing <code>75%</code> before a structure or unit marks it as partially built or in progress.",
    },
    {
      title: "Resource Cost Notation",
      input: "100 gas, 150 minerals",
      description:
        "Typing gas or mineral amounts will format them into icons and place them next to the build action.",
    },
    {
      title: "Map Position Markers",
      input: "Make hatchery at pos1 then attack at pos2",
      description: `
      <code>pos1</code> – <code>pos9</code> markers highlight positions on the map for clarity or expansion order.<br><br>
      You can place these markers interactively using the map found in the <strong>"Additional Settings"</strong> section.<br><br>
      • Click once on the map to place a position marker.<br>
      • Click and hold, then release at a different location to draw an arrow between the two points.<br>
      • To erase a marker or arrow, simply click on it again.<br><br>
      <img src="./img/info/minimap-positions (1).webp" alt="Minimap Example" class="example-image">
    `,
    },
  ];

  const manualHTML = ` 
    <p>You can enter build steps like this:</p>
    <ul>
      <li><strong>Supply/Time Column:</strong> Writing inside brackets like <code>[12]</code> or <code>[01:23]</code> will show up in the left column.</li>
      <li><strong>Quick Typing:</strong> Pressing <kbd>Enter</kbd> while inside brackets automatically moves the cursor outside for faster typing.</li>
      <li><strong>Abbreviations:</strong> Short forms like <code>RW</code> or <code>cc</code> are automatically expanded to their full terms.</li>
      <li><strong>Done Formatting:</strong> Writing <code>100%</code>, <code>@100%</code>, or <code>@100</code> will format the next action to show it’s completed.</li>
      <li><strong>Progress Formatting:</strong> Typing <code>40%</code> (or any percent) will format the next action as being in progress.</li>
      <li><strong>Map Markers:</strong> Writing <code>pos1</code> to <code>pos9</code> inserts indicators to highlight locations on the map (like expansion order).</li>
      <li><strong>Resources:</strong> Writing <code>100 gas</code> or <code>150 minerals</code> will format and show icons. The number can be anything.</li>
    </ul>
  `;

  const abbreviationGridHTML = ` 
    <h4>Abbreviations Reference:</h4>
    ${generateAbbrSection("Structures", abbreviationMap.Structures)}
    ${generateAbbrSection("Units", abbreviationMap.Units)}
    ${generateAbbrSection("Upgrades", abbreviationMap.Upgrades)}
        <hr />
    <h4>Examples:</h4>
  `;

  contentDiv.innerHTML =
    manualHTML + abbreviationGridHTML + examples.map(createExample).join("");

  modal.style.display = "block";
}

export function createNotificationDot() {
  const dot = document.createElement("div");
  dot.className = "notification-dot";
  return dot;
}
