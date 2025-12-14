import {
  auth,
  db,
  getCurrentUsername,
  getCurrentUserAvatarUrl,
  getPulseState,
  initializeAuthUI,
} from "../../../app.js";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { showToast } from "../toastHandler.js";
import { initUserSettingsModal } from "../settingsModalInit.js";
import DOMPurify from "dompurify";
import {
  STORAGE_KEY,
  BROADCAST_NAME,
  TOURNAMENT_REGISTRY_KEY,
  TOURNAMENT_COLLECTION,
  TOURNAMENT_STATE_COLLECTION,
  MAPS_JSON_URL,
  FALLBACK_LADDER_MAPS,
  defaultState,
  DEFAULT_PLAYER_AVATAR,
  MAX_SECONDARY_PULSE_LINKS,
  MIN_SECONDARY_PULSE_LINKS,
  GOOGLE_AVATAR_PATTERNS,
  defaultBestOf,
  defaultRoundRobinSettings,
  bracketTestHarness,
  broadcast,
  currentSlug,
  state,
  pulseProfile,
  derivedRace,
  derivedMmr,
  isAdmin,
  registryCache,
  currentTournamentMeta,
  requirePulseLinkSetting,
  mapPoolSelection,
  mapCatalog,
  mapCatalogLoaded,
  currentMapPoolMode,
  playerDetailModalInitialized,
  currentVetoMatchId,
  vetoState,
  setStateObj,
  setPulseProfileState,
  setDerivedRaceState,
  setDerivedMmrState,
  setIsAdminState,
  setRegistryCacheState,
  setCurrentTournamentMetaState,
  setRequirePulseLinkSettingState,
  setMapPoolSelectionState,
  setMapCatalogState,
  setMapCatalogLoadedState,
  setCurrentMapPoolModeState,
  setPlayerDetailModalInitializedState,
  setCurrentVetoMatchIdState,
  setVetoStateState,
  setCurrentSlugState,
} from "./state.js";
import { initBroadcastSync } from "./sync/broadcast.js";
import {
  playerSource,
  winnerSource,
  loserSource,
  safeWinnerSource,
  safeLoserSource,
  getAllMatches,
  getMatchLookup,
  resolveParticipants,
} from "./bracket/lookup.js";
import {
  applySeeding,
  buildBracket,
  buildEliminationBracket,
  buildRoundRobinBracket,
  buildLosersBracket,
  createMatch,
  normalizeRoundRobinSettings,
  normalizePlayoffMode,
} from "./bracket/build.js";
import {
  escapeHtml,
  sanitizeUrl,
  getSelectValue,
  getBestOfForMatch,
  parseMatchNumber,
  raceClassName,
} from "./bracket/renderUtils.js";
import {
  renderPlayerRow,
  renderScoreOptions,
  clampScoreSelectOptions,
  renderSimpleMatch,
  layoutBracketSection,
  attachMatchHoverHandlers,
  annotateConnectorPlayers,
  renderBracketView,
  renderRoundRobinView,
  renderRoundRobinPlayoffs,
  renderGroupBlock,
} from "./bracket/render.js";
import {
  renderMapsTab as renderMapsTabUI,
  renderChosenMaps as renderChosenMapsUI,
  updateMapButtons as updateMapButtonsUI,
} from "./maps/render.js";
import { renderMapPoolPicker as renderMapPoolPickerUI } from "./maps/pool.js";
import {
  setMapPoolSelection as setMapPoolSelectionUI,
  toggleMapSelection as toggleMapSelectionUI,
} from "./maps/selection.js";
import {
  openVetoModal,
  renderVetoPoolGrid,
  renderVetoSelectionList,
  renderVetoStatus,
  handleVetoPoolClick,
  hideVetoModal,
  saveVetoSelection,
  showVetoInfo,
} from "./maps/veto.js";

if (typeof window !== "undefined") {
  window.addEventListener("pulse-state-changed", (event) => {
    hydratePulseFromState(event.detail);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadMapCatalog();
  setMapPoolSelection(getDefaultMapPoolNames());
  initializeAuthUI();
  hydratePulseFromState(getPulseState());
  bindUI();
  const slugFromUrl = getSlugFromPath();
  if (slugFromUrl) {
    await enterTournament(slugFromUrl);
  } else {
    await showLanding();
  }
});

initBroadcastSync(syncFromRemote, getStorageKey, handlePopState);

function bindUI() {
  ensureTestHarnessPanel();
  initUserSettingsModal();
  const registrationForm = document.getElementById("registrationForm");
  const rebuildBtn = document.getElementById("rebuildBracketBtn");
  const resetBtn = document.getElementById("resetTournamentBtn");
  const jumpToRegistration = document.getElementById("jumpToRegistration");
  const jumpToBracket = document.getElementById("jumpToBracket");
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const autoFillBtn = document.getElementById("autoFillBtn");
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const switchAccountBtn = document.getElementById("switchAccountBtn");
  const raceSelect = document.getElementById("raceSelect");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const openCreateTournament = document.getElementById("openCreateTournament");
  const createModal = document.getElementById("createTournamentModal");
  const closeCreateTournament = document.getElementById(
    "closeCreateTournament"
  );
  const saveTournamentBtn = document.getElementById("saveTournamentBtn");
  const refreshTournaments = document.getElementById("refreshTournaments");
  const generateSlugBtn = document.getElementById("generateSlugBtn");
  const testBracketStartBtn = document.getElementById("testBracketStart");
  const testBracketPrevBtn = document.getElementById("testBracketPrev");
  const testBracketNextBtn = document.getElementById("testBracketNext");
  const descriptionInput = document.getElementById(
    "tournamentDescriptionInput"
  );
  const descToolbarBtns = document.querySelectorAll("[data-desc-action]");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const rulesToolbarBtns = document.querySelectorAll("[data-rules-action]");
  const mapPoolPicker = document.getElementById("mapPoolPicker");
  const useLadderMapsBtn = document.getElementById("useLadderMapsBtn");
  const clearMapPoolBtn = document.getElementById("clearMapPoolBtn");
  const settingsTabBtns = document.querySelectorAll("[data-settings-tab]");
  const settingsPanels = document.querySelectorAll(
    "#settingsTab .settings-panel"
  );
  const createTabBtns = document.querySelectorAll("[data-create-tab]");
  const createPanels = document.querySelectorAll(
    "#createTournamentModal .settings-panel"
  );
  const settingsUseLadderMapsBtn = document.getElementById(
    "settingsUseLadderMapsBtn"
  );
  const settingsClearMapPoolBtn = document.getElementById(
    "settingsClearMapPoolBtn"
  );
  const settingsMapPoolPicker = document.getElementById(
    "settingsMapPoolPicker"
  );
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const settingsDescToolbarBtns = document.querySelectorAll(
    "[data-settings-desc-action]"
  );
  const settingsRulesToolbarBtns = document.querySelectorAll(
    "[data-settings-rules-action]"
  );
  const slugInput = document.getElementById("tournamentSlugInput");
  const bestOfUpperInput = document.getElementById("bestOfUpperInput");
  const bestOfLowerInput = document.getElementById("bestOfLowerInput");
  const bestOfQuarterInput = document.getElementById("bestOfQuarterInput");
  const bestOfSemiInput = document.getElementById("bestOfSemiInput");
  const bestOfFinalInput = document.getElementById("bestOfFinalInput");
  const createFormatSelect = document.getElementById("tournamentFormatSelect");
  const settingsBestOfUpper = document.getElementById("settingsBestOfUpper");
  const settingsBestOfLower = document.getElementById("settingsBestOfLower");
  const settingsBestOfQuarter = document.getElementById(
    "settingsBestOfQuarter"
  );
  const settingsBestOfSemi = document.getElementById("settingsBestOfSemi");
  const settingsBestOfFinal = document.getElementById("settingsBestOfFinal");
  const settingsFormatSelect = document.getElementById("settingsFormatSelect");
  const vetoModal = document.getElementById("vetoModal");
  const closeVetoModal = document.getElementById("closeVetoModal");
  const saveVetoBtn = document.getElementById("saveVetoBtn");

  registrationForm?.addEventListener("submit", handleRegistration);
  rebuildBtn?.addEventListener("click", () =>
    rebuildBracket(true, "Manual reseed")
  );
  resetBtn?.addEventListener("click", resetTournament);
  autoFillBtn?.addEventListener("click", autoFillPlayers);

  signInBtn?.addEventListener("click", () => window.handleSignIn?.());
  signOutBtn?.addEventListener("click", () => window.handleSignOut?.());
  switchAccountBtn?.addEventListener("click", () =>
    window.handleSwitchAccount?.()
  );
  raceSelect?.addEventListener("change", () => {
    const statusEl = document.getElementById("mmrStatus");
    const normalizedRace = normalizeRaceLabel(raceSelect.value);
    setDerivedRaceState(normalizedRace || derivedRace);
    setDerivedMmrState(mmrForRace(normalizedRace));
    updateMmrDisplay(statusEl);
  });
  openRegisterBtn?.addEventListener("click", () => {
    switchTab("registrationTab");
    document
      .getElementById("registrationCard")
      ?.scrollIntoView({ behavior: "smooth" });
  });

  openCreateTournament?.addEventListener("click", async () => {
    await populateCreateForm();
    if (createModal) createModal.style.display = "flex";
  });
  closeCreateTournament?.addEventListener("click", () => {
    if (createModal) createModal.style.display = "none";
  });
  window.addEventListener("mousedown", (e) => {
    if (
      createModal &&
      createModal.style.display === "flex" &&
      e.target === createModal
    ) {
      createModal.style.display = "none";
    }
  });
  saveTournamentBtn?.addEventListener("click", handleCreateTournament);
  refreshTournaments?.addEventListener("click", () => renderTournamentList());
  generateSlugBtn?.addEventListener("click", async () => {
    const slugInput = document.getElementById("tournamentSlugInput");
    if (slugInput) slugInput.value = await generateUniqueSlug();
    await validateSlug();
    updateSlugPreview();
  });
  slugInput?.addEventListener("input", () => {
    updateSlugPreview();
  });
  createTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.createTab;
      if (!target) return;
      createTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      createPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === target);
      });
    });
  });
  settingsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.settingsTab;
      if (!target) return;
      settingsTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      settingsPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === target);
      });
    });
  });
  descriptionInput?.addEventListener("input", updateDescriptionPreview);
  rulesInput?.addEventListener("input", updateRulesPreview);
  descToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormatting(btn.dataset.descAction, "tournamentDescriptionInput")
    );
  });
  rulesToolbarBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      applyFormatting(btn.dataset.rulesAction, "tournamentRulesInput")
    );
  });
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
  document
    .getElementById("settingsDescriptionInput")
    ?.addEventListener("input", updateSettingsDescriptionPreview);
  document
    .getElementById("settingsRulesInput")
    ?.addEventListener("input", updateSettingsRulesPreview);
  useLadderMapsBtn?.addEventListener("click", () =>
    setMapPoolSelection(getDefaultMapPoolNames())
  );
  clearMapPoolBtn?.addEventListener("click", () => setMapPoolSelection([]));
  mapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleMapSelection(card.dataset.mapName);
  });
  settingsUseLadderMapsBtn?.addEventListener("click", () =>
    setMapPoolSelection(getDefaultMapPoolNames())
  );
  settingsClearMapPoolBtn?.addEventListener("click", () =>
    setMapPoolSelection([])
  );
  settingsMapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleMapSelection(card.dataset.mapName);
  });
  saveSettingsBtn?.addEventListener("click", handleSaveSettings);
  testBracketStartBtn?.addEventListener("click", () => setTestBracketCount(16));
  testBracketPrevBtn?.addEventListener("click", () =>
    cycleTestBracketCount(-1)
  );
  testBracketNextBtn?.addEventListener("click", () => cycleTestBracketCount(1));
  [
    bestOfUpperInput,
    bestOfLowerInput,
    bestOfQuarterInput,
    bestOfSemiInput,
    bestOfFinalInput,
  ].forEach((el) => {
    el?.addEventListener("input", () => {});
  });
  [
    settingsBestOfUpper,
    settingsBestOfLower,
    settingsBestOfQuarter,
    settingsBestOfSemi,
    settingsBestOfFinal,
  ].forEach((el) => {
    el?.addEventListener("input", () => {});
  });
  createFormatSelect?.addEventListener("change", () =>
    syncFormatFieldVisibility("create")
  );
  settingsFormatSelect?.addEventListener("change", () =>
    syncFormatFieldVisibility("settings")
  );
  closeVetoModal?.addEventListener("click", () => hideVetoModal());
  saveVetoBtn?.addEventListener("click", () => saveVetoSelection());

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

  // Let admins type freely; only reseed when the input is committed (blur/enter)
  playersTable?.addEventListener("change", (e) => {
    if (!isAdmin) return;
    if (e.target.matches(".points-input")) {
      const id = e.target.dataset.playerId;
      const raw = e.target.value;

      // If they clear the field, treat it as 0 when they leave the input
      const value = raw === "" ? 0 : Math.max(0, Number(raw) || 0);

      // Normalize display so it never stays blank
      if (raw === "") e.target.value = String(value);

      updatePlayerPoints(id, value); // this reseeds + resorts
    }
  });

  playersTable?.addEventListener("click", (e) => {
    if (!isAdmin) return;
    if (e.target.matches(".remove-player")) {
      const id = e.target.dataset.playerId;
      removePlayer(id);
    }
  });

  bracketGrid?.addEventListener("change", (e) => {
    if (e.target.matches(".score-select")) {
      const matchId = e.target.dataset.matchId;
      if (!matchId) return;
      const selects = document.querySelectorAll(
        `.score-select[data-match-id="${matchId}"]`
      );
      const vals = Array.from(selects).map((s) => s.value || "0");
      updateMatchScore(matchId, vals[0], vals[1]);
    }
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      switchTab(target);
    });
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

  attachPlayerDetailHandlers();
  renderMapPoolPicker();
  renderMapPoolPicker("settingsMapPoolPicker");
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  renderChosenMapsUI("settingsChosenMapList", {
    mapPoolSelection,
    getMapByName,
  });
  updateMapButtonsUI(currentMapPoolMode);
  ensureTestHarnessPanel();
  syncFormatFieldVisibility("create");
  syncFormatFieldVisibility("settings");
}

