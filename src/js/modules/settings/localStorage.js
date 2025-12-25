const SETTINGS_STORAGE_KEYS = {
  bracket: "enableBracketInput",
  buildInput: "showBuildInput",
  mainClan: "mainClanId",
};

function applySettingsToLocalStorage(settings = {}) {
  if (!settings || typeof settings !== "object") return;
  if (settings.enableBracketInput !== undefined) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEYS.bracket,
      settings.enableBracketInput ? "true" : "false"
    );
  }
  if (settings.showBuildInput !== undefined) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEYS.buildInput,
      settings.showBuildInput ? "true" : "false"
    );
  }
  if (settings.mainClanId !== undefined) {
    if (settings.mainClanId) {
      localStorage.setItem(SETTINGS_STORAGE_KEYS.mainClan, settings.mainClanId);
    } else {
      localStorage.removeItem(SETTINGS_STORAGE_KEYS.mainClan);
    }
  }
}

export { applySettingsToLocalStorage };
