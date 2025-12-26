let finalMapPoolSelection = new Set();
let finalMapPoolMode = "ladder";
let deps = null;

export function configureFinalMapPool(nextDeps) {
  deps = nextDeps || null;
}

function ensureDeps() {
  if (!deps) {
    throw new Error("Final map pool dependencies not configured.");
  }
}

function updateFinalMapButtons() {
  const ladderBtn = document.getElementById("finalUseLadderMapsBtn");
  const customBtn = document.getElementById("finalClearMapPoolBtn");
  const isLadder = finalMapPoolMode === "ladder";
  ladderBtn?.classList.toggle("active", isLadder);
  customBtn?.classList.toggle("active", !isLadder);
}

function renderFinalMapPoolSelection() {
  ensureDeps();
  const { getAll1v1Maps, getMapByName, renderMapPoolPickerUI, renderChosenMapsUI } = deps;
  renderMapPoolPickerUI("finalMapPoolPicker", {
    mapPoolSelection: finalMapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("finalChosenMapList", {
    mapPoolSelection: finalMapPoolSelection,
    getMapByName,
  });
  updateFinalMapButtons();
}

export function setFinalMapPoolSelection(names) {
  ensureDeps();
  const { getDefaultMapPoolNames, isDefaultLadderSelection } = deps;
  finalMapPoolSelection = new Set((names || []).filter(Boolean));
  finalMapPoolMode = isDefaultLadderSelection(finalMapPoolSelection, getDefaultMapPoolNames)
    ? "ladder"
    : "custom";
  renderFinalMapPoolSelection();
}

export function toggleFinalMapSelection(name) {
  ensureDeps();
  const { getDefaultMapPoolNames, isDefaultLadderSelection } = deps;
  if (!name) return;
  if (finalMapPoolSelection.has(name)) {
    finalMapPoolSelection.delete(name);
  } else {
    finalMapPoolSelection.add(name);
  }
  finalMapPoolMode = isDefaultLadderSelection(finalMapPoolSelection, getDefaultMapPoolNames)
    ? "ladder"
    : "custom";
  renderFinalMapPoolSelection();
}

export function resetFinalMapPoolSelection() {
  ensureDeps();
  setFinalMapPoolSelection(deps.getDefaultMapPoolNames());
}

export function getFinalMapPoolSelection() {
  return new Set(finalMapPoolSelection);
}