function ensureTestHarnessPanel() {
  const host =
    document.getElementById("bracketTab") ||
    document.getElementById("seedingCard") ||
    document.getElementById("adminTab") ||
    document.getElementById("registrationCard") ||
    document.body;
  if (!host) return;
  if (document.getElementById("testBracketPanel")) {
    updateTestHarnessLabel();
    return;
  }
  const panel = document.createElement("div");
  panel.id = "testBracketPanel";
  panel.style.marginTop = "8px";
  panel.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      <button class="cta small ghost" id="testBracketStart">Start 1-16 Test</button>
      <button class="cta small ghost" id="testBracketPrev">Prev</button>
      <button class="cta small ghost" id="testBracketNext">Next</button>
      <span class="helper" id="testBracketLabel">Test harness not started</span>
    </div>
  `;
  if (host.firstChild) {
    host.insertBefore(panel, host.firstChild);
  } else {
    host.appendChild(panel);
  }
  updateTestHarnessLabel();
}

function switchTab(targetId) {
  const targetPanel = document.getElementById(targetId);
  if (targetPanel && targetPanel.dataset.adminOnly === "true" && !isAdmin) {
    return;
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === targetId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const isTarget = panel.id === targetId;
    panel.classList.toggle("active", isTarget);
    panel.style.display = isTarget ? "block" : "none";
  });
}

function hydratePulseFromState(pulseState) {
  const raceSelect = document.getElementById("raceSelect");
  const mmrDisplay = document.getElementById("mmrDisplay");
  const pulseLinkDisplay = document.getElementById("pulseLinkDisplay");
  const statusEl = document.getElementById("mmrStatus");
  const requirePulseLinkEnabled =
    currentTournamentMeta?.requirePulseLink ?? requirePulseLinkSetting;

  const byRace =
    pulseState && typeof pulseState.byRace === "object"
      ? pulseState.byRace
      : null;
  const normalizedUrl = sanitizeUrl(pulseState?.url || "");
  const overallMmr = Number.isFinite(pulseState?.mmr)
    ? Math.round(pulseState.mmr)
    : null;
  const { race: bestRace, mmr: bestMmr } = pickBestRace(byRace, overallMmr);

  const secondary =
    pulseState && Array.isArray(pulseState.secondary)
      ? pulseState.secondary
      : [];

  setPulseProfileState(
    pulseState &&
      (normalizedUrl || overallMmr || bestRace || secondary.length)
      ? {
          ...pulseState,
          url: normalizedUrl,
          byRace,
          mmr: overallMmr,
          secondary,
        }
      : null
  );

  const existingSelection = pulseProfile
    ? normalizeRaceLabel(raceSelect?.value)
    : "";
  setDerivedRaceState(existingSelection || (pulseProfile ? bestRace : null));
  setDerivedMmrState(
    pulseProfile
      ? derivedRace
        ? mmrForRace(derivedRace)
        : bestMmr ?? overallMmr ?? null
      : null
  );

  const hasProfileUrl = Boolean(pulseProfile?.url);
  if (raceSelect) {
    const shouldDisable = requirePulseLinkEnabled && !hasProfileUrl;
    raceSelect.disabled = shouldDisable;
    if (derivedRace) {
      raceSelect.value = derivedRace;
    } else if (!shouldDisable) {
      raceSelect.value = raceSelect.value || "";
    }
  }
  if (mmrDisplay) {
    if (derivedRace) {
      mmrDisplay.value = Number.isFinite(derivedMmr)
        ? `${derivedMmr} MMR`
        : "No rank";
    } else {
      mmrDisplay.value = "";
    }
  }
  if (pulseLinkDisplay) {
    if (normalizedUrl) {
      pulseLinkDisplay.value = normalizedUrl;
    }
  }

  updateMmrDisplay(statusEl);
  populatePlayerNameFromProfile();
}

function pickBestRace(byRace = null, fallbackMmr = null) {
  const entries = Object.entries(byRace || {}).map(([race, value]) => ({
    race: normalizeRaceLabel(race),
    key: normalizeRaceKey(race),
    mmr: Number(value),
  }));
  const valid = entries
    .filter((entry) => entry.key && Number.isFinite(entry.mmr) && entry.mmr > 0)
    .sort((a, b) => b.mmr - a.mmr);

  if (valid.length) {
    return { race: valid[0].race, mmr: Math.round(valid[0].mmr) };
  }

  const mmr = Number.isFinite(fallbackMmr)
    ? Math.round(Math.max(0, fallbackMmr))
    : null;
  return { race: null, mmr };
}

function normalizeRaceLabel(raw) {
  const val = (raw || "").toString().toLowerCase();
  if (val.startsWith("z")) return "Zerg";
  if (val.startsWith("p")) return "Protoss";
  if (val.startsWith("t")) return "Terran";
  if (val.startsWith("r")) return "Random";
  return "";
}

function normalizeRaceKey(raw) {
  const val = (raw || "").toString().toLowerCase();
  if (val.startsWith("z")) return "zerg";
  if (val.startsWith("p")) return "protoss";
  if (val.startsWith("t")) return "terran";
  if (val.startsWith("r")) return "random";
  return "";
}

function autoFillPlayers() {
  // 32 clean names (no numbers)
  const names = [
    "Zephyr",
    "Astra",
    "Nexus",
    "Starlance",
    "Vortex",
    "Nightfall",
    "IonBlade",
    "WarpDrive",
    "Pulsefire",
    "Skyforge",
    "NovaWing",
    "CryoCore",
    "Flux",
    "Helix",
    "Frostbyte",
    "Titanfall",
    "RubyRock",
    "Solaris",
    "VoidReaper",
    "Tempest",
    "IronWarden",
    "Starweaver",
    "NeonViper",
    "GrimNova",
    "ArcRunner",
    "Quantum",
    "NightOwl",
    "DriftKing",
    "ShadowFox",
    "LunarEdge",
    "StormRider",
    "CoreSync",
  ];

  const races = ["Zerg", "Protoss", "Terran", "Random"];

  // shuffle names so the order changes each click
  const shuffled = [...names].sort(() => Math.random() - 0.5);

  const picks = shuffled.slice(0, 32).map((name) => {
    const race = races[Math.floor(Math.random() * races.length)];
    const mmr = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;
    return { name, race, mmr, points: 0 };
  });

  picks.forEach((p) => {
    createOrUpdatePlayer({
      name: p.name,
      race: p.race,
      sc2Link: "",
      mmr: p.mmr,
      points: p.points,
    });
  });

  const seededPlayers = applySeeding(state.players);
  saveState({ players: seededPlayers, needsReseed: false });
  rebuildBracket(true, "Dev auto-fill");
  addActivity("Auto-filled 32 players for testing.");
}

function buildTestPlayers(count) {
  // 32 clean names (no numbers in the display name)
  const pool = [
    "Zephyr",
    "Astra",
    "Nexus",
    "Starlance",
    "Vortex",
    "Nightfall",
    "IonBlade",
    "WarpDrive",
    "Pulsefire",
    "Skyforge",
    "NovaWing",
    "CryoCore",
    "Flux",
    "Helix",
    "Frostbyte",
    "Titanfall",
    "RubyRock",
    "Solaris",
    "VoidReaper",
    "Tempest",
    "IronWarden",
    "Starweaver",
    "NeonViper",
    "GrimNova",
    "ArcRunner",
    "Quantum",
    "NightOwl",
    "DriftKing",
    "ShadowFox",
    "LunarEdge",
    "StormRider",
    "CoreSync",
  ];

  const races = ["Zerg", "Protoss", "Terran", "Random"];
  const createdAt = Date.now();

  // Shuffle and pick `count` unique names
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  return picked.map((name, idx) => ({
    id: `test-${idx + 1}`, // ✅ UNIQUE ID (critical!)
    name, // ✅ No numbers
    race: races[Math.floor(Math.random() * races.length)],
    sc2Link: "",
    mmr: 4000 - idx * 25,
    points: 1000 - idx,
    seed: idx + 1,
    createdAt,
  }));
}

function updateTestHarnessLabel() {
  const label = document.getElementById("testBracketLabel");
  if (!label) return;
  label.textContent = bracketTestHarness.active
    ? `Testing ${bracketTestHarness.count} players`
    : "Test harness not started";
}

function setTestBracketCount(count) {
  const clamped = Math.max(1, Math.min(16, count));
  bracketTestHarness.active = true;
  bracketTestHarness.count = clamped;
  const testPlayers = buildTestPlayers(clamped);
  const ledger = {};
  testPlayers.forEach((p) => {
    ledger[playerKey(p.name, p.sc2Link)] = p.points ?? 0;
  });
  state.players = testPlayers;
  state.pointsLedger = ledger;
  const seededPlayers = applySeeding(state.players);
  saveState({ players: seededPlayers, needsReseed: false });
  rebuildBracket(true, `Test harness (${clamped} players)`);
  updateTestHarnessLabel();
}

function cycleTestBracketCount(delta) {
  if (!bracketTestHarness.active) {
    setTestBracketCount(16);
    return;
  }
  setTestBracketCount(bracketTestHarness.count + delta);
}

async function handleRegistration(event) {
  event.preventDefault();
  const name = document.getElementById("playerNameInput")?.value.trim();
  const statusEl = document.getElementById("mmrStatus");
  const raceSelect = document.getElementById("raceSelect");
  const selectedRace =
    normalizeRaceLabel(raceSelect?.value) || derivedRace || "";
  const race = selectedRace;
  const sc2Link = pulseProfile?.url ? sanitizeUrl(pulseProfile.url) : "";
  const mmr = mmrForRace(race);
  const pulseLinkInput = document.getElementById("pulseLinkDisplay");
  const manualPulseLink = pulseLinkInput?.value?.trim() || "";
  const sc2LinkInput = sc2Link
    ? sc2Link
    : manualPulseLink
    ? sanitizeUrl(manualPulseLink)
    : "";
  const requirePulseLinkEnabled =
    currentTournamentMeta?.requirePulseLink ?? requirePulseLinkSetting;
  const pointsField = document.getElementById("pointsInput");

  if (!auth.currentUser) {
    setStatus(
      statusEl,
      "Sign in and add your SC2Pulse link in Settings first.",
      true
    );
    return;
  }

  if (!name) {
    setStatus(statusEl, "Player name is required.", true);
    return;
  }

  const rawPoints = pointsField?.value ?? "";
  const requestedPoints =
    rawPoints === "" || rawPoints === null || rawPoints === undefined
      ? null
      : Number(rawPoints);
  const startingPoints =
    requestedPoints === null
      ? null
      : Number.isFinite(requestedPoints)
      ? Math.max(0, requestedPoints)
      : null;

  if (requirePulseLinkEnabled && !sc2LinkInput) {
    setStatus(
      statusEl,
      "This tournament requires your SC2Pulse link.",
      true
    );
    return;
  }

  if (!race) {
    setStatus(
      statusEl,
      "Could not load your MMR. Refresh SC2Pulse in Settings.",
      true
    );
    return;
  }

  if (raceSelect) {
    raceSelect.value = race;
  }

  if (Number.isFinite(mmr)) {
    setStatus(statusEl, `Using ${race} @ ${mmr} MMR from SC2Pulse.`, false);
  } else {
    setStatus(statusEl, `No rank found for ${race} — seeding as 0.`, true);
  }

  const avatarUrl = getCurrentUserAvatarUrl();
  if (!avatarUrl || isGoogleAvatarUrl(avatarUrl)) {
    setStatus(
      statusEl,
      "Choose your Z-Build Order avatar in Settings before registering (Google profile pictures are not allowed).",
      true
    );
    return;
  }
  const twitchUrl =
    document.getElementById("settingsTwitchInput")?.value?.trim() || "";
  let secondaryPulseLinks = collectSecondaryPulseLinks();
  const secondaryPulseProfiles =
    Array.isArray(pulseProfile?.secondary) && pulseProfile.secondary.length
      ? pulseProfile.secondary
      : [];
  if (!secondaryPulseLinks.length && secondaryPulseProfiles.length) {
    secondaryPulseLinks = secondaryPulseProfiles
      .map((entry) => (entry && typeof entry === "object" ? entry.url : ""))
      .filter(Boolean);
  }
  const mmrByRace = pulseProfile?.byRace ? { ...pulseProfile.byRace } : null;
  const mainClanSelect = document.getElementById("mainClanSelect");
  const selectedClanOption = mainClanSelect?.selectedOptions?.[0];
  const selectedClanId = mainClanSelect?.value || "";
  let clanName = selectedClanOption?.textContent || "";
  let clanAbbreviation = selectedClanOption?.dataset?.abbr || "";
  if (selectedClanId) {
    try {
      const clanDoc = await getDoc(doc(db, "clans", selectedClanId));
      if (clanDoc.exists()) {
        const clanData = clanDoc.data();
        clanName = clanData?.name || clanName;
        clanAbbreviation = clanData?.abbreviation || clanAbbreviation;
      }
    } catch (err) {
      console.warn("Could not fetch clan abbreviation", err);
    }
  }

  const newPlayer = createOrUpdatePlayer({
    name,
    race,
    sc2Link: sc2LinkInput,
    mmr: Number.isFinite(mmr) ? mmr : 0,
    points: startingPoints,
    avatarUrl,
    twitchUrl,
    secondaryPulseLinks,
    secondaryPulseProfiles,
    mmrByRace,
    clan: clanName === "None" ? "" : clanName,
    clanAbbreviation: clanAbbreviation || "",
    pulseName: pulseProfile?.accountName || "",
  });

  const hasCompletedMatches = bracketHasResults();
  const seededPlayers = applySeeding(state.players);
  const nextState = {
    players: seededPlayers,
    needsReseed: hasCompletedMatches,
  };

  saveState(nextState);
  addActivity(
    `${newPlayer.name} saved (${newPlayer.mmr || "MMR?"} MMR, ${
      newPlayer.points
    } pts)`
  );

  markRegisteredTournament(currentSlug);

  const shouldAutoRebuild = !hasCompletedMatches;
  if (shouldAutoRebuild) {
    rebuildBracket(true, "Roster updated");
  } else {
    setSeedingNotice(true);
    if (!state.bracket || !state.bracket.winners?.length) {
      rebuildBracket(true, "Initial bracket");
    } else {
      renderAll();
    }
  }

  event.target.reset();
  hydratePulseFromState(pulseProfile);
}

function mmrForRace(raceLabel) {
  const key = normalizeRaceKey(raceLabel);
  const byRace = pulseProfile?.byRace || null;
  if (key && byRace && Number.isFinite(byRace[key])) {
    return Math.round(byRace[key]);
  }
  return null;
}

function updateMmrDisplay(statusEl) {
  const mmrDisplay = document.getElementById("mmrDisplay");
  if (mmrDisplay) {
    if (derivedRace) {
      mmrDisplay.value = Number.isFinite(derivedMmr)
        ? `${derivedMmr} MMR`
        : "No rank";
    } else {
      mmrDisplay.value = "";
    }
  }

  if (!statusEl) statusEl = document.getElementById("mmrStatus");
  if (!statusEl) return;

  if (!auth.currentUser) {
    setStatus(
      statusEl,
      "Sign in and set your SC2Pulse link in Settings to register.",
      true
    );
    return;
  }

  if (!pulseProfile?.url) {
    setStatus(
      statusEl,
      "Set your SC2Pulse link in Settings to load race and MMR.",
      true
    );
    return;
  }

  if (derivedRace && Number.isFinite(derivedMmr)) {
    setStatus(
      statusEl,
      `Using ${derivedRace} @ ${derivedMmr} MMR from SC2Pulse.`,
      false
    );
  } else if (derivedRace) {
    setStatus(
      statusEl,
      `No rank found for ${derivedRace} — seeding as 0.`,
      true
    );
  } else if (pulseProfile?.url) {
    setStatus(statusEl, "Waiting for MMR. Refresh SC2Pulse in Settings.", true);
  }
}

function collectSecondaryPulseLinks() {
  const inputs = document.querySelectorAll(
    "#secondaryPulseList .secondary-pulse-input"
  );
  const links = [];
  inputs.forEach((input) => {
    const normalized = sanitizeUrl(input.value.trim());
    if (normalized && links.length < MAX_SECONDARY_PULSE_LINKS) {
      links.push(normalized);
    }
  });
  return links;
}

function isGoogleAvatarUrl(url = "") {
  if (!url) return false;
  return GOOGLE_AVATAR_PATTERNS.some((pattern) => pattern.test(url));
}

function setupPlayerDetailModal() {
  if (playerDetailModalInitialized) return;
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const closeBtn = document.getElementById("closePlayerDetailModal");

  const hide = () => {
    modal.style.display = "none";
  };
  const show = () => {
    modal.style.display = "block";
  };

  closeBtn?.addEventListener("click", hide);
  window.addEventListener("mousedown", (e) => {
    if (e.target === modal) hide();
  });

  modal.dataset.ready = "true";
  modal.showModal = show;
  setPlayerDetailModalInitializedState(true);
}

function attachPlayerDetailHandlers() {
  setupPlayerDetailModal();
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");

  const handler = (e) => {
    if (e.target.closest("select") || e.target.closest(".remove-player")) return;
    const trigger = e.target.closest("[data-player-id]");
    if (!trigger) return;
    const pid = trigger.dataset.playerId;
    if (!pid) return;
    const player = getPlayersMap().get(pid);
    if (player) {
      openPlayerDetailModal(player);
    }
  };

  bracketGrid?.addEventListener("click", handler);
  playersTable?.addEventListener("click", handler);
}

function formatPulseLinks(list = [], linkClass = "secondary-pulse-link") {
  if (!Array.isArray(list) || !list.length) {
    return DOMPurify.sanitize(`<p class="helper">No secondary links</p>`);
  }

  const items = list.slice(0, MAX_SECONDARY_PULSE_LINKS).map((entry, idx) => {
    const normalized =
      typeof entry === "string"
        ? { url: entry }
        : entry && typeof entry === "object"
        ? entry
        : {};
    const url = normalized.url || "";
    const name =
      (normalized.name && escapeHtml(String(normalized.name))) ||
      `SC2Pulse #${idx + 1}`;
    if (!url) {
      return `<div class="secondary-pulse-row readonly"><span class="pill">${name}</span><span class="muted">No link</span></div>`;
    }
    return `<div class="secondary-pulse-row readonly"><a class="${escapeHtml(
      linkClass
    )}" href="${escapeHtml(
      url
    )}" target="_blank" rel="noopener">${name}</a></div>`;
  });

  const html = `
    <div class="secondary-section-header">Secondary Accounts</div>
    ${items.join("")}
  `;

  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

