import DOMPurify from "dompurify";

import { getSavedBuilds } from "./buildStorage.js";
import { closeModal, populateBuildList } from "./modal.js";
import { updateYouTubeEmbed } from "./youtube.js";
import { mapAnnotations } from "./interactive_map.js";
import {
  formatActionText,
  formatWorkersOrTimestampText,
} from "./textFormatters.js";
import { getCurrentBuildId, setCurrentBuildId } from "./states/buildState.js";
import { abbreviationMap } from "../data/abbreviationMap.js";
import { parseBuildOrder } from "./utils.js";
import { isBracketInputEnabled } from "./settings.js";
import { updateTooltips } from "./tooltip.js";

// Function to toggle the title input field

// Enable the main Save button after any meaningful change
function enableSaveButton() {
  try {
    const btn = document.getElementById("saveBuildButton");
    if (btn) {
      btn.disabled = false;
      btn.style.backgroundColor = "";
    }
  } catch {}
}
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

  setCurrentBuildId(build.id);

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

  // Setup editors (Main + Variations) from the loaded build so tabs appear
  try {
    // Sync title UI (text span + input)
    try {
      const titleStr = build.title || "";
      const titleTextEl = document.getElementById("buildOrderTitleText");
      if (titleTextEl) {
        titleTextEl.textContent = titleStr || "Enter build order title here...";
        if (titleStr) titleTextEl.classList.remove("dimmed");
        else titleTextEl.classList.add("dimmed");
      }
      const titleInputEl = document.getElementById("buildOrderTitleInput");
      if (titleInputEl) titleInputEl.value = titleStr;
    } catch (_) {}

    const main = document.getElementById("buildOrderInput");
    if (main) {
      // Ensure matchup dropdown reflects build (case-insensitive)
      try {
        const dd = document.getElementById("buildCategoryDropdown");
        const sub = (build.subcategory || build.subcategoryLowercase || "")
          .toString()
          .toLowerCase();
        if (dd && sub) {
          for (const opt of dd.options) {
            if (String(opt.value).toLowerCase() === sub) {
              dd.value = opt.value;
              break;
            }
          }
          dd.style.color = sub.startsWith("zv")
            ? "#c07aeb"
            : sub.startsWith("pv")
            ? "#5fe5ff"
            : sub.startsWith("tv")
            ? "#ff3a30"
            : "";
        }
      } catch (_) {}
      // Ensure editor stack exists
      let stack = document.getElementById("boEditorsStack");
      if (!stack) {
        stack = document.createElement("div");
        stack.id = "boEditorsStack";
        const parent = main.parentElement;
        if (parent) parent.insertBefore(stack, main);
        stack.appendChild(main);
      } else {
        // Remove previously added variation editors
        Array.from(stack.querySelectorAll(".bo-editor"))
          .filter((ed) => ed !== main)
          .forEach((ed) => ed.remove());
      }

      // Set main editor
      main.classList.add("bo-editor");
      main.dataset.editorId = "main";
      main.dataset.editorName = "Main";
      const toText = (arrOrObj) => {
        if (Array.isArray(arrOrObj)) {
          return arrOrObj
            .map((s) =>
              `[${s.workersOrTimestamp || ""}] ${s.action || ""}`.trim()
            )
            .join("\n");
        }
        return String(arrOrObj?.text || "");
      };
      main.value = toText(build.buildOrder) || "";
      main.style.display = "block";

      // Add variations from the document (if present)
      const variations = Array.isArray(build.variations)
        ? build.variations
        : [];
      // Expose names/ids so analyze can seed tabs if needed
      window.zboPreloadedVariations = variations.map((v, idx) => ({
        id: v.id || `var_${idx + 1}`,
        name: v.name || `Variation ${idx + 1}`,
      }));
      variations.slice(0, 5).forEach((v, idx) => {
        const ta = document.createElement("textarea");
        ta.className = "bo-editor";
        ta.dataset.editorId = v.id || `var_${idx + 1}`;
        ta.dataset.editorName = v.name || `Variation ${idx + 1}`;
        ta.value = toText(v.buildOrder || v);
        ta.style.display = "none";
        stack.appendChild(ta);
      });

      // Ensure the tabs exist and reflect editors before rendering
      ensureVariationUIContainers();
      renderVariationTabs(loadEditorsStateFromDOM());

      // Analyze immediately to rebuild table + rails from DOM editors
      analyzeBuildOrder(main.value || "");
    }
  } catch (e) {
    console.warn("Failed to initialize editors for loaded build", e);
  }

  // Update description and video input fields
  const descriptionInput = document.getElementById("descriptionInput");
  const videoInput = document.getElementById("videoInput");

  if (descriptionInput) {
    descriptionInput.value = build.description || "";
  } else {
    console.warn("descriptionInput not found!");
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
  const replayInput = document.getElementById("replayLinkInput");

  if (replayUrl && replayWrapper && replayView && replayBtn) {
    replayWrapper.style.display = "none";
    replayView.style.display = "block";
    replayBtn.href = replayUrl;
    replayBtn.innerText = "Download Replay";
    if (replayInput) replayInput.value = replayUrl;
  } else if (replayWrapper && replayView) {
    replayWrapper.style.display = "flex";
    replayView.style.display = "none";
    if (replayInput) replayInput.value = "";
  }

  // Always keep replay input visible to allow renewing the link
  try {
    const replayInputEl = document.getElementById("replayLinkInput");
    if (replayInputEl) replayInputEl.value = replayUrl || "";
    const replayWrapperEl = document.getElementById("replayInputWrapper");
    if (replayWrapperEl) replayWrapperEl.style.display = "flex";
    const replayBtnEl = document.getElementById("replayDownloadBtn");
    if (replayBtnEl) replayBtnEl.innerText = "Download Replay";
  } catch (_) {}

  console.log("🔍 Loaded build object:", build);
  console.log("🎮 Replay URL:", build.replayUrl);

  // Update video embed
  updateYouTubeEmbed();

  // Preserve Map selection and annotations in the editor
  try {
    const mapImage = document.getElementById("map-preview-image");
    const selectedMapText = document.getElementById("selected-map-text");
    const modeDropdown = document.getElementById("mapModeDropdown");

    if (modeDropdown && build.mapMode) {
      modeDropdown.value = build.mapMode;
    }

    const mapNameRaw = (build.map || "").trim();
    const hasValidMap =
      mapNameRaw &&
      mapNameRaw.toLowerCase() !== "index" &&
      mapNameRaw.toLowerCase() !== "no map selected";

    if (hasValidMap) {
      const capitalizeWords = (str) =>
        str
          .split(" ")
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
          .join(" ");
      const formattedName = capitalizeWords(mapNameRaw);

      let mapUrl = "";
      try {
        const folder = build.mapFolder || `current/${build.mapMode || "1v1"}`;
        const fileName =
          mapNameRaw.replace(/\s+/g, "_").toLowerCase() + ".webp";
        mapUrl = `/img/maps/${folder}/${fileName}`;
      } catch (_) {
        mapUrl = `/img/maps/${mapNameRaw
          .replace(/\s+/g, "_")
          .toLowerCase()}.webp`;
      }

      if (mapImage) {
        mapImage.src = mapUrl;
        mapImage.dataset.mapName = formattedName;
        if (build.mapMode) mapImage.dataset.mapMode = build.mapMode;
      }
      if (selectedMapText) selectedMapText.innerText = formattedName;

      if (mapAnnotations && mapAnnotations.annotationsContainer) {
        mapAnnotations.annotationsContainer.innerHTML = "";
        mapAnnotations.circles = [];
        mapAnnotations.arrows = [];
        const applyAnnotations = () => {
          if (build.interactiveMap) {
            (build.interactiveMap.circles || []).forEach(({ x, y }) =>
              mapAnnotations.createCircle(x, y)
            );
            (build.interactiveMap.arrows || []).forEach(
              ({ startX, startY, endX, endY }) =>
                mapAnnotations.createArrow(startX, startY, endX, endY)
            );
            mapAnnotations.updateCircleNumbers?.();
          }
        };
        if (mapImage && mapImage.complete && mapImage.naturalWidth > 0) {
          applyAnnotations();
        } else if (mapImage) {
          mapImage.addEventListener("load", applyAnnotations, { once: true });
        }
      }
    } else {
      if (selectedMapText) selectedMapText.innerText = "No map selected";
      if (mapImage) {
        mapImage.removeAttribute("src");
        delete mapImage.dataset.mapName;
        delete mapImage.dataset.mapMode;
      }
      if (mapAnnotations && mapAnnotations.annotationsContainer) {
        mapAnnotations.annotationsContainer.innerHTML = "";
        mapAnnotations.circles = [];
        mapAnnotations.arrows = [];
      }
    }
  } catch (_) {
    // non-fatal
  }

  // Populate the modal details section
  const buildDetailsContainer = document.getElementById(
    "buildDetailsContainer"
  );

  if (!buildDetailsContainer) {
    // Details container only exists in certain modals; skip gracefully if absent
    // Do not early-return to avoid aborting the rest of the save/update flow
  } else {
    buildDetailsContainer.innerHTML = `
  <h3>${DOMPurify.sanitize(build.title)}</h3>
  <p>${DOMPurify.sanitize(build.description || "No description provided.")}</p>
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
    const match = step.match(/\[(.*?)\]\s*(.*)/);
    if (match) {
      return { workersOrTimestamp: match[1], action: match[2] };
    }
    // Fallback for lines without brackets
    return { workersOrTimestamp: "", action: step };
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
export async function analyzeBuildOrder(inputText) {
  requestAnimationFrame(async () => {
    const table = document.getElementById("buildOrderTable");
    if (!table) return;

    // Ensure a variation tabs container exists (do not alter input/title styles)
    ensureVariationUIContainers();

    // Ensure editor stack exists (wraps the main textarea once)
    ensureEditorStack();

    // Load editors state from DOM and render tabs (no memory drafts)
    let store = loadEditorsStateFromDOM();
    // Fallback: if editors are present but tabs still come up empty,
    // allow a preloaded list (set during build load) to seed the tabs.
    if (
      (!store || store.variations.length === 0) &&
      Array.isArray(window.zboPreloadedVariations) &&
      window.zboPreloadedVariations.length > 0
    ) {
      store = {
        activeId: variationState.active || "main",
        variations: window.zboPreloadedVariations,
      };
    }
    renderVariationTabs(store);

    // Ensure header has only Supply/Time and Action; rails render inside Action cells
    ensureVariationHeader(table);

    // Clear previous rows
    while (table.rows.length > 1) {
      table.deleteRow(1);
    }

    // Determine which steps to show based on active tab
    const active = variationState.active || "main";
    const mainText = getMainText();
    const mainLines = splitLines(mainText);
    const activeText =
      active === "main" ? mainText : getEditorById(active)?.value || mainText;
    const lines = splitLines(activeText);
    const visibleSteps = lines
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const m = line.match(/\[(.*?)\]\s*(.*)/);
        return {
          workersOrTimestamp: m ? m[1] : "",
          actionText: m ? m[2] : line,
          branchNotes: [],
        };
      });

    // Pre-compute lines and pivots for all variations
    const varIds = variationState.order.slice(0, 5);
    const varLinesMap = new Map();
    const pivotByVar = new Map();
    varIds.forEach((vid) => {
      const ed = getEditorById(vid);
      const vLines = splitLines(ed?.value || "");
      varLinesMap.set(vid, vLines);
      pivotByVar.set(vid, findPivotIndex(mainLines, vLines));
    });

    // Remove legacy right-side branch buttons (now use tabs Branch mode)
    let branchOverlay = null;

    // Render rows
    visibleSteps.forEach((step) => {
      const row = table.insertRow();

      const stCell = row.insertCell(0);
      stCell.innerHTML = step.workersOrTimestamp
        ? formatWorkersOrTimestampText(step.workersOrTimestamp)
        : "-";

      const actionCell = row.insertCell(1);
      let actionHtml = formatActionText(step.actionText);
      // Append branch notes that are visible in current mode
      // No branch notes when using separate saved variations.
      actionCell.innerHTML = DOMPurify.sanitize(actionHtml, {
        ADD_ATTR: ["style"],
      });

      // Rails render inside the Action cell to avoid a dividing column
      actionCell.classList.add("action-with-rails");
      const rails = document.createElement("div");
      rails.className = "var-rails";
      // Attach rails to the action cell (positioned absolute via CSS)
      actionCell.style.position = "relative";
      const activeVar =
        active !== "main" ? variationState.byId.get(active) : null;
      const rowIndex = table.rows.length - 2; // zero-based row index within visible steps

      // helper: create a non-interactive vertical line (chip-label replacement)
      const makeLine = (color) => {
        const line = document.createElement("div");
        line.className = "var-label-line";
        try { line.style.setProperty("--var-color", color || MAIN_COLOR); } catch (_) {}
        line.style.backgroundColor = color || MAIN_COLOR;
        return line;
      };

      if (!activeVar) {
        // Overview: gather all variations that branch on this row and render side-by-side lines
        const atThisRow = [];
        varIds.forEach((vid) => {
          const pv = pivotByVar.get(vid) ?? -1;
          if (rowIndex === pv) {
            const v = variationState.byId.get(vid);
            atThisRow.push({
              id: vid,
              name: v?.name || "Variation",
              color: v?.color || MAIN_COLOR,
            });
          }
        });
        let linesCount = atThisRow.length;
        if (linesCount > 0) {
          atThisRow.forEach((info) => {
            rails.appendChild(makeLine(info.color));
          });
        }
        // Dynamically reserve right padding based on number of rails
        try {
          const pad = linesCount > 0 ? 15 + linesCount * 6 + Math.max(0, linesCount - 1) * 3 + 10 : 15;
          actionCell.style.paddingRight = pad + "px";
        } catch (_) {}
      } else {
        // Variation view: single line at its pivot
        const pv = pivotByVar.get(active) ?? -1;
        if (rowIndex === pv) {
          const v = activeVar;
          rails.appendChild(makeLine(v?.color || MAIN_COLOR));
          try { actionCell.style.paddingRight = (15 + 1 * 6 + 0 * 3 + 10) + "px"; } catch (_) {}
        } else {
          try { actionCell.style.paddingRight = "15px"; } catch (_) {}
        }
      }
      
      actionCell.appendChild(rails);

      // Branch button overlay: place outside table aligned to row (only when viewing Main)
      // No per-row branch buttons anymore
    });

    // After rows are rendered, update overlay box metrics
    // No overlay adjustments needed
  });
}

// ---------------- Variations: lightweight state + helpers -----------------

// Colors
// Main uses Variation 1's vivid cyan; variations then shift with a green for var 2
const MAIN_COLOR = "#4CC9F0"; // Main rail color (ex-Variation 1 color)
const VARIATION_COLORS = [
  "#F72585", // Variation 1
  "#8AC926", // Variation 2 (green)
  "#F19E39", // Variation 3 (orange)
  "#B38CFF", // Variation 4 (violet)
  "#3DD6D0", // Variation 5 (teal)
];

const variationState = {
  active: "main", // "main" | variationId
  byId: new Map(),
  order: [],
};
// DOM editor stack id used for hide/show switching of Main/variations
const EDITOR_STACK_ID = "boEditorsStack";

function ensureVariationUIContainers() {
  const output = document.querySelector(".buildOrderOutput");
  if (!output) return;
  const table = document.getElementById("buildOrderTable");
  if (!table) return;

  let tabs = document.getElementById("variationTabs");
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.id = "variationTabs";
    tabs.className = "variation-tabs";
  }

  // Ensure tabs live directly under .buildOrderOutput, immediately before the table
  // This moves it out of the grid-based .form-container so it can flex full width on mobile
  if (tabs.parentNode !== output || tabs.nextElementSibling !== table) {
    try {
      output.insertBefore(tabs, table);
    } catch (_) {
      // Fallback in case of rare DOM state; append to output then reorder
      output.appendChild(tabs);
      output.insertBefore(tabs, table);
    }
  }

  // Make sure it renders as a flex row wrapper
  tabs.style.display = "flex";
}

function renderVariationTabs(groupContext) {
  const tabs = document.getElementById("variationTabs");
  if (!tabs) return;

  // Build state maps from groupContext
  variationState.byId = new Map();
  variationState.order = [];

  tabs.innerHTML = ""; // reset

  const makeTab = (id, label, color = null) => {
    const btn = document.createElement("button");
    btn.className =
      "variation-tab" + (variationState.active === id ? " active" : "");
    btn.textContent = label;
    try {
      btn.setAttribute("data-tooltip", label);
    } catch (_) {}
    if (color) {
      try {
        btn.style.borderColor = color;
      } catch (_) {}
    }
    // Subtle active indicator: colored underline that matches rail color
    const isActive = variationState.active === id;
    const underlineColor = color || MAIN_COLOR;
    if (isActive) {
      try {
        btn.style.boxShadow = `inset 0 -3px 0 0 ${underlineColor}`;
      } catch (_) {}
    } else {
      try {
        btn.style.boxShadow = "none";
      } catch (_) {}
    }
    btn.addEventListener("click", () => setActiveVariation(id));
    return btn;
  };

  // Always show the container so branching is available even with 0 variations
  tabs.style.display = "flex";

  // Assign colors and ids
  (groupContext?.variations || []).slice(0, 5).forEach((v, idx) => {
    const color = VARIATION_COLORS[idx % VARIATION_COLORS.length];
    const varDef = { id: v.id, name: v.name, color };
    variationState.byId.set(v.id, varDef);
    variationState.order.push(v.id);
  });

  // Always render Main tab
  tabs.appendChild(makeTab("main", "Main", MAIN_COLOR));
  // Other branches
  variationState.order.forEach((vid) => {
    const v = variationState.byId.get(vid);
    tabs.appendChild(makeTab(vid, v?.name || "Var", v?.color));
  });

  // Always show a "+" branch button right after tabs (disabled when not allowed)
  const canBranch =
    (variationState.active || "main") === "main" &&
    variationState.order.length < 5;
  const branchBtn = document.createElement("button");
  branchBtn.className = "var-branch-btn";
  branchBtn.type = "button";
  branchBtn.textContent = "+";
  branchBtn.disabled = !canBranch;
  try {
    branchBtn.setAttribute(
      "data-tooltip",
      canBranch ? "Add variation" : "Switch to Main to add (max 5)"
    );
  } catch (_) {}
  branchBtn.addEventListener("click", () => {
    if (branchBtn.disabled) return;
    startBranchSelectMode();
  });
  tabs.appendChild(branchBtn);

  // Then the Edit button at the very end
  const editBtn = document.createElement("button");
  editBtn.className = "var-edit-btn";
  editBtn.innerHTML =
    '<img src="./img/SVG/pencil.svg" alt="Edit" class="svg-icon">';
  try {
    editBtn.setAttribute("data-tooltip", "Manage variations");
  } catch (_) {}
  editBtn.addEventListener("click", () => openVariationManager());
  tabs.appendChild(editBtn);

  // Ensure custom tooltips attach to newly added elements
  try {
    updateTooltips();
  } catch (_) {}
}

// Public helper to show tabs on initial page load
export function ensureVariationTabsVisibleOnLoad() {
  try {
    // Ensure the editor structure exists so Main is available
    ensureEditorStack();
    // Ensure the tabs container is placed and visible
    ensureVariationUIContainers();
    // Render tabs from current editor DOM state (Main + any existing variations)
    const store = loadEditorsStateFromDOM();
    renderVariationTabs(store);
  } catch (e) {
    console.warn("ensureVariationTabsVisibleOnLoad failed", e);
  }
}

function setActiveVariation(id) {
  // Persist current text under current active
  // Switch visible editor by hiding/showing DOM editors
  variationState.active = id || "main";
  const stack = getEditorStack();
  if (!stack) return;
  const all = getAllEditors();
  let activeEditor =
    getEditorById(variationState.active) || getEditorById("main");
  all.forEach((ed) => {
    if (ed === activeEditor) {
      ed.style.display = "block";
      ed.id = "buildOrderInput";
      if (!ed.__zboBound) {
        ed.addEventListener("input", () => analyzeBuildOrder(ed.value));
        ed.__zboBound = true;
      }
      try {
        // Rebind helpers that attach to #buildOrderInput
        initializeTextareaClickHandler();
      } catch (_) {}
      try {
        import("./autoCorrect.js").then((m) => m.initializeAutoCorrect());
      } catch (_) {}
    } else {
      if (ed.id === "buildOrderInput")
        ed.id = `buildOrderInput__${ed.dataset.editorId || "hidden"}`;
      ed.style.display = "none";
    }
  });
  analyzeBuildOrder(activeEditor?.value || "");
}

// --------- Local variation store helpers ----------
function splitLines(text) {
  return String(text || "").split("\n");
}
function getMainText() {
  const mainEd = getEditorById("main");
  return mainEd ? String(mainEd.value || "") : "";
}
function loadEditorsStateFromDOM() {
  const editors = getAllEditors();
  const vars = editors
    .filter((ed) => ed.dataset.editorId !== "main")
    .map((ed) => ({
      id: ed.dataset.editorId,
      name: ed.dataset.editorName || "Variation",
    }));
  return { activeId: variationState.active || "main", variations: vars };
}
function getEditorStack() {
  return document.getElementById(EDITOR_STACK_ID);
}
function ensureEditorStack() {
  const main = document.getElementById("buildOrderInput");
  if (!main) return;
  let stack = document.getElementById(EDITOR_STACK_ID);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = EDITOR_STACK_ID;
    const parent = main.parentElement;
    if (parent) parent.insertBefore(stack, main);
    stack.appendChild(main);
    main.classList.add("bo-editor");
    main.dataset.editorId = "main";
    main.dataset.editorName = "Main";
    if (!main.__zboBound) {
      main.addEventListener("input", () => analyzeBuildOrder(main.value));
      main.__zboBound = true;
    }
    try {
      initializeTextareaClickHandler();
    } catch (_) {}
    try {
      import("./autoCorrect.js").then((m) => m.initializeAutoCorrect());
    } catch (_) {}
  }
}
function getAllEditors() {
  const stack = getEditorStack();
  if (!stack) return [];
  return Array.from(stack.querySelectorAll(".bo-editor"));
}
function getEditorById(id) {
  const stack = getEditorStack();
  if (!stack) return null;
  return stack.querySelector(`.bo-editor[data-editor-id="${id}"]`);
}
function createBranchAtIndex(index) {
  // Only from main
  if (variationState.active !== "main") return;
  const mainText = getMainText();
  const lines = splitLines(mainText);
  const prefix = lines.slice(0, index + 1).join("\n");
  const stack = getEditorStack();
  if (!stack) return;
  const nextIdx =
    getAllEditors().filter((ed) => ed.dataset.editorId !== "main").length + 1;
  const id = `var_${nextIdx}`;
  const name = `Variation ${nextIdx}`;
  const ta = document.createElement("textarea");
  ta.value = prefix;
  ta.className = "bo-editor";
  ta.dataset.editorId = id;
  ta.dataset.editorName = name;
  ta.style.display = "none";
  ta.addEventListener("input", () => analyzeBuildOrder(ta.value));
  stack.appendChild(ta);
  setActiveVariation(id);
  enableSaveButton();
  const saveBtn = document.getElementById("saveBuildButton");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.style.backgroundColor = "";
  }
}
function findPivotIndex(mainLines, varLines) {
  const max = Math.min(mainLines.length, varLines.length);
  let lastShared = -1;
  for (let i = 0; i < max; i++) {
    if (normalizeStep(mainLines[i]) === normalizeStep(varLines[i]))
      lastShared = i;
    else break;
  }
  return lastShared;
}
function normalizeStep(line) {
  return String(line || "")
    .trim()
    .toLowerCase();
}

// Sanitize variation names (limit 32 chars, collapse whitespace)
function sanitizeVarName(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim().slice(0, 32);
}

function ensureVariationHeader(table) {
  const headerRow = table.rows[0];
  if (!headerRow) return;
  // Remove any existing rails column so the table has only two columns
  for (let i = headerRow.cells.length - 1; i >= 0; i--) {
    const cell = headerRow.cells[i];
    if (cell && cell.classList && cell.classList.contains("var-col-header")) {
      headerRow.deleteCell(i);
    }
  }
  // Remove legacy branch button column if present
  const last = headerRow.cells[headerRow.cells.length - 1];
  if (last && last.classList.contains("var-branch-col-header")) {
    headerRow.deleteCell(headerRow.cells.length - 1);
  }
}

// --------- Branch selection (click a row to branch) ---------
let branchSelectActive = false;
let branchHintEl = null;
function startBranchSelectMode() {
  if (branchSelectActive) return;
  const table = document.getElementById("buildOrderTable");
  if (!table) return;
  branchSelectActive = true;
  document.body.classList.add("branch-select-mode");
  // Hint element that follows cursor
  branchHintEl = document.createElement("div");
  branchHintEl.className = "branch-select-hint";
  branchHintEl.textContent = "Select a row to create a branch";
  document.body.appendChild(branchHintEl);

  // Handlers
  const onMouseMove = (e) => {
    if (!branchSelectActive || !branchHintEl) return;
    branchHintEl.style.left = `${e.clientX + 12}px`;
    branchHintEl.style.top = `${e.clientY + 12}px`;
  };
  const onTableClick = (e) => {
    if (!branchSelectActive) return;
    const tr = e.target.closest("#buildOrderTable tr");
    if (!tr || tr.rowIndex === 0) return; // ignore header
    e.stopPropagation();
    const idx = tr.rowIndex - 1; // zero-based data row index
    try {
      createBranchAtIndex(idx);
    } catch (_) {}
    endBranchSelectMode();
  };
  const onDocClick = (e) => {
    if (!branchSelectActive) return;
    if (e.target.closest("#buildOrderTable")) return; // inside table
    endBranchSelectMode();
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") endBranchSelectMode();
  };

  // Save to table for cleanup
  table.__branch_onMouseMove = onMouseMove;
  table.__branch_onTableClick = onTableClick;
  table.__branch_onDocClick = onDocClick;
  table.__branch_onKeyDown = onKeyDown;

  document.addEventListener("mousemove", onMouseMove);
  table.addEventListener("click", onTableClick, true);
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onKeyDown);
}
function endBranchSelectMode() {
  if (!branchSelectActive) return;
  branchSelectActive = false;
  document.body.classList.remove("branch-select-mode");
  if (branchHintEl && branchHintEl.parentNode)
    branchHintEl.parentNode.removeChild(branchHintEl);
  branchHintEl = null;
  const table = document.getElementById("buildOrderTable");
  if (!table) return;
  document.removeEventListener("mousemove", table.__branch_onMouseMove);
  table.removeEventListener("click", table.__branch_onTableClick, true);
  document.removeEventListener("click", table.__branch_onDocClick, true);
  document.removeEventListener("keydown", table.__branch_onKeyDown);
  delete table.__branch_onMouseMove;
  delete table.__branch_onTableClick;
  delete table.__branch_onDocClick;
  delete table.__branch_onKeyDown;
}

// (Removed DSL-based parsing; variations are separate builds.)

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
  if (textarea.__zboClickBound) return;
  textarea.__zboClickBound = true;

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

  if (example.image) {
    return `
    <div class="example-block" id="${example.id}">
      <h4 class="example-subtitle">${example.title}</h4>
      <div class="example-flex">
        <img src="${example.image}" alt="${example.title} example" class="example-image" />
        <div class="example-right">
          <p class="example-description"><em>${example.description}</em></p>
        </div>
      </div>
    </div>
    <hr />
    `;
  }

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
  <div class="example-block" id="${example.id}">
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

function generateTableOfContents(items) {
  return `
    <p>Table of Contents:</p>
    <ul class="help-toc">
      ${items
        .map(
          (ex) =>
            `<li><a href="#${ex.id}" class="toc-link">${ex.title}</a></li>`
        )
        .join("")}
      <li><a href="#abbr-section" class="toc-link">Abbreviations Reference</a></li>
    </ul>
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
      id: "time-supply-format",
      title: "Time/Worker Supply Format",
      inputTime: "[01:10] Overlord",
      inputSupply: "[24] Hatchery",
      actionTime: "overlord",
      actionSupply: "hatchery",
      description:
        "This format showcases two types: one for time-based actions (e.g., [01:10] for timestamp) and one for supply-based actions (e.g., [24] for worker supply).",
    },
    {
      id: "completed-upgrade",
      title: "Completed Upgrade with Percent",
      input: "@100% stimpack push opponent third base",
      description:
        "Using <code><u>@100%</u>, <u>@100</u> or <u>100%</u></code> marks the action as fully completed and visually emphasizes the upgrade status.",
    },
    {
      id: "progress-indicator",
      title: "Progress Indicator",
      input: "75% hatchery",
      description:
        "Typing <code>75%</code> before a structure or unit marks it as partially built or in progress.",
    },
    {
      id: "resource-cost",
      title: "Resource Cost Notation",
      input: "100 gas, 150 minerals",
      description:
        "Typing gas or mineral amounts will format them into icons and place them next to the build action.",
    },
    {
      id: "map-markers",
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
    {
      id: "base-indicator",
      title: "Base Production Indicator",
      input: "queen (b1)",
      description:
        "Append <code>(b1)</code>, <code>(b2)</code>, and so on after a unit or structure to mark the base where it is produced.",
    },
    {
      id: "quick-typing",
      title: "Quick Typing",
      image: "./img/info/quick_typing.webp",
      description:
        "Press <kbd>Enter</kbd> while inside the brackets to automatically jump outside and continue typing the action.",
    },
  ];

  const manualHTML = generateTableOfContents(examples);

  const abbreviationGridHTML = `
    <h4 id="abbr-section">Abbreviations Reference:</h4>
    ${generateAbbrSection("Structures", abbreviationMap.Structures)}
    ${generateAbbrSection("Units", abbreviationMap.Units)}
    ${generateAbbrSection("Upgrades", abbreviationMap.Upgrades)}
  `;

  const examplesHeader = `<h4>Examples:</h4>`;

  contentDiv.innerHTML =
    manualHTML +
    examplesHeader +
    examples.map(createExample).join("") +
    `<hr />` +
    abbreviationGridHTML;

  modal.style.display = "block";
}

