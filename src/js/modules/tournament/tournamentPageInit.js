import { bindMapSelectionEvents } from "./maps/bindings.js";
import { bindSettingsEvents } from "./settings/bindings.js";
import {
  openVetoModal,
  renderVetoPoolGrid,
  renderVetoSelectionList,
  renderVetoStatus,
  handleVetoPoolClick,
  hideVetoModal,
  saveVetoSelection,
  showVetoInfo,
  attachMatchActionHandlers,
  setVetoDependencies,
} from "./maps/veto.js";
import { renderChosenMaps as renderChosenMapsUI, updateMapButtons as updateMapButtonsUI } from "./maps/render.js";
import { renderMapPoolPicker as renderMapPoolPickerUI } from "./maps/pool.js";
import { attachPlayerDetailHandlers } from "./playerDetail.js";
import { ensureTestHarnessPanel } from "./ui/testHarness.js";
import { enableDragScroll } from "./ui/dragScroll.js";
import { initUserSettingsModal } from "../settingsModalInit.js";

export function initTournamentPage({
  handleRegistration,
  handleCreateTournament,
  handleSaveSettings,
  rebuildBracket,
  setSeedingNotice,
  autoFillPlayers,
  normalizeRaceLabel,
  mmrForRace,
  updateMmrDisplay,
  switchTab,
  populateCreateForm,
  generateUniqueSlug,
  validateSlug,
  updateSlugPreview,
  renderTournamentList,
  syncFormatFieldVisibility,
  applyFormattingInline,
  setMapPoolSelection,
  getDefaultMapPoolNames,
  toggleMapSelection,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  getPlayersMap,
  getMapByName,
  renderMarkdown,
  mapPoolSelection,
  getAll1v1Maps,
  currentMapPoolMode,
  updatePlayerPoints,
  removePlayer,
  updateMatchScore,
  saveState,
  setTestBracketCount,
  cycleTestBracketCount,
  resetTournament,
  checkInCurrentPlayer,
  removeNotCheckedInPlayers,
  goLiveTournament,
}) {
  ensureTestHarnessPanel();
  initUserSettingsModal();

  const registrationForm = document.getElementById("registrationForm");
  const rebuildBtn = document.getElementById("rebuildBracketBtn");
  const resetBtn = document.getElementById("resetTournamentBtn");
  const removeNotCheckedInBtn = document.getElementById("removeNotCheckedInBtn");
  const jumpToRegistration = document.getElementById("jumpToRegistration");
  const jumpToBracket = document.getElementById("jumpToBracket");
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const autoFillBtn = document.getElementById("autoFillBtn");
  const checkInBtn = document.getElementById("checkInBtn");
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const switchAccountBtn = document.getElementById("switchAccountBtn");
  const raceSelect = document.getElementById("raceSelect");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const openCreateTournament = document.getElementById("openCreateTournament");
  const createModal = document.getElementById("createTournamentModal");
  const closeCreateTournament = document.getElementById("closeCreateTournament");
  const saveTournamentBtn = document.getElementById("saveTournamentBtn");
  const refreshTournaments = document.getElementById("refreshTournaments");
  const generateSlugBtn = document.getElementById("generateSlugBtn");
  const testBracketStartBtn = document.getElementById("testBracketStart");
  const testBracketPrevBtn = document.getElementById("testBracketPrev");
  const testBracketNextBtn = document.getElementById("testBracketNext");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const descToolbarBtns = document.querySelectorAll("[data-desc-action]");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const rulesToolbarBtns = document.querySelectorAll("[data-rules-action]");
  const mapPoolPicker = document.getElementById("mapPoolPicker");
  const useLadderMapsBtn = document.getElementById("useLadderMapsBtn");
  const clearMapPoolBtn = document.getElementById("clearMapPoolBtn");
  const settingsTabBtns = document.querySelectorAll("[data-settings-tab]");
  const settingsPanels = document.querySelectorAll("#settingsTab .settings-panel");
  const createTabBtns = document.querySelectorAll("[data-create-tab]");
  const createPanels = document.querySelectorAll("#createTournamentModal .settings-panel");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const settingsDescToolbarBtns = document.querySelectorAll("[data-settings-desc-action]");
  const settingsRulesToolbarBtns = document.querySelectorAll("[data-settings-rules-action]");
  const createImageInput = document.getElementById("tournamentImageInput");
  const createImagePreview = document.getElementById("tournamentImagePreview");
  const settingsImageInput = document.getElementById("settingsImageInput");
  const settingsImagePreview = document.getElementById("settingsImagePreview");
  const slugInput = document.getElementById("tournamentSlugInput");
  const bestOfUpperInput = document.getElementById("bestOfUpperInput");
  const bestOfLowerInput = document.getElementById("bestOfLowerInput");
  const bestOfQuarterInput = document.getElementById("bestOfQuarterInput");
  const bestOfSemiInput = document.getElementById("bestOfSemiInput");
  const bestOfFinalInput = document.getElementById("bestOfFinalInput");
  const createFormatSelect = document.getElementById("tournamentFormatSelect");
  const settingsBestOfUpper = document.getElementById("settingsBestOfUpper");
  const settingsBestOfLower = document.getElementById("settingsBestOfLower");
  const settingsBestOfQuarter = document.getElementById("settingsBestOfQuarter");
  const settingsBestOfSemi = document.getElementById("settingsBestOfSemi");
  const settingsBestOfFinal = document.getElementById("settingsBestOfFinal");
  const settingsFormatSelect = document.getElementById("settingsFormatSelect");
  const vetoModal = document.getElementById("vetoModal");
  const closeVetoModal = document.getElementById("closeVetoModal");
  const saveVetoBtn = document.getElementById("saveVetoBtn");

  const bindImagePreview = (inputEl, previewEl) => {
    if (!inputEl || !previewEl) return;
    inputEl.addEventListener("change", () => {
      const file = inputEl.files?.[0] || null;
      if (!file) {
        if (previewEl.dataset.tempPreview) {
          try {
            URL.revokeObjectURL(previewEl.dataset.tempPreview);
          } catch (_) {}
          previewEl.removeAttribute("src");
          previewEl.style.display = "none";
          delete previewEl.dataset.tempPreview;
        }
        return;
      }
      const url = URL.createObjectURL(file);
      if (previewEl.dataset.tempPreview) {
        try {
          URL.revokeObjectURL(previewEl.dataset.tempPreview);
        } catch (_) {}
      }
      previewEl.src = url;
      previewEl.style.display = "block";
      previewEl.dataset.tempPreview = url;
    });
  };

  registrationForm?.addEventListener("submit", handleRegistration);
  rebuildBtn?.addEventListener("click", () => goLiveTournament?.());
  removeNotCheckedInBtn?.addEventListener("click", () => removeNotCheckedInPlayers?.());
  resetBtn?.addEventListener("click", () => {
    resetTournament?.();
  });
  autoFillBtn?.addEventListener("click", autoFillPlayers);
  checkInBtn?.addEventListener("click", () => checkInCurrentPlayer?.());

  signInBtn?.addEventListener("click", () => window.handleSignIn?.());
  signOutBtn?.addEventListener("click", () => window.handleSignOut?.());
  switchAccountBtn?.addEventListener("click", () => window.handleSwitchAccount?.());
  raceSelect?.addEventListener("change", () => {
    const statusEl = document.getElementById("mmrStatus");
    const normalizedRace = normalizeRaceLabel(raceSelect.value);
    updateMmrDisplay(statusEl, normalizedRace ? mmrForRace(normalizedRace) : null);
  });
  openRegisterBtn?.addEventListener("click", () => {
    switchTab("registrationTab");
    document.getElementById("registrationCard")?.scrollIntoView({ behavior: "smooth" });
  });

  openCreateTournament?.addEventListener("click", async () => {
    await populateCreateForm();
    if (createModal) createModal.style.display = "flex";
  });
  closeCreateTournament?.addEventListener("click", () => {
    if (createModal) createModal.style.display = "none";
  });
  window.addEventListener("mousedown", (e) => {
    if (createModal && createModal.style.display === "flex" && e.target === createModal) {
      createModal.style.display = "none";
    }
  });
  saveTournamentBtn?.addEventListener("click", handleCreateTournament || handleRegistration);
  refreshTournaments?.addEventListener("click", () => renderTournamentList());
  generateSlugBtn?.addEventListener("click", async () => {
    const input = document.getElementById("tournamentSlugInput");
    if (input) input.value = await generateUniqueSlug();
    await validateSlug();
    updateSlugPreview();
  });
  slugInput?.addEventListener("input", () => updateSlugPreview());

  createTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.createTab;
      if (!target) return;
      createTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      createPanels.forEach((panel) => panel.classList.toggle("active", panel.id === target));
    });
  });
  settingsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.settingsTab;
      if (!target) return;
      settingsTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      settingsPanels.forEach((panel) => panel.classList.toggle("active", panel.id === target));
    });
  });

  descriptionInput?.addEventListener("input", () => {
    const preview = document.getElementById("tournamentDescriptionPreview");
    if (!preview) return;
    preview.innerHTML = renderMarkdown(descriptionInput.value || "");
  });
  rulesInput?.addEventListener("input", () => {
    const preview = document.getElementById("tournamentRulesPreview");
    if (!preview) return;
    preview.innerHTML = renderMarkdown(rulesInput.value || "");
  });
  descToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormattingInline(btn.dataset.descAction, "tournamentDescriptionInput")
    );
  });
  rulesToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormattingInline(btn.dataset.rulesAction, "tournamentRulesInput")
    );
  });
  bindImagePreview(createImageInput, createImagePreview);
  bindImagePreview(settingsImageInput, settingsImagePreview);

  bindMapSelectionEvents({
    setMapPoolSelection,
    getDefaultMapPoolNames,
    toggleMapSelection,
  });
  bindSettingsEvents({
    applyFormatting: applyFormattingInline,
    setMapPoolSelection,
    getDefaultMapPoolNames,
    toggleMapSelection,
    updateSettingsDescriptionPreview,
    updateSettingsRulesPreview,
    syncFormatFieldVisibility,
    handleSaveSettings,
  });

  [
    bestOfUpperInput,
    bestOfLowerInput,
    bestOfQuarterInput,
    bestOfSemiInput,
    bestOfFinalInput,
    settingsBestOfUpper,
    settingsBestOfLower,
    settingsBestOfQuarter,
    settingsBestOfSemi,
    settingsBestOfFinal,
  ].forEach((el) => el?.addEventListener("input", () => {}));

  createFormatSelect?.addEventListener("change", () => syncFormatFieldVisibility("create"));
  settingsFormatSelect?.addEventListener("change", () => syncFormatFieldVisibility("settings"));
  closeVetoModal?.addEventListener("click", () => hideVetoModal());
  saveVetoBtn?.addEventListener("click", () => saveVetoSelection());

  jumpToRegistration?.addEventListener("click", () => {
    switchTab("registrationTab");
    document.getElementById("registrationCard")?.scrollIntoView({ behavior: "smooth" });
  });
  jumpToBracket?.addEventListener("click", () => {
    switchTab("bracketTab");
    document.getElementById("bracketGrid")?.scrollIntoView({ behavior: "smooth" });
  });

  enableDragScroll(bracketGrid, {
    ignoreSelector:
      'a, button, input, select, textarea, label, summary, details, [contenteditable="true"], [data-no-drag], .name-text:not(.is-placeholder), .hover-info-container, .score-select, .row-actions',
  });

  playersTable?.addEventListener("change", (e) => {
    if (e.target.matches(".points-input")) {
      const id = e.target.dataset.playerId;
      const raw = e.target.value;
      const value = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
      if (raw === "") e.target.value = String(value);
      updatePlayerPoints?.(id, value);
    }
  });
  playersTable?.addEventListener("click", (e) => {
    if (e.target.matches(".remove-player")) {
      const id = e.target.dataset.playerId;
      removePlayer?.(id);
    }
  });

  bracketGrid?.addEventListener("change", (e) => {
    if (e.target.matches(".score-select")) {
      const matchId = e.target.dataset.matchId;
      if (!matchId) return;
      const selects = document.querySelectorAll(`.score-select[data-match-id="${matchId}"]`);
      const vals = Array.from(selects).map((s) => s.value || "0");
      updateMatchScore?.(matchId, vals[0], vals[1]);
    }
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll("#tournamentListTabs .list-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#tournamentListTabs .list-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTournamentList();
    });
  });
  // Ensure "Open tournaments" is active on load and render list once
  const defaultTab = document.querySelector(
    '#tournamentListTabs .list-tab[data-list-filter="open"]'
  );
  if (defaultTab) {
    document
      .querySelectorAll("#tournamentListTabs .list-tab")
      .forEach((b) => b.classList.remove("active"));
    defaultTab.classList.add("active");
  }
  renderTournamentList();

  attachPlayerDetailHandlers({ getPlayersMap });
  renderMapPoolPickerUI("mapPoolPicker", {
    mapPoolSelection: mapPoolSelection || new Set(),
    getAll1v1Maps: getAll1v1Maps || (() => []),
  });
  renderMapPoolPickerUI("settingsMapPoolPicker", {
    mapPoolSelection: mapPoolSelection || new Set(),
    getAll1v1Maps: getAll1v1Maps || (() => []),
  });
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  renderChosenMapsUI("settingsChosenMapList", {
    mapPoolSelection: mapPoolSelection,
    getMapByName,
  });
  updateMapButtonsUI(currentMapPoolMode);
  setVetoDependencies({
    getPlayersMap,
    getDefaultMapPoolNames,
    getMapByName,
    updateMatchScore,
    saveState,
  });

  // Wire test harness buttons if callbacks provided
  document
    .getElementById("testBracketStart")
    ?.addEventListener("click", () => setTestBracketCount?.(16));
  document
    .getElementById("testBracketStart32")
    ?.addEventListener("click", () => setTestBracketCount?.(32));
  document
    .getElementById("testBracketPrev")
    ?.addEventListener("click", () => cycleTestBracketCount?.(-1));
  document
    .getElementById("testBracketNext")
    ?.addEventListener("click", () => cycleTestBracketCount?.(1));

  syncFormatFieldVisibility("create");
  syncFormatFieldVisibility("settings");
}