function formatMmrByRace(player) {
  const list = document.getElementById("playerDetailMmrList");
  if (!list) return;
  const mmrByRace = player?.mmrByRace || {};
  const races = ["Zerg", "Protoss", "Terran", "Random"];
  const rows = races.map((race) => {
    const key = normalizeRaceKey(race);
    const value = Number.isFinite(mmrByRace?.[key]) ? Math.round(mmrByRace[key]) : null;
    const display = value !== null ? `${value}` : "No MMR";
    return `<li><span class="pill">${race}</span><strong>${display}</strong></li>`;
  });
  list.innerHTML = DOMPurify.sanitize(rows.join(""));
}

function resolvePlayerAvatar(player) {
  const userPhoto = document.getElementById("userPhoto")?.src;
  return player?.avatarUrl || userPhoto || DEFAULT_PLAYER_AVATAR;
}

function openPlayerDetailModal(player) {
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const avatar = document.getElementById("playerDetailAvatar");
  const nameEl = document.getElementById("playerDetailName");
  const clanEl = document.getElementById("playerDetailClan");
  const raceEl = document.getElementById("playerDetailRace");
  const pointsEl = document.getElementById("playerDetailPoints");
  const mainPulseEl = document.getElementById("playerDetailMainPulse");
  const pulseNameEl = document.getElementById("playerDetailPulseName");
  const secondaryEl = document.getElementById("playerDetailSecondary");
  const twitchEl = document.getElementById("playerDetailTwitch");
  const achievementsEl = document.getElementById("playerDetailAchievements");

  const avatarUrl = resolvePlayerAvatar(player);
  if (avatar) avatar.src = avatarUrl;
  if (nameEl) {
    const abbr = player?.clanAbbreviation;
    const displayName = player?.pulseName || player?.name;
    const safeName = displayName || "Player";
    nameEl.textContent = abbr ? `[${abbr}] ${safeName}` : safeName;
  }
  if (clanEl) {
    const clan = player?.clan || "";
    clanEl.textContent = clan || "No clan";
    clanEl.style.display = clan ? "inline-flex" : "none";
  }
  if (raceEl) raceEl.textContent = player?.race || "";
  if (pointsEl)
    pointsEl.textContent = `${player?.points || 0} pts • ${
      player?.mmr || 0
    } MMR`;

  if (mainPulseEl) {
    const displayName = player?.pulseName || "Main SC2Pulse";
    if (player?.sc2Link) {
      mainPulseEl.href = player.sc2Link;
      mainPulseEl.textContent = displayName;
    } else {
      mainPulseEl.removeAttribute("href");
      mainPulseEl.textContent = "Not provided";
    }
  }
  if (pulseNameEl) {
    pulseNameEl.textContent = player?.pulseName || "";
    pulseNameEl.style.display = player?.pulseName ? "block" : "none";
  }

  if (secondaryEl) {
    const secondaryProfiles =
      player?.secondaryPulseProfiles && player.secondaryPulseProfiles.length
        ? player.secondaryPulseProfiles
        : player?.secondaryPulseLinks && player.secondaryPulseLinks.length
        ? player.secondaryPulseLinks
        : [];
    const linkClass =
      (mainPulseEl && mainPulseEl.className) || "secondary-pulse-link";
    secondaryEl.innerHTML = formatPulseLinks(secondaryProfiles, linkClass);
  }

  if (twitchEl) {
    const twitchUrl = player?.twitchUrl || "";
    if (twitchUrl) {
      twitchEl.href = twitchUrl;
      twitchEl.innerHTML = `<img src="img/SVG/glitch_flat_purple.svg" class="menu-icon settings-list-icon" aria-hidden="true" /> ${escapeHtml(
        twitchUrl
      )}`;
    } else {
      twitchEl.removeAttribute("href");
      twitchEl.textContent = "Not provided";
    }
  }

  formatMmrByRace(player);

  if (achievementsEl) {
    if (Array.isArray(player?.achievements) && player.achievements.length) {
      achievementsEl.innerHTML = player.achievements
        .map((a) => `<div class="pill">${escapeHtml(String(a))}</div>`)
        .join("");
    } else {
      achievementsEl.textContent =
        "Coming soon: tournament wins and milestones.";
    }
  }

  modal.style.display = "block";
}

