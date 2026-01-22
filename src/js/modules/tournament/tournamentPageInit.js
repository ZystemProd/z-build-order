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
import {
  renderChosenMaps as renderChosenMapsUI,
  updateMapButtons as updateMapButtonsUI,
} from "./maps/render.js";
import { renderMapPoolPicker as renderMapPoolPickerUI } from "./maps/pool.js";
import { attachPlayerDetailHandlers } from "./playerDetail.js";
import { enableDragScroll } from "./ui/dragScroll.js";
import { lockBodyScroll, unlockBodyScroll } from "./modalLock.js";
import { initTournamentNotifications } from "./notifications.js";
import { initTournamentTemplateManager } from "./templateManager.js";
import { initTournamentSearch } from "./search/tournamentSearch.js";
import {
  initTournamentListSlider,
  refreshTournamentListLayout,
  loadMoreTournamentListItems,
} from "./listSlider.js";
import { initQuillEditors, syncQuillById } from "./markdownEditor.js";

export function initTournamentPage({
  handleRegistration,
  handleCreateTournament,
  handleCreateCircuit,
  openCircuitTournamentModal,
  openCircuitSettingsModal,
  closeCircuitSettingsModal,
  saveCircuitSettings,
  openDeleteCircuitModal,
  confirmDeleteCircuit,
  closeDeleteCircuitModal,
  openDeleteTournamentModal,
  confirmDeleteTournament,
  closeDeleteTournamentModal,
  handleSaveSettings,
  rebuildBracket,
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
  setCircuitFinalMapPoolSelection,
  toggleCircuitFinalMapSelection,
  resetCircuitFinalMapPoolSelection,
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
  setPlayerForfeit,
  removePlayer,
  setManualSeedingEnabled,
  getManualSeedingActive,
  handleManualSeedingReorder,
  setMmrSeedingMode,
  updateMatchScore,
  updateRegistrationRequirementIcons,
  renderAll,
  saveState,
  handleAddCircuitPointsRow,
  handleRemoveCircuitPointsRow,
  handleCircuitPointsChange,
  handleEditCircuitPoints,
  handleSaveCircuitPoints,
  handleApplyCircuitPoints,
  addBotPlayer,
  removeBotPlayer,
  removeAllBots,
  resetTournament,
  resetScores,
  resetVetoScoreChat,
  checkInCurrentPlayer,
  notifyCheckInPlayers,
  toggleCheckInManualClose,
  toggleLiveTournament,
  refreshRosterMmrFromPulse,
}) {
  const runAfterFirstPaint = (fn) => {
    if (typeof window === "undefined") return fn?.();
    requestAnimationFrame(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(fn, { timeout: 1200 });
      } else {
        setTimeout(fn, 0);
      }
    });
  };

  const registrationForm = document.getElementById("registrationForm");
  const rebuildBtn = document.getElementById("rebuildBracketBtn");
  const resetBtn = document.getElementById("resetTournamentBtn");
  const resetScoresBtn = document.getElementById("resetScoresBtn");
  const resetVetoScoreChatBtn = document.getElementById(
    "resetVetoScoreChatBtn",
  );
  const notifyCheckInBtn = document.getElementById("notifyCheckInBtn");
  const checkInToggleBtn = document.getElementById("checkInToggleBtn");
  const refreshMmrBtn = document.getElementById("refreshMmrBtn");
  const jumpToRegistration = document.getElementById("jumpToRegistration");
  const jumpToBracket = document.getElementById("jumpToBracket");
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const manualSeedingToggle = document.getElementById("manualSeedingToggle");
  const mmrSeedingToggle = document.getElementById("mmrSeedingToggle");
  const autoFillBtn = document.getElementById("autoFillBtn");
  const checkInBtn = document.getElementById("checkInBtn");
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const switchAccountBtn = document.getElementById("switchAccountBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const raceSelect = document.getElementById("raceSelect");
  const pulseLinkDisplay = document.getElementById("pulseLinkDisplay");
  const playerNameInput = document.getElementById("playerNameInput");
  const openPulseSettingsBtn = document.getElementById("openPulseSettingsBtn");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const openCreateTournament = document.getElementById("openCreateTournament");
  const createModal = document.getElementById("createTournamentModal");
  const closeCreateTournament = document.getElementById(
    "closeCreateTournament",
  );
  const saveTournamentBtn = document.getElementById("saveTournamentBtn");
  const openCreateCircuitTournament = document.getElementById(
    "openCreateCircuitTournament",
  );
  const openCircuitSettingsBtn = document.getElementById(
    "openCircuitSettingsBtn",
  );
  const deleteTournamentBtn = document.getElementById("deleteTournamentBtn");
  const confirmDeleteTournamentBtn = document.getElementById(
    "confirmDeleteTournamentBtn",
  );
  const cancelDeleteTournamentBtn = document.getElementById(
    "cancelDeleteTournamentBtn",
  );
  const deleteTournamentModal = document.getElementById(
    "confirmDeleteTournamentModal",
  );
  const resetTournamentModal = document.getElementById(
    "confirmResetTournamentModal",
  );
  const resetScoresModal = document.getElementById("confirmResetScoresModal");
  const resetVetoScoreChatModal = document.getElementById(
    "confirmResetVetoScoreChatModal",
  );
  const confirmResetTournamentBtn = document.getElementById(
    "confirmResetTournamentBtn",
  );
  const cancelResetTournamentBtn = document.getElementById(
    "cancelResetTournamentBtn",
  );
  const confirmResetScoresBtn = document.getElementById(
    "confirmResetScoresBtn",
  );
  const cancelResetScoresBtn = document.getElementById("cancelResetScoresBtn");
  const confirmResetVetoScoreChatBtn = document.getElementById(
    "confirmResetVetoScoreChatBtn",
  );
  const cancelResetVetoScoreChatBtn = document.getElementById(
    "cancelResetVetoScoreChatBtn",
  );
  const openCreateCircuit = document.getElementById("openCreateCircuit");
  const createCircuitModal = document.getElementById("createCircuitModal");
  const circuitSettingsModal = document.getElementById("circuitSettingsModal");
  const closeCircuitSettingsBtn = document.getElementById(
    "closeCircuitSettingsModal",
  );
  const saveCircuitSettingsBtn = document.getElementById(
    "saveCircuitSettingsBtn",
  );
  const deleteCircuitBtn = document.getElementById("deleteCircuitBtn");
  const deleteCircuitModal = document.getElementById(
    "confirmDeleteCircuitModal",
  );
  const confirmDeleteCircuitBtn = document.getElementById(
    "confirmDeleteCircuitBtn",
  );
  const cancelDeleteCircuitBtn = document.getElementById(
    "cancelDeleteCircuitBtn",
  );
  const closeCreateCircuit = document.getElementById("closeCreateCircuit");
  const saveCircuitBtn = document.getElementById("saveCircuitBtn");
  const nextCreateCircuitStep = document.getElementById(
    "nextCreateCircuitStep",
  );
  const backCreateCircuitStep = document.getElementById(
    "backCreateCircuitStep",
  );
  const refreshTournaments = document.getElementById("refreshTournaments");
  const addBotBtn = document.getElementById("addBotBtn");
  const removeBotBtn = document.getElementById("removeBotBtn");
  const removeBotsBtn = document.getElementById("removeBotsBtn");
  const descriptionInput = document.getElementById(
    "tournamentDescriptionInput",
  );
  const rulesInput = document.getElementById("tournamentRulesInput");
  const finalDescriptionInput = document.getElementById(
    "finalTournamentDescriptionInput",
  );
  const finalRulesInput = document.getElementById("finalTournamentRulesInput");
  const mapPoolPicker = document.getElementById("mapPoolPicker");
  const useLadderMapsBtn = document.getElementById("useLadderMapsBtn");
  const clearMapPoolBtn = document.getElementById("clearMapPoolBtn");
  const finalMapPoolPicker = document.getElementById("finalMapPoolPicker");
  const finalUseLadderMapsBtn = document.getElementById(
    "finalUseLadderMapsBtn",
  );
  const finalClearMapPoolBtn = document.getElementById("finalClearMapPoolBtn");
  const circuitFinalMapPoolPicker = document.getElementById(
    "circuitFinalMapPoolPicker",
  );
  const circuitFinalUseLadderMapsBtn = document.getElementById(
    "circuitFinalUseLadderMapsBtn",
  );
  const circuitFinalClearMapPoolBtn = document.getElementById(
    "circuitFinalClearMapPoolBtn",
  );
  const settingsTabBtns = document.querySelectorAll("[data-settings-tab]");
  const settingsPanels = document.querySelectorAll(
    "#settingsTab .settings-panel",
  );
  const createTabBtns = document.querySelectorAll("[data-create-tab]");
  const createPanels = document.querySelectorAll(
    "#createTournamentModal .settings-panel",
  );
  const createFinalTabBtns = document.querySelectorAll(
    "[data-final-create-tab]",
  );
  const createFinalPanels = document.querySelectorAll(
    "#createFinalPanel .create-final-panel",
  );
  const circuitSettingsTabBtns = document.querySelectorAll(
    "[data-circuit-settings-tab]",
  );
  const circuitSettingsPanels = document.querySelectorAll(
    ".circuit-settings-panel",
  );
  const circuitFinalTabBtns = document.querySelectorAll(
    "[data-final-settings-tab]",
  );
  const circuitFinalPanels = document.querySelectorAll(
    "#circuitSettingsFinal .circuit-final-panel",
  );
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const createImageInput = document.getElementById("tournamentImageInput");
  const createImagePreview = document.getElementById("tournamentImagePreview");
  const finalImageInput = document.getElementById("finalTournamentImageInput");
  const finalImagePreview = document.getElementById(
    "finalTournamentImagePreview",
  );
  const circuitFinalImageInput = document.getElementById(
    "circuitFinalImageInput",
  );
  const circuitFinalImagePreview = document.getElementById(
    "circuitFinalImagePreview",
  );
  const settingsImageInput = document.getElementById("settingsImageInput");
  const settingsImagePreview = document.getElementById("settingsImagePreview");
  const settingsRequirePulseLink = document.getElementById(
    "settingsRequirePulseLink",
  );
  const tournamentMaxPlayersInput = document.getElementById(
    "tournamentMaxPlayersInput",
  );
  const settingsMaxPlayersInput = document.getElementById(
    "settingsMaxPlayersInput",
  );
  const finalMaxPlayersInput = document.getElementById(
    "finalTournamentMaxPlayersInput",
  );
  const circuitFinalMaxPlayersInput = document.getElementById(
    "circuitFinalMaxPlayersInput",
  );
  const nameInput = document.getElementById("tournamentNameInput");
  const slugInput = document.getElementById("tournamentSlugInput");
  const circuitSlugInput = document.getElementById("circuitSlugInput");
  const finalSlugInput = document.getElementById("finalTournamentSlugInput");
  const finalNameInput = document.getElementById("finalTournamentNameInput");
  const bestOfUpperInput = document.getElementById("bestOfUpperInput");
  const bestOfLowerInput = document.getElementById("bestOfLowerInput");
  const bestOfLowerSemiInput = document.getElementById("bestOfLowerSemiInput");
  const bestOfLowerFinalInput = document.getElementById(
    "bestOfLowerFinalInput",
  );
  const bestOfQuarterInput = document.getElementById("bestOfQuarterInput");
  const bestOfSemiInput = document.getElementById("bestOfSemiInput");
  const bestOfFinalInput = document.getElementById("bestOfFinalInput");
  const createFormatSelect = document.getElementById("tournamentFormatSelect");
  const finalFormatSelect = document.getElementById("finalFormatSelect");
  const circuitFinalFormatSelect = document.getElementById(
    "circuitFinalFormatSelect",
  );
  const settingsBestOfUpper = document.getElementById("settingsBestOfUpper");
  const settingsBestOfLower = document.getElementById("settingsBestOfLower");
  const settingsBestOfQuarter = document.getElementById(
    "settingsBestOfQuarter",
  );
  const settingsBestOfSemi = document.getElementById("settingsBestOfSemi");
  const settingsBestOfFinal = document.getElementById("settingsBestOfFinal");
  const settingsFormatSelect = document.getElementById("settingsFormatSelect");
  const showClanModalButton = document.getElementById("showClanModalButton");
  const vetoModal = document.getElementById("vetoModal");
  const closeVetoModal = document.getElementById("closeVetoModal");
  const saveVetoBtn = document.getElementById("saveVetoBtn");
  const refreshCircuitBtn = document.getElementById("refreshCircuitBtn");
  const syncQuillFromInputs = () => {
    [
      "settingsDescriptionInput",
      "settingsRulesInput",
      "tournamentDescriptionInput",
      "tournamentRulesInput",
      "finalTournamentDescriptionInput",
      "finalTournamentRulesInput",
      "circuitFinalDescriptionInput",
      "circuitFinalRulesInput",
    ].forEach((id) => {
      const input = document.getElementById(id);
      if (input) syncQuillById(id, input.value || "");
    });
  };
  const quillConfigs = [
    {
      editorId: "settingsDescriptionEditor",
      textareaId: "settingsDescriptionInput",
      placeholder: "Describe the event...",
    },
    {
      editorId: "settingsRulesEditor",
      textareaId: "settingsRulesInput",
      placeholder:
        "Add eligibility, format, communication, and fair play rules...",
    },
    {
      editorId: "tournamentDescriptionEditor",
      textareaId: "tournamentDescriptionInput",
      placeholder: "Write rules, schedule, map pool...",
    },
    {
      editorId: "tournamentRulesEditor",
      textareaId: "tournamentRulesInput",
      placeholder:
        "Add eligibility, format, communication, and fair play rules...",
    },
    {
      editorId: "finalTournamentDescriptionEditor",
      textareaId: "finalTournamentDescriptionInput",
      placeholder: "Write rules, schedule, map pool...",
    },
    {
      editorId: "finalTournamentRulesEditor",
      textareaId: "finalTournamentRulesInput",
      placeholder:
        "Add eligibility, format, communication, and fair play rules...",
    },
    {
      editorId: "circuitFinalDescriptionEditor",
      textareaId: "circuitFinalDescriptionInput",
      placeholder: "Write rules, schedule, map pool...",
    },
    {
      editorId: "circuitFinalRulesEditor",
      textareaId: "circuitFinalRulesInput",
      placeholder:
        "Add eligibility, format, communication, and fair play rules...",
    },
  ];
  const QUILL_SCRIPT_SRC =
    "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js";
  const QUILL_CSS_SRC =
    "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css";
  const FLATPICKR_SCRIPT_SRC = "/vendor/flatpickr/flatpickr.min.js";
  const FLATPICKR_CSS_SRC = "/vendor/flatpickr/flatpickr.min.css";
  const FLATPICKR_DARK_CSS_SRC = "/vendor/flatpickr/flatpickr-dark.min.css";
  let quillLoadPromise = null;
  let quillCssPromise = null;
  let quillInitialized = false;
  let flatpickrLoadPromise = null;
  let flatpickrCssPromise = null;
  let datePickersInitialized = false;

  const loadQuillCss = () => {
    if (typeof window === "undefined") return Promise.resolve();
    const existing = document.querySelector(`link[href="${QUILL_CSS_SRC}"]`);
    if (existing) return Promise.resolve();
    if (quillCssPromise) return quillCssPromise;
    quillCssPromise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = QUILL_CSS_SRC;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("Quill CSS load failed"));
      document.head.appendChild(link);
    });
    return quillCssPromise;
  };

  const loadQuillScript = () => {
    if (typeof window === "undefined") return Promise.resolve();
    if (window.Quill) return Promise.resolve();
    if (quillLoadPromise) return quillLoadPromise;
    quillLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${QUILL_SCRIPT_SRC}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Quill load failed")),
        );
        return;
      }
      const script = document.createElement("script");
      script.src = QUILL_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Quill load failed"));
      document.head.appendChild(script);
    });
    return quillLoadPromise;
  };

  const ensureQuillInitialized = () => {
    if (quillInitialized) return Promise.resolve();
    return loadQuillCss()
      .then(() => loadQuillScript())
      .then(() => {
        if (quillInitialized) return;
        initQuillEditors(quillConfigs);
        syncQuillFromInputs();
        quillInitialized = true;
      });
  };

  const loadFlatpickrCss = () => {
    if (typeof window === "undefined") return Promise.resolve();
    const hasBase = document.querySelector(`link[href="${FLATPICKR_CSS_SRC}"]`);
    const hasDark = document.querySelector(
      `link[href="${FLATPICKR_DARK_CSS_SRC}"]`,
    );
    if (hasBase && hasDark) return Promise.resolve();
    if (flatpickrCssPromise) return flatpickrCssPromise;
    flatpickrCssPromise = new Promise((resolve, reject) => {
      const linkBase = document.createElement("link");
      linkBase.rel = "stylesheet";
      linkBase.href = FLATPICKR_CSS_SRC;
      const linkDark = document.createElement("link");
      linkDark.rel = "stylesheet";
      linkDark.href = FLATPICKR_DARK_CSS_SRC;
      let loaded = 0;
      const onLoad = () => {
        loaded += 1;
        if (loaded === 2) resolve();
      };
      const onError = () => reject(new Error("Flatpickr CSS load failed"));
      linkBase.onload = onLoad;
      linkDark.onload = onLoad;
      linkBase.onerror = onError;
      linkDark.onerror = onError;
      document.head.appendChild(linkBase);
      document.head.appendChild(linkDark);
    });
    return flatpickrCssPromise;
  };

  const loadFlatpickrScript = () => {
    if (typeof window === "undefined") return Promise.resolve();
    if (window.flatpickr) return Promise.resolve();
    if (flatpickrLoadPromise) return flatpickrLoadPromise;
    flatpickrLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${FLATPICKR_SCRIPT_SRC}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Flatpickr load failed")),
        );
        return;
      }
      const script = document.createElement("script");
      script.src = FLATPICKR_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Flatpickr load failed"));
      document.head.appendChild(script);
    });
    return flatpickrLoadPromise;
  };

  const ensureDatePickersInitialized = () => {
    if (datePickersInitialized) return Promise.resolve();
    return loadFlatpickrCss()
      .then(() => loadFlatpickrScript())
      .then(() => {
        if (datePickersInitialized) return;
        initDatePickers();
        datePickersInitialized = true;
      });
  };

  const isDualTournamentFormat = (value) => {
    const normalized = (value || "").toLowerCase();
    return normalized.includes("gsl") || normalized.includes("dual tournament");
  };

  const snapToMultiple = (value, step) => {
    if (!Number.isFinite(value) || !step) return value;
    return Math.round(value / step) * step;
  };

  const syncMaxPlayersInput = (formatSelect, input) => {
    if (!formatSelect || !input) return;
    if (!input.dataset.defaultStep) {
      input.dataset.defaultStep = input.step || "1";
      input.dataset.defaultMin = input.min || "2";
    }
    const isDual = isDualTournamentFormat(formatSelect.value);
    if (isDual) {
      input.step = "4";
      input.min = "4";
    } else {
      input.step = input.dataset.defaultStep;
      input.min = input.dataset.defaultMin;
    }

    const maxCap = Number(input.max || 0) || 32;
    const minCap = Number(input.min || 0) || 2;
    const current = Number(input.value || input.placeholder || "");
    if (!Number.isFinite(current)) return;
    const next = isDual ? snapToMultiple(current, 4) : current;
    const clamped = Math.min(maxCap, Math.max(minCap, next));
    if (Number.isFinite(clamped)) {
      input.value = String(clamped);
    }
  };
  runAfterFirstPaint(() => {
    initTournamentNotifications();
    initTournamentSearch();
    initTournamentListSlider();
  });

  const quillTriggerSelector = [
    "[data-settings-tab]",
    "[data-create-tab]",
    "[data-final-create-tab]",
    "[data-circuit-settings-tab]",
    "[data-final-settings-tab]",
  ].join(",");

  const maybeInitQuillFromEvent = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(quillTriggerSelector) ||
      target.closest(".quill-editor") ||
      target.matches(
        "#settingsDescriptionInput, #settingsRulesInput, #tournamentDescriptionInput, #tournamentRulesInput, #finalTournamentDescriptionInput, #finalTournamentRulesInput, #circuitFinalDescriptionInput, #circuitFinalRulesInput",
      )
    ) {
      ensureQuillInitialized();
    }
  };

  document.addEventListener("click", maybeInitQuillFromEvent, {
    capture: true,
  });
  document.addEventListener("focusin", maybeInitQuillFromEvent, {
    capture: true,
  });

  const dateTriggerSelector = "[data-datepicker-for]";
  const dateInputSelector =
    "#tournamentStartInput, #finalTournamentStartInput, #settingsStartInput";
  const maybeInitDatePickersFromEvent = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(dateTriggerSelector) ||
      target.matches(dateInputSelector)
    ) {
      ensureDatePickersInitialized();
    }
  };

  document.addEventListener("click", maybeInitDatePickersFromEvent, {
    capture: true,
  });
  document.addEventListener("focusin", maybeInitDatePickersFromEvent, {
    capture: true,
  });

  const preventLabelFocus = (root) => {
    if (!root) return;
    root.addEventListener("click", (event) => {
      const label = event.target.closest("label");
      if (!label) return;
      if (
        event.target.closest(
          "input, select, textarea, button, .quill-editor, .ql-toolbar, .ql-container, .ql-editor, .ql-picker",
        )
      ) {
        return;
      }
      event.preventDefault();
    });
  };

  preventLabelFocus(
    document.querySelector("#createTournamentModal .settings-panel"),
  );
  preventLabelFocus(document.querySelector("#settingsTab .settings-panel"));
  preventLabelFocus(document.querySelector("#createFinalPanel"));

  const setModalVisible = (modal, visible, display = "flex") => {
    if (!modal) return;
    modal.style.display = visible ? display : "none";
    if (visible) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
  };

  const resetMarkdownToolState = (root) => {
    if (!root) return;
    root
      .querySelectorAll(".markdown-surface[data-editor-for]")
      .forEach((surface) => {
        delete surface.dataset.pendingActions;
        delete surface.dataset.pendingDisplay;
        delete surface.dataset.lastFormatAction;
        delete surface.dataset.preservePendingTs;
        delete surface.dataset.activeStyles;
      });
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
    const assignPickerNames = (picker) => {
      if (!picker?.input) return;
      const baseName =
        picker.input.name || picker.input.id || "tournament-date";
      if (!picker.input.name) picker.input.name = baseName;
      const setName = (el, suffix) => {
        if (!el || el.name || el.id) return;
        el.name = `${baseName}-${suffix}`;
      };
      setName(picker.hourElement, "hour");
      setName(picker.minuteElement, "minute");
      setName(picker.secondElement, "second");
      setName(picker.amPM, "ampm");
      setName(picker.altInput, "alt");
      setName(picker.mobileInput, "mobile");
      const monthDropdown =
        Array.isArray(picker.monthElements) && picker.monthElements.length
          ? picker.monthElements[0]
          : picker.monthElement || null;
      setName(monthDropdown, "month");
      setName(picker.currentYearElement, "year");
    };
    const ensurePicker = (input) => {
      if (!input) return null;
      if (input._flatpickr) {
        assignPickerNames(input._flatpickr);
        return input._flatpickr;
      }
      if (typeof window.flatpickr !== "function") return null;
      const picker = window.flatpickr(input, options);
      assignPickerNames(picker);
      return picker;
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

  const resolveMaxPlayers = (input) => {
    const raw = input?.value;
    const fallback = Number(input?.placeholder || 0);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    return 8;
  };

  const nextPowerOfTwo = (value) => {
    const v = Math.max(2, Math.floor(value || 2));
    return 2 ** Math.ceil(Math.log2(v));
  };

  const getUpperLabelForSettings = (roundNumber, totalRounds, isDoubleElim) => {
    const idx = Math.max(1, roundNumber);
    const fromEnd = totalRounds - idx + 1;
    if (fromEnd === 1) return isDoubleElim ? "Upper Final" : "Final";
    if (fromEnd === 2) return "Semi-final";
    if (fromEnd === 3) return "Quarterfinal";
    return `Upper Round ${idx}`;
  };

  const getPlayoffsSelectForRoot = (rootEl) => {
    if (!rootEl) return null;
    if (rootEl.closest("#settingsTab")) {
      return document.getElementById("settingsRoundRobinPlayoffs");
    }
    if (rootEl.closest("#createFinalPanel")) {
      return document.getElementById("finalRoundRobinPlayoffsSelect");
    }
    if (rootEl.closest("#createTournamentModal")) {
      return document.getElementById("roundRobinPlayoffsSelect");
    }
    return null;
  };

  const resolvePlayoffsFormat = (rootEl, formatValue) => {
    const raw = (formatValue || "").toLowerCase();
    const isGroupStage =
      raw.startsWith("round robin") ||
      raw.includes("gsl") ||
      raw.includes("dual tournament");
    if (!isGroupStage) {
      return formatValue || "";
    }
    const playoffsSelect = getPlayoffsSelectForRoot(rootEl);
    return playoffsSelect?.value || "None";
  };

  const updateFormatDiagramTitles = ({
    root,
    maxPlayersInput,
    formatSelect,
  }) => {
    if (!root) return;
    const formatValue = formatSelect?.value || "";
    const format = formatValue.toLowerCase();
    const isGroupStageFormat =
      format.startsWith("round robin") ||
      format.includes("gsl") ||
      format.includes("dual tournament");
    const playoffsValue = resolvePlayoffsFormat(root, formatValue);
    const playoffsLower = (playoffsValue || "").toLowerCase();
    const isDoubleElim =
      format.includes("double") || playoffsLower.includes("double");
    const isSingleElim =
      format.startsWith("single") || playoffsLower.startsWith("single");
    const maxPlayers = resolveMaxPlayers(maxPlayersInput);
    const totalRounds = Math.max(1, Math.log2(nextPowerOfTwo(maxPlayers)));
    const earlyRounds = Math.max(0, totalRounds - (isDoubleElim ? 3 : 2));
    const upperTitle = root.querySelector(
      ".format-col--upper-main .format-title",
    );
    const quarterTitle = root.querySelector(
      ".format-col--quarter .format-title",
    );
    const semiTitle = root.querySelector(".format-col--semi .format-title");
    const upperFinalTitle = root.querySelector(
      ".format-col--upper-final .format-title",
    );
    const finalTitle = root.querySelector(".format-col--final .format-title");
    const upperFinalCol = root.querySelector(".format-col--upper-final");

    if (upperTitle) {
      if (earlyRounds <= 0) {
        upperTitle.textContent = "Upper bracket";
      } else if (earlyRounds === 1) {
        upperTitle.textContent = "Upper Round 1";
      } else {
        upperTitle.textContent = `Upper Rounds 1-${earlyRounds}`;
      }
    }

    if (quarterTitle) {
      quarterTitle.textContent = getUpperLabelForSettings(
        Math.max(1, totalRounds - 2),
        totalRounds,
        isDoubleElim,
      );
    }
    if (semiTitle) {
      semiTitle.textContent = getUpperLabelForSettings(
        Math.max(1, totalRounds - 1),
        totalRounds,
        isDoubleElim,
      );
    }
    if (upperFinalTitle) {
      upperFinalTitle.textContent = isDoubleElim
        ? getUpperLabelForSettings(totalRounds, totalRounds, isDoubleElim)
        : getUpperLabelForSettings(totalRounds, totalRounds, isDoubleElim);
    }
    if (upperFinalCol) {
      upperFinalCol.style.display = isDoubleElim ? "" : "none";
    }
    if (finalTitle) {
      finalTitle.textContent = isDoubleElim
        ? "Grand Final"
        : getUpperLabelForSettings(totalRounds, totalRounds, isDoubleElim);
    }
    const lowerRow = root.querySelector(".format-row--lower");
    if (lowerRow) {
      lowerRow.style.display = isSingleElim ? "none" : "";
    }
    if (isGroupStageFormat) {
      root.style.display = playoffsLower === "none" ? "none" : "";
    } else {
      root.style.display = "";
    }
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
      delete previewEl.dataset.reuseUrl;
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

  // Lazy-load flatpickr on first interaction.
  rebuildBtn?.addEventListener("click", () => toggleLiveTournament?.());
  resetBtn?.addEventListener("click", () => {
    setModalVisible(resetTournamentModal, true);
  });
  resetScoresBtn?.addEventListener("click", () => {
    setModalVisible(resetScoresModal, true);
  });
  resetVetoScoreChatBtn?.addEventListener("click", () => {
    setModalVisible(resetVetoScoreChatModal, true);
  });
  autoFillBtn?.addEventListener("click", autoFillPlayers);
  checkInBtn?.addEventListener("click", () => checkInCurrentPlayer?.());
  checkInToggleBtn?.addEventListener("click", () =>
    toggleCheckInManualClose?.(),
  );
  notifyCheckInBtn?.addEventListener("click", () => notifyCheckInPlayers?.());
  refreshMmrBtn?.addEventListener("click", () => refreshRosterMmrFromPulse?.());

  signInBtn?.addEventListener("click", () => window.handleSignIn?.());
  signOutBtn?.addEventListener("click", () => window.handleSignOut?.());
  switchAccountBtn?.addEventListener("click", () =>
    window.handleSwitchAccount?.(),
  );
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
    ensureDatePickersInitialized();
  });
  const openPulseSettings = async () => {
    const mod = await import("../settingsModalInit.js");
    if (typeof mod.openSettingsModal === "function") {
      await mod.openSettingsModal();
    } else if (typeof mod.initUserSettingsModal === "function") {
      mod.initUserSettingsModal();
      const modal = document.getElementById("settingsModal");
      if (modal) modal.style.display = "block";
    }
    const modal = document.getElementById("settingsModal");
    if (modal) {
      const tabButtons = modal.querySelectorAll("[data-user-settings-tab]");
      const tabPanels = modal.querySelectorAll(".settings-panel");
      tabButtons.forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.dataset.userSettingsTab === "settingsTournament",
        );
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === "settingsTournament");
      });
    }
    const pulseInput = document.getElementById("sc2PulseInput");
    if (pulseInput) {
      pulseInput.classList.add("highlight");
      pulseInput.focus();
      pulseInput.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => pulseInput.classList.remove("highlight"), 2000);
    }
  };
  openPulseSettingsBtn?.addEventListener("click", openPulseSettings);
  if (pulseLinkDisplay) {
    pulseLinkDisplay.addEventListener("input", () => {
      if (!raceSelect) return;
      if (pulseLinkDisplay.value.trim()) {
        delete pulseLinkDisplay.dataset.manualCleared;
      } else {
        pulseLinkDisplay.dataset.manualCleared = "true";
      }
      updateRegistrationRequirementIcons?.();
    });
  }
  playerNameInput?.addEventListener("input", () => {
    updateRegistrationRequirementIcons?.();
  });
  updateRegistrationRequirementIcons?.();
  raceSelect?.addEventListener("change", () => {
    const statusEl = document.getElementById("mmrStatus");
    const normalizedRace = normalizeRaceLabel(raceSelect.value);
    updateMmrDisplay(statusEl, normalizedRace || null);
  });
  openRegisterBtn?.addEventListener("click", () => {
    switchTab("registrationTab");
    document
      .getElementById("registrationCard")
      ?.scrollIntoView({ behavior: "smooth" });
  });

  openCreateTournament?.addEventListener("click", async () => {
    await populateCreateForm();
    templateManager?.ensureCreateModalHome();
    templateManager?.setTemplateManagerMode(false);
    templateManager?.refreshTemplateUI();
    resetMarkdownToolState(createModal);
    syncQuillFromInputs();
    setModalVisible(createModal, true);
  });
  closeCreateTournament?.addEventListener("click", () => {
    if (templateManager?.isTemplateManagerOpen?.()) {
      templateManager.closeTemplateManager(false);
      return;
    }
    resetMarkdownToolState(createModal);
    setModalVisible(createModal, false);
  });
  window.addEventListener("mousedown", (e) => {
    if (
      createModal &&
      createModal.style.display === "flex" &&
      e.target === createModal
    ) {
      setModalVisible(createModal, false);
    }
  });
  saveTournamentBtn?.addEventListener(
    "click",
    handleCreateTournament || handleRegistration,
  );
  refreshTournaments?.addEventListener("click", () => renderTournamentList());
  let slugAutoTimer = null;
  const queueSlugFromName = () => {
    if (!nameInput || !slugInput || !generateUniqueSlug) return;
    const shouldAuto = !slugInput.value || slugInput.dataset.auto === "true";
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
  nameInput?.addEventListener("input", () => queueSlugFromName());
  slugInput?.addEventListener("input", () => {
    if (slugInput) slugInput.dataset.auto = "false";
    updateSlugPreview();
  });
  openCreateCircuitTournament?.addEventListener("click", () => {
    openCircuitTournamentModal?.();
  });
  openCircuitSettingsBtn?.addEventListener("click", () => {
    openCircuitSettingsModal?.();
  });
  closeCircuitSettingsBtn?.addEventListener("click", () => {
    closeCircuitSettingsModal?.();
  });
  saveCircuitSettingsBtn?.addEventListener("click", () => {
    saveCircuitSettings?.();
  });
  deleteCircuitBtn?.addEventListener("click", () => {
    openDeleteCircuitModal?.();
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
  confirmDeleteCircuitBtn?.addEventListener("click", () => {
    confirmDeleteCircuit?.();
  });
  cancelDeleteCircuitBtn?.addEventListener("click", () => {
    closeDeleteCircuitModal?.();
  });
  confirmResetTournamentBtn?.addEventListener("click", () => {
    resetTournament?.();
    setModalVisible(resetTournamentModal, false);
  });
  cancelResetTournamentBtn?.addEventListener("click", () => {
    setModalVisible(resetTournamentModal, false);
  });
  confirmResetScoresBtn?.addEventListener("click", () => {
    resetScores?.();
    setModalVisible(resetScoresModal, false);
  });
  cancelResetScoresBtn?.addEventListener("click", () => {
    setModalVisible(resetScoresModal, false);
  });
  confirmResetVetoScoreChatBtn?.addEventListener("click", () => {
    resetVetoScoreChat?.();
    setModalVisible(resetVetoScoreChatModal, false);
  });
  cancelResetVetoScoreChatBtn?.addEventListener("click", () => {
    setModalVisible(resetVetoScoreChatModal, false);
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
  window.addEventListener("mousedown", (e) => {
    if (
      deleteCircuitModal &&
      deleteCircuitModal.style.display === "flex" &&
      e.target === deleteCircuitModal
    ) {
      closeDeleteCircuitModal?.();
    }
  });
  window.addEventListener("mousedown", (e) => {
    if (
      resetTournamentModal &&
      resetTournamentModal.style.display === "flex" &&
      e.target === resetTournamentModal
    ) {
      setModalVisible(resetTournamentModal, false);
    }
  });
  window.addEventListener("mousedown", (e) => {
    if (
      resetScoresModal &&
      resetScoresModal.style.display === "flex" &&
      e.target === resetScoresModal
    ) {
      setModalVisible(resetScoresModal, false);
    }
  });
  window.addEventListener("mousedown", (e) => {
    if (
      resetVetoScoreChatModal &&
      resetVetoScoreChatModal.style.display === "flex" &&
      e.target === resetVetoScoreChatModal
    ) {
      setModalVisible(resetVetoScoreChatModal, false);
    }
  });
  window.addEventListener("mousedown", (e) => {
    if (
      circuitSettingsModal &&
      circuitSettingsModal.style.display === "flex" &&
      e.target === circuitSettingsModal
    ) {
      closeCircuitSettingsModal?.();
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
    if (saveCircuitBtn)
      saveCircuitBtn.style.display = isFinal ? "inline-flex" : "none";
    if (isFinal && createFinalTabBtns.length) {
      createFinalTabBtns.forEach((b) =>
        b.classList.toggle(
          "active",
          b.dataset.finalCreateTab === "createFinalGeneral",
        ),
      );
      createFinalPanels.forEach((panel) =>
        panel.classList.toggle("active", panel.id === "createFinalGeneral"),
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
  circuitSlugInput?.addEventListener("input", () => {
    updateCircuitSlugPreview?.();
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
      createPanels.forEach((panel) =>
        panel.classList.toggle("active", panel.id === target),
      );
    });
  });
  nextCreateCircuitStep?.addEventListener("click", () =>
    setCreateCircuitStep("final"),
  );
  backCreateCircuitStep?.addEventListener("click", () =>
    setCreateCircuitStep("circuit"),
  );
  createFinalTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.finalCreateTab;
      if (!target) return;
      createFinalTabBtns.forEach((b) =>
        b.classList.toggle("active", b === btn),
      );
      createFinalPanels.forEach((panel) =>
        panel.classList.toggle("active", panel.id === target),
      );
    });
  });
  const switchCircuitSettingsTab = (targetId) => {
    if (!targetId) return;
    circuitSettingsTabBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.circuitSettingsTab === targetId),
    );
    circuitSettingsPanels.forEach((panel) =>
      panel.classList.toggle("active", panel.id === targetId),
    );
  };
  circuitSettingsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchCircuitSettingsTab(btn.dataset.circuitSettingsTab);
    });
  });
  circuitFinalTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.finalSettingsTab;
      if (!target) return;
      circuitFinalTabBtns.forEach((b) =>
        b.classList.toggle("active", b === btn),
      );
      circuitFinalPanels.forEach((panel) =>
        panel.classList.toggle("active", panel.id === target),
      );
    });
  });
  const switchSettingsTab = (targetId) => {
    if (!targetId) return;
    settingsTabBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.settingsTab === targetId),
    );
    settingsPanels.forEach((panel) =>
      panel.classList.toggle("active", panel.id === targetId),
    );
  };
  settingsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchSettingsTab(btn.dataset.settingsTab);
    });
  });
  if (typeof window !== "undefined") {
    window.__switchSettingsTab = switchSettingsTab;
  }

  bindImagePreview(createImageInput, createImagePreview);
  bindImagePreview(finalImageInput, finalImagePreview);
  bindImagePreview(settingsImageInput, settingsImagePreview);
  bindImagePreview(circuitFinalImageInput, circuitFinalImagePreview);

  bindMapSelectionEvents({
    setMapPoolSelection,
    getDefaultMapPoolNames,
    toggleMapSelection,
  });
  finalUseLadderMapsBtn?.addEventListener("click", () =>
    setFinalMapPoolSelection?.(getDefaultMapPoolNames()),
  );
  finalClearMapPoolBtn?.addEventListener("click", () =>
    setFinalMapPoolSelection?.([]),
  );
  finalMapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleFinalMapSelection?.(card.dataset.mapName);
  });
  circuitFinalUseLadderMapsBtn?.addEventListener("click", () =>
    setCircuitFinalMapPoolSelection?.(getDefaultMapPoolNames()),
  );
  circuitFinalClearMapPoolBtn?.addEventListener("click", () =>
    setCircuitFinalMapPoolSelection?.([]),
  );
  circuitFinalMapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleCircuitFinalMapSelection?.(card.dataset.mapName);
  });
  bindSettingsEvents({
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
    handleSaveCircuitPoints: (event) =>
      handleSaveCircuitPoints?.(event, { handleSaveSettings }),
    handleApplyCircuitPoints,
  });
  const updateMmrStatusPreview = () => {
    const statusEl = document.getElementById("mmrStatus");
    if (!statusEl) return;
    updateMmrDisplay(statusEl, null, {
      requirePulseLinkEnabled: settingsRequirePulseLink?.checked,
    });
  };
  settingsRequirePulseLink?.addEventListener("change", updateMmrStatusPreview);

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

  createFormatSelect?.addEventListener("change", () => {
    syncFormatFieldVisibility("create");
    syncMaxPlayersInput(createFormatSelect, tournamentMaxPlayersInput);
  });
  settingsFormatSelect?.addEventListener("change", () => {
    syncFormatFieldVisibility("settings");
    syncMaxPlayersInput(settingsFormatSelect, settingsMaxPlayersInput);
  });
  finalFormatSelect?.addEventListener("change", () => {
    syncFormatFieldVisibility("final");
    syncMaxPlayersInput(finalFormatSelect, finalMaxPlayersInput);
  });
  circuitFinalFormatSelect?.addEventListener("change", () => {
    syncFormatFieldVisibility("circuitfinal");
    syncMaxPlayersInput(circuitFinalFormatSelect, circuitFinalMaxPlayersInput);
  });
  syncMaxPlayersInput(createFormatSelect, tournamentMaxPlayersInput);
  syncMaxPlayersInput(settingsFormatSelect, settingsMaxPlayersInput);
  syncMaxPlayersInput(finalFormatSelect, finalMaxPlayersInput);
  syncMaxPlayersInput(circuitFinalFormatSelect, circuitFinalMaxPlayersInput);
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
    document
      .getElementById("registrationCard")
      ?.scrollIntoView({ behavior: "smooth" });
  });
  jumpToBracket?.addEventListener("click", () => {
    switchTab("bracketTab");
    document
      .getElementById("bracketGrid")
      ?.scrollIntoView({ behavior: "smooth" });
  });

  enableDragScroll(bracketGrid, {
    ignoreSelector:
      'a, button, input, select, textarea, label, summary, details, [contenteditable="true"], [data-no-drag], .group-stage-scroll, .playoff-scroll, .name-text:not(.is-placeholder), .hover-info-container, .score-select, .row-actions',
  });

  if (bracketGrid) {
    const hoverHoldMs = 340;
    const hoverTimers = new WeakMap();
    const clearHoverTimer = (card) => {
      const timer = hoverTimers.get(card);
      if (timer) {
        clearTimeout(timer);
        hoverTimers.delete(card);
      }
    };
    const armHoverTimer = (card) => {
      clearHoverTimer(card);
      const timer = window.setTimeout(() => {
        card.classList.remove("is-hovering");
        hoverTimers.delete(card);
      }, hoverHoldMs);
      hoverTimers.set(card, timer);
    };

    bracketGrid.addEventListener("mouseover", (event) => {
      const card = event.target.closest(".match-card");
      if (!card || !bracketGrid.contains(card)) return;
      if (event.relatedTarget && card.contains(event.relatedTarget)) return;
      clearHoverTimer(card);
      card.classList.add("is-hovering");
    });

    bracketGrid.addEventListener("mouseout", (event) => {
      const card = event.target.closest(".match-card");
      if (!card || !bracketGrid.contains(card)) return;
      if (event.relatedTarget && card.contains(event.relatedTarget)) return;
      armHoverTimer(card);
    });
  }

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
    if (e.target.matches(".forfeit-player")) {
      const id = e.target.dataset.playerId;
      const next = e.target.dataset.forfeit === "true";
      setPlayerForfeit?.(id, next);
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
    if (e.target.matches(".result-select, .score-select")) {
      const card = e.target.closest(".match-card");
      const matchId = e.target.dataset.matchId || card?.dataset?.matchId;
      if (!matchId) return;
      const selects = card
        ? card.querySelectorAll("select.result-select, select.score-select")
        : document.querySelectorAll(
            `select.result-select[data-match-id="${matchId}"], select.score-select[data-match-id="${matchId}"]`,
          );
      const vals = Array.from(selects).map((s) => s.value || "0");
      updateMatchScore?.(matchId, vals[0], vals[1]);
    }
  });

  manualSeedingToggle?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    setManualSeedingEnabled?.(target.checked);
  });
  mmrSeedingToggle?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    setMmrSeedingMode?.(target.checked ? "current" : "registered");
  });

  let draggedRow = null;
  let dropTarget = null;
  const clearDropTargets = () => {
    if (dropTarget) {
      dropTarget.classList.remove("drop-before", "drop-after");
      dropTarget = null;
    }
  };

  playersTable?.addEventListener("dragstart", (event) => {
    if (!getManualSeedingActive?.()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("tr");
    const handle = target.closest(".seeding-drag-handle");
    if (!row || !handle) {
      event.preventDefault();
      return;
    }
    draggedRow = row;
    row.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.playerId || "");
    }
  });

  playersTable?.addEventListener("dragover", (event) => {
    if (!getManualSeedingActive?.() || !draggedRow) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("tr");
    if (!row || row === draggedRow) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const dropAfter = event.clientY > rect.top + rect.height / 2;
    if (dropTarget && dropTarget !== row) {
      dropTarget.classList.remove("drop-before", "drop-after");
    }
    row.classList.toggle("drop-before", !dropAfter);
    row.classList.toggle("drop-after", dropAfter);
    dropTarget = row;
  });

  playersTable?.addEventListener("dragleave", (event) => {
    if (!getManualSeedingActive?.() || !draggedRow) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("tr");
    if (!row || row !== dropTarget) return;
    clearDropTargets();
  });

  playersTable?.addEventListener("drop", (event) => {
    if (!getManualSeedingActive?.() || !draggedRow) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("tr");
    if (!row || row === draggedRow) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const dropAfter = event.clientY > rect.top + rect.height / 2;
    if (dropAfter) {
      row.after(draggedRow);
    } else {
      row.before(draggedRow);
    }
    const nextOrder = Array.from(playersTable.querySelectorAll("tr"))
      .map((item) => item.dataset.playerId || "")
      .filter(Boolean);
    handleManualSeedingReorder?.(nextOrder);
    clearDropTargets();
  });

  playersTable?.addEventListener("dragend", () => {
    if (draggedRow) {
      draggedRow.classList.remove("is-dragging");
    }
    draggedRow = null;
    clearDropTargets();
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const closeAdminPanels = () => {
    document.querySelectorAll(".hero-admin-panel.is-open").forEach((panel) => {
      panel.classList.remove("is-open");
      const toggle = panel
        .closest(".hero")
        ?.querySelector(".hero-admin-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  };
  document.querySelectorAll(".hero-admin-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const hero = toggle.closest(".hero");
      const panel = hero?.querySelector(".hero-admin-panel");
      if (!panel) return;
      const isOpen = panel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(".hero-admin-panel") ||
      target.closest(".hero-admin-toggle")
    )
      return;
    closeAdminPanels();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAdminPanels();
  });
  const placements = document.getElementById("tournamentPlacements");
  const placementsSlot = document.getElementById(
    "tournamentPlacementsMobileSlot",
  );
  const placementsHome = placements?.parentElement || null;
  const placementsHomeNext = placements?.nextSibling || null;
  const updatePlacementsLocation = () => {
    if (!placements || !placementsSlot || !placementsHome) return;
    const isMobile =
      window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    if (isMobile) {
      if (placements.parentElement !== placementsSlot) {
        placementsSlot.appendChild(placements);
      }
      return;
    }
    if (placements.parentElement === placementsHome) return;
    if (
      placementsHomeNext &&
      placementsHomeNext.parentNode === placementsHome
    ) {
      placementsHome.insertBefore(placements, placementsHomeNext);
    } else {
      placementsHome.appendChild(placements);
    }
  };
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      refreshTournamentListLayout();
      updatePlacementsLocation();
      closeAdminPanels();
    }, 150);
  });
  updatePlacementsLocation();

  const listViewport = document.querySelector(".tournament-list-viewport");
  if (listViewport && "IntersectionObserver" in window) {
    const sentinel = document.createElement("div");
    sentinel.className = "list-sentinel";
    listViewport.appendChild(sentinel);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMoreTournamentListItems();
          }
        });
      },
      { root: listViewport, rootMargin: "120px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
  }
  const statusSelect = document.getElementById("tournamentStatusSelect");
  const roleSelect = document.getElementById("tournamentRoleSelect");
  const ownerBtn = document.getElementById("tournamentMyFilterBtn");
  document.querySelectorAll("#tournamentTypeTabs .list-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#tournamentTypeTabs .list-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTournamentList();
    });
  });
  statusSelect?.addEventListener("change", () => renderTournamentList());
  roleSelect?.addEventListener("change", () => renderTournamentList());
  ownerBtn?.addEventListener("click", () => {
    const next = !ownerBtn.classList.contains("active");
    ownerBtn.classList.toggle("active", next);
    ownerBtn.setAttribute("aria-pressed", next ? "true" : "false");
    renderTournamentList();
  });
  attachPlayerDetailHandlers({ getPlayersMap });
  runAfterFirstPaint(() => {
    renderTournamentList();
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
      renderAll,
    });
  });

  const formatDiagrams = [
    {
      root: document.querySelector("#settingsTab .format-diagram"),
      maxPlayersInput: document.getElementById("settingsMaxPlayersInput"),
      formatSelect: document.getElementById("settingsFormatSelect"),
    },
    {
      root: document.querySelector("#createTournamentModal .format-diagram"),
      maxPlayersInput: document.getElementById("tournamentMaxPlayersInput"),
      formatSelect: document.getElementById("tournamentFormatSelect"),
    },
    {
      root: document.querySelector("#createFinalPanel .format-diagram"),
      maxPlayersInput: document.getElementById(
        "finalTournamentMaxPlayersInput",
      ),
      formatSelect: document.getElementById("finalFormatSelect"),
    },
  ];

  const clampMaxPlayersInput = (input, { clampMin = true } = {}) => {
    if (!input) return false;
    const raw = input.value.trim();
    if (!raw) return false;
    const value = Number(raw);
    if (!Number.isFinite(value)) return false;
    const clamped = clampMin
      ? Math.max(2, Math.min(32, Math.round(value)))
      : Math.min(32, Math.round(value));
    if (String(clamped) !== raw) {
      input.value = String(clamped);
      return true;
    }
    return false;
  };

  formatDiagrams.forEach((entry) => {
    updateFormatDiagramTitles(entry);
    entry.maxPlayersInput?.addEventListener("input", () => {
      clampMaxPlayersInput(entry.maxPlayersInput, { clampMin: false });
      updateFormatDiagramTitles(entry);
    });
    entry.maxPlayersInput?.addEventListener("blur", () => {
      if (clampMaxPlayersInput(entry.maxPlayersInput)) {
        updateFormatDiagramTitles(entry);
      }
    });
    entry.formatSelect?.addEventListener("change", () =>
      updateFormatDiagramTitles(entry),
    );
    const playoffsSelect = getPlayoffsSelectForRoot(entry.root);
    playoffsSelect?.addEventListener("change", () =>
      updateFormatDiagramTitles(entry),
    );
  });

  addBotBtn?.addEventListener("click", () => addBotPlayer?.());
  removeBotBtn?.addEventListener("click", () => removeBotPlayer?.());
  removeBotsBtn?.addEventListener("click", () => removeAllBots?.());

  syncFormatFieldVisibility("create");
  syncFormatFieldVisibility("settings");
  syncFormatFieldVisibility("final");

  const matchInspector = document.getElementById("matchInfoModal");
  const matchInspectorContent = matchInspector?.querySelector(
    ".match-inspector__content",
  );
  const bracketLayout = document.getElementById("bracketLayout");
  const railBtn = document.getElementById("matchInfoRailBtn");

  const setMatchInspectorOpen = (open) => {
    if (!matchInspector) return;

    const isOpen = !!open;

    if (!isOpen && matchInspector.contains(document.activeElement)) {
      document.activeElement?.blur();
    }

    matchInspector.classList.toggle("is-open", isOpen);
    matchInspector.removeAttribute("aria-hidden");
    if (matchInspectorContent) {
      matchInspectorContent.setAttribute(
        "aria-hidden",
        isOpen ? "false" : "true",
      );
    }

    if (bracketLayout) {
      bracketLayout.classList.toggle("inspector-collapsed", !isOpen);
    }
  };

  railBtn?.addEventListener("click", () => {
    const isOpen = matchInspector?.classList.contains("is-open");
    setMatchInspectorOpen(!isOpen);
  });

  window.setMatchInspectorOpen = setMatchInspectorOpen;

  // Default: collapsed (rail visible)
  setMatchInspectorOpen(false);
}
