export function bindSettingsEvents({
  applyFormatting,
  setMapPoolSelection,
  getDefaultMapPoolNames,
  toggleMapSelection,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  syncFormatFieldVisibility,
  handleSaveSettings,
  handleAddCircuitPointsRow,
  handleRemoveCircuitPointsRow,
  handleApplyCircuitPoints,
}) {
  const settingsDescToolbarBtns = document.querySelectorAll(
    "[data-settings-desc-action]"
  );
  const settingsRulesToolbarBtns = document.querySelectorAll(
    "[data-settings-rules-action]"
  );
  const settingsDescInput = document.getElementById("settingsDescriptionInput");
  const settingsRulesInput = document.getElementById("settingsRulesInput");
  const settingsUseLadderMapsBtn = document.getElementById(
    "settingsUseLadderMapsBtn"
  );
  const settingsFormatSelect = document.getElementById("settingsFormatSelect");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const addCircuitPointsRowBtn = document.getElementById("addCircuitPointsRow");
  const applyCircuitPointsBtn = document.getElementById("applyCircuitPointsBtn");
  const circuitPointsBody = document.getElementById("circuitPointsBody");

  settingsDescToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormatting(
        btn.dataset.settingsDescAction,
        "settingsDescriptionInput"
      )
    );
  });
  settingsRulesToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormatting(btn.dataset.settingsRulesAction, "settingsRulesInput")
    );
  });

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
  circuitPointsBody?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-circuit-remove='true']");
    if (!target) return;
    handleRemoveCircuitPointsRow?.(event);
  });
}