function populatePlayerNameFromProfile() {
  const input = document.getElementById("playerNameInput");
  if (!input || input.value.trim()) return;
  const username =
    getCurrentUsername?.() || auth.currentUser?.displayName || "";
  if (username) input.value = username;
}

async function showLanding() {
  const landing = document.getElementById("landingView");
  const tournamentView = document.getElementById("tournamentView");
  if (landing) landing.style.display = "block";
  if (tournamentView) tournamentView.style.display = "none";
  await renderTournamentList();
}

async function enterTournament(slug) {
  const landing = document.getElementById("landingView");
  const tournamentView = document.getElementById("tournamentView");
  setCurrentSlugState(slug);
  setStateObj(loadState());
  const registry = await loadTournamentRegistry(true);
  const tournament = registry.find((t) => t.slug === slug);
  setCurrentTournamentMetaState(tournament || null);
  setRequirePulseLinkSettingState(
    currentTournamentMeta?.requirePulseLink ?? requirePulseLinkSetting
  );
  if (currentTournamentMeta && !currentTournamentMeta.bestOf) {
    currentTournamentMeta.bestOf = { ...defaultBestOf };
  }
  if (currentTournamentMeta && !currentTournamentMeta.roundRobin) {
    currentTournamentMeta.roundRobin = { ...defaultRoundRobinSettings };
  }
  if (tournament?.mapPool?.length) {
    setMapPoolSelection(tournament.mapPool);
  } else {
    setMapPoolSelection(getDefaultMapPoolNames());
  }
  setTournamentHeader(tournament);
  setIsAdminState(
    !!(
      tournament &&
      auth.currentUser &&
      tournament.createdBy === auth.currentUser.uid
    )
  );
  toggleAdminUI(isAdmin);
  populateSettingsPanel(tournament);
  if (landing) landing.style.display = "none";
  if (tournamentView) tournamentView.style.display = "block";
  if (!state.bracket && state.players.length) {
    rebuildBracket(true, "Loaded saved players");
  } else {
    renderAll();
  }
  hydrateStateFromRemote(slug);
}

function setTournamentHeader(tournament) {
  const title = document.getElementById("tournamentTitle");
  const desc = document.getElementById("tournamentDescription");
  const descBody = document.getElementById("tournamentDescriptionBody");
  const rulesBody = document.getElementById("tournamentRulesBody");
  const format = document.getElementById("tournamentFormat");
  const start = document.getElementById("tournamentStart");
  const bracketTitle = document.getElementById("bracketTitle");
  const renderedDesc = tournament
    ? renderMarkdown(tournament.description || "")
    : "";
  const renderedRules = tournament
    ? renderMarkdown(tournament.rules || "")
    : "";
  if (title) title.textContent = tournament?.name || "Tournament";
  if (desc) desc.innerHTML = renderedDesc || "No description yet.";
  if (descBody)
    descBody.innerHTML =
      renderedDesc || '<p class="helper">No description yet.</p>';
  if (rulesBody)
    rulesBody.innerHTML =
      renderedRules || '<p class="helper">No rules yet.</p>';
  if (format) format.textContent = tournament?.format || "Tournament";
  if (start)
    start.textContent = tournament?.startTime
      ? new Date(tournament.startTime).toLocaleString()
      : "TBD";
  if (bracketTitle) bracketTitle.textContent = tournament?.format || "Bracket";
}

async function handleSaveSettings(event) {
  event?.preventDefault?.();
  if (!currentTournamentMeta?.slug) return;
  const name = document.getElementById("settingsNameInput")?.value?.trim();
  const description =
    document.getElementById("settingsDescriptionInput")?.value || "";
  const rules = document.getElementById("settingsRulesInput")?.value || "";
  const format =
    document.getElementById("settingsFormatSelect")?.value ||
    "Double Elimination";
  const maxPlayersRaw = document.getElementById(
    "settingsMaxPlayersInput"
  )?.value;
  const maxPlayers = maxPlayersRaw ? Math.max(2, Number(maxPlayersRaw)) : null;
  const startTime = document.getElementById("settingsStartInput")?.value || "";
  const bestOf = readBestOfFromForm("settings");
  const roundRobin = readRoundRobinSettings("settings");
  const requirePulseLink =
    document.getElementById("settingsRequirePulseLink")?.checked ?? true;
  const mapPool = mapPoolSelection.size
    ? Array.from(mapPoolSelection)
    : getDefaultMapPoolNames();
  if (!name) return;

  const payload = {
    name,
    description,
    rules,
    mapPool,
    format,
    maxPlayers,
    bestOf,
    roundRobin,
    startTime: startTime ? new Date(startTime).toISOString() : null,
    requirePulseLink,
    updatedAt: Date.now(),
  };

  const prevFormat = currentTournamentMeta?.format || "";
  const prevRR = currentTournamentMeta?.roundRobin || null;

  try {
    await setDoc(
      doc(db, TOURNAMENT_COLLECTION, currentTournamentMeta.slug),
      {
        ...payload,
        startTime: payload.startTime ? new Date(payload.startTime) : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to save tournament settings", err);
    showToast?.("Could not update tournament settings.", "error");
    return;
  }

  setCurrentTournamentMetaState({
    ...currentTournamentMeta,
    ...payload,
  });
  setRequirePulseLinkSettingState(payload.requirePulseLink);
  cacheTournamentRegistry(null);
  setTournamentHeader(currentTournamentMeta);
  renderMapsTab(currentTournamentMeta);
  const rrChanged = JSON.stringify(prevRR || {}) !== JSON.stringify(roundRobin);
  if (prevFormat !== format || rrChanged) {
    rebuildBracket(true, "Format updated");
  } else {
    renderBracket();
  }
  showToast?.("Tournament settings saved.", "success");
}
function toggleAdminUI(isAdminUser) {
  const adminTabBtn = document.getElementById("adminTabBtn");
  const seedingTabBtn = document.getElementById("seedingTabBtn");
  const settingsTabBtn = document.getElementById("settingsTabBtn");
  const registrationTab = document.getElementById("registrationTab");
  const jumpToReg = document.getElementById("jumpToRegistration");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const seedingCard = document.getElementById("seedingCard");
  const autoFillBtn = document.getElementById("autoFillBtn");
    if (adminTabBtn) adminTabBtn.style.display = "inline-flex";
    if (seedingTabBtn) seedingTabBtn.style.display = isAdminUser ? "inline-flex" : "none";
  if (settingsTabBtn)
    settingsTabBtn.style.display = isAdminUser ? "inline-flex" : "none";
  if (registrationTab) registrationTab.style.display = "";
  if (!isAdminUser) {
    switchTab("bracketTab");
  }
  if (jumpToReg) jumpToReg.style.display = isAdminUser ? "inline-flex" : "none";
  if (openRegisterBtn)
    openRegisterBtn.style.display = isAdminUser ? "none" : "inline-flex";
  if (seedingCard) seedingCard.style.display = isAdminUser ? "block" : "none";
  if (autoFillBtn)
    autoFillBtn.style.display = isAdminUser ? "inline-flex" : "none";
  const testPanel = document.getElementById("testBracketPanel");
  if (testPanel) testPanel.style.display = isAdminUser ? "block" : "none";
}

async function renderTournamentList() {
  const listEl = document.getElementById("tournamentList");
  if (!listEl) return;
  const registry = await loadTournamentRegistry(true);
  const currentUserId = auth.currentUser?.uid || null;
  const registeredSlugs = getRegisteredTournamentSlugs();
  updateLandingStats(registry);
  const filter =
    document.querySelector(".list-tab.active")?.dataset.listFilter || "open";
  const filtered = registry.filter((t) => {
    if (filter === "hosted")
      return currentUserId && t.createdBy === currentUserId;
    if (filter === "mine")
      return (
        registeredSlugs.has(t.slug) ||
        (currentUserId && t.createdBy === currentUserId)
      );
    return true;
  });
  const items = filtered.map((t) => {
    const start = t.startTime
      ? new Date(t.startTime).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "TBD";
    const creator = t.createdByName ? escapeHtml(t.createdByName) : "Host";
    return `<li class="tournament-card">
      <div>
        <h4>${escapeHtml(t.name)}</h4>
        <div class="meta">
          <span>${escapeHtml(t.format)}</span>
          <span>${t.maxPlayers || "?"} players</span>
          <span>${start}</span>
          <span>Host: ${creator}</span>
          <span>${t.slug}</span>
        </div>
      </div>
    </li>`;
  });
  listEl.innerHTML =
    items.join("") || `<li class="helper">No tournaments yet.</li>`;
  listEl.querySelectorAll(".tournament-card").forEach((card, idx) => {
    const slug = filtered[idx]?.slug;
    if (!slug) return;
    card.addEventListener("click", () => {
      history.pushState({}, "", `/tournament/${slug}`);
      enterTournament(slug);
    });
    card.tabIndex = 0;
    card.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        history.pushState({}, "", `/tournament/${slug}`);
        enterTournament(slug);
      }
    });
  });
  const stat = document.getElementById("statTournaments");
  if (stat) stat.textContent = String(registry.length);
}

function updateLandingStats(registry = []) {
  const statNextStart = document.getElementById("statNextStart");
  const futureStarts = registry
    .map((t) => (t.startTime ? new Date(t.startTime).getTime() : null))
    .filter((ts) => ts && ts > Date.now())
    .sort((a, b) => a - b);
  const next = futureStarts[0];
  if (statNextStart) {
    statNextStart.textContent = next ? new Date(next).toLocaleString() : "TBD";
  }
}

async function populateCreateForm() {
  const slugInput = document.getElementById("tournamentSlugInput");
  const nameInput = document.getElementById("tournamentNameInput");
  const descInput = document.getElementById("tournamentDescriptionInput");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const formatSelect = document.getElementById("tournamentFormatSelect");
  const maxInput = document.getElementById("tournamentMaxPlayersInput");
  const startInput = document.getElementById("tournamentStartInput");
  const upperInput = document.getElementById("bestOfUpperInput");
  const lowerInput = document.getElementById("bestOfLowerInput");
  const quarterInput = document.getElementById("bestOfQuarterInput");
  const semiInput = document.getElementById("bestOfSemiInput");
  const finalInput = document.getElementById("bestOfFinalInput");
  if (slugInput) slugInput.value = await generateUniqueSlug();
  if (nameInput) nameInput.value = "";
  if (descInput) descInput.value = "";
  if (rulesInput) rulesInput.value = "";
  if (formatSelect) formatSelect.value = "Double Elimination";
  if (maxInput) maxInput.value = "";
  if (startInput) startInput.value = "";
  if (upperInput) upperInput.value = defaultBestOf.upper;
  if (lowerInput) lowerInput.value = defaultBestOf.lower;
  if (quarterInput) quarterInput.value = defaultBestOf.quarter;
  if (semiInput) semiInput.value = defaultBestOf.semi;
  if (finalInput) finalInput.value = defaultBestOf.final;
  const rrDefaults = normalizeRoundRobinSettings(defaultRoundRobinSettings);
  const rrGroups = document.getElementById("roundRobinGroupsInput");
  const rrAdvance = document.getElementById("roundRobinAdvanceInput");
  const rrPlayoffs = document.getElementById("roundRobinPlayoffsSelect");
  if (rrGroups) rrGroups.value = rrDefaults.groups;
  if (rrAdvance) rrAdvance.value = rrDefaults.advancePerGroup;
  if (rrPlayoffs) rrPlayoffs.value = rrDefaults.playoffs;
  updateDescriptionPreview();
  updateRulesPreview();
  setMapPoolSelection(getDefaultMapPoolNames());
  await validateSlug();
  syncFormatFieldVisibility("create");
}

