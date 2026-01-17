export function bindSettingsEvents({
  setMapPoolSelection,
  getDefaultMapPoolNames,
  toggleMapSelection,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  syncFormatFieldVisibility,
  handleSaveSettings,
  handleAddCircuitPointsRow,
  handleRemoveCircuitPointsRow,
  handleCircuitPointsChange,
  handleEditCircuitPoints,
  handleSaveCircuitPoints,
  handleApplyCircuitPoints,
}) {
  const settingsDescInput = document.getElementById("settingsDescriptionInput");
  const settingsRulesInput = document.getElementById("settingsRulesInput");
  const settingsUseLadderMapsBtn = document.getElementById(
    "settingsUseLadderMapsBtn"
  );
  const settingsFormatSelect = document.getElementById("settingsFormatSelect");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const addCircuitPointsRowBtn = document.getElementById("addCircuitPointsRow");
  const applyCircuitPointsBtn = document.getElementById("applyCircuitPointsBtn");
  const editCircuitPointsBtn = document.getElementById("editCircuitPointsBtn");
  const saveCircuitPointsBtn = document.getElementById(
    "saveTournamentCircuitPointsBtn"
  );
  const circuitPointsBody = document.getElementById("circuitPointsBody");

  settingsDescInput?.addEventListener(
    "input",
    updateSettingsDescriptionPreview
  );
  settingsRulesInput?.addEventListener("input", updateSettingsRulesPreview);

  settingsFormatSelect?.addEventListener("change", () => {
    try {
      localStorage.setItem("zboSettingsFormat", settingsFormatSelect.value || "");
    } catch (_) {
      // ignore storage errors
    }
    syncFormatFieldVisibility("settings");
  });

  saveSettingsBtn?.addEventListener("click", handleSaveSettings);
  addCircuitPointsRowBtn?.addEventListener("click", handleAddCircuitPointsRow);
  applyCircuitPointsBtn?.addEventListener("click", handleApplyCircuitPoints);
  editCircuitPointsBtn?.addEventListener("click", handleEditCircuitPoints);
  saveCircuitPointsBtn?.addEventListener("click", handleSaveCircuitPoints);
  circuitPointsBody?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-circuit-remove='true']");
    if (!target) return;
    handleRemoveCircuitPointsRow?.(event);
  });
  circuitPointsBody?.addEventListener("change", (event) => {
    handleCircuitPointsChange?.(event);
  });
  circuitPointsBody?.addEventListener("input", (event) => {
    handleCircuitPointsChange?.(event);
  });
}