export function createNotificationDot() {
  const dot = document.createElement("div");
  dot.className = "notification-dot";
  return dot;
}

// ----- Variation Manager modal (rename + reorder)
function openVariationManager() {
  const vars = variationState.order.map((vid) => {
    const v = variationState.byId.get(vid);
    return {
      id: vid,
      name: v?.name || "Variation",
      color: v?.color || MAIN_COLOR,
    };
  });
  const overlay = document.createElement("div");
  overlay.className = "zbo-modal-overlay";
  const modal = document.createElement("div");
  modal.className = "zbo-modal";
  modal.innerHTML = `
    <div class="zbo-modal-header">
      <h3>Manage Variations</h3>
      <button class="zbo-close" aria-label="Close">×</button>
    </div>
    <div class="zbo-modal-body">
      <ul class="zbo-var-list" id="zboVarList"></ul>
    </div>
    <div class="zbo-modal-footer">
      <button class="zbo-btn" id="zboSaveVars">Save</button>
      <button class="zbo-btn ghost" id="zboCancelVars">Cancel</button>
    </div>`;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const list = modal.querySelector("#zboVarList");
  const toDelete = new Set();
  // Enable Save when editing names or order inside manager
  list.addEventListener("input", (e) => {
    if (e.target.classList && e.target.classList.contains("zbo-name"))
      enableSaveButton();
  });
  list.addEventListener("dragend", () => enableSaveButton());
  vars.forEach((v) => {
    const li = document.createElement("li");
    li.className = "zbo-var-item";
    li.draggable = false;
    li.dataset.varId = v.id;
    li.innerHTML = `\n      <span class="zbo-drag" draggable="true">≡</span>\n      <span class="zbo-color" style="background:${v.color}"></span>\n      <input type="text" class="zbo-name" maxlength="32" value="${v.name}">\n      <button type="button" class="zbo-remove" title="Remove" aria-label="Remove">×</button>\n    `;
    list.appendChild(li);
  });

  let dragEl = null;
  list.addEventListener("dragstart", (e) => {
    const handle = e.target.closest(".zbo-drag");
    if (!handle) {
      e.preventDefault();
      return;
    }
    dragEl = handle.closest(".zbo-var-item");
    e.dataTransfer.effectAllowed = "move";
  });
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const over = e.target.closest(".zbo-var-item");
    if (!over || over === dragEl) return;
    const rect = over.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    list.insertBefore(dragEl, before ? over : over.nextSibling);
  });

  // Remove row / mark for deletion
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".zbo-remove");
    if (!btn) return;
    const li = btn.closest(".zbo-var-item");
    if (!li) return;
    toDelete.add(li.dataset.varId);
    li.remove();
  });

  const close = () => {
    overlay.remove();
  };
  modal.querySelector(".zbo-close").onclick = close;
  modal.querySelector("#zboCancelVars").onclick = close;
  modal.querySelector("#zboSaveVars").onclick = () => {
    const items = Array.from(list.querySelectorAll(".zbo-var-item"));
    const newOrder = [];
    items.forEach((li) => {
      const id = li.dataset.varId;
      const name = sanitizeVarName(li.querySelector(".zbo-name").value);
      const ed = getEditorById(id);
      if (ed)
        ed.dataset.editorName = name || ed.dataset.editorName || "Variation";
      const vd = variationState.byId.get(id);
      if (vd) vd.name = name || vd.name;
      newOrder.push(id);
    });
    // Remove deleted editors from DOM
    const stack = getEditorStack();
    if (stack && toDelete.size) {
      toDelete.forEach((id) => {
        const ed = getEditorById(id);
        if (ed) ed.remove();
        // Also drop from in-memory state so they don't come back
        try { variationState.byId.delete(id); } catch (_) {}
      });
    }
    // Apply new order to state and editors DOM
    variationState.order = newOrder;
    // Ensure the preloaded fallback reflects the new order (or clears it)
    try {
      if (Array.isArray(window.zboPreloadedVariations)) {
        window.zboPreloadedVariations = newOrder.map((id) => {
          const vd = variationState.byId.get(id);
          const name = vd?.name || getEditorById(id)?.dataset?.editorName || "Variation";
          return { id, name };
        });
      }
    } catch (_) {}
    if (stack) {
      const map = new Map();
      getAllEditors().forEach((ed) => map.set(ed.dataset.editorId, ed));
      newOrder.forEach((id) => {
        const ed = map.get(id);
        if (ed) stack.appendChild(ed);
      });
    }
    // Rebuild tabs to reflect order immediately
    try {
      const store = loadEditorsStateFromDOM();
      renderVariationTabs(store);
    } catch {}
    enableSaveButton();
    try {
      analyzeBuildOrder(
        getEditorById(variationState.active || "main")?.value || getMainText()
      );
    } catch (_) {}
    close();
  };
}