async function generateUniqueSlug() {
  const registry = await loadTournamentRegistry(true);
  let slug = "";
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  do {
    slug = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
  } while (registry.some((t) => t.slug === slug));
  return slug;
}

async function validateSlug() {
  const slugInput = document.getElementById("tournamentSlugInput");
  const status = document.getElementById("slugStatus");
  const registry = await loadTournamentRegistry(true);
  const value =
    slugInput?.value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-") || "";
  if (slugInput) slugInput.value = value;
  let exists = registry.some((t) => t.slug === value);
  if (!exists && value) {
    try {
      const snap = await getDoc(doc(db, TOURNAMENT_COLLECTION, value));
      exists = snap.exists();
    } catch (_) {
      // network issues ignored
    }
  }
  if (status) {
    status.textContent = exists
      ? "Slug is already taken."
      : "Slug is available.";
    status.style.color = exists ? "#ff8b8b" : "var(--muted)";
  }
  return !exists && value;
}

async function handleCreateTournament(event) {
  event?.preventDefault?.();
  const name = document.getElementById("tournamentNameInput")?.value?.trim();
  const slugInput = document.getElementById("tournamentSlugInput");
  const slugIsValid = await validateSlug();
  const slug = slugIsValid ? slugInput.value.trim() : "";
  const description =
    document.getElementById("tournamentDescriptionInput")?.value || "";
  const rules = document.getElementById("tournamentRulesInput")?.value || "";
  const format =
    document.getElementById("tournamentFormatSelect")?.value ||
    "Double Elimination";
  const maxPlayersRaw = document.getElementById(
    "tournamentMaxPlayersInput"
  )?.value;
  const maxPlayers = maxPlayersRaw ? Math.max(2, Number(maxPlayersRaw)) : null;
  const startTime =
    document.getElementById("tournamentStartInput")?.value || "";
  const bestOf = readBestOfFromForm("create");
  const roundRobin = readRoundRobinSettings("create");
  if (!name || !slug) return;
  const selectedMaps =
    mapPoolSelection.size > 0
      ? Array.from(mapPoolSelection)
      : getDefaultMapPoolNames();

  const payload = {
    name,
    slug,
    description,
    rules,
    mapPool: selectedMaps,
    format,
    maxPlayers,
    bestOf,
    roundRobin,
    startTime: startTime ? new Date(startTime).toISOString() : null,
    createdBy: auth.currentUser?.uid || "anon",
    createdByName:
      getCurrentUsername?.() || auth.currentUser?.displayName || "Host",
    createdAt: Date.now(),
    requirePulseLink: true,
  };

  try {
    await setDoc(doc(db, TOURNAMENT_COLLECTION, slug), {
      ...payload,
      startTime: payload.startTime ? new Date(payload.startTime) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setRegistryCacheState(null);
    cacheTournamentRegistry(null);
  } catch (_) {
    console.error("Failed to save tournament to Firestore", _);
    showToast?.(
      "Could not save tournament to Firestore. Using local cache only.",
      "error"
    );
  }

  const registry = await loadTournamentRegistry(true);
  const merged = registry.some((t) => t.slug === slug)
    ? registry
    : registry.concat(payload);
  setRegistryCacheState(merged);
  cacheTournamentRegistry(merged);
  document.getElementById("createTournamentModal").style.display = "none";
  renderTournamentList();
  history.pushState({}, "", `/tournament/${slug}`);
  enterTournament(slug);
}

async function loadTournamentRegistry(force = false) {
  if (!force && registryCache) return registryCache;
  const fallback = loadTournamentRegistryCache();
  try {
    const snap = await getDocs(collection(db, TOURNAMENT_COLLECTION));
    const list = snap.docs.map((d) => {
      const data = d.data() || {};
      const startTime = data.startTime?.toMillis
        ? data.startTime.toMillis()
        : data.startTime;
      return {
        id: d.id,
        slug: data.slug || d.id,
        name: data.name || d.id,
        description: data.description || "",
        rules: data.rules || "",
        mapPool: data.mapPool?.length ? data.mapPool : getDefaultMapPoolNames(),
        format: data.format || "Tournament",
        maxPlayers: data.maxPlayers || null,
        startTime: startTime || null,
        createdBy: data.createdBy || null,
        createdByName: data.createdByName || data.hostName || null,
        bestOf: data.bestOf || defaultBestOf,
      };
    });
    setRegistryCacheState(list);
    cacheTournamentRegistry(list);
    return list;
  } catch (_) {
    setRegistryCacheState(fallback);
    return fallback || [];
  }
}

function cacheTournamentRegistry(registry) {
  try {
    if (!registry) {
      localStorage.removeItem(TOURNAMENT_REGISTRY_KEY);
    } else {
      localStorage.setItem(TOURNAMENT_REGISTRY_KEY, JSON.stringify(registry));
    }
  } catch (_) {
    // ignore
  }
}

function loadTournamentRegistryCache() {
  try {
    const raw = localStorage.getItem(TOURNAMENT_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getRegisteredTournamentSlugs() {
  try {
    const raw = localStorage.getItem("registeredTournaments");
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return new Set();
  }
}

function markRegisteredTournament(slug) {
  if (!slug) return;
  try {
    const set = getRegisteredTournamentSlugs();
    set.add(slug);
    localStorage.setItem(
      "registeredTournaments",
      JSON.stringify(Array.from(set))
    );
  } catch (_) {
    // ignore storage errors
  }
}

function getSlugFromPath() {
  const path = window.location.pathname || "";
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "tournament") return null;
  return parts[1] || null;
}

async function handlePopState() {
  const slugFromUrl = getSlugFromPath();
  if (slugFromUrl) {
    await enterTournament(slugFromUrl);
  } else {
    setCurrentSlugState(null);
    setStateObj(loadState());
    await showLanding();
  }
}

function renderMarkdown(md) {
  if (!md) return "";
  const escaped = escapeHtml(md);
  const bold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const italics = bold.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return italics.replace(/\n/g, "<br>");
}

function updateDescriptionPreview() {
  const descInput = document.getElementById("tournamentDescriptionInput");
  const preview = document.getElementById("tournamentDescriptionPreview");
  if (!preview) return;
  preview.innerHTML = renderMarkdown(descInput?.value || "");
}

function updateRulesPreview() {
  const rulesInput = document.getElementById("tournamentRulesInput");
  const preview = document.getElementById("tournamentRulesPreview");
  if (!preview) return;
  preview.innerHTML = renderMarkdown(rulesInput?.value || "");
}

function updateSettingsDescriptionPreview() {
  const descInput = document.getElementById("settingsDescriptionInput");
  const preview = document.getElementById("settingsDescriptionPreview");
  if (!preview) return;
  preview.innerHTML = renderMarkdown(descInput?.value || "");
}

function updateSettingsRulesPreview() {
  const rulesInput = document.getElementById("settingsRulesInput");
  const preview = document.getElementById("settingsRulesPreview");
  if (!preview) return;
  preview.innerHTML = renderMarkdown(rulesInput?.value || "");
}

async function loadMapCatalog() {
  if (mapCatalogLoaded) return mapCatalog;
  try {
    const resp = await fetch(MAPS_JSON_URL, { cache: "no-cache" });
    const data = await resp.json();
    if (Array.isArray(data)) {
      setMapCatalogState(data);
      setMapCatalogLoadedState(true);
      return mapCatalog;
    }
  } catch (err) {
    console.warn("Falling back to bundled ladder map list", err);
  }
  setMapCatalogState(FALLBACK_LADDER_MAPS);
  setMapCatalogLoadedState(true);
  return mapCatalog;
}

function getLadderMaps() {
  const source = mapCatalog.length ? mapCatalog : FALLBACK_LADDER_MAPS;
  const currentOnly = source.filter((m) =>
    (m.folder || "").toLowerCase().includes("current/1v1")
  );
  if (currentOnly.length) return currentOnly;
  const explicitCurrent = source.filter((m) =>
    (m.folder || "").toLowerCase().includes("current")
  );
  return explicitCurrent.length ? explicitCurrent : FALLBACK_LADDER_MAPS;
}

function getAll1v1Maps() {
  const source = mapCatalog.length ? mapCatalog : FALLBACK_LADDER_MAPS;
  const all = source.filter(
    (m) =>
      (m.mode || "").toLowerCase() === "1v1" || (m.folder || "").includes("1v1")
  );
  return all.length ? all : FALLBACK_LADDER_MAPS;
}

function updateSlugPreview() {
  // Preview removed per design change
}

function getDefaultMapPoolNames() {
  return getLadderMaps().map((m) => m.name);
}

function getMapByName(name) {
  return getAll1v1Maps().find((m) => m.name === name) || null;
}

function readBestOfFromForm(prefix) {
  const ids =
    prefix === "settings"
      ? {
          upper: "settingsBestOfUpper",
          lower: "settingsBestOfLower",
          quarter: "settingsBestOfQuarter",
          semi: "settingsBestOfSemi",
          final: "settingsBestOfFinal",
          lowerSemi: "settingsBestOfLowerSemi",
          lowerFinal: "settingsBestOfLowerFinal",
        }
      : {
          upper: "bestOfUpperInput",
          lower: "bestOfLowerInput",
          quarter: "bestOfQuarterInput",
          semi: "bestOfSemiInput",
          final: "bestOfFinalInput",
          lowerSemi: "bestOfLowerSemiInput",
          lowerFinal: "bestOfLowerFinalInput",
        };

  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    const num = Number(el?.value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  };

  return {
    upper: getVal(ids.upper, defaultBestOf.upper),
    lower: getVal(ids.lower, defaultBestOf.lower),
    quarter: getVal(ids.quarter, defaultBestOf.quarter),
    semi: getVal(ids.semi, defaultBestOf.semi),
    final: getVal(ids.final, defaultBestOf.final),
    lowerSemi: getVal(ids.lowerSemi, defaultBestOf.lowerSemi),
    lowerFinal: getVal(ids.lowerFinal, defaultBestOf.lowerFinal),
  };
}

function readRoundRobinSettings(prefix) {
  const ids =
    prefix === "settings"
      ? {
          groups: "settingsRoundRobinGroups",
          advance: "settingsRoundRobinAdvance",
          playoffs: "settingsRoundRobinPlayoffs",
        }
      : {
          groups: "roundRobinGroupsInput",
          advance: "roundRobinAdvanceInput",
          playoffs: "roundRobinPlayoffsSelect",
        };

  const groupsVal = Number(
    document.getElementById(ids.groups)?.value ||
      defaultRoundRobinSettings.groups
  );
  const advanceVal = Number(
    document.getElementById(ids.advance)?.value ||
      defaultRoundRobinSettings.advancePerGroup
  );
  const playoffsVal =
    document.getElementById(ids.playoffs)?.value ||
    defaultRoundRobinSettings.playoffs;

  return normalizeRoundRobinSettings({
    groups: groupsVal,
    advancePerGroup: advanceVal,
    playoffs: playoffsVal,
  });
}

function isRoundRobinFormat(format) {
  return (format || "").toLowerCase().startsWith("round robin");
}

function syncFormatFieldVisibility(scope) {
  const selectId =
    scope === "settings" ? "settingsFormatSelect" : "tournamentFormatSelect";
  const value = document.getElementById(selectId)?.value || "";
  const isRR = isRoundRobinFormat(value);
  const rrBlocks = document.querySelectorAll(
    `[data-format-scope="${scope}-roundrobin"]`
  );
  rrBlocks.forEach((el) => {
    el.style.display = isRR ? "flex" : "none";
  });
}

function setMapPoolSelection(names) {
  setMapPoolSelectionUI(names, {
    setMapPoolSelectionState,
    setCurrentMapPoolModeState,
    mapPoolSelection,
    getDefaultMapPoolNames,
    getMapByName,
    getAll1v1Maps,
    updateMapButtonsUI,
  });
}

function toggleMapSelection(name) {
  toggleMapSelectionUI(name, {
    mapPoolSelection,
    setCurrentMapPoolModeState,
    getDefaultMapPoolNames,
    getAll1v1Maps,
    getMapByName,
    renderMapPoolPicker: renderMapPoolPickerUI,
    renderChosenMapsUI,
    updateMapButtonsUI,
  });
}

function renderMapPoolPicker(targetId = "mapPoolPicker") {
  renderMapPoolPickerUI(targetId, { mapPoolSelection, getAll1v1Maps });
}

function applyFormatting(action, textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const wrap = (prefix, suffix = prefix) => {
    textarea.value = `${before}${prefix}${selected || ""}${suffix}${after}`;
    const cursor =
      before.length + prefix.length + (selected ? selected.length : 0);
    textarea.setSelectionRange(cursor, cursor);
  };

  switch (action) {
    case "bold":
      wrap("**", "**");
      break;
    case "italic":
      wrap("*", "*");
      break;
    case "heading":
      textarea.value = `${before}## ${selected || "Heading"}${after}`;
      textarea.setSelectionRange(
        before.length + 3,
        before.length + 3 + (selected || "Heading").length
      );
      break;
    case "bullet":
      textarea.value = `${before}- ${selected || "List item"}${after}`;
      break;
    case "numbered":
      textarea.value = `${before}1. ${selected || "List item"}${after}`;
      break;
    case "quote":
      textarea.value = `${before}> ${selected || "Quote"}${after}`;
      break;
    case "link":
      wrap(
        "[",
        `](${selected ? "https://example.com" : "https://example.com"})`
      );
      break;
    case "image":
      textarea.value = `${before}![alt text](${
        selected || "https://example.com/image.png"
      })${after}`;
      break;
    case "code":
      wrap("`", "`");
      break;
    default:
      break;
  }

  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
}

function createOrUpdatePlayer(payload) {
  const ledgerKey = playerKey(payload.name, payload.sc2Link);
  const savedPoints = state.pointsLedger[ledgerKey] ?? 0;
  const existingIndex = state.players.findIndex(
    (p) => playerKey(p.name, p.sc2Link) === ledgerKey
  );

  const resolvedPoints =
    payload.points === null || payload.points === undefined
      ? savedPoints
      : payload.points;

  const base = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
    seed: 0,
    points: resolvedPoints,
    avatarUrl: payload.avatarUrl || DEFAULT_PLAYER_AVATAR,
    clan: payload.clan || "",
    clanAbbreviation: payload.clanAbbreviation || "",
    twitchUrl: payload.twitchUrl || "",
    secondaryPulseLinks: Array.isArray(payload.secondaryPulseLinks)
      ? payload.secondaryPulseLinks.slice(0, MAX_SECONDARY_PULSE_LINKS)
      : [],
    secondaryPulseProfiles: Array.isArray(payload.secondaryPulseProfiles)
      ? payload.secondaryPulseProfiles.slice(0, MAX_SECONDARY_PULSE_LINKS)
      : [],
    mmrByRace: payload.mmrByRace || null,
    achievements: payload.achievements || [],
    pulseName: payload.pulseName || "",
    ...payload,
  };

  let updatedPlayer = base;

  if (existingIndex !== -1) {
    updatedPlayer = {
      ...state.players[existingIndex],
      ...payload,
      points:
        payload.points === null || payload.points === undefined
          ? state.players[existingIndex].points ?? savedPoints
          : payload.points,
      avatarUrl:
        payload.avatarUrl ||
        state.players[existingIndex].avatarUrl ||
        DEFAULT_PLAYER_AVATAR,
      clan: payload.clan ?? state.players[existingIndex].clan ?? "",
      clanAbbreviation:
        payload.clanAbbreviation ??
        state.players[existingIndex].clanAbbreviation ??
        "",
      twitchUrl:
        payload.twitchUrl ?? state.players[existingIndex].twitchUrl ?? "",
      secondaryPulseLinks:
        Array.isArray(payload.secondaryPulseLinks) &&
        payload.secondaryPulseLinks.length
          ? payload.secondaryPulseLinks.slice(0, MAX_SECONDARY_PULSE_LINKS)
          : state.players[existingIndex].secondaryPulseLinks || [],
      secondaryPulseProfiles:
        Array.isArray(payload.secondaryPulseProfiles) &&
        payload.secondaryPulseProfiles.length
          ? payload.secondaryPulseProfiles.slice(0, MAX_SECONDARY_PULSE_LINKS)
          : state.players[existingIndex].secondaryPulseProfiles || [],
      mmrByRace: payload.mmrByRace ?? state.players[existingIndex].mmrByRace,
      achievements:
        payload.achievements?.length === 0 ||
        Array.isArray(payload.achievements)
          ? payload.achievements
          : state.players[existingIndex].achievements || [],
      pulseName:
        payload.pulseName ?? state.players[existingIndex].pulseName ?? "",
    };
    state.players[existingIndex] = updatedPlayer;
  } else {
    state.pointsLedger[ledgerKey] = resolvedPoints ?? 0;
    state.players.push(updatedPlayer);
  }

  state.pointsLedger[ledgerKey] = updatedPlayer.points ?? savedPoints;
  return updatedPlayer;
}

function updatePlayerPoints(playerId, points) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  player.points = points;
  const ledgerKey = playerKey(player.name, player.sc2Link);
  state.pointsLedger[ledgerKey] = points;
  const seeded = applySeeding(state.players);
  saveState({ players: seeded, needsReseed: true });
  setSeedingNotice(true);
  renderAll();
}

function removePlayer(playerId) {
  state.players = state.players.filter((p) => p.id !== playerId);
  addActivity("Removed a player from the roster.");
  const seeded = applySeeding(state.players);
  const hadResults = bracketHasResults();
  saveState({ players: seeded, needsReseed: hadResults });
  if (!hadResults) {
    rebuildBracket(true, "Roster updated");
  } else {
    setSeedingNotice(true);
    renderAll();
  }
}

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#ff8b8b" : "var(--muted)";
}

async function fetchMmrFromPulse(link, statusEl) {
  try {
    const url = sanitizeUrl(link);
    if (!url) {
      setStatus(
        statusEl,
        "Invalid SC2Pulse link. Please double-check the URL.",
        true
      );
      return 0;
    }
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const text = await response.text();
    // Try to get "last" or "current" MMR from the stats section
    const mmrMatch =
      text.match(/"last":\s*([0-9]{3,5})/i) ||
      text.match(/"current":\s*([0-9]{3,5})/i) ||
      text.match(/mmr[^0-9]*([0-9]{3,5})/i) ||
      text.match(/rating[^0-9]*([0-9]{3,5})/i);
    if (mmrMatch && mmrMatch[1]) {
      return Number(mmrMatch[1]);
    }
    setStatus(
      statusEl,
      "Could not find MMR in the page. Enter it manually.",
      true
    );
    return 0;
  } catch (err) {
    setStatus(
      statusEl,
      "Could not fetch MMR (CORS or offline). Please fill it manually.",
      true
    );
    return 0;
  }
}

function rebuildBracket(force = false, reason = "") {
  if (!force && state.needsReseed === false && state.bracket) {
    return;
  }
  const seededPlayers = applySeeding(state.players);
  const bracket = buildBracket(
    seededPlayers,
    currentTournamentMeta || { format: "Double Elimination" },
    isRoundRobinFormat
  );
  if (!isRoundRobinFormat(currentTournamentMeta?.format)) {
    autoResolveByes(bracket);
  }
  saveState({
    players: seededPlayers,
    bracket,
    needsReseed: false,
  });
  setSeedingNotice(false);
  if (reason) addActivity(`Bracket regenerated (${reason}).`);
  renderAll();
}
function groupStandingComparator(a, b) {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.mapDiff !== b.mapDiff) return b.mapDiff - a.mapDiff;
  if (a.mapFor !== b.mapFor) return b.mapFor - a.mapFor;
  return a.seed - b.seed;
}

