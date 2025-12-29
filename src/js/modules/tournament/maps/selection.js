import { renderMapPoolPicker as renderMapPoolPickerUI } from "./pool.js";
import { renderChosenMaps as renderChosenMapsUI } from "./render.js";

export function setMapPoolSelection(
  names,
  {
    setMapPoolSelectionState,
    setCurrentMapPoolModeState,
    mapPoolSelection,
    getDefaultMapPoolNames,
    getMapByName,
    getAll1v1Maps,
    updateMapButtonsUI,
  }
) {
  setMapPoolSelectionState(new Set((names || []).filter(Boolean)));
  setCurrentMapPoolModeState(
    isDefaultLadderSelection(mapPoolSelection, getDefaultMapPoolNames)
      ? "ladder"
      : "custom"
  );
  renderMapPoolPickerUI("mapPoolPicker", { mapPoolSelection, getAll1v1Maps });
  renderMapPoolPickerUI("settingsMapPoolPicker", {
    mapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  renderChosenMapsUI("settingsChosenMapList", {
    mapPoolSelection,
    getMapByName,
  });
  updateMapButtonsUI(
    isDefaultLadderSelection(mapPoolSelection, getDefaultMapPoolNames)
      ? "ladder"
      : "custom"
  );
}

export function toggleMapSelection(
  name,
  {
    mapPoolSelection,
    setCurrentMapPoolModeState,
    getDefaultMapPoolNames,
    getAll1v1Maps,
    getMapByName,
    renderMapPoolPicker,
    renderChosenMapsUI,
    updateMapButtonsUI,
  }
) {
  if (!name) return;
  if (mapPoolSelection.has(name)) {
    mapPoolSelection.delete(name);
  } else {
    mapPoolSelection.add(name);
  }
  setCurrentMapPoolModeState(
    isDefaultLadderSelection(mapPoolSelection, getDefaultMapPoolNames)
      ? "ladder"
      : "custom"
  );
  renderMapPoolPicker("mapPoolPicker", { mapPoolSelection, getAll1v1Maps });
  renderMapPoolPicker("settingsMapPoolPicker", {
    mapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  renderChosenMapsUI("settingsChosenMapList", {
    mapPoolSelection,
    getMapByName,
  });
  updateMapButtonsUI(
    isDefaultLadderSelection(mapPoolSelection, getDefaultMapPoolNames)
      ? "ladder"
      : "custom"
  );
}

export function isDefaultLadderSelection(mapPoolSelection, getDefaultMapPoolNames) {
  const defaults = getDefaultMapPoolNames();
  if (defaults.length !== mapPoolSelection.size) return false;
  return defaults.every((name) => mapPoolSelection.has(name));
}
