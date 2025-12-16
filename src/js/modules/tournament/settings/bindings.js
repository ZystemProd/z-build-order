export function bindSettingsEvents({
  applyFormatting,
  setMapPoolSelection,
  getDefaultMapPoolNames,
  toggleMapSelection,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  syncFormatFieldVisibility,
  handleSaveSettings,
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

  settingsFormatSelect?.addEventListener("change", () =>
    syncFormatFieldVisibility("settings")
  );

  saveSettingsBtn?.addEventListener("click", handleSaveSettings);
}