function computeGroupStandings(bracket, group, playersById, lookup) {
  const stats = new Map();
  const ids = group.playerIds || [];
  ids.forEach((id) => {
    const player = playersById.get(id);
    stats.set(id, {
      playerId: id,
      wins: 0,
      losses: 0,
      mapFor: 0,
      mapAgainst: 0,
      mapDiff: 0,
      seed: player?.seed || Number.MAX_SAFE_INTEGER,
    });
  });

  (group.matches || []).forEach((match) => {
    const ref = lookup?.get(match.id) || match;
    if (!ref || ref.status !== "complete" || !ref.winnerId) return;
    const [sourceA, sourceB] = ref.sources || [];
    const pA = playersById.get(sourceA?.playerId) || null;
    const pB = playersById.get(sourceB?.playerId) || null;
    if (!pA || !pB) return;
    const entryA = stats.get(pA.id);
    const entryB = stats.get(pB.id);
    if (!entryA || !entryB) return;
    const scores = ref.scores || [0, 0];
    entryA.mapFor += scores[0];
    entryA.mapAgainst += scores[1];
    entryB.mapFor += scores[1];
    entryB.mapAgainst += scores[0];
    entryA.mapDiff = entryA.mapFor - entryA.mapAgainst;
    entryB.mapDiff = entryB.mapFor - entryB.mapAgainst;
    if (ref.winnerId === pA.id) {
      entryA.wins += 1;
      entryB.losses += 1;
    } else if (ref.winnerId === pB.id) {
      entryB.wins += 1;
      entryA.losses += 1;
    }
  });

  return Array.from(stats.values()).sort(groupStandingComparator);
}

function collectAdvancingPlayers(bracket, settings, playersForSeeding = []) {
  const playersById =
    playersForSeeding.length && playersForSeeding[0]?.id
      ? new Map(playersForSeeding.map((p) => [p.id, p]))
      : getPlayersMap();
  const lookup = getMatchLookup(bracket);
  const advancing = [];

  (bracket.groups || []).forEach((group, gIdx) => {
    const standings = computeGroupStandings(
      bracket,
      group,
      playersById,
      lookup
    );
    const slots = Math.min(settings.advancePerGroup, standings.length);
    for (let i = 0; i < slots; i++) {
      advancing.push({
        ...standings[i],
        groupIndex: gIdx,
        rank: i + 1,
      });
    }
  });

  advancing.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return groupStandingComparator(a, b);
  });

  return advancing;
}

function playoffsStarted(bracket) {
  const all = [
    ...(bracket.winners || []).flat(),
    ...(bracket.losers || []).flat(),
    bracket.finals,
  ].filter(Boolean);
  return all.some((m) => m.status === "complete");
}

function ensureRoundRobinPlayoffs(bracket, playersForSeeding = []) {
  if (!bracket || !Array.isArray(bracket.groups)) return;
  const settings = normalizeRoundRobinSettings(
    bracket.roundRobin || currentTournamentMeta?.roundRobin || {}
  );
  bracket.roundRobin = settings;
  bracket.playoffs = { mode: settings.playoffs };
  const mode = (settings.playoffs || "None").toLowerCase();
  const hasPlayoffs = mode !== "none";

  if (!hasPlayoffs) {
    bracket.winners = [];
    bracket.losers = [];
    bracket.finals = null;
    return;
  }

  const includeLosers = mode.startsWith("double");
  const groupsComplete = (bracket.groups || []).every((g) =>
    (g.matches || []).every((m) => m.status === "complete")
  );

  if (!groupsComplete) {
    bracket.winners = [];
    bracket.losers = [];
    bracket.finals = null;
    return;
  }

  const advancing = collectAdvancingPlayers(
    bracket,
    settings,
    playersForSeeding
  );

  if (advancing.length < 2) {
    bracket.winners = [];
    bracket.losers = [];
    bracket.finals = null;
    return;
  }

  if (playoffsStarted(bracket)) return;

  const playersById =
    playersForSeeding.length && playersForSeeding[0]?.id
      ? new Map(playersForSeeding.map((p) => [p.id, p]))
      : getPlayersMap();

  const seededAdvancing = advancing.map((entry, idx) => {
    const base = playersById.get(entry.playerId) || {
      id: entry.playerId,
      name: "TBD",
    };
    return { ...base, seed: idx + 1 };
  });

  const playoffBracket = buildEliminationBracket(seededAdvancing, {
    includeLosers,
  });

  bracket.winners = playoffBracket.winners;
  bracket.losers = playoffBracket.losers;
  bracket.finals = playoffBracket.finals;
  bracket.playoffSeedOrder = seededAdvancing.map((p) => p.id);
}

