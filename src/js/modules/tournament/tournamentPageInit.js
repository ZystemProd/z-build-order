import { bindMapSelectionEvents } from "./maps/bindings.js";
import { bindSettingsEvents } from "./settings/bindings.js";
import {
  openVetoModal,
  renderVetoPoolGrid,
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
import { lockBodyScroll, unlockBodyScroll } from "./modalLock.js";
import { initTournamentNotifications } from "./notifications.js";
import { initTournamentTemplateManager } from "./templateManager.js";

export function initTournamentPage({
  handleRegistration,
  handleCreateTournament,
  handleCreateCircuit,
  openCircuitTournamentModal,
  openDeleteTournamentModal,
  confirmDeleteTournament,
  closeDeleteTournamentModal,
  handleSaveSettings,
  rebuildBracket,
  setSeedingNotice,
  autoFillPlayers,
  normalizeRaceLabel,
  mmrForRace,
  updateMmrDisplay,
  switchTab,
  populateCreateForm,
  populateCreateCircuitForm,
  generateUniqueSlug,
  generateCircuitSlug,
  validateSlug,
  updateSlugPreview,
  updateCircuitSlugPreview,
  updateFinalSlugPreview,
  renderTournamentList,
  refreshCircuitView,
  syncFormatFieldVisibility,
  applyFormattingInline,
  setMapPoolSelection,
  getDefaultMapPoolNames,
  toggleMapSelection,
  setFinalMapPoolSelection,
  toggleFinalMapSelection,
  resetFinalMapPoolSelection,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  getPlayersMap,
  getMapByName,
  renderMarkdown,
  mapPoolSelection,
  getAll1v1Maps,
  currentMapPoolMode,
  updatePlayerPoints,
  setPlayerCheckIn,
  removePlayer,
  updateMatchScore,
  saveState,
  handleAddCircuitPointsRow,
  handleRemoveCircuitPointsRow,
  handleApplyCircuitPoints,
  setTestBracketCount,
  cycleTestBracketCount,
  resetTournament,
  checkInCurrentPlayer,
  notifyCheckInPlayers,
  goLiveTournament,
}) {
  ensureTestHarnessPanel();
  initTournamentNotifications();

  const registrationForm = document.getElementById("registrationForm");
  const rebuildBtn = document.getElementById("rebuildBracketBtn");
  const resetBtn = document.getElementById("resetTournamentBtn");
  const notifyCheckInBtn = document.getElementById("notifyCheckInBtn");
  const jumpToRegistration = document.getElementById("jumpToRegistration");
  const jumpToBracket = document.getElementById("jumpToBracket");
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const autoFillBtn = document.getElementById("autoFillBtn");
  const checkInBtn = document.getElementById("checkInBtn");
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const switchAccountBtn = document.getElementById("switchAccountBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const raceSelect = document.getElementById("raceSelect");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const openCreateTournament = document.getElementById("openCreateTournament");
  const createModal = document.getElementById("createTournamentModal");
  const closeCreateTournament = document.getElementById("closeCreateTournament");
  const saveTournamentBtn = document.getElementById("saveTournamentBtn");
  const openCreateCircuitTournament = document.getElementById("openCreateCircuitTournament");
  const deleteTournamentBtn = document.getElementById("deleteTournamentBtn");
  const confirmDeleteTournamentBtn = document.getElementById("confirmDeleteTournamentBtn");
  const cancelDeleteTournamentBtn = document.getElementById("cancelDeleteTournamentBtn");
  const deleteTournamentModal = document.getElementById("confirmDeleteTournamentModal");
  const openCreateCircuit = document.getElementById("openCreateCircuit");
  const createCircuitModal = document.getElementById("createCircuitModal");
  const closeCreateCircuit = document.getElementById("closeCreateCircuit");
  const saveCircuitBtn = document.getElementById("saveCircuitBtn");
  const nextCreateCircuitStep = document.getElementById("nextCreateCircuitStep");
  const backCreateCircuitStep = document.getElementById("backCreateCircuitStep");
  const refreshTournaments = document.getElementById("refreshTournaments");
  const generateSlugBtn = document.getElementById("generateSlugBtn");
  const generateCircuitSlugBtn = document.getElementById("generateCircuitSlugBtn");
  const testBracketStartBtn = document.getElementById("testBracketStart");
  const testBracketPrevBtn = document.getElementById("testBracketPrev");
  const testBracketNextBtn = document.getElementById("testBracketNext");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const descToolbarBtns = document.querySelectorAll("[data-desc-action]");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const rulesToolbarBtns = document.querySelectorAll("[data-rules-action]");
  const finalDescriptionInput = document.getElementById("finalTournamentDescriptionInput");
  const finalDescToolbarBtns = document.querySelectorAll("[data-final-desc-action]");
  const finalRulesInput = document.getElementById("finalTournamentRulesInput");
  const finalRulesToolbarBtns = document.querySelectorAll("[data-final-rules-action]");
  const mapPoolPicker = document.getElementById("mapPoolPicker");
  const useLadderMapsBtn = document.getElementById("useLadderMapsBtn");
  const clearMapPoolBtn = document.getElementById("clearMapPoolBtn");
  const finalMapPoolPicker = document.getElementById("finalMapPoolPicker");
  const finalUseLadderMapsBtn = document.getElementById("finalUseLadderMapsBtn");
  const finalClearMapPoolBtn = document.getElementById("finalClearMapPoolBtn");
  const settingsTabBtns = document.querySelectorAll("[data-settings-tab]");
  const settingsPanels = document.querySelectorAll("#settingsTab .settings-panel");
  const createTabBtns = document.querySelectorAll("[data-create-tab]");
  const createPanels = document.querySelectorAll("#createTournamentModal .settings-panel");
  const createFinalTabBtns = document.querySelectorAll("[data-final-create-tab]");
  const createFinalPanels = document.querySelectorAll("#createFinalPanel .create-final-panel");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const settingsDescToolbarBtns = document.querySelectorAll("[data-settings-desc-action]");
  const settingsRulesToolbarBtns = document.querySelectorAll("[data-settings-rules-action]");
  const createImageInput = document.getElementById("tournamentImageInput");
  const createImagePreview = document.getElementById("tournamentImagePreview");
  const finalImageInput = document.getElementById("finalTournamentImageInput");
  const finalImagePreview = document.getElementById("finalTournamentImagePreview");
  const settingsImageInput = document.getElementById("settingsImageInput");
  const settingsImagePreview = document.getElementById("settingsImagePreview");
  const nameInput = document.getElementById("tournamentNameInput");
  const slugInput = document.getElementById("tournamentSlugInput");
  const circuitSlugInput = document.getElementById("circuitSlugInput");
  const finalSlugInput = document.getElementById("finalTournamentSlugInput");
  const finalNameInput = document.getElementById("finalTournamentNameInput");
  const generateFinalSlugBtn = document.getElementById("generateFinalSlugBtn");
  const bestOfUpperInput = document.getElementById("bestOfUpperInput");
  const bestOfLowerInput = document.getElementById("bestOfLowerInput");
  const bestOfLowerSemiInput = document.getElementById("bestOfLowerSemiInput");
  const bestOfLowerFinalInput = document.getElementById("bestOfLowerFinalInput");
  const bestOfQuarterInput = document.getElementById("bestOfQuarterInput");
  const bestOfSemiInput = document.getElementById("bestOfSemiInput");
  const bestOfFinalInput = document.getElementById("bestOfFinalInput");
  const createFormatSelect = document.getElementById("tournamentFormatSelect");
  const finalFormatSelect = document.getElementById("finalFormatSelect");
  const settingsBestOfUpper = document.getElementById("settingsBestOfUpper");
  const settingsBestOfLower = document.getElementById("settingsBestOfLower");
  const settingsBestOfQuarter = document.getElementById("settingsBestOfQuarter");
  const settingsBestOfSemi = document.getElementById("settingsBestOfSemi");
  const settingsBestOfFinal = document.getElementById("settingsBestOfFinal");
  const settingsFormatSelect = document.getElementById("settingsFormatSelect");
  const showClanModalButton = document.getElementById("showClanModalButton");
  const vetoModal = document.getElementById("vetoModal");
  const closeVetoModal = document.getElementById("closeVetoModal");
  const saveVetoBtn = document.getElementById("saveVetoBtn");
  const refreshCircuitBtn = document.getElementById("refreshCircuitBtn");

  const setModalVisible = (modal, visible, display = "flex") => {
    if (!modal) return;
    modal.style.display = visible ? display : "none";
    if (visible) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
  };


  const initDatePickers = () => {
    if (typeof window.flatpickr !== "function") return;
    const options = {
      enableTime: true,
      time_24hr: true,
      allowInput: true,
      dateFormat: "Y-m-d\\TH:i",
      disableMobile: true,
    };
    const ensurePicker = (input) => {
      if (!input || input._flatpickr) return input?._flatpickr || null;
      if (typeof window.flatpickr !== "function") return null;
      return window.flatpickr(input, options);
    };
    const inputs = [
      document.getElementById("tournamentStartInput"),
      document.getElementById("finalTournamentStartInput"),
      document.getElementById("settingsStartInput"),
    ];
    inputs.forEach((input) => {
      ensurePicker(input);
    });

    document.querySelectorAll("[data-datepicker-for]").forEach((button) => {
      const targetId = button.dataset.datepickerFor;
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      button.addEventListener("click", () => {
        const picker = ensurePicker(target);
        if (picker) picker.open();
        else target.focus();
      });
    });
  };

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

  const templateManager = initTournamentTemplateManager({
    mapPoolSelection,
    setMapPoolSelection,
    setModalVisible,
  });

  registrationForm?.addEventListener("submit", handleRegistration);

  initDatePickers();
  rebuildBtn?.addEventListener("click", () => goLiveTournament?.());
  resetBtn?.addEventListener("click", () => {
    resetTournament?.();
  });
  autoFillBtn?.addEventListener("click", autoFillPlayers);
  checkInBtn?.addEventListener("click", () => checkInCurrentPlayer?.());
  notifyCheckInBtn?.addEventListener("click", () => notifyCheckInPlayers?.());

  signInBtn?.addEventListener("click", () => window.handleSignIn?.());
  signOutBtn?.addEventListener("click", () => window.handleSignOut?.());
  switchAccountBtn?.addEventListener("click", () => window.handleSwitchAccount?.());
  settingsBtn?.addEventListener("click", async () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    const mod = await import("../settingsModalInit.js");
    if (typeof mod.openSettingsModal === "function") {
      await mod.openSettingsModal();
    } else if (typeof mod.initUserSettingsModal === "function") {
      mod.initUserSettingsModal();
      const modal = document.getElementById("settingsModal");
      if (modal) modal.style.display = "block";
    }
  });
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
    templateManager?.ensureCreateModalHome();
    templateManager?.setTemplateManagerMode(false);
    templateManager?.refreshTemplateUI();
    setModalVisible(createModal, true);
  });
  closeCreateTournament?.addEventListener("click", () => {
    if (templateManager?.isTemplateManagerOpen?.()) {
      templateManager.closeTemplateManager(false);
      return;
    }
    setModalVisible(createModal, false);
  });
  window.addEventListener("mousedown", (e) => {
    if (createModal && createModal.style.display === "flex" && e.target === createModal) {
      setModalVisible(createModal, false);
    }
  });
  saveTournamentBtn?.addEventListener("click", handleCreateTournament || handleRegistration);
  refreshTournaments?.addEventListener("click", () => renderTournamentList());
  let slugAutoTimer = null;
  const queueSlugFromName = () => {
    if (!nameInput || !slugInput || !generateUniqueSlug) return;
    const shouldAuto =
      !slugInput.value || slugInput.dataset.auto === "true";
    if (!shouldAuto) return;
    const nameValue = nameInput.value || "";
    if (!nameValue.trim()) {
      slugInput.value = "";
      slugInput.dataset.auto = "true";
      updateSlugPreview();
      return;
    }
    if (slugAutoTimer) window.clearTimeout(slugAutoTimer);
    slugAutoTimer = window.setTimeout(async () => {
      const nextSlug = await generateUniqueSlug(nameValue);
      if (!nextSlug) return;
      slugInput.value = nextSlug;
      slugInput.dataset.auto = "true";
      updateSlugPreview();
    }, 250);
  };
  generateSlugBtn?.addEventListener("click", async () => {
    if (!slugInput) return;
    const nextSlug = await generateUniqueSlug(nameInput?.value || "");
    slugInput.value = nextSlug.toLowerCase();
    slugInput.dataset.auto = "true";
    await validateSlug();
    updateSlugPreview();
  });
  nameInput?.addEventListener("input", () => queueSlugFromName());
  slugInput?.addEventListener("input", () => {
    if (slugInput) slugInput.dataset.auto = "false";
    updateSlugPreview();
  });
  openCreateCircuitTournament?.addEventListener("click", () => {
    openCircuitTournamentModal?.();
  });
  deleteTournamentBtn?.addEventListener("click", () => {
    openDeleteTournamentModal?.();
  });
  confirmDeleteTournamentBtn?.addEventListener("click", () => {
    confirmDeleteTournament?.();
  });
  cancelDeleteTournamentBtn?.addEventListener("click", () => {
    closeDeleteTournamentModal?.();
  });
  window.addEventListener("mousedown", (e) => {
    if (
      deleteTournamentModal &&
      deleteTournamentModal.style.display === "flex" &&
      e.target === deleteTournamentModal
    ) {
      closeDeleteTournamentModal?.();
    }
  });
  const setCreateCircuitStep = (step) => {
    const circuitPanel = document.getElementById("createCircuitGeneral");
    const finalPanel = document.getElementById("createFinalPanel");
    const isFinal = step === "final";
    if (circuitPanel) circuitPanel.classList.toggle("active", !isFinal);
    if (finalPanel) finalPanel.classList.toggle("active", isFinal);
    if (nextCreateCircuitStep)
      nextCreateCircuitStep.style.display = isFinal ? "none" : "inline-flex";
    if (backCreateCircuitStep)
      backCreateCircuitStep.style.display = isFinal ? "inline-flex" : "none";
    if (saveCircuitBtn) saveCircuitBtn.style.display = isFinal ? "inline-flex" : "none";
    if (isFinal && createFinalTabBtns.length) {
      createFinalTabBtns.forEach((b) =>
        b.classList.toggle("active", b.dataset.finalCreateTab === "createFinalGeneral")
      );
      createFinalPanels.forEach((panel) =>
        panel.classList.toggle("active", panel.id === "createFinalGeneral")
      );
    }
  };

  openCreateCircuit?.addEventListener("click", async () => {
    await populateCreateCircuitForm?.();
    resetFinalMapPoolSelection?.();
    updateFinalSlugPreview?.();
    setCreateCircuitStep("circuit");
    setModalVisible(createCircuitModal, true);
  });
  closeCreateCircuit?.addEventListener("click", () => {
    setModalVisible(createCircuitModal, false);
  });
  window.addEventListener("mousedown", (e) => {
    if (
      createCircuitModal &&
      createCircuitModal.style.display === "flex" &&
      e.target === createCircuitModal
    ) {
      setModalVisible(createCircuitModal, false);
    }
  });
  saveCircuitBtn?.addEventListener("click", handleCreateCircuit);
  generateCircuitSlugBtn?.addEventListener("click", async () => {
    if (!circuitSlugInput || !generateCircuitSlug) return;
    circuitSlugInput.value = (await generateCircuitSlug()).toLowerCase();
    updateCircuitSlugPreview?.();
    updateFinalSlugPreview?.();
  });
  circuitSlugInput?.addEventListener("input", () => {
    updateCircuitSlugPreview?.();
    updateFinalSlugPreview?.();
  });
  generateFinalSlugBtn?.addEventListener("click", async () => {
    if (!finalSlugInput || !generateUniqueSlug) return;
    finalSlugInput.value = (await generateUniqueSlug(finalNameInput?.value || "")).toLowerCase();
    updateFinalSlugPreview?.();
  });
  finalSlugInput?.addEventListener("input", () => updateFinalSlugPreview?.());
  refreshCircuitBtn?.addEventListener("click", () => refreshCircuitView?.());
  setCreateCircuitStep("circuit");

  createTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.createTab;
      if (!target) return;
      createTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      createPanels.forEach((panel) => panel.classList.toggle("active", panel.id === target));
    });
  });
  nextCreateCircuitStep?.addEventListener("click", () => setCreateCircuitStep("final"));
  backCreateCircuitStep?.addEventListener("click", () => setCreateCircuitStep("circuit"));
  createFinalTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.finalCreateTab;
      if (!target) return;
      createFinalTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      createFinalPanels.forEach((panel) =>
        panel.classList.toggle("active", panel.id === target)
      );
    });
  });
  const switchSettingsTab = (targetId) => {
    if (!targetId) return;
    settingsTabBtns.forEach((b) => b.classList.toggle("active", b.dataset.settingsTab === targetId));
    settingsPanels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
  };
  settingsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchSettingsTab(btn.dataset.settingsTab);
    });
  });
  if (typeof window !== "undefined") {
    window.__switchSettingsTab = switchSettingsTab;
  }

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
  finalDescriptionInput?.addEventListener("input", () => {
    const preview = document.getElementById("finalTournamentDescriptionPreview");
    if (!preview) return;
    preview.innerHTML = renderMarkdown(finalDescriptionInput.value || "");
  });
  finalRulesInput?.addEventListener("input", () => {
    const preview = document.getElementById("finalTournamentRulesPreview");
    if (!preview) return;
    preview.innerHTML = renderMarkdown(finalRulesInput.value || "");
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
  finalDescToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormattingInline(btn.dataset.finalDescAction, "finalTournamentDescriptionInput")
    );
  });
  finalRulesToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormattingInline(btn.dataset.finalRulesAction, "finalTournamentRulesInput")
    );
  });
  bindImagePreview(createImageInput, createImagePreview);
  bindImagePreview(finalImageInput, finalImagePreview);
  bindImagePreview(settingsImageInput, settingsImagePreview);

  bindMapSelectionEvents({
    setMapPoolSelection,
    getDefaultMapPoolNames,
    toggleMapSelection,
  });
  finalUseLadderMapsBtn?.addEventListener("click", () =>
    setFinalMapPoolSelection?.(getDefaultMapPoolNames())
  );
  finalClearMapPoolBtn?.addEventListener("click", () => setFinalMapPoolSelection?.([]));
  finalMapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleFinalMapSelection?.(card.dataset.mapName);
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
    handleAddCircuitPointsRow,
    handleRemoveCircuitPointsRow,
    handleApplyCircuitPoints,
  });

  [
    bestOfUpperInput,
    bestOfLowerInput,
    bestOfLowerSemiInput,
    bestOfLowerFinalInput,
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
  finalFormatSelect?.addEventListener("change", () => syncFormatFieldVisibility("final"));
  closeVetoModal?.addEventListener("click", () => hideVetoModal());
  saveVetoBtn?.addEventListener("click", () => saveVetoSelection());

  let clanModulePromise = null;
  const ensureClanStyles = () => {
    if (document.getElementById("clanStylesheet")) return;
    const link = document.createElement("link");
    link.id = "clanStylesheet";
    link.rel = "stylesheet";
    link.href = "/public/css/clan.css";
    document.head.appendChild(link);
  };
  const ensureClanModule = async () => {
    if (!clanModulePromise) {
      clanModulePromise = import("../clan.js");
    }
    return clanModulePromise;
  };
  const ensureClanModalReady = async () => {
    ensureClanStyles();
    const clanModule = await ensureClanModule();
    if (!document.body.dataset.clanModalBound) {
      clanModule.setupClanViewSwitching?.();
      const closeClanModal = document.getElementById("closeClanModal");
      const clanModal = document.getElementById("clanModal");
      closeClanModal?.addEventListener("click", () => {
        if (clanModal) clanModal.style.display = "none";
      });
      window.addEventListener("mousedown", (event) => {
        if (!clanModal || clanModal.style.display === "none") return;
        if (event.target === clanModal) clanModal.style.display = "none";
      });
      document.body.dataset.clanModalBound = "true";
    }
    return clanModule;
  };

  showClanModalButton?.addEventListener("click", async () => {
    const userMenu = document.getElementById("userMenu");
    if (userMenu) userMenu.style.display = "none";
    await ensureClanModalReady();
    const clanModal = document.getElementById("clanModal");
    if (clanModal) clanModal.style.display = "flex";
    document.getElementById("findClanBtn")?.click();
  });

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
  playersTable?.addEventListener("change", (e) => {
    if (e.target.matches(".checkin-select")) {
      const id = e.target.dataset.playerId;
      const value = e.target.value;
      setPlayerCheckIn?.(id, value === "checked");
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
  syncFormatFieldVisibility("final");
}