function autoResolveByes(bracket) {
  const matches = getAllMatches(bracket);
  const lookup = getMatchLookup(bracket);
  const playersById = getPlayersMap();

  matches.forEach((match) => {
    if (match.status === "complete") return;
    // Only auto-advance free wins in Winners Round 1; elsewhere keep matches pending.
    if (!(match.bracket === "winners" && match.round === 1)) return;
    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    if (pA && !pB) {
      finalizeMatchResult(match, {
        winnerId: pA.id,
        loserId: null,
        scores: [0, 0],
        walkover: null,
      });
    } else if (!pA && pB) {
      finalizeMatchResult(match, {
        winnerId: pB.id,
        loserId: null,
        scores: [0, 0],
        walkover: null,
      });
    }
  });
}

function applyMatchInputs(card) {
  const matchId = card.dataset.matchId;
  const selects = card.querySelectorAll(".result-select");
  const valA = selects[0]?.value || "0";
  const valB = selects[1]?.value || "0";
  updateMatchScore(matchId, valA, valB);
}

function parseResult(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  if (v === "W" || v === "W/O") return { type: "walkover" };
  const num = Number(v);
  return { type: "score", value: Number.isFinite(num) ? Math.max(0, num) : 0 };
}

function updateMatchScore(matchId, valA, valB) {
  if (!state.bracket) return;
  const lookup = getMatchLookup(state.bracket);
  const match = lookup.get(matchId);
  if (!match) return;

  const playersById = getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  const prevWinner = match.winnerId;
  const resA = parseResult(valA);
  const resB = parseResult(valB);
  const bestOf = getBestOfForMatch(match);
  const needed = Math.ceil((bestOf || 1) / 2);

  if (!pA || !pB) {
    finalizeMatchResult(match, {
      winnerId: null,
      loserId: null,
      scores: [resA.value || 0, resB.value || 0],
      walkover: null,
      status: "pending",
    });
    saveState({ bracket: state.bracket });
    renderBracket();
    return;
  }

  let winnerId = null;
  let loserId = null;
  let status = "pending";
  let finalScores = [resA.value || 0, resB.value || 0];
  let walkoverValue = null;

  if (resA.type === "walkover" && resB.type !== "walkover") {
    // Player A forfeits -> Player B wins
    winnerId = pB.id;
    loserId = pA.id;
    status = "complete";
    finalScores = [0, needed];
    walkoverValue = "a";
  } else if (resB.type === "walkover" && resA.type !== "walkover") {
    // Player B forfeits -> Player A wins
    winnerId = pA.id;
    loserId = pB.id;
    status = "complete";
    finalScores = [needed, 0];
    walkoverValue = "b";
  } else if (
    resA.type === "score" &&
    resB.type === "score" &&
    resA.value !== resB.value
  ) {
    if (resA.value >= needed || resB.value >= needed) {
      winnerId = resA.value > resB.value ? pA.id : pB.id;
      loserId = resA.value > resB.value ? pB.id : pA.id;
      status = "complete";
    } else {
      status = "pending";
    }
  }

  if (prevWinner && prevWinner !== winnerId) {
    clearDownstream(matchId);
  }

  finalizeMatchResult(match, {
    winnerId,
    loserId,
    scores: finalScores,
    walkover: walkoverValue,
    status,
  });

  if (match.status === "complete") {
    addActivity(
      `${pA.name} ${finalScores[0]} - ${finalScores[1]} ${pB.name}${
        walkoverValue ? ` (walkover: ${walkoverValue.toUpperCase()})` : ""
      }`
    );
  }

  if (isRoundRobinFormat(currentTournamentMeta?.format)) {
    ensureRoundRobinPlayoffs(state.bracket);
  }

  saveState({ bracket: state.bracket });
  renderBracket();
}

function clearDownstream(matchId) {
  if (!state.bracket) return;
  const matches = getAllMatches(state.bracket);
  const dependents = matches.filter((m) =>
    m.sources.some((src) => src?.type === "match" && src.matchId === matchId)
  );
  dependents.forEach((dep) => {
    dep.winnerId = null;
    dep.loserId = null;
    dep.scores = [0, 0];
    dep.walkover = null;
    dep.status = "pending";
    dep.updatedAt = Date.now();
    clearDownstream(dep.id);
  });
}

function finalizeMatchResult(
  match,
  { winnerId, loserId, scores, walkover, status }
) {
  match.winnerId = winnerId ?? null;
  match.loserId = loserId ?? null;
  match.scores = scores ?? match.scores;
  match.walkover = walkover ?? null;
  match.status = status || (winnerId ? "complete" : "pending");
  match.updatedAt = Date.now();
}

function renderAll() {
  setSeedingNotice(state.needsReseed);
  renderPlayersTable();
  renderBracket();
  renderActivity();
  updateStats();
  renderMapsTab(currentTournamentMeta);
}

function renderPlayersTable() {
  const tbody = document.getElementById("playersTableBody");
  if (!tbody) return;
  const rows = state.players.map((p) => {
    const profileUrl = sanitizeUrl(p.sc2Link);
    const link = profileUrl
      ? `<a href="${profileUrl}" target="_blank" rel="noopener">Profile</a>`
      : `<span class="placeholder-tag">-</span>`;
    return `
      <tr>
        <td>#${p.seed || "?"}</td>
        <td><span class="player-detail-trigger" data-player-id="${
          p.id
        }"><strong>${escapeHtml(p.name)}</strong></span> <span class="helper">${
      p.race || ""
    }</span></td>
        <td><input class="points-input" type="number" min="0" data-player-id="${
          p.id
        }" value="${p.points || 0}"/></td>
        <td>${p.mmr || 0}</td>
        <td>${link}</td>
        <td><button class="cta small ghost remove-player" data-player-id="${
          p.id
        }">Remove</button></td>
      </tr>`;
  });
  tbody.innerHTML =
    rows.join("") ||
    `<tr><td colspan="6" class="helper">No players yet.</td></tr>`;
}

function renderBracket() {
  renderBracketView({
    bracket: state.bracket,
    players: state.players,
    format: currentTournamentMeta?.format || "Double Elimination",
    ensurePlayoffs: ensureRoundRobinPlayoffs,
    getPlayersMap,
    attachMatchActionHandlers,
    computeGroupStandings,
  });
}

function renderMapsTab(tournament) {
  renderMapsTabUI(tournament, {
    mapPoolSelection,
    getDefaultMapPoolNames,
    getMapByName,
  });
}

function applyBestOfToSettings(bestOf) {
  const upperInput = document.getElementById("settingsBestOfUpper");
  const lowerInput = document.getElementById("settingsBestOfLower");
  const quarterInput = document.getElementById("settingsBestOfQuarter");
  const semiInput = document.getElementById("settingsBestOfSemi");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");

  if (upperInput) upperInput.value = bestOf.upper ?? defaultBestOf.upper;
  if (lowerInput) lowerInput.value = bestOf.lower ?? defaultBestOf.lower;
  if (quarterInput)
    quarterInput.value = bestOf.quarter ?? defaultBestOf.quarter;
  if (semiInput) semiInput.value = bestOf.semi ?? defaultBestOf.semi;
  if (finalInput) finalInput.value = bestOf.final ?? defaultBestOf.final;
  if (lbSemiInput)
    lbSemiInput.value = bestOf.lowerSemi ?? defaultBestOf.lowerSemi;
  if (lbFinalInput)
    lbFinalInput.value = bestOf.lowerFinal ?? defaultBestOf.lowerFinal;
}

function populateSettingsPanel(tournament) {
  if (!tournament) return;
  const nameInput = document.getElementById("settingsNameInput");
  const slugInput = document.getElementById("settingsSlugInput");
  const descInput = document.getElementById("settingsDescriptionInput");
  const rulesInput = document.getElementById("settingsRulesInput");
  const formatSelect = document.getElementById("settingsFormatSelect");
  const maxInput = document.getElementById("settingsMaxPlayersInput");
  const startInput = document.getElementById("settingsStartInput");
  const bestOf = {
    ...defaultBestOf,
    ...(tournament.bestOf || {}),
  };
  const upperInput = document.getElementById("settingsBestOfUpper");
  const lowerInput = document.getElementById("settingsBestOfLower");
  const quarterInput = document.getElementById("settingsBestOfQuarter");
  const semiInput = document.getElementById("settingsBestOfSemi");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");
  const rrGroups = document.getElementById("settingsRoundRobinGroups");
  const rrAdvance = document.getElementById("settingsRoundRobinAdvance");
  const rrPlayoffs = document.getElementById("settingsRoundRobinPlayoffs");
  if (nameInput) nameInput.value = tournament.name || "";
  if (slugInput) slugInput.value = tournament.slug || "";
  if (descInput) descInput.value = tournament.description || "";
  if (rulesInput) rulesInput.value = tournament.rules || "";
  if (formatSelect)
    formatSelect.value = tournament.format || "Double Elimination";
  if (maxInput) maxInput.value = tournament.maxPlayers || "";
  if (startInput) {
    startInput.value = tournament.startTime
      ? new Date(tournament.startTime).toISOString().slice(0, 16)
      : "";
  }
  const requirePulseInput = document.getElementById("settingsRequirePulseLink");
  if (requirePulseInput)
    requirePulseInput.checked = tournament.requirePulseLink ?? true;
  setMapPoolSelection(
    tournament.mapPool?.length ? tournament.mapPool : getDefaultMapPoolNames()
  );
  updateSettingsDescriptionPreview();
  updateSettingsRulesPreview();
  if (upperInput) upperInput.value = bestOf.upper ?? defaultBestOf.upper;
  if (lowerInput) lowerInput.value = bestOf.lower ?? defaultBestOf.lower;
  if (quarterInput)
    quarterInput.value = bestOf.quarter ?? defaultBestOf.quarter;
  if (semiInput) semiInput.value = bestOf.semi ?? defaultBestOf.semi;
  if (finalInput) finalInput.value = bestOf.final ?? defaultBestOf.final;
  if (lbSemiInput)
    lbSemiInput.value = bestOf.lowerSemi ?? defaultBestOf.lowerSemi;
  if (lbFinalInput)
    lbFinalInput.value = bestOf.lowerFinal ?? defaultBestOf.lowerFinal;
  const rrSettings = normalizeRoundRobinSettings(tournament.roundRobin || {});
  if (rrGroups) rrGroups.value = rrSettings.groups;
  if (rrAdvance) rrAdvance.value = rrSettings.advancePerGroup;
  if (rrPlayoffs) rrPlayoffs.value = rrSettings.playoffs;

  applyBestOfToSettings({
    ...defaultBestOf,
    ...(tournament.bestOf || {}),
  });
  syncFormatFieldVisibility("settings");
}

function renderActivity() {
  const list = document.getElementById("activityList");
  if (!list) return;
  const items = state.activity
    .slice(-20)
    .reverse()
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(
          entry.message
        )}</strong><span class="helper">${formatTime(
          entry.timestamp
        )}</span></li>`
    );
  list.innerHTML = items.join("") || `<li class="helper">No updates yet.</li>`;
}

function addActivity(message) {
  const entry = { message, timestamp: Date.now() };
  state.activity.push(entry);
  if (state.activity.length > 40) state.activity.shift();
  saveState({ activity: state.activity });
  renderActivity();
}

function updateStats() {
  const playersEl = document.getElementById("statPlayers");
  const bracketEl = document.getElementById("statBracket");
  const liveEl = document.getElementById("statLive");
  if (playersEl) playersEl.textContent = String(state.players.length);
  if (bracketEl) {
    const size = state.bracket?.winners?.[0]?.length
      ? state.bracket.winners[0].length * 2
      : 0;
    bracketEl.textContent = size ? `${size} slot` : "0";
  }
  if (liveEl) liveEl.textContent = "Live";
}

function resetTournament() {
  if (!confirm("Reset all players, points, and bracket?")) return;
  const next = { ...defaultState, lastUpdated: Date.now() };
  setStateObj(next);
  saveState(next);
  setSeedingNotice(false);
  renderAll();
}

function setSeedingNotice(show) {
  const el = document.getElementById("seedingNotice");
  if (!el) return;
  el.style.display = show ? "inline-flex" : "none";
}

function bracketHasResults() {
  const matches = getAllMatches(state.bracket);
  return matches.some((m) => m.status === "complete");
}

function getPlayersMap() {
  const map = new Map();
  state.players.forEach((p) => map.set(p.id, p));
  return map;
}

function syncFromRemote(incoming) {
  if (!incoming || typeof incoming !== "object") return;
  if (incoming.lastUpdated && incoming.lastUpdated <= state.lastUpdated) return;
  setStateObj({
    ...defaultState,
    ...incoming,
    players: applySeeding(incoming.players || []),
    pointsLedger: incoming.pointsLedger || {},
    activity: incoming.activity || [],
  });
  renderAll();
}

function saveState(next, options = {}) {
  const timestamp =
    options.keepTimestamp && typeof next?.lastUpdated === "number"
      ? next.lastUpdated
      : Date.now();
  setStateObj({ ...state, ...next, lastUpdated: timestamp });
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch (_) {
    // storage may be unavailable
  }
  broadcast?.postMessage({ slug: currentSlug, payload: state });
  if (!options.skipRemote) {
    persistTournamentStateRemote(state);
  }
}

function attachMatchActionHandlers() {
  document.querySelectorAll(".veto-btn").forEach((btn) => {
    btn.addEventListener("click", () => openVetoModal(btn.dataset.matchId));
  });
  document.querySelectorAll(".info-btn").forEach((btn) => {
    btn.addEventListener("click", () => showVetoInfo(btn.dataset.matchId));
  });
}

function loadState() {
  if (!currentSlug) return { ...defaultState };
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      players: applySeeding(parsed.players || []),
      activity: parsed.activity || [],
    };
  } catch (_) {
    return { ...defaultState };
  }
}

async function hydrateStateFromRemote(slug) {
  if (!slug) return;
  const remote = await loadTournamentStateRemote(slug);
  if (!remote) return;
  const merged = {
    ...defaultState,
    ...remote,
    players: applySeeding(remote.players || []),
    activity: remote.activity || [],
    bracket: deserializeBracket(remote.bracket),
  };
  saveState(merged, { skipRemote: true, keepTimestamp: true });
  renderAll();
}

async function loadTournamentStateRemote(slug) {
  try {
    const snap = await getDoc(doc(db, TOURNAMENT_STATE_COLLECTION, slug));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const lastUpdated = data.lastUpdated?.toMillis
      ? data.lastUpdated.toMillis()
      : data.lastUpdated;
    return { ...data, lastUpdated: lastUpdated || Date.now() };
  } catch (_) {
    return null;
  }
}

async function persistTournamentStateRemote(snapshot) {
  if (!currentSlug) return;
  try {
    const ref = doc(db, TOURNAMENT_STATE_COLLECTION, currentSlug);
    const bracket = snapshot.bracket
      ? serializeBracket(snapshot.bracket)
      : null;
    const payload = stripUndefinedDeep({
      ...snapshot,
      bracket,
      lastUpdated: snapshot.lastUpdated || Date.now(),
    });

    await setDoc(ref, payload, { merge: true });
  } catch (_) {
    console.error("Failed to persist tournament state to Firestore", _);
    showToast?.(
      "Could not sync tournament state to Firestore. Changes stay local.",
      "error"
    );
  }
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    // ✅ Firestore cannot store `undefined` array items either
    return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue; // 🔥 Firestore cannot store undefined
      const cleaned = stripUndefinedDeep(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }

  return value;
}

function serializeBracket(bracket) {
  if (!bracket || typeof bracket !== "object") return bracket;
  const toObj = (arr) =>
    Array.isArray(arr)
      ? arr.reduce((acc, round, idx) => {
          acc[idx] = round;
          return acc;
        }, {})
      : arr || {};
  return {
    ...bracket,
    winners: toObj(bracket.winners),
    losers: toObj(bracket.losers),
    groups: toObj(bracket.groups),
  };
}

function deserializeBracket(bracket) {
  if (!bracket || typeof bracket !== "object") return bracket || null;
  const toArr = (obj) =>
    Array.isArray(obj)
      ? obj
      : obj && typeof obj === "object"
      ? Object.keys(obj)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => obj[key])
      : [];
  return {
    ...bracket,
    winners: toArr(bracket.winners),
    losers: toArr(bracket.losers),
    groups: toArr(bracket.groups),
  };
}

function getStorageKey() {
  return currentSlug ? `${STORAGE_KEY}:${currentSlug}` : STORAGE_KEY;
}

function playerKey(name, link) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (link) {
    return `${base}-${link.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  return base;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function layoutUpperBracket(bracket, lookup, playersById) {
  const winners = bracket.winners || [];
  if (!winners.length) {
    return `<div class="placeholder">Add players to generate the bracket.</div>`;
  }

  const CARD_HEIGHT = 90;
  const CARD_WIDTH = 240;
  const V_GAP = 8;
  const H_GAP = 90;

  const positions = new Map(); // matchId -> {x,y}

  winners.forEach((round, rIdx) => {
    round.forEach((match, mIdx) => {
      const x = rIdx * (CARD_WIDTH + H_GAP);
      if (rIdx === 0) {
        const y = mIdx * (CARD_HEIGHT + V_GAP);
        positions.set(match.id, { x, y });
      } else {
        const parents = match.sources
          .map((src) =>
            src?.type === "match" ? positions.get(src.matchId) : null
          )
          .filter(Boolean);
        const parentYs = parents.map((p) => p.y + CARD_HEIGHT / 2);
        const yCenter =
          parentYs.length === 2
            ? (parentYs[0] + parentYs[1]) / 2
            : parentYs[0] || mIdx * (CARD_HEIGHT + V_GAP);
        const y = yCenter - CARD_HEIGHT / 2;
        positions.set(match.id, { x, y, parents });
      }
    });
  });

  const connectors = [];
  const matchCards = [];
  const renderedMatches = new Set();
  let maxY = 0;

  winners.forEach((round, rIdx) => {
    round.forEach((match) => {
      const pos = positions.get(match.id);
      if (!pos) return;
      maxY = Math.max(maxY, pos.y + CARD_HEIGHT);
      const participants = resolveParticipants(match, lookup, playersById);
      const [pA, pB] = participants;
      matchCards.push(
        renderSimpleMatch(
          match,
          pA,
          pB,
          pos.x,
          pos.y,
          CARD_HEIGHT,
          CARD_WIDTH,
          "",
          ""
        )
      );

      if (rIdx > 0) {
        const srcs = match.sources
          .map((src) =>
            src?.type === "match" ? positions.get(src.matchId) : null
          )
          .filter(Boolean);
        const parentIds = (match.sources || [])
          .map((s) => (s?.type === "match" ? s.matchId : null))
          .filter(Boolean);
        if (
          srcs.length === 2 &&
          matchCards.some((m) => m.includes(`data-match-id="${match.id}"`))
        ) {
          const midY1 = srcs[0].y + CARD_HEIGHT / 2;
          const midY2 = srcs[1].y + CARD_HEIGHT / 2;
          const childMidY = pos.y + CARD_HEIGHT / 2;
          const junctionX = pos.x - 30;
          connectors.push(
            makeConnector(srcs[0].x + CARD_WIDTH, midY1, junctionX, midY1, {
              from: parentIds[0],
              to: match.id,
            })
          );
          connectors.push(
            makeConnector(srcs[1].x + CARD_WIDTH, midY2, junctionX, midY2, {
              from: parentIds[1],
              to: match.id,
            })
          );
          connectors.push(
            makeVConnector(junctionX, midY1, childMidY, {
              from: parentIds[0],
              to: match.id,
            })
          );
          connectors.push(
            makeVConnector(junctionX, midY2, childMidY, {
              from: parentIds[1],
              to: match.id,
            })
          );
          connectors.push(
            makeConnector(junctionX, childMidY, pos.x, childMidY, {
              from: match.id,
              to: match.id,
              parents: parentIds.join(","),
            })
          );
        }
      }
    });
  });

  const titles = winners
    .map((round, idx) => {
      const bestOfLabel = round?.length ? getBestOfForMatch(round[0]) : null;
      const boBadge = bestOfLabel
        ? `<span class="round-bo">Bo${bestOfLabel}</span>`
        : "";
      return `<div class="round-title row-title" style="left:${
        idx * (CARD_WIDTH + H_GAP)
      }px;">${round.name || `Round ${idx + 1}`} ${boBadge}</div>`;
    })
    .join("");

  return `<div class="tree-bracket" style="height:${maxY + 20}px">
    ${titles}
    ${matchCards.join("")}
    ${connectors.join("")}
  </div>`;
}

function formatConnectorMeta(meta = {}) {
  const attrs = [];
  if (meta.from) attrs.push(`data-from="${meta.from}"`);
  if (meta.to) attrs.push(`data-to="${meta.to}"`);
  if (meta.parents) attrs.push(`data-parents="${meta.parents}"`);
  return attrs.join(" ");
}

function makeConnector(x1, y1, x2, y2, meta = {}) {
  const attr = formatConnectorMeta(meta);
  return `<div class="connector h" ${attr} style="left:${Math.min(
    x1,
    x2
  )}px; top:${y1}px; width:${Math.abs(x2 - x1)}px;"></div>`;
}

function makeVConnector(x, y1, y2, meta = {}) {
  const attr = formatConnectorMeta(meta);
  return `<div class="connector v" ${attr} style="left:${x}px; top:${Math.min(
    y1,
    y2
  )}px; height:${Math.abs(y2 - y1)}px;"></div>`;
}

// --- Round ordering helper to reduce crossing connectors --------------------

function getParentOrderKey(match, prevIndexMap) {
  if (!match || !Array.isArray(match.sources)) {
    return Number.MAX_SAFE_INTEGER;
  }
  const indices = match.sources
    .filter((src) => src && src.type === "match")
    .map((src) => {
      const idx = prevIndexMap.get(src.matchId);
      return typeof idx === "number" ? idx : Number.MAX_SAFE_INTEGER;
    });

  if (!indices.length) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.min(...indices);
}

/**
 * Reorders matches in each round so that matches whose parents are
 * higher in the previous round also appear higher in this round.
 * This keeps connector lines from crossing as much as possible.
 */
function sortRoundsByParents(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return [];
  }

  const ordered = [];

  for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
    const round = Array.isArray(rounds[rIdx]) ? [...rounds[rIdx]] : [];

    // First round: keep original order
    if (rIdx === 0) {
      ordered.push(round);
      continue;
    }

    const prevRound = ordered[rIdx - 1] || rounds[rIdx - 1] || [];
    const prevIndexMap = new Map(prevRound.map((m, idx) => [m.id, idx]));

    const decorated = round.map((match, i) => ({
      match,
      key: getParentOrderKey(match, prevIndexMap),
      originalIndex: i,
    }));

    const hasRealParents = decorated.some(
      (d) => d.key !== Number.MAX_SAFE_INTEGER
    );

    if (!hasRealParents) {
      // Nothing to sort against – keep original order
      ordered.push(round);
      continue;
    }

    decorated.sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      return a.originalIndex - b.originalIndex;
    });

    ordered.push(decorated.map((d) => d.match));
  }

  return ordered;
}

// Helper: pretty round titles (Final / Semi-final / Lower Final, etc.)
function getRoundLabel(titlePrefix, idx, totalRounds) {
  // idx is 0-based, totalRounds is the number of columns in this section
  const fromEnd = totalRounds - idx; // 1 = last round, 2 = second last, ...

  if (titlePrefix === "Upper") {
    if (fromEnd === 1) return "Final";
    if (fromEnd === 2) return "Semi-final";
    return `Upper Round ${idx + 1}`;
  }

  if (titlePrefix === "Lower") {
    if (fromEnd === 1) return "Lower Final";
    if (fromEnd === 2) return "Lower Semi-final";
    return `Lower Round ${idx + 1}`;
  }

  // Fallback for any other prefix
  return `${titlePrefix} Round ${idx + 1}`;
}
export { getMatchLookupForTesting, rebuildBracket };
