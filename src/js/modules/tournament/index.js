import {
  auth,
  app,
  db,
  ensureSettingsUiReady,
  getCurrentUsername,
  getCurrentUserAvatarUrl,
  getCurrentUserProfile,
  getPulseState,
  initializeAuthUI,
  syncPulseNow,
} from "../../../app.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { showToast } from "../toastHandler.js";
import DOMPurify from "dompurify";
import { prepareImageForUpload, validateImageFile } from "../imageUtils.js";
import {
  TOURNAMENT_COLLECTION,
  TOURNAMENT_STATE_COLLECTION,
  CIRCUIT_COLLECTION,
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
  requirePulseSyncSetting,
  mapPoolSelection,
  mapCatalog,
  mapCatalogLoaded,
  currentMapPoolMode,
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
  setRequirePulseSyncSettingState,
  setMapPoolSelectionState,
  setMapCatalogState,
  setMapCatalogLoadedState,
  setCurrentMapPoolModeState,
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
import { computePlacementsForBracket } from "./bracket/placements.js";
import { playerKey } from "./playerKey.js";
import {
  readCircuitPointsTable,
  renderCircuitPointsSettings,
  handleAddCircuitPointsRow,
  handleRemoveCircuitPointsRow,
  handleApplyCircuitPoints as handleApplyCircuitPointsCore,
  getCircuitSeedPoints,
} from "./circuitPoints.js";
import { updateTooltips } from "../tooltip.js";
import {
  fetchCircuitMeta,
  buildCircuitLeaderboard,
  renderCircuitList,
  renderCircuitLeaderboard,
  renderCircuitView,
  normalizeCircuitTournamentSlugs,
  generateCircuitSlug,
  updateCircuitSlugPreview,
  populateCreateCircuitForm,
} from "./circuit.js";
import { renderActivityList } from "./activity.js";
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
import { computeGroupStandings } from "./bracket/standings.js";
import { ensureRoundRobinPlayoffs } from "./bracket/playoffs.js";
import { updateMatchScore as updateMatchScoreCore } from "./bracket/update.js";
import {
  renderMapsTab as renderMapsTabUI,
  renderChosenMaps as renderChosenMapsUI,
  updateMapButtons as updateMapButtonsUI,
} from "./maps/render.js";
import { renderMapPoolPicker as renderMapPoolPickerUI } from "./maps/pool.js";
import {
  setMapPoolSelection as setMapPoolSelectionUI,
  toggleMapSelection as toggleMapSelectionUI,
  isDefaultLadderSelection,
} from "./maps/selection.js";
import {
  setupPlayerDetailModal,
  attachPlayerDetailHandlers,
} from "./playerDetail.js";
import { renderSeedingTable } from "./ui/seeding.js";
import {
  applyBestOfToSettings,
  populateSettingsPanel as populateSettingsPanelUI,
} from "./settings/render.js";
import {
  syncFormatFieldVisibility as syncFormatFieldVisibilityUI,
  updateSettingsDescriptionPreview as updateSettingsDescriptionPreviewUI,
  updateSettingsRulesPreview as updateSettingsRulesPreviewUI,
  extractRoundRobinSettings as extractRoundRobinSettingsUI,
} from "./settings/ui.js";
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
  refreshMatchInfoModalIfOpen,
  refreshMatchInfoPresenceIfOpen,
  refreshVetoModalIfOpen,
} from "./maps/veto.js";
import { initTournamentPage } from "./tournamentPageInit.js";
import {
  loadState as loadLocalState,
  hydrateStateFromRemote,
  saveState as persistState,
  persistTournamentStateRemote,
  loadTournamentStateRemote,
  getStorageKey as getPersistStorageKey,
  getRegisteredTournaments,
  setRegisteredTournament,
  loadTournamentRegistry,
  loadCircuitRegistry,
} from "./sync/persistence.js";
import { createFinalTournamentForCircuit } from "./finalsCreate.js";
import { initCoverReuseModal } from "./reuseImage.js";
import { lockBodyScroll, unlockBodyScroll } from "./modalLock.js";
import {
  configureFinalMapPool,
  getFinalMapPoolSelection,
  resetFinalMapPoolSelection,
  setFinalMapPoolSelection,
  toggleFinalMapSelection,
} from "./finalMapPool.js";
import { createCircuitPageHandlers } from "./circuitPage.js";
import { enforceCircuitFinalQualification } from "./registrationGates.js";
import {
  generateUniqueSlug,
  updateFinalSlugPreview,
  updateSlugPreview,
} from "./slugs.js";
import {
  buildCreateTournamentPayload,
  buildFinalTournamentPayload,
  buildSettingsPayload,
  readBestOf,
} from "./tournamentPayloads.js";
import { createAdminPlayerSearch } from "./admin/addSearchPlayer.js";
import { createAdminManager } from "./admin/manageAdmins.js";
import { initCasterControls, renderCasterSection } from "./caster.js";
import { setTournamentListItems } from "./listSlider.js";
import {
  INVITE_STATUS,
  normalizeInviteStatus,
  isInviteAccepted,
  getEligiblePlayers,
} from "./rosterSeeding.js";
import {
  handleTournamentInviteAction,
  handleTournamentCheckInAction,
  sendTournamentCheckInNotifications,
  sendTournamentInviteNotification,
} from "./invites.js";
const renderMapPoolPicker = renderMapPoolPickerUI;
const CURRENT_BRACKET_LAYOUT_VERSION = 54;
const MAX_TOURNAMENT_IMAGE_SIZE = 12 * 1024 * 1024;
const COVER_TARGET_WIDTH = 1200;
const COVER_TARGET_HEIGHT = 675;
const COVER_QUALITY = 0.82;
const storage = getStorage(app);
let currentCircuitMeta = null;
let isCircuitAdmin = false;
let circuitPointsBtnTemplate = null;
let pulseSyncSessionCompleted = false;
let secondaryPulseSyncSessionCompleted = false;
let pulseSyncRequired = false;
let secondaryPulseSyncRequired = false;
let lastPulseUrl = "";
let lastSecondarySignature = "";
const adminManager = createAdminManager({
  auth,
  db,
  doc,
  collection,
  setDoc,
  CIRCUIT_COLLECTION,
  TOURNAMENT_COLLECTION,
  lockBodyScroll,
  unlockBodyScroll,
  showToast,
  getCurrentTournamentMeta: () => currentTournamentMeta,
  setCurrentTournamentMeta: (next) => setCurrentTournamentMetaState(next),
  getCurrentCircuitMeta: () => currentCircuitMeta,
  setCurrentCircuitMeta: (next) => {
    currentCircuitMeta = next;
  },
});
const {
  isAdminForMeta,
  renderTournamentAdmins,
  renderCircuitAdmins,
  updateTournamentAdminInviteVisibility,
  updateCircuitAdminInviteVisibility,
  initAdminInviteModal,
} = adminManager;
function renderMarkdown(text = "") {
  const raw = text || "";
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  const sanitized = DOMPurify.sanitize(raw);
  return hasHtml ? sanitized : sanitized.replace(/\n/g, "<br>");
}
async function loadMapCatalog() {
  if (mapCatalogLoaded) return mapCatalog;
  try {
    const resp = await fetch(MAPS_JSON_URL, { cache: "no-cache" });
    const data = await resp.json();
    if (Array.isArray(data)) {
      setMapCatalogState(data);
      setMapCatalogLoadedState(true);
      return data;
    }
  } catch (err) {
    console.warn("Falling back to bundled ladder map list", err);
  }
  setMapCatalogState([]);
  setMapCatalogLoadedState(true);
  return mapCatalog;
}

function syncFromRemote(incoming) {
  if (!incoming || typeof incoming !== "object") return;
  const incomingPresence = incoming.presence?.matchInfo || null;
  const currentPresence = state?.presence?.matchInfo || null;
  const presenceChanged =
    incomingPresence &&
    JSON.stringify(incomingPresence) !== JSON.stringify(currentPresence || {});
  const casterChanged =
    JSON.stringify(incoming.casterRequests || []) !==
      JSON.stringify(state.casterRequests || []) ||
    JSON.stringify(incoming.casters || []) !== JSON.stringify(state.casters || []) ||
    JSON.stringify(incoming.matchCasts || {}) !== JSON.stringify(state.matchCasts || {});

  if (
    incoming.lastUpdated &&
    incoming.lastUpdated <= state.lastUpdated &&
    !casterChanged
  ) {
    if (presenceChanged) {
      setStateObj({ ...state, presence: { matchInfo: incomingPresence } });
      refreshMatchInfoPresenceIfOpen?.();
    }
    return;
  }
  setStateObj({
    ...defaultState,
    ...incoming,
    players: applyRosterSeedingWithMode(incoming.players || [], incoming),
    pointsLedger: incoming.pointsLedger || {},
    activity: incoming.activity || [],
    bracket: deserializeBracket(incoming.bracket),
  });
  renderAll();
  refreshMatchInfoModalIfOpen?.();
  refreshVetoModalIfOpen?.();
}

let unsubscribeRemoteState = null;
function subscribeTournamentStateRemote(slug) {
  try {
    unsubscribeRemoteState?.();
  } catch (_) {
    // ignore
  }
  unsubscribeRemoteState = null;
  if (!slug) return;

  const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug);
  unsubscribeRemoteState = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      syncFromRemote({
        ...data,
        lastUpdated: data.lastUpdated?.toMillis ? data.lastUpdated.toMillis() : data.lastUpdated,
      });
    },
    (err) => {
      console.warn("Remote tournament state listener error", err);
    }
  );
}

const syncFormatFieldVisibility = syncFormatFieldVisibilityUI;
const updateSettingsDescriptionPreview = () =>
  updateSettingsDescriptionPreviewUI(renderMarkdown);
const updateSettingsRulesPreview = () =>
  updateSettingsRulesPreviewUI(renderMarkdown);
function applyFormattingInline(action, textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const surface = document.querySelector(
    `.markdown-surface[data-editor-for="${textareaId}"]`
  );
  if (surface?.isContentEditable) {
    surface.focus();
    const selection = window.getSelection();
    const selectedText = selection?.toString() || "";
    const exec = (command, value = null) => {
      try {
        document.execCommand(command, false, value);
      } catch (_) {
        // ignore unsupported commands
      }
    };
    const styles = (surface.dataset.activeStyles || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const toggleStyle = (styleKey) => {
      const idx = styles.indexOf(styleKey);
      if (idx >= 0) {
        styles.splice(idx, 1);
      } else {
        styles.push(styleKey);
      }
      surface.dataset.activeStyles = styles.join(",");
      surface.classList.toggle("is-bold", styles.includes("bold"));
      surface.classList.toggle("is-italic", styles.includes("italic"));
    };
    const hasSelection =
      selection &&
      !selection.isCollapsed &&
      surface.contains(selection.anchorNode) &&
      surface.contains(selection.focusNode);
    const isEmpty = !surface.textContent?.trim();
    const toggleActions = ["bold", "italic", "bullet", "numbered"];

    if (action === "bold" || action === "italic") {
      if (hasSelection) {
        exec(action === "bold" ? "bold" : "italic");
      } else {
        toggleStyle(action === "bold" ? "bold" : "italic");
      }
    } else if (action === "bullet") {
      exec("insertUnorderedList");
    } else if (action === "numbered") {
      exec("insertOrderedList");
    } else if (action === "link") {
      const url = window.prompt("Link URL", "https://");
      if (url) {
        if (selectedText) {
          exec("createLink", url);
        } else {
          exec("insertHTML", `<a href="${url}">${url}</a>`);
        }
      }
    }

    if (isEmpty && toggleActions.includes(action)) {
      surface.dataset.pendingActions = styles.join(",");
    } else {
      delete surface.dataset.pendingActions;
    }
    textarea.value = surface.innerHTML;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    if (typeof window !== "undefined") {
      window.__updateMarkdownToolbarState?.();
    }
    return;
  }

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
    case "strike":
      wrap("~~", "~~");
      break;
    case "code":
      wrap("`", "`");
      break;
    case "link":
      wrap("[", "](url)");
      break;
    default:
      break;
  }
}

function getPlayersMap() {
  return new Map((state.players || []).map((p) => [p.id, p]));
}

function getManualSeedingSettings(snapshot = state) {
  return {
    enabled: Boolean(snapshot?.manualSeedingEnabled),
    order: Array.isArray(snapshot?.manualSeedingOrder)
      ? snapshot.manualSeedingOrder
      : [],
  };
}

function buildManualOrder(players = [], manualOrder = []) {
  const byId = new Map((players || []).map((player) => [player.id, player]));
  const nextOrder = [];
  const used = new Set();
  (manualOrder || []).forEach((id) => {
    if (!id || used.has(id) || !byId.has(id)) return;
    nextOrder.push(id);
    used.add(id);
  });
  const remaining = (players || []).filter(
    (player) => player?.id && !used.has(player.id)
  );
  if (!remaining.length) return nextOrder;
  const seededRemaining = applySeeding(
    remaining.map((player) => ({ ...player }))
  );
  seededRemaining.forEach((player) => {
    if (!player?.id || used.has(player.id)) return;
    nextOrder.push(player.id);
    used.add(player.id);
  });
  return nextOrder;
}

function applyManualSeeding(players = [], manualOrder = []) {
  const clones = (players || []).map((player) => ({ ...player }));
  const byId = new Map(clones.map((player) => [player.id, player]));
  const nextOrder = buildManualOrder(clones, manualOrder);
  const seeded = nextOrder
    .map((id) => byId.get(id))
    .filter(Boolean);
  seeded.forEach((player, idx) => {
    player.seed = idx + 1;
  });
  return seeded;
}

function seedPlayersForState(players = [], snapshot = state) {
  const { enabled, order } = getManualSeedingSettings(snapshot);
  if (enabled) {
    return applyManualSeeding(players, order);
  }
  return applySeeding((players || []).map((player) => ({ ...player })));
}

function seedEligiblePlayersWithMode(players = [], snapshot = state) {
  const eligible = getEligiblePlayers(players);
  const seededEligible = seedPlayersForState(eligible, snapshot);
  const seedById = new Map(
    seededEligible.map((player) => [player.id, player.seed])
  );
  const mergedPlayers = (players || []).map((player) => {
    const inviteStatus = normalizeInviteStatus(player.inviteStatus);
    const seed = seedById.get(player.id);
    if (Number.isFinite(seed)) {
      return { ...player, seed, inviteStatus };
    }
    if (inviteStatus !== INVITE_STATUS.accepted) {
      const { seed: _seed, ...rest } = player;
      return { ...rest, inviteStatus };
    }
    return { ...player, inviteStatus };
  });
  return { seededEligible, mergedPlayers };
}

function applyRosterSeedingWithMode(players = [], snapshot = state) {
  return seedEligiblePlayersWithMode(players, snapshot).mergedPlayers;
}

function getManualSeedingActive() {
  return Boolean(state.manualSeedingEnabled) && !state.isLive;
}

function applySeedingStateUpdate(nextSnapshot, reason) {
  const hasCompletedMatches = bracketHasResults();
  setStateObj(nextSnapshot);
  if (!state.isLive && !hasCompletedMatches) {
    rebuildBracket(true, reason);
    return;
  }
  const { mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    nextSnapshot
  );
  saveState({
    manualSeedingEnabled: nextSnapshot.manualSeedingEnabled,
    manualSeedingOrder: nextSnapshot.manualSeedingOrder,
    players: mergedPlayers,
    needsReseed: hasCompletedMatches,
  });
  if (hasCompletedMatches) {
    setSeedingNotice(true);
  }
  renderAll();
}

function setManualSeedingEnabled(nextEnabled) {
  if (state.isLive) {
    showToast?.("Tournament is live. Seeding is locked.", "error");
    renderAll();
    return;
  }
  const enabled = Boolean(nextEnabled);
  const current = getManualSeedingSettings(state);
  const nextOrder = enabled
    ? buildManualOrder(state.players || [], current.order)
    : current.order;
  const nextSnapshot = {
    ...state,
    manualSeedingEnabled: enabled,
    manualSeedingOrder: nextOrder,
  };
  applySeedingStateUpdate(
    nextSnapshot,
    enabled ? "Manual seeding enabled" : "Automatic seeding enabled"
  );
}

function handleManualSeedingReorder(nextOrder = []) {
  if (!Array.isArray(nextOrder) || !nextOrder.length) return;
  if (state.isLive) return;
  const normalizedOrder = buildManualOrder(state.players || [], nextOrder);
  const currentOrder = getManualSeedingSettings(state).order;
  const isSame =
    normalizedOrder.length === currentOrder.length &&
    normalizedOrder.every((id, idx) => id === currentOrder[idx]);
  if (isSame && state.manualSeedingEnabled) return;
  const nextSnapshot = {
    ...state,
    manualSeedingEnabled: true,
    manualSeedingOrder: normalizedOrder,
  };
  applySeedingStateUpdate(nextSnapshot, "Manual seeding updated");
}

function handleApplyCircuitPoints(event) {
  const result = handleApplyCircuitPointsCore(event, { saveState, renderAll });
  if (!result?.applied || !currentTournamentMeta?.slug) return;
  const updatedMeta = { ...(currentTournamentMeta || {}), circuitPointsApplied: true };
  setCurrentTournamentMetaState(updatedMeta);
  renderCircuitPointsSettings();
  setDoc(
    doc(collection(db, TOURNAMENT_COLLECTION), currentTournamentMeta.slug),
    { circuitPointsApplied: true },
    { merge: true }
  ).catch((err) => {
    console.error("Failed to store circuit points applied flag", err);
  });
}

function renderAll() {
  // Update seeding table
  const seedingSnapshot = seedPlayersForState(state.players || [], state);
  renderSeedingTable(seedingSnapshot, {
    isLive: state.isLive,
    isAdmin,
    manualSeeding: state.manualSeedingEnabled,
  });
  updateManualSeedingUi();

  if (currentTournamentMeta) {
    const tournamentTitle = document.getElementById("tournamentTitle");
    const tournamentFormat = document.getElementById("tournamentFormat");
    const tournamentStart = document.getElementById("tournamentStart");
    const statPlayers = document.getElementById("statPlayers");
    const placementsRow = document.getElementById("tournamentPlacements");
    const placementFirst = document.getElementById("placementFirst");
    const placementSecond = document.getElementById("placementSecond");
    const placementThirdFourth = document.getElementById("placementThirdFourth");
    const registerBtn = document.getElementById("registerBtn");
    const goLiveBtn = document.getElementById("rebuildBracketBtn");
    const notifyCheckInBtn = document.getElementById("notifyCheckInBtn");
    const startMs = getStartTimeMs(currentTournamentMeta);
    const liveDot = document.getElementById("liveDot");
    const bracketGrid = document.getElementById("bracketGrid");
    const bracketNotLive = document.getElementById("bracketNotLive");
    const registeredPlayersList = document.getElementById("registeredPlayersList");
    const activityCard = document.getElementById("activityCard");
    const currentUid = auth.currentUser?.uid || null;
    const currentPlayer = currentUid
      ? (state.players || []).find((p) => p.uid === currentUid)
      : null;
    const currentInviteStatus = normalizeInviteStatus(currentPlayer?.inviteStatus);
    const eligiblePlayers = getEligiblePlayers(state.players || []);
    const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);
    const accessNote = document.getElementById("registrationAccessNote");
    const syncPulseBtn = document.getElementById("syncPulseBtn");
    const syncPulseSpinner = document.getElementById("syncPulseSpinner");
    const requirePulseSyncEnabled =
      currentTournamentMeta?.requirePulseSync ?? requirePulseSyncSetting;
    const pulseGate = getPulseSyncGateStatus();

    if (tournamentTitle) {
      tournamentTitle.textContent = currentTournamentMeta.name || "Tournament";
    }
    const tournamentHero = document.querySelector("#tournamentView .hero");
    if (tournamentHero) {
      const coverUrl = sanitizeUrl(currentTournamentMeta.coverImageUrl || "");
      if (coverUrl) {
        tournamentHero.classList.add("has-cover");
        tournamentHero.style.setProperty(
          "--hero-cover-image",
          `url("${coverUrl}")`
        );
      } else {
        tournamentHero.classList.remove("has-cover");
        tournamentHero.style.removeProperty("--hero-cover-image");
      }
    }
    if (tournamentFormat) {
      tournamentFormat.textContent = currentTournamentMeta.format || "Tournament";
    }
    if (tournamentStart) {
      tournamentStart.textContent = startMs
        ? new Date(startMs).toLocaleString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";
    }
    if (statPlayers) statPlayers.textContent = String(eligiblePlayers.length || 0);

    if (accessNote) {
      if (isInviteOnly && !isAdmin) {
        accessNote.textContent =
          "This tournament is invite-only. Ask an admin for an invite.";
        accessNote.style.display = "block";
      } else {
        accessNote.textContent = "";
        accessNote.style.display = "none";
      }
    }

    if (placementsRow && placementFirst && placementSecond && placementThirdFourth) {
      const placements = computePlacementsForBracket(
        state.bracket,
        eligiblePlayers.length || 0
      );
      if (!placements) {
        placementsRow.style.display = "none";
      } else {
        const playersById = getPlayersMap();
        const firstId = Array.from(placements.entries()).find(([, p]) => p === 1)?.[0];
        const secondId = Array.from(placements.entries()).find(([, p]) => p === 2)?.[0];
        const thirdIds = Array.from(placements.entries())
          .filter(([, p]) => p === 3)
          .map(([id]) => id);
        placementFirst.textContent = playersById.get(firstId)?.name || "—";
        placementSecond.textContent = playersById.get(secondId)?.name || "—";
        placementThirdFourth.textContent = thirdIds.length
          ? thirdIds.map((id) => playersById.get(id)?.name || "—").join(" · ")
          : "—";
        placementsRow.style.display = "flex";
      }
    }

    if (registerBtn) {
      if (state.isLive) {
        registerBtn.textContent = "Registration closed";
        registerBtn.disabled = true;
      } else if (currentPlayer && currentInviteStatus === INVITE_STATUS.pending) {
        registerBtn.textContent = "Invitation pending";
        registerBtn.disabled = true;
      } else if (currentPlayer && currentInviteStatus === INVITE_STATUS.denied) {
        registerBtn.textContent = "Invite declined";
        registerBtn.disabled = true;
      } else if (currentPlayer) {
        registerBtn.textContent = "Unregister";
        registerBtn.disabled = false;
      } else if (isInviteOnly && !isAdmin) {
        registerBtn.textContent = "Invite required";
        registerBtn.disabled = true;
      } else if (pulseGate.needsSync) {
        registerBtn.textContent = "Register";
        registerBtn.disabled = true;
      } else {
        registerBtn.textContent = "Register";
        registerBtn.disabled = false;
      }
    }

    if (syncPulseBtn) {
      const label = syncPulseBtn.querySelector(".sync-label");
      if (label) label.textContent = "Sync SC2Pulse";
      const isLoading = syncPulseBtn.classList.contains("is-loading");
      syncPulseBtn.style.display = requirePulseSyncEnabled ? "" : "none";
      syncPulseBtn.disabled = !auth.currentUser || isLoading;
    }
    if (syncPulseSpinner) {
      syncPulseSpinner.style.display = requirePulseSyncEnabled ? "" : "none";
    }

    if (goLiveBtn) {
      goLiveBtn.disabled = state.isLive;
      goLiveBtn.textContent = state.isLive ? "Live" : "Go Live";
    }
    if (notifyCheckInBtn) {
      const checkInState = getCheckInWindowState(currentTournamentMeta);
      const eligibleNotCheckedIn = eligiblePlayers.filter((p) => !p.checkedInAt);
      notifyCheckInBtn.disabled =
        state.isLive || !checkInState.isOpen || eligibleNotCheckedIn.length === 0;
    }

    updateCheckInUI();
    renderCasterSection();

    if (liveDot) {
      liveDot.textContent = state.isLive ? "Live" : "Not Live";
      liveDot.classList.toggle("not-live", !state.isLive);
    }

    if (bracketGrid && bracketNotLive) {
      if (!state.isLive && !isAdmin) {
        bracketGrid.style.display = "none";
        bracketNotLive.style.display = "block";
        if (registeredPlayersList) {
          const items = eligiblePlayers.map((p) => {
            const name = escapeHtml(p.name || "Unknown");
            const race = (p.race || "").trim();
            const raceClass = raceClassName(race);
            const raceLabel = race ? escapeHtml(race) : "Race TBD";
            const mmr = Number.isFinite(p.mmr) ? `${Math.round(p.mmr)} MMR` : "MMR TBD";
            return `<li data-player-id="${escapeHtml(p.id || "")}">
              <span class="race-strip ${raceClass}"></span>
              <span class="name-text">${name}</span>
              <span class="registered-meta">${raceLabel} · ${mmr}</span>
            </li>`;
          });
          registeredPlayersList.innerHTML = items.join("");
        }
      } else {
        bracketGrid.style.display = "flex";
        bracketNotLive.style.display = "none";
      }
    }

    if (activityCard) {
      activityCard.style.display = state.isLive ? "" : "none";
    }
    renderActivityList({ state, escapeHtml, formatTime });
    populateSettingsPanelUI({
      tournament: currentTournamentMeta,
      setMapPoolSelection,
      getDefaultMapPoolNames,
      updateSettingsDescriptionPreview,
      updateSettingsRulesPreview,
      syncFormatFieldVisibility,
    });
    renderCircuitPointsSettings();
  }

  // Render maps tab from current meta or default pool
  renderMapsTabUI(currentTournamentMeta, {
    mapPoolSelection,
    getDefaultMapPoolNames,
    getMapByName,
  });

  const bracketContainer = document.getElementById("bracketGrid");
  const bracket = state.bracket;
  const playersArr = state.players || [];
  const format = currentTournamentMeta?.format || "Tournament";
  const isRoundRobinFormat = (fmt) =>
    (fmt || "").toLowerCase().includes("round robin");
  const layoutVersion = state.bracketLayoutVersion || 1;
  const needsLayoutUpgrade =
    bracket &&
    layoutVersion < CURRENT_BRACKET_LAYOUT_VERSION &&
    !bracketHasRecordedResults(bracket);
  if (needsLayoutUpgrade) {
    rebuildBracket(true, "Updated bracket layout");
    return;
  }
  const needsBracketRepair = (() => {
    if (!bracket || !playersArr.length) return false;
    if (bracketHasRecordedResults(bracket)) return false;
    if (isRoundRobinFormat(format)) return false;
    const { seededEligible } = seedEligiblePlayersWithMode(state.players || [], state);
    const expected = buildBracket(
      seededEligible,
      currentTournamentMeta || {},
      isRoundRobinFormat
    );
    const actualIds = getAllMatches(bracket)
      .map((m) => m?.id)
      .filter(Boolean);
    const expectedIds = getAllMatches(expected)
      .map((m) => m?.id)
      .filter(Boolean);
    if (actualIds.length !== expectedIds.length) return true;
    const expectedSet = new Set(expectedIds);
    return actualIds.some((id) => !expectedSet.has(id));
  })();
  if (needsBracketRepair) {
    rebuildBracket(true, "Bracket repaired");
    return;
  }
  if (bracketContainer && bracket) {
    let lookup = getMatchLookup(bracket);
    const playersById = getPlayersMap();
    if (format.toLowerCase().includes("round robin")) {
      const changed = ensureRoundRobinPlayoffs(bracket, playersById, lookup);
      if (changed) {
        lookup = getMatchLookup(bracket);
        saveState({ bracket });
      }
      const html = renderRoundRobinView(
        { ...bracket },
        playersById,
        computeGroupStandings
      );
      bracketContainer.innerHTML = DOMPurify.sanitize(html);
      attachMatchActionHandlers?.();
    } else {
      renderBracketView({
        bracket,
        players: playersArr,
        format,
        ensurePlayoffs: (b) => ensureRoundRobinPlayoffs(b, playersById, lookup),
        getPlayersMap,
        attachMatchActionHandlers,
        computeGroupStandings,
        currentUsername: getCurrentUsername?.() || "",
      });
    }
    attachMatchHoverHandlers();
    annotateConnectorPlayers(lookup, playersById);
    clampScoreSelectOptions();
  }
  updateTooltips?.();
}

function checkInCurrentPlayer() {
  const meta = currentTournamentMeta || {};
  const { isOpen } = getCheckInWindowState(meta);
  if (!isOpen) {
    showToast?.("Check-in is not open yet.", "error");
    return;
  }
  const uid = auth.currentUser?.uid || null;
  if (!uid) {
    showToast?.("You must be signed in to check in.", "error");
    return;
  }
  const players = state.players || [];
  const idx = players.findIndex((p) => p.uid === uid);
  if (idx === -1) {
    showToast?.("Register before checking in.", "error");
    return;
  }
  if (!isInviteAccepted(players[idx])) {
    showToast?.("Respond to your invite before checking in.", "error");
    return;
  }
  if (players[idx].checkedInAt) {
    showToast?.("You are already checked in.", "success");
    return;
  }
  const updated = players.map((p, i) =>
    i === idx ? { ...p, checkedInAt: Date.now() } : p
  );
  saveState({ players: updated });
  addActivity(`${players[idx].name || "Player"} checked in.`);
  renderAll();
}

async function notifyCheckInPlayers() {
  if (!isAdmin) {
    showToast?.("Only admins can send check-in reminders.", "error");
    return;
  }
  if (!currentTournamentMeta) {
    showToast?.("Tournament data not loaded yet.", "error");
    return;
  }
  const checkInState = getCheckInWindowState(currentTournamentMeta);
  if (!checkInState.isOpen) {
    showToast?.("Check-in is not open yet.", "error");
    return;
  }
  if (state.isLive) {
    showToast?.("Tournament is live. Check-in is closed.", "error");
    return;
  }
  const targetSlug = currentSlug || currentTournamentMeta.slug || currentTournamentMeta.id || "";
  if (!targetSlug) {
    showToast?.("Missing tournament slug.", "error");
    return;
  }
  const eligiblePlayers = getEligiblePlayers(state.players || []).filter(
    (player) => player?.uid && !player.checkedInAt
  );
  if (!eligiblePlayers.length) {
    showToast?.("All eligible players are checked in.", "success");
    return;
  }
  try {
    await sendTournamentCheckInNotifications({
      db,
      auth,
      getCurrentUsername,
      players: eligiblePlayers,
      tournamentMeta: currentTournamentMeta,
      slug: targetSlug,
    });
    showToast?.("Check-in notifications sent.", "success");
  } catch (err) {
    console.error("Failed to send check-in notifications", err);
    showToast?.("Failed to send check-in notifications.", "error");
  }
}

function goLiveTournament() {
  if (state.isLive) {
    showToast?.("Tournament is already live.", "success");
    return;
  }
  const checkedInPlayers = getEligiblePlayers(state.players || []).filter(
    (p) => p.checkedInAt
  );
  if (!checkedInPlayers.length) {
    showToast?.("No checked-in players to go live.", "error");
    return;
  }
  const seededPlayers = seedPlayersForState(checkedInPlayers, state);
  const bracket = buildBracket(
    seededPlayers,
    currentTournamentMeta || {},
    (fmt) => (fmt || "").toLowerCase().includes("round robin")
  );
  saveState({
    players: seededPlayers,
    bracket,
    needsReseed: false,
    bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
    isLive: true,
  });
  addActivity("Tournament went live.");
  renderAll();
}

function addActivity(message, options = {}) {
  if (!message) return;
  const entry = {
    message,
    time: Date.now(),
    type: options.type,
  };
  const next = {
    activity: [entry, ...(state.activity || [])].slice(0, 50),
  };
  saveState(next);
  renderActivityList({ state, escapeHtml, formatTime });
}

function setSeedingNotice(show) {
  const el = document.getElementById("seedingNotice");
  if (el) {
    el.style.display = show ? "block" : "none";
  }
}

function updateManualSeedingUi() {
  const toggle = document.getElementById("manualSeedingToggle");
  const help = document.getElementById("manualSeedingHelp");
  const enabled = Boolean(state.manualSeedingEnabled);
  const locked = state.isLive;
  if (toggle) {
    toggle.checked = enabled;
    toggle.disabled = locked;
  }
  if (help) {
    if (enabled) {
      help.textContent = locked
        ? "Manual seeding is locked while live."
        : "Drag rows to set manual seed order.";
    } else {
      help.textContent = "Automatic seeding uses points and MMR.";
    }
  }
}

function bracketHasResults() {
  if (!state?.bracket) return false;
  try {
    const lookup = getMatchLookup(state.bracket);
    return lookup && lookup.size > 0;
  } catch (_) {
    return false;
  }
}

function bracketHasRecordedResults(bracket) {
  if (!bracket) return false;
  try {
    const lookup = getMatchLookup(bracket);
    for (const match of lookup.values()) {
      if (!match) continue;
      if (match.status === "complete") return true;
      if (match.winnerId || match.walkover) return true;
      const scores = match.scores || [];
      if ((scores[0] || 0) + (scores[1] || 0) > 0) return true;
    }
  } catch (_) {
    return false;
  }
  return false;
}


function createOrUpdatePlayer(data) {
  if (!data) return null;
  const id =
    data.id ||
    `p-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  const existing = (state.players || []).find(
    (p) => p.id === id || (data.name && p.name === data.name)
  );
  const merged = existing ? { ...existing, ...data, id } : { ...data, id };
  const players = existing
    ? state.players.map((p) => (p.id === merged.id ? merged : p))
    : [...(state.players || []), merged];
  setStateObj({ ...state, players });
  return merged;
}

function removePlayer(id) {
  if (state.isLive) return;
  if (!id) return;
  const players = (state.players || []).filter((p) => p.id !== id);
  saveState({ players, needsReseed: true });
  rebuildBracket(true, "Player removed");
}

function updatePlayerPoints(id, points) {
  if (state.isLive) return;
  if (!id) return;
  const players = (state.players || []).map((p) =>
    p.id === id ? { ...p, points } : p
  );
  saveState({ players, needsReseed: true });
  rebuildBracket(true, "Points updated");
}

function setPlayerCheckIn(id, shouldCheckIn) {
  if (!id) return;
  const players = (state.players || []).map((p) => {
    if (p.id !== id) return p;
    if (!isInviteAccepted(p)) return p;
    if (shouldCheckIn) {
      return { ...p, checkedInAt: p.checkedInAt || Date.now() };
    }
    return { ...p, checkedInAt: null };
  });
  saveState({ players });
  const changed = players.find((p) => p.id === id);
  if (changed) {
    addActivity(
      `${changed.name || "Player"} marked ${
        changed.checkedInAt ? "checked in" : "not checked in"
      }.`
    );
  }
  renderAll();
}

function resetTournament() {
  const empty = { ...defaultState, lastUpdated: Date.now() };
  setStateObj(empty);
  saveState(empty);
  rebuildBracket(true, "Tournament reset");
  addActivity("Tournament reset.");
  setSeedingNotice(false);
}

function updateMatchScore(matchId, scoreA, scoreB, options = {}) {
  const lookupBefore = state?.bracket ? getMatchLookup(state.bracket) : null;
  const matchBefore = lookupBefore?.get(matchId) || null;
  const prevScores = Array.isArray(matchBefore?.scores)
    ? [...matchBefore.scores]
    : null;
  const prevWalkover = matchBefore?.walkover || null;
  const prevStatus = matchBefore?.status || null;
  const prevWinnerId = matchBefore?.winnerId || null;
  updateMatchScoreCore(matchId, scoreA, scoreB, {
    saveState,
    renderAll,
    ...options,
  });
  if (options?.finalize === false) return;
  const lookupAfter = state?.bracket ? getMatchLookup(state.bracket) : null;
  const matchAfter = lookupAfter?.get(matchId) || null;
  if (!matchAfter) return;
  const nextScores = Array.isArray(matchAfter.scores) ? matchAfter.scores : [];
  const changed =
    !prevScores ||
    prevScores[0] !== nextScores[0] ||
    prevScores[1] !== nextScores[1] ||
    prevWalkover !== matchAfter.walkover;
  const completedNow =
    matchAfter.status === "complete" && prevStatus !== "complete";
  const winnerChanged = prevWinnerId !== matchAfter.winnerId;
  const hasScore =
    (nextScores[0] || 0) > 0 ||
    (nextScores[1] || 0) > 0 ||
    !!matchAfter.walkover;
  if ((!changed && !completedNow && !winnerChanged) || !hasScore) return;
  const playersById = getPlayersMap();
  const participants = resolveParticipants(matchAfter, lookupAfter, playersById);
  const nameA = participants[0]?.name || "TBD";
  const nameB = participants[1]?.name || "TBD";
  const scoreAOut = Number.isFinite(nextScores[0]) ? nextScores[0] : 0;
  const scoreBOut = Number.isFinite(nextScores[1]) ? nextScores[1] : 0;
  addActivity(
    `Score submitted: ${nameA} ${scoreAOut}-${scoreBOut} ${nameB}`,
    {
      type: "score",
      score: {
        nameA,
        nameB,
        scoreA: scoreAOut,
        scoreB: scoreBOut,
      },
    }
  );
}

function saveState(next = {}, options = {}) {
  persistState(
    next,
    options,
    state,
    defaultState,
    currentSlug,
    broadcast,
    setStateObj,
    (snapshot) =>
      persistTournamentStateRemote(snapshot, currentSlug, serializeBracket, showToast)
  );
}

function rebuildBracket(force = false, reason = "") {
  const { seededEligible, mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    state
  );
  setStateObj({ ...state, players: mergedPlayers, needsReseed: false });
  const isRoundRobin = (fmt) =>
    (fmt || "").toLowerCase().includes("round robin");
  const bracket = buildBracket(
    seededEligible,
    currentTournamentMeta || {},
    isRoundRobin
  );
    saveState({
      players: mergedPlayers,
      bracket,
      needsReseed: false,
      bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
    });
  if (reason) addActivity(reason);
  renderAll();
}

async function renderTournamentList() {
  const listEl = document.getElementById("tournamentList");
  const statTournaments = document.getElementById("statTournaments");
  const statNextStart = document.getElementById("statNextStart");
  const listTitle = document.getElementById("tournamentListTitle");
  const typeFilter =
    document.querySelector("#tournamentTypeTabs .list-tab.active")
      ?.dataset.typeFilter || "tournaments";
  const statusFilter =
    document.getElementById("tournamentStatusSelect")?.value || "all";
  const roleFilter =
    document.getElementById("tournamentRoleSelect")?.value || "all";
  const ownerBtn = document.getElementById("tournamentMyFilterBtn");
  const ownerFilterActive = ownerBtn?.classList.contains("active") || false;
  const filterControls = document.getElementById("tournamentFilterControls");
  if (listTitle) {
    listTitle.textContent = typeFilter === "circuits" ? "Circuits" : "Tournaments";
  }
  const listCard = listEl?.closest(".tournament-list-card");
  if (listCard) {
    listCard.classList.toggle("is-tournaments", typeFilter !== "circuits");
    listCard.classList.toggle("is-circuits", typeFilter === "circuits");
  }
  if (filterControls) {
    filterControls.style.display = typeFilter === "circuits" ? "none" : "flex";
  }
  if (ownerBtn) {
    ownerBtn.style.display = typeFilter === "circuits" ? "none" : "inline-flex";
  }
  const userId = auth?.currentUser?.uid || null;
  const registered = new Set(getRegisteredTournaments());
  if (!listEl) return;
  listEl.innerHTML = `<li class="muted">Loading tournaments...</li>`;
  try {
    if (typeFilter === "circuits") {
      const circuits = await loadCircuitRegistry(true);
      const circuitItems = (circuits || []).map((item) => ({
        ...item,
        type: "circuit",
      }));
      if (!circuitItems.length) {
        listEl.innerHTML = `<li class="muted">No circuits found.</li>`;
        setTournamentListItems([], { mode: "circuits" });
      } else {
        setTournamentListItems(circuitItems, {
          mode: "circuits",
          renderItem: (item, targetList) => {
            const li = document.createElement("li");
            li.className = "tournament-card circuit-card";
            const tournamentCount = item.tournaments?.length || 0;
            const description = item.description || "Circuit points race.";
            const metaBits = [
              `${tournamentCount} tournaments`,
              `Host: ${item.createdByName || "Unknown"}`,
            ];
            if (item.finalTournamentSlug) {
              metaBits.unshift(`Finals: ${item.finalTournamentSlug}`);
            }
            li.innerHTML = DOMPurify.sanitize(`
              <div class="card-cover">
                <span class="status-chip status-circuit status-chip-overlay">Circuit</span>
              </div>
              <div class="content-stack">
                <div class="card-top">
                  <h4>${escapeHtml(item.name)}</h4>
                </div>
                <div class="meta">
                  ${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join("")}
                </div>
              </div>
            `);
            li.addEventListener("click", () => enterCircuit(item.slug));
            targetList.appendChild(li);
          },
        });
      }
      if (statTournaments) statTournaments.textContent = String(circuitItems.length);
      if (statNextStart) statNextStart.textContent = "TBD";
      return;
    }
    const items = await loadTournamentRegistry(true);
    const progressTargets = [];
    let filtered = items || [];
    if (ownerFilterActive) {
      if (!userId) {
        filtered = [];
      } else {
        filtered = filtered.filter((item) => item.createdBy === userId);
      }
    }
    if (roleFilter === "hosting") {
      filtered = filtered.filter((item) => userId && item.createdBy === userId);
    } else if (roleFilter === "registered") {
      filtered = filtered.filter((item) =>
        registered.has(item.slug || item.id)
      );
    } else if (roleFilter === "casting") {
      if (!userId) {
        filtered = [];
      } else {
        const checks = await Promise.all(
          filtered.map(async (item) => ({
            item,
            isCaster: await isCasterForTournament(item.slug, userId),
          }))
        );
        filtered = checks.filter((row) => row.isCaster).map((row) => row.item);
      }
    }

    const now = Date.now();
    if (statusFilter === "upcoming") {
      filtered = filtered.filter((item) => item.startTime && item.startTime > now);
    } else if (statusFilter === "live" || statusFilter === "finished") {
      const candidates = filtered.filter((item) => item.startTime && item.startTime <= now);
      const checks = await Promise.all(
        candidates.map(async (item) => ({
          item,
          finished: await getTournamentFinishedStatus(item.slug),
        }))
      );
      filtered = checks
        .filter((row) => (statusFilter === "finished" ? row.finished : !row.finished))
        .map((row) => row.item);
    }

    const sorted = filtered.sort((a, b) => {
      const aHasStart = Number.isFinite(a.startTime);
      const bHasStart = Number.isFinite(b.startTime);
      if (aHasStart !== bHasStart) return aHasStart ? -1 : 1;
      const aTime = aHasStart ? a.startTime : 0;
      const bTime = bHasStart ? b.startTime : 0;
      return aTime - bTime;
    });
    const listItems = sorted.map((item) => ({ ...item, type: "tournament" }));

    if (!listItems.length) {
      listEl.innerHTML = `<li class="muted">No tournaments found.</li>`;
      setTournamentListItems([], {
        mode: `${statusFilter}-${roleFilter}-${ownerFilterActive ? "mine" : "all"}`,
      });
    } else {
      setTournamentListItems(listItems, {
        mode: `${statusFilter}-${roleFilter}-${ownerFilterActive ? "mine" : "all"}`,
        onPageRender: (targetList) => {
          const targets = Array.from(
            targetList.querySelectorAll(".tournament-progress")
          ).map((progressEl) => {
            const card = progressEl.closest(".tournament-card");
            return {
              slug: progressEl.dataset.slug,
              el: card,
            };
          });
          updateTournamentProgress(targets);
        },
        renderItem: (item, targetList) => {
          const li = document.createElement("li");
          li.className = "tournament-card";
          li.dataset.slug = item.slug;
          const startLabel = item.startTime
            ? new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(item.startTime))
            : "TBD";
          const coverUrl = sanitizeUrl(item.coverImageUrl || "");
          let statusLabel = "TBD";
          let statusClass = "status-tbd";
          if (item.startTime) {
            if (item.startTime <= now) {
              statusLabel = "Live";
              statusClass = "status-started";
            } else {
              statusLabel = "Upcoming";
              statusClass = "status-upcoming";
            }
          }
          const accessLabel = item.isInviteOnly ? "Closed" : "Open";
          const accessClass = item.isInviteOnly ? "status-closed" : "status-open";
          const overlayChip = `<span class="status-chip ${statusClass} status-chip-overlay">${statusLabel}</span>`;
          const accessChip = `<span class="status-chip ${accessClass} status-chip-access">${accessLabel}</span>`;
          li.innerHTML = DOMPurify.sanitize(`
            <div class="card-cover${coverUrl ? " has-image" : ""}"${
              coverUrl ? ` style="background-image:url('${escapeHtml(coverUrl)}')"` : ""
            }>
              ${overlayChip}
              ${accessChip}
              <div class="time-block time-block-cover">
                <span class="time-value">${escapeHtml(startLabel)}</span>
              </div>
            </div>
            <div class="content-stack">
              <div class="card-top">
                <h4>${escapeHtml(item.name)}</h4>
              </div>
              <div class="meta">
                <span>Host: ${escapeHtml(item.createdByName || "Unknown")}</span>
              </div>
              <div class="tournament-progress" data-slug="${escapeHtml(item.slug)}">
                <span class="progress-label">Progress</span>
                <div class="progress-track">
                  <div class="progress-fill" style="width:0%"></div>
                </div>
                <div class="progress-meta">Loading progress…</div>
              </div>
              <div class="time-block time-block-row">
                <span class="time-value">${escapeHtml(startLabel)}</span>
              </div>
            </div>
          `);
          const open = () =>
            enterTournament(item.slug, { circuitSlug: item.circuitSlug || "" });
          li.addEventListener("click", open);
          targetList.appendChild(li);
          progressTargets.push({ slug: item.slug, el: li });
        },
      });
    }
    if (statTournaments) statTournaments.textContent = String(sorted.length);
    if (statNextStart) {
      const next = sorted.find((i) => i.startTime);
      statNextStart.textContent = next
        ? new Date(next.startTime).toLocaleString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";
    }
    updateTournamentProgress(progressTargets);
  } catch (err) {
    console.error("Failed to load tournaments", err);
    listEl.innerHTML = `<li class="muted error">Failed to load tournaments.</li>`;
  }
}

function computeTournamentProgress(bracket) {
  if (!bracket) return null;
  const matches = getAllMatches(bracket);
  if (!matches.length) return null;
  let completed = 0;
  matches.forEach((match) => {
    if (
      match?.status === "complete" ||
      match?.winnerId ||
      match?.walkover
    ) {
      completed += 1;
    }
  });
  const percent = Math.round((completed / matches.length) * 100);
  return {
    completed,
    total: matches.length,
    percent,
    isFinished: completed === matches.length,
  };
}

const tournamentStateCache = new Map();
const TOURNAMENT_PROGRESS_TTL_MS = 30000;

async function getTournamentStateCached(slug, { maxAgeMs = TOURNAMENT_PROGRESS_TTL_MS } = {}) {
  if (!slug) return null;
  const cached = tournamentStateCache.get(slug);
  const now = Date.now();
  if (cached?.value && now - cached.ts < maxAgeMs) {
    return cached.value;
  }
  if (cached?.promise) {
    return cached.promise;
  }
  const promise = loadTournamentStateRemote(slug)
    .then((value) => {
      tournamentStateCache.set(slug, { value, ts: Date.now() });
      return value;
    })
    .catch(() => {
      tournamentStateCache.delete(slug);
      return null;
    });
  tournamentStateCache.set(slug, { promise, ts: now });
  return promise;
}

async function getTournamentFinishedStatus(slug) {
  const state = await getTournamentStateCached(slug);
  const bracket = deserializeBracket(state?.bracket);
  const progress = computeTournamentProgress(bracket);
  return Boolean(progress?.isFinished);
}

async function isCasterForTournament(slug, uid) {
  if (!uid) return false;
  const state = await getTournamentStateCached(slug);
  const casters = Array.isArray(state?.casters) ? state.casters : [];
  return casters.some((entry) => entry?.uid === uid);
}

function updateTournamentProgress(targets = []) {
  if (!targets.length) return;
  Promise.all(
    targets.map(async ({ slug, el }) => {
      if (!slug || !el) return;
      const progressEl = el.querySelector(".tournament-progress");
      if (!progressEl) return;
      try {
        const remote = await getTournamentStateCached(slug);
        const bracket = deserializeBracket(remote?.bracket);
        const progress = computeTournamentProgress(bracket);
        const fill = progressEl.querySelector(".progress-fill");
        const meta = progressEl.querySelector(".progress-meta");
        const statusChip = el.querySelector(".status-chip.status-chip-overlay");
        if (!fill || !meta) return;
        if (!progress) {
          fill.style.width = "0%";
          meta.textContent = "No matches yet";
          return;
        }
        const percent = Math.max(0, Math.min(100, progress.percent));
        fill.style.width = `${percent}%`;
        meta.textContent = `${progress.completed}/${progress.total} matches`;
        if (progress.isFinished && statusChip) {
          statusChip.textContent = "Finished";
          statusChip.classList.remove("status-upcoming", "status-started", "status-tbd");
          statusChip.classList.add("status-finished");
        }
      } catch (err) {
        console.warn("Failed to load progress", err);
      }
    })
  );
}

function markRegisteredTournament(slug) {
  if (!slug) return;
  setRegisteredTournament(slug);
}

async function validateSlug() {
  return true;
}

async function populateCreateForm() {
  renderMapPoolPicker("mapPoolPicker", {
    mapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  const slugInput = document.getElementById("tournamentSlugInput");
  const nameInput = document.getElementById("tournamentNameInput");
  if (slugInput && !slugInput.value) {
    const baseName = (nameInput?.value || "").trim();
    if (baseName) {
      slugInput.value = await generateUniqueSlug(baseName);
      slugInput.dataset.auto = "true";
    } else {
      slugInput.value = "";
      slugInput.dataset.auto = "true";
    }
    updateSlugPreview();
  }
  const imageInput = document.getElementById("tournamentImageInput");
  const imagePreview = document.getElementById("tournamentImagePreview");
  const checkInSelect = document.getElementById("checkInSelect");
  const accessSelect = document.getElementById("tournamentAccessSelect");
  const templateSelect = document.getElementById("tournamentTemplateSelect");
  const templateNameInput = document.getElementById("tournamentTemplateNameInput");
  if (imageInput) imageInput.value = "";
  if (imagePreview) {
    imagePreview.removeAttribute("src");
    imagePreview.style.display = "none";
    delete imagePreview.dataset.tempPreview;
    delete imagePreview.dataset.reuseUrl;
  }
  if (checkInSelect) checkInSelect.value = "0";
  if (accessSelect) accessSelect.value = "open";
  if (templateSelect) templateSelect.value = "";
  if (templateNameInput) {
    templateNameInput.value = "";
    delete templateNameInput.dataset.templateId;
  }
  const bestOfUpperInput = document.getElementById("bestOfUpperInput");
  const bestOfLowerInput = document.getElementById("bestOfLowerInput");
  const bestOfLowerSemiInput = document.getElementById("bestOfLowerSemiInput");
  const bestOfLowerFinalInput = document.getElementById("bestOfLowerFinalInput");
  const bestOfQuarterInput = document.getElementById("bestOfQuarterInput");
  const bestOfSemiInput = document.getElementById("bestOfSemiInput");
  const bestOfUpperFinalInput = document.getElementById("bestOfUpperFinalInput");
  const bestOfFinalInput = document.getElementById("bestOfFinalInput");
  if (bestOfUpperInput) bestOfUpperInput.value = String(defaultBestOf.upper);
  if (bestOfLowerInput) bestOfLowerInput.value = String(defaultBestOf.lower);
  if (bestOfLowerSemiInput) bestOfLowerSemiInput.value = String(defaultBestOf.lowerSemi);
  if (bestOfLowerFinalInput) bestOfLowerFinalInput.value = String(defaultBestOf.lowerFinal);
  if (bestOfQuarterInput) bestOfQuarterInput.value = String(defaultBestOf.quarter);
  if (bestOfSemiInput) bestOfSemiInput.value = String(defaultBestOf.semi);
  if (bestOfUpperFinalInput) {
    bestOfUpperFinalInput.value = String(defaultBestOf.upperFinal);
  }
  if (bestOfFinalInput) bestOfFinalInput.value = String(defaultBestOf.final);
  setCreateTournamentCircuitContext("");
}


function setCreateTournamentCircuitContext(circuitSlug) {
  const modal = document.getElementById("createTournamentModal");
  const options = document.getElementById("circuitTournamentOptions");
  const label = document.getElementById("circuitSlugLabel");
  const toggle = document.getElementById("circuitFinalToggle");
  if (options) options.style.display = circuitSlug ? "block" : "none";
  if (label) label.textContent = circuitSlug || "";
  if (toggle) toggle.checked = false;
  if (modal) {
    if (circuitSlug) {
      modal.dataset.circuitSlug = circuitSlug;
    } else {
      delete modal.dataset.circuitSlug;
    }
  }
}

async function openCircuitTournamentModal() {
  if (!currentCircuitMeta?.slug || !isCircuitAdmin) return;
  await populateCreateForm();
  setCreateTournamentCircuitContext(currentCircuitMeta.slug);
  const modal = document.getElementById("createTournamentModal");
  if (modal) {
    modal.style.display = "flex";
    lockBodyScroll();
  }
}

function openCircuitSettingsModal() {
  if (!currentCircuitMeta?.slug || !isCircuitAdmin) return;
  const modal = document.getElementById("circuitSettingsModal");
  const toggle = document.getElementById("circuitSettingsFirstPlaceSortToggle");
  if (toggle) toggle.checked = Boolean(currentCircuitMeta?.sortByFirstPlace);
  if (modal) {
    modal.style.display = "flex";
    lockBodyScroll();
  }
}

function closeCircuitSettingsModal() {
  const modal = document.getElementById("circuitSettingsModal");
  if (!modal) return;
  modal.style.display = "none";
  unlockBodyScroll();
}

async function saveCircuitSettings() {
  if (!currentCircuitMeta?.slug || !isCircuitAdmin) return;
  const toggle = document.getElementById("circuitSettingsFirstPlaceSortToggle");
  const sortByFirstPlace = Boolean(toggle?.checked);
  try {
    await setDoc(
      doc(collection(db, CIRCUIT_COLLECTION), currentCircuitMeta.slug),
      { sortByFirstPlace },
      { merge: true }
    );
    currentCircuitMeta = { ...currentCircuitMeta, sortByFirstPlace };
    await renderCircuitLeaderboard(
      currentCircuitMeta,
      normalizeCircuitTournamentSlugs(currentCircuitMeta),
      { showEdit: isCircuitAdmin }
    );
    showToast?.("Circuit settings saved.", "success");
    closeCircuitSettingsModal();
  } catch (err) {
    console.error("Failed to save circuit settings", err);
    showToast?.("Failed to save circuit settings.", "error");
  }
}

function openDeleteTournamentModal({ slug, circuitSlug } = {}) {
  const targetSlug = slug || currentSlug || "";
  if (!targetSlug) return;
  const modal = document.getElementById("confirmDeleteTournamentModal");
  const message = document.getElementById("confirmDeleteTournamentMessage");
  if (modal) {
    modal.dataset.slug = targetSlug;
    if (circuitSlug) {
      modal.dataset.circuitSlug = circuitSlug;
    } else {
      delete modal.dataset.circuitSlug;
    }
    if (message) {
      message.textContent = `Are you sure you want to delete "${targetSlug}"? This cannot be undone.`;
    }
    modal.style.display = "flex";
    lockBodyScroll();
  }
}

function closeDeleteTournamentModal() {
  const modal = document.getElementById("confirmDeleteTournamentModal");
  if (!modal) return;
  delete modal.dataset.slug;
  delete modal.dataset.circuitSlug;
  modal.style.display = "none";
  unlockBodyScroll();
}

async function confirmDeleteTournament() {
  const modal = document.getElementById("confirmDeleteTournamentModal");
  if (!modal?.dataset.slug) return;
  const slug = modal.dataset.slug;
  const circuitSlug = modal.dataset.circuitSlug || currentTournamentMeta?.circuitSlug || "";
  try {
    let coverImageUrl = "";
    if (currentTournamentMeta?.slug === slug) {
      coverImageUrl = currentTournamentMeta?.coverImageUrl || "";
    } else {
      try {
        const tournamentSnap = await getDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
        coverImageUrl = tournamentSnap.exists() ? tournamentSnap.data()?.coverImageUrl || "" : "";
      } catch (err) {
        console.warn("Failed to load tournament cover image", err);
      }
    }
    await deleteTournamentChatHistory(slug);
    await deleteTournamentPresence(slug);
    await deleteDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
    await deleteDoc(doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug));
    await deleteTournamentCoverByUrl(coverImageUrl, slug);
    await deleteTournamentCoverFolder(slug);
    try {
      localStorage.removeItem(getPersistStorageKey(slug));
    } catch (_) {
      // ignore
    }
    if (circuitSlug) {
      const updates = { tournaments: arrayRemove(slug) };
      if (currentCircuitMeta?.finalTournamentSlug === slug) {
        updates.finalTournamentSlug = "";
      }
      await setDoc(doc(collection(db, CIRCUIT_COLLECTION), circuitSlug), updates, {
        merge: true,
      });
      if (currentCircuitMeta?.slug === circuitSlug) {
        currentCircuitMeta = {
          ...currentCircuitMeta,
          tournaments: (currentCircuitMeta.tournaments || []).filter(
            (t) => t !== slug
          ),
          finalTournamentSlug:
            currentCircuitMeta.finalTournamentSlug === slug
              ? ""
              : currentCircuitMeta.finalTournamentSlug,
        };
      }
    }
    showToast?.("Tournament deleted.", "success");
    closeDeleteTournamentModal();
    const redirectTarget = circuitSlug ? `/tournament/${circuitSlug}` : "/tournament/";
    if (typeof window !== "undefined") {
      window.location.href = redirectTarget;
    }
  } catch (err) {
    console.error("Failed to delete tournament", err);
    showToast?.("Failed to delete tournament.", "error");
  }
}

function getRouteFromPath() {
  const parts = (window.location.pathname || "").split("/").filter(Boolean);
  if (!parts.length) {
    return { view: "landing", slug: "" };
  }
  if (parts.length === 1 && parts[0].toLowerCase() === "tournament") {
    return { view: "landing", slug: "" };
  }
  if (
    parts[0].toLowerCase() === "tournament" &&
    parts[1]?.toLowerCase() === "circuit" &&
    parts[2]
  ) {
    return { view: "circuitLegacy", slug: parts[2] };
  }
  if (parts[0].toLowerCase() === "tournament" && parts.length >= 3) {
    return { view: "circuitTournament", circuitSlug: parts[1], slug: parts[2] };
  }
  if (parts[0].toLowerCase() === "tournament" && parts.length === 2) {
    return { view: "slug", slug: parts[1] };
  }
  return { view: "landing", slug: "" };
}

async function handleRouteChange() {
  const route = getRouteFromPath();
  if (route.view === "circuitLegacy" && route.slug) {
    await enterCircuit(route.slug);
    return;
  }
  if (route.view === "circuitTournament" && route.slug && route.circuitSlug) {
    await enterTournament(route.slug, { circuitSlug: route.circuitSlug });
    return;
  }
  if (route.view === "circuit" && route.slug) {
    await enterCircuit(route.slug);
    return;
  }
  if (route.view === "slug" && route.slug) {
    const meta = await fetchCircuitMeta(route.slug);
    if (meta) {
      await enterCircuit(route.slug, { meta });
      return;
    }
    try {
      const snap = await getDoc(doc(collection(db, TOURNAMENT_COLLECTION), route.slug));
      if (snap.exists()) {
        const tournamentMeta = snap.data() || {};
        const circuitSlug = String(tournamentMeta?.circuitSlug || "").trim();
        if (circuitSlug) {
          await enterTournament(route.slug, { circuitSlug });
          return;
        }
      }
    } catch (_) {
      // ignore lookup errors
    }
    await enterTournament(route.slug);
    return;
  }
  await showLanding();
}

async function enterTournament(slug, options = {}) {
  const { circuitSlug = "" } = options;
  setCurrentSlugState(slug || null);
  if (slug) {
    const target = circuitSlug ? `/tournament/${circuitSlug}/${slug}` : `/tournament/${slug}`;
    if (window.location.pathname !== target) {
      window.history.pushState({}, "", target);
    }
  }
  const backLink = document.getElementById("tournamentBackLink");
  if (backLink) {
    backLink.href = circuitSlug ? `/tournament/${circuitSlug}` : "/tournament";
    backLink.lastChild.textContent = circuitSlug ? "Circuit page" : "All tournaments";
  }
  // Load local state for this slug
  const local = loadLocalState(slug, applyRosterSeedingWithMode, deserializeBracket);
  setStateObj(local);
  // Try remote meta first
  try {
    const snap = await getDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
    if (snap.exists()) {
      const meta = snap.data() || null;
      if (meta && circuitSlug && !meta.circuitSlug) {
        meta.circuitSlug = circuitSlug;
      }
      setCurrentTournamentMetaState(meta);
      const metaCircuitSlug = meta?.circuitSlug || "";
      if (slug && metaCircuitSlug && !circuitSlug) {
        const target = `/tournament/${metaCircuitSlug}/${slug}`;
        if (window.location.pathname !== target) {
          window.history.pushState({}, "", target);
        }
      }
      const backLink = document.getElementById("tournamentBackLink");
      if (backLink) {
        backLink.href = metaCircuitSlug ? `/tournament/${metaCircuitSlug}` : "/tournament";
        backLink.lastChild.textContent = metaCircuitSlug ? "Circuit page" : "All tournaments";
      }
    } else {
      if (typeof window !== "undefined") {
        window.location.href = "/404.html";
      }
      return;
    }
  } catch (_) {
    // ignore
  }
  // Update admin flag based on ownership
  recomputeAdminFromMeta();
  // Hydrate remote state (merge) and render
  await hydrateStateFromRemote(
    slug,
    applyRosterSeedingWithMode,
    deserializeBracket,
    saveState,
    renderAll
  );
  await maybeAutoAddFinalPlayers();
  subscribeTournamentStateRemote(slug);
  const landingView = document.getElementById("landingView");
  const tournamentView = document.getElementById("tournamentView");
  const circuitView = document.getElementById("circuitView");
  if (landingView) landingView.style.display = "none";
  if (tournamentView) tournamentView.style.display = "block";
  if (circuitView) circuitView.style.display = "none";
  currentCircuitMeta = null;
  isCircuitAdmin = false;
  updateCircuitAdminVisibility();
  renderAll();
  switchTab("bracketTab");
}

async function showLanding() {
  try {
    unsubscribeRemoteState?.();
  } catch (_) {
    // ignore
  }
  unsubscribeRemoteState = null;
  setIsAdminState(false);
  updateAdminVisibility();
  const landingView = document.getElementById("landingView");
  const tournamentView = document.getElementById("tournamentView");
  const circuitView = document.getElementById("circuitView");
  if (landingView) landingView.style.display = "block";
  if (tournamentView) tournamentView.style.display = "none";
  if (circuitView) circuitView.style.display = "none";
  currentCircuitMeta = null;
  isCircuitAdmin = false;
  updateCircuitAdminVisibility();
  switchTab("registrationTab");
}

const {
  enterCircuit,
  refreshCircuitView,
  updateCircuitAdminVisibility,
  recomputeCircuitAdminFromMeta,
} = createCircuitPageHandlers({
  fetchCircuitMeta,
  renderCircuitView,
  enterTournament,
  openDeleteTournamentModal,
  showToast,
  showLanding,
  setIsAdminState,
  updateAdminVisibility,
  getUnsubscribeRemoteState: () => unsubscribeRemoteState,
  setUnsubscribeRemoteState: (next) => {
    unsubscribeRemoteState = next;
  },
  getCurrentCircuitMeta: () => currentCircuitMeta,
  setCurrentCircuitMeta: (next) => {
    currentCircuitMeta = next;
  },
  getAuthUid: () => auth?.currentUser?.uid || null,
  getIsCircuitAdmin: () => isCircuitAdmin,
  setIsCircuitAdmin: (next) => {
    isCircuitAdmin = next;
  },
  isAdminForMeta,
  renderAdmins: renderCircuitAdmins,
});

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.style.display = message ? "block" : "none";
  el.classList.toggle("error", !!isError);
  el.classList.toggle("status-ok", !isError);
}

function getPulseSyncGateStatus() {
  const requirePulseSyncEnabled =
    currentTournamentMeta?.requirePulseSync ?? requirePulseSyncSetting;
  if (!requirePulseSyncEnabled) {
    return {
      needsSync: false,
      needsMain: false,
      needsSecondary: false,
      message: "",
    };
  }
  if (!auth.currentUser) {
    return {
      needsSync: false,
      needsMain: false,
      needsSecondary: false,
      message: "",
    };
  }
  const needsMain = pulseSyncRequired && !pulseSyncSessionCompleted;
  const needsSecondary =
    secondaryPulseSyncRequired && !secondaryPulseSyncSessionCompleted;
  const needsSync = needsMain || needsSecondary;
  let message = "";
  if (needsMain && needsSecondary) {
    message =
      "Update your SC2Pulse link and secondary links in Settings before registering.";
  } else if (needsMain) {
    message = "Update your SC2Pulse link in Settings before registering.";
  } else if (needsSecondary) {
    message =
      "Update your secondary SC2Pulse links in Settings before registering.";
  }
  return { needsSync, needsMain, needsSecondary, message };
}

function normalizePulseSyncUrl(url = "") {
  return sanitizeUrl((url || "").trim());
}

function extractSecondaryPulseUrls(secondary = []) {
  if (!Array.isArray(secondary)) return [];
  const urls = secondary
    .map((entry) => (entry && typeof entry === "object" ? entry.url : entry))
    .map((url) => normalizePulseSyncUrl(url))
    .filter(Boolean);
  return Array.from(new Set(urls));
}

function computeSecondarySignature(secondary = []) {
  const urls = extractSecondaryPulseUrls(secondary).sort();
  return urls.length ? urls.join("|") : "";
}

function resetPulseSyncSessionState() {
  pulseSyncSessionCompleted = false;
  secondaryPulseSyncSessionCompleted = false;
  pulseSyncRequired = false;
  secondaryPulseSyncRequired = false;
  lastPulseUrl = "";
  lastSecondarySignature = "";
}

function syncPulseRegistrationRequirements(pulseState = null) {
  const source = pulseState || getPulseState?.() || {};
  const url = normalizePulseSyncUrl(source?.url || "");
  const secondarySignature = computeSecondarySignature(source?.secondary || []);

  if (url !== lastPulseUrl) {
    pulseSyncSessionCompleted = false;
    lastPulseUrl = url;
  }
  if (secondarySignature !== lastSecondarySignature) {
    secondaryPulseSyncSessionCompleted = false;
    lastSecondarySignature = secondarySignature;
  }

  pulseSyncRequired = Boolean(url);
  secondaryPulseSyncRequired = Boolean(secondarySignature);
}

function isInviteOnlyTournament(meta) {
  if (!meta) return false;
  if (typeof meta.isInviteOnly === "boolean") return meta.isInviteOnly;
  const access = String(meta.accessType || meta.registrationType || "").toLowerCase();
  return access === "closed" || access === "invite-only" || access === "invite";
}

function getDefaultMapPoolNames() {
  const list = (mapCatalog || []).filter((m) => {
    const folder = (m.folder || "").toLowerCase();
    const isArchive = folder.includes("archive");
    return m.mode === "1v1" && !isArchive;
  });
  if (list.length) {
    return list.map((m) => m.name);
  }
  // Fallback to bundled current ladder list
  return FALLBACK_LADDER_MAPS.map((m) => m.name);
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

function validateTournamentImage(file) {
  return validateImageFile(file, { maxBytes: MAX_TOURNAMENT_IMAGE_SIZE });
}

function getStartTimeMs(meta) {
  const raw = meta?.startTime;
  if (!raw) return null;
  if (raw?.toMillis) return raw.toMillis();
  if (typeof raw === "number") return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getCheckInWindowMinutesFromMeta(meta) {
  const minutes = Number(meta?.checkInWindowMinutes || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function getCheckInWindowState(meta) {
  const startMs = getStartTimeMs(meta);
  const windowMinutes = getCheckInWindowMinutesFromMeta(meta);
  if (!startMs || !windowMinutes) {
    return { isOpen: false, opensAt: null, closesAt: null };
  }
  const now = Date.now();
  const opensAt = startMs - windowMinutes * 60 * 1000;
  const closesAt = startMs;
  return { isOpen: now >= opensAt && now < closesAt, opensAt, closesAt };
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function updateCheckInUI() {
  if (!currentTournamentMeta) return;
  const checkInBtn = document.getElementById("checkInBtn");
  const checkInStatus = document.getElementById("checkInStatus");
  if (!checkInBtn || !checkInStatus) return;

  checkInStatus.classList.remove("is-open", "is-checked", "is-closed");
  const startMs = getStartTimeMs(currentTournamentMeta);
  const checkInState = getCheckInWindowState(currentTournamentMeta);
  const currentUid = auth.currentUser?.uid || null;
  const currentPlayer = currentUid
    ? (state.players || []).find((p) => p.uid === currentUid)
    : null;
  const inviteStatus = normalizeInviteStatus(currentPlayer?.inviteStatus);
  const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);

  if (state.isLive || !getCheckInWindowMinutesFromMeta(currentTournamentMeta) || !startMs) {
    checkInBtn.style.display = "none";
    checkInStatus.textContent = "";
    return;
  }

  if (!checkInState.isOpen) {
    checkInBtn.style.display = "none";
    const timeUntil = checkInState.opensAt ? checkInState.opensAt - Date.now() : 0;
    checkInStatus.textContent = checkInState.opensAt
      ? `Check-in opens in ${formatCountdown(timeUntil)}`
      : "Check-in is not open yet.";
    checkInStatus.classList.add("is-closed");
    return;
  }

  if (!currentPlayer) {
    checkInBtn.style.display = "none";
    checkInStatus.textContent = isInviteOnly && !isAdmin
      ? "Invite required to check in."
      : "Register to check in.";
    checkInStatus.classList.add("is-open");
    return;
  }
  if (inviteStatus !== INVITE_STATUS.accepted) {
    checkInBtn.style.display = "none";
    checkInStatus.textContent =
      inviteStatus === INVITE_STATUS.pending
        ? "Invite pending."
        : "Invite declined.";
    checkInStatus.classList.add("is-closed");
    return;
  }

  if (currentPlayer.checkedInAt) {
    checkInBtn.style.display = "none";
    checkInStatus.textContent = "You are checked in.";
    checkInStatus.classList.add("is-checked");
    return;
  }

  const closesIn = checkInState.closesAt ? checkInState.closesAt - Date.now() : 0;
  checkInBtn.style.display = "inline-flex";
  checkInStatus.textContent = `Check-in open · closes in ${formatCountdown(closesIn)}`;
  checkInStatus.classList.add("is-open");
}

function getCheckInWindowMinutes(selectInput) {
  const minutes = Number(selectInput?.value || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

async function deleteTournamentPresence(slug) {
  if (!slug) return;
  try {
    const colRef = collection(db, "tournamentPresence", slug, "matchInfo");
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.warn("Failed to delete tournament presence data", err);
  }
}

async function deleteTournamentChatHistory(slug) {
  if (!slug) return;
  try {
    const matchesRef = collection(db, "tournamentChats", slug, "matches");
    const matchesSnap = await getDocs(matchesRef);
    for (const matchDoc of matchesSnap.docs) {
      try {
        const messagesRef = collection(matchDoc.ref, "messages");
        const messagesSnap = await getDocs(messagesRef);
        await Promise.all(messagesSnap.docs.map((msg) => deleteDoc(msg.ref)));
      } catch (err) {
        console.warn("Failed to delete match chat messages", err);
      }
      try {
        await deleteDoc(matchDoc.ref);
      } catch (err) {
        console.warn("Failed to delete match chat doc", err);
      }
    }
  } catch (err) {
    console.warn("Failed to delete tournament chat history", err);
  }
}

function isFirebaseStorageUrl(url) {
  return /^gs:\/\//.test(url) || url.includes("firebasestorage.googleapis.com");
}

function isCoverUrlInSlugFolder(url, slug) {
  if (!url || !slug) return false;
  const encodedSlug = encodeURIComponent(slug);
  return (
    url.includes(`tournamentCovers/${slug}/`) ||
    url.includes(`tournamentCovers%2F${encodedSlug}%2F`)
  );
}

async function isCoverUrlUsedElsewhere(coverImageUrl, excludeSlug) {
  const trimmed = String(coverImageUrl || "").trim();
  if (!trimmed) return false;
  try {
    const registry = await loadTournamentRegistry(true);
    return (registry || []).some((item) => {
      if (!item || item.slug === excludeSlug) return false;
      return String(item.coverImageUrl || "").trim() === trimmed;
    });
  } catch (err) {
    console.warn("Failed to verify cover image usage", err);
    return true;
  }
}

async function isCoverFolderUsedElsewhere(slug, excludeSlug) {
  if (!slug) return false;
  try {
    const registry = await loadTournamentRegistry(true);
    return (registry || []).some((item) => {
      if (!item || item.slug === excludeSlug) return false;
      return isCoverUrlInSlugFolder(String(item.coverImageUrl || "").trim(), slug);
    });
  } catch (err) {
    console.warn("Failed to verify cover folder usage", err);
    return true;
  }
}

async function deleteTournamentCoverByUrl(coverImageUrl, slug) {
  const trimmed = String(coverImageUrl || "").trim();
  if (!trimmed || !isFirebaseStorageUrl(trimmed)) return;
  if (slug && !isCoverUrlInSlugFolder(trimmed, slug)) return;
  const usedElsewhere = await isCoverUrlUsedElsewhere(trimmed, slug);
  if (usedElsewhere) return;
  try {
    const coverRef = storageRef(storage, trimmed);
    await deleteObject(coverRef);
  } catch (err) {
    console.warn("Failed to delete tournament cover image", err);
  }
}

async function deleteTournamentCoverFolder(slug) {
  if (!slug) return;
  const usedElsewhere = await isCoverFolderUsedElsewhere(slug, slug);
  if (usedElsewhere) return;
  try {
    const folderRef = storageRef(storage, `tournamentCovers/${slug}`);
    const list = await listAll(folderRef);
    await Promise.all(list.items.map((item) => deleteObject(item)));
  } catch (err) {
    console.warn("Failed to delete tournament cover folder", err);
  }
}

async function uploadTournamentCover(file, slug) {
  const error = validateTournamentImage(file);
  if (error) throw new Error(error);
  if (!slug) throw new Error("Missing tournament slug.");
  const processed = await prepareImageForUpload(file, {
    targetWidth: COVER_TARGET_WIDTH,
    targetHeight: COVER_TARGET_HEIGHT,
    quality: COVER_QUALITY,
    outputType: "image/webp",
    fallbackType: "image/jpeg",
  });
  const path = `tournamentCovers/${slug}/cover-${Date.now()}.webp`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, processed.blob, { contentType: processed.contentType });
  return getDownloadURL(ref);
}

async function handleSaveSettings(event) {
  event?.preventDefault?.();
  const formatSelect = document.getElementById("settingsFormatSelect");
  const descInput = document.getElementById("settingsDescriptionInput");
  const rulesInput = document.getElementById("settingsRulesInput");
  const slugInput = document.getElementById("settingsSlugInput");
  const startInput = document.getElementById("settingsStartInput");
  const maxPlayersInput = document.getElementById("settingsMaxPlayersInput");
  const checkInSelect = document.getElementById("settingsCheckInSelect");
  const accessSelect = document.getElementById("settingsAccessSelect");
  const qualifyInput = document.getElementById("settingsCircuitQualifyCount");
  const requirePulseInput = document.getElementById("settingsRequirePulseLink");
  const requirePulseSyncInput = document.getElementById("settingsRequirePulseSync");
  const imageInput = document.getElementById("settingsImageInput");
  const imagePreview = document.getElementById("settingsImagePreview");
  const imageFile = imageInput?.files?.[0] || null;
  const reuseUrl = imagePreview?.dataset.reuseUrl || "";
  const newSlugRaw = (slugInput?.value || "").trim();
  const newSlug = newSlugRaw || currentSlug || "";
  const slugChanged = newSlug && newSlug !== currentSlug;
  const bestOf = readBestOf("settings", defaultBestOf);
  const format = (formatSelect?.value || currentTournamentMeta?.format || "Tournament").trim();
  const description = descInput?.value || "";
  const rules = rulesInput?.value || "";
  const startTime = startInput?.value ? new Date(startInput.value) : null;
  const maxPlayers = maxPlayersInput?.value
    ? Number(maxPlayersInput.value)
    : null;
  const qualifyRaw = qualifyInput?.value ?? "";
  const qualifyCount =
    qualifyRaw === "" || qualifyRaw === null || qualifyRaw === undefined
      ? null
      : Number(qualifyRaw);
  const checkInWindowMinutes = getCheckInWindowMinutes(checkInSelect);
  const isInviteOnly = accessSelect?.value === "closed";
  const mapPool = Array.from(mapPoolSelection || []);
  const rrSettings = extractRoundRobinSettingsUI("settings", defaultRoundRobinSettings);
  const circuitPoints = currentTournamentMeta?.circuitSlug
    ? readCircuitPointsTable()
    : null;
  const requirePulseLink =
    requirePulseInput?.checked ?? currentTournamentMeta?.requirePulseLink ?? true;
  const requirePulseSync =
    requirePulseSyncInput?.checked ?? currentTournamentMeta?.requirePulseSync ?? true;
  let coverImageUrl = currentTournamentMeta?.coverImageUrl || "";
  if (!imageFile && reuseUrl) {
    coverImageUrl = reuseUrl;
  }
  if (imageFile) {
    try {
      coverImageUrl = await uploadTournamentCover(imageFile, newSlug);
    } catch (err) {
      showToast?.(err?.message || "Failed to upload cover image.", "error");
      return;
    }
  }

  const meta = buildSettingsPayload({
    currentTournamentMeta,
    newSlug,
    format,
    description,
    rules,
    coverImageUrl,
    maxPlayers,
    startTime,
    checkInWindowMinutes,
    isInviteOnly,
    bestOf,
    mapPool,
    roundRobin: rrSettings,
    requirePulseLink,
    requirePulseSync,
    circuitQualifyCount:
      currentTournamentMeta?.isCircuitFinal &&
      Number.isFinite(qualifyCount) &&
      qualifyCount >= 0
        ? qualifyCount
        : null,
  });
  if (currentTournamentMeta?.circuitSlug) {
    meta.circuitPoints = circuitPoints || [];
  }

  const previousSlug = currentSlug;
  if (slugChanged) {
    setCurrentSlugState(newSlug);
    try {
      localStorage.removeItem(getPersistStorageKey(previousSlug));
    } catch (_) {
      // ignore storage removal errors
    }
    const circuitSlug = meta?.circuitSlug || "";
    const target = circuitSlug ? `/tournament/${circuitSlug}/${newSlug}` : `/tournament/${newSlug}`;
    window.history.pushState({}, "", target);
  }

  setCurrentTournamentMetaState(meta);
  setRequirePulseLinkSettingState(requirePulseLink);
  setRequirePulseSyncSettingState(requirePulseSync);
  saveState({ bracket: state.bracket }); // keep bracket but bump timestamp via saveState
  // Reflect slug in the settings input
  const settingsSlugInput = document.getElementById("settingsSlugInput");
  if (settingsSlugInput) settingsSlugInput.value = newSlug;

  const targetSlug = currentSlug || newSlug;
  if (targetSlug) {
    try {
      await setDoc(
        doc(collection(db, TOURNAMENT_COLLECTION), targetSlug),
        meta,
        { merge: true }
      );
      showToast?.("Settings saved.", "success");
    } catch (err) {
      console.error("Failed to save settings", err);
      showToast?.("Failed to save settings.", "error");
    }
  } else {
    showToast?.("Settings saved locally.", "success");
  }
  rebuildBracket(true, "Settings updated");
}

async function handleCreateCircuit(event) {
  event?.preventDefault?.();
  const nameInput = document.getElementById("circuitNameInput");
  const slugInput = document.getElementById("circuitSlugInput");
  const descriptionInput = document.getElementById("circuitDescriptionInput");
  const firstPlaceToggle = document.getElementById("circuitFirstPlaceSortToggle");
  const finalNameInput = document.getElementById("finalTournamentNameInput");
  const finalSlugInput = document.getElementById("finalTournamentSlugInput");
  const finalFormatSelect = document.getElementById("finalFormatSelect");
  const finalStartInput = document.getElementById("finalTournamentStartInput");
  const finalMaxPlayersInput = document.getElementById("finalTournamentMaxPlayersInput");
  const finalCheckInSelect = document.getElementById("finalCheckInSelect");
  const finalDescriptionInput = document.getElementById("finalTournamentDescriptionInput");
  const finalRulesInput = document.getElementById("finalTournamentRulesInput");
  const finalImageInput = document.getElementById("finalTournamentImageInput");
  const finalImagePreview = document.getElementById("finalTournamentImagePreview");
  const finalQualifyInput = document.getElementById("finalQualifyCountInput");
  const modal = document.getElementById("createCircuitModal");
  const name = (nameInput?.value || "").trim();
  const slug =
    (slugInput?.value || "").trim().toLowerCase() ||
    (await generateCircuitSlug());
  const description = descriptionInput?.value || "";
  const sortByFirstPlace = Boolean(firstPlaceToggle?.checked);
  const finalName =
    (finalNameInput?.value || "").trim() || (name ? `${name} Finals` : "");
  let finalSlug = (finalSlugInput?.value || "").trim().toLowerCase();
  if (!finalSlug) {
    finalSlug = slug ? `${slug}-final` : await generateUniqueSlug();
  }
  const finalFormat = (finalFormatSelect?.value || "Double Elimination").trim();
  const finalStartTime = finalStartInput?.value ? new Date(finalStartInput.value) : null;
  const finalMaxPlayers = finalMaxPlayersInput?.value
    ? Number(finalMaxPlayersInput.value)
    : null;
  const finalCheckInWindowMinutes = getCheckInWindowMinutes(finalCheckInSelect);
  const finalDescription = finalDescriptionInput?.value || "";
  const finalRules = finalRulesInput?.value || "";
  const finalImageFile = finalImageInput?.files?.[0] || null;
  const finalReuseUrl = finalImagePreview?.dataset.reuseUrl || "";
  const finalQualifyRaw = finalQualifyInput?.value ?? "";
  const finalQualifyCount =
    finalQualifyRaw === "" || finalQualifyRaw === null || finalQualifyRaw === undefined
      ? null
      : Number(finalQualifyRaw);
  const rrSettings = extractRoundRobinSettingsUI("final", defaultRoundRobinSettings);
  if (!name) {
    showToast?.("Circuit name is required.", "error");
    return;
  }
  if (!slug) {
    showToast?.("Circuit slug is required.", "error");
    return;
  }
  if (!auth?.currentUser) {
    showToast?.("Sign in to create a circuit.", "error");
    return;
  }
  if (!finalName) {
    showToast?.("Final tournament name is required.", "error");
    return;
  }
  if (!finalSlug) {
    showToast?.("Final tournament slug is required.", "error");
    return;
  }
  const payload = {
    name,
    slug,
    description,
    sortByFirstPlace,
    tournaments: [],
    finalTournamentSlug: "",
    admins: [],
    createdBy: auth.currentUser.uid,
    createdByName:
      getCurrentUsername?.() || auth.currentUser.displayName || "Unknown",
    createdAt: serverTimestamp(),
  };
  const finalPayload = buildFinalTournamentPayload({
    slug: finalSlug,
    name: finalName,
    description: finalDescription,
    rules: finalRules,
    format: finalFormat,
    maxPlayers: finalMaxPlayers,
    startTime: finalStartTime,
    checkInWindowMinutes: finalCheckInWindowMinutes,
    mapPool: getFinalMapPoolSelection(),
    createdBy: auth.currentUser?.uid || null,
    createdByName: getCurrentUsername() || "Unknown host",
    roundRobin: rrSettings,
    bestOf: readBestOf("final", defaultBestOf),
    circuitSlug: slug,
    circuitQualifyCount: finalQualifyCount,
  });
  try {
    await setDoc(
      doc(collection(db, CIRCUIT_COLLECTION), slug),
      payload,
      { merge: true }
    );
    let finalCreated = false;
    try {
      await createFinalTournamentForCircuit({
        db,
        doc,
        collection,
        setDoc,
        arrayUnion,
        uploadTournamentCover,
        showToast,
        tournamentCollection: TOURNAMENT_COLLECTION,
        circuitCollection: CIRCUIT_COLLECTION,
        circuitSlug: slug,
        finalSlug,
        finalPayload,
        finalImageFile,
        finalCoverUrl: finalReuseUrl,
      });
      finalCreated = true;
    } catch (err) {
      console.error("Failed to create final tournament", err);
      showToast?.("Circuit saved, but final tournament failed.", "error");
    }
    if (finalCreated) {
      showToast?.("Circuit saved.", "success");
    }
    if (modal) {
      modal.style.display = "none";
      unlockBodyScroll();
    }
    await renderCircuitList({ onEnterCircuit: enterCircuit });
    await enterCircuit(slug);
    if (finalCreated) {
      await renderTournamentList();
    }
  } catch (err) {
    console.error("Failed to save circuit", err);
    showToast?.("Failed to save circuit.", "error");
  }
}

async function handleCreateTournament(event) {
  event?.preventDefault?.();
  const nameInput = document.getElementById("tournamentNameInput");
  const slugInput = document.getElementById("tournamentSlugInput");
  const formatSelect = document.getElementById("tournamentFormatSelect");
  const startInput = document.getElementById("tournamentStartInput");
  const maxPlayersInput = document.getElementById("tournamentMaxPlayersInput");
  const checkInSelect = document.getElementById("checkInSelect");
  const accessSelect = document.getElementById("tournamentAccessSelect");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const imageInput = document.getElementById("tournamentImageInput");
  const imagePreview = document.getElementById("tournamentImagePreview");
  const imageFile = imageInput?.files?.[0] || null;
  const reuseUrl = imagePreview?.dataset.reuseUrl || "";
  const modal = document.getElementById("createTournamentModal");
  const circuitSlug = (modal?.dataset.circuitSlug || "").trim();
  const isCircuitFinal = circuitSlug
    ? Boolean(document.getElementById("circuitFinalToggle")?.checked)
    : false;
  const name = (nameInput?.value || "").trim();
  if (!name) {
    showToast?.("Tournament name is required.", "error");
    return;
  }
  const rawSlug = (slugInput?.value || "").trim();
  const slugBase = rawSlug || name;
  const slug = await generateUniqueSlug(slugBase);
  if (slugInput && slug && slugInput.value !== slug) {
    slugInput.value = slug;
    slugInput.dataset.auto = "true";
    updateSlugPreview();
  }
  const format = (formatSelect?.value || "Double Elimination").trim();
  const startTime = startInput?.value ? new Date(startInput.value) : null;
  const maxPlayers = maxPlayersInput?.value
    ? Number(maxPlayersInput.value)
    : null;
  const checkInWindowMinutes = getCheckInWindowMinutes(checkInSelect);
  const isInviteOnly = accessSelect?.value === "closed";
  const description = descriptionInput?.value || "";
  const rules = rulesInput?.value || "";
  const rrSettings = extractRoundRobinSettingsUI("create", defaultRoundRobinSettings);
  try {
    const payload = buildCreateTournamentPayload({
      slug,
      name,
      description,
      rules,
      format,
      maxPlayers,
      startTime,
      checkInWindowMinutes,
      isInviteOnly,
      mapPool: Array.from(mapPoolSelection || []),
      createdBy: auth.currentUser?.uid || null,
      createdByName: getCurrentUsername() || "Unknown host",
      roundRobin: rrSettings,
      bestOf: readBestOf("create", defaultBestOf),
      circuitSlug: circuitSlug || null,
      isCircuitFinal: circuitSlug ? isCircuitFinal : false,
    });
    await setDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug), payload, {
      merge: true,
    });
    if (imageFile) {
      try {
        const coverImageUrl = await uploadTournamentCover(imageFile, slug);
        payload.coverImageUrl = coverImageUrl;
        await setDoc(
          doc(collection(db, TOURNAMENT_COLLECTION), slug),
          { coverImageUrl },
          { merge: true }
        );
      } catch (err) {
        showToast?.(err?.message || "Failed to upload cover image.", "error");
      }
    } else if (reuseUrl) {
      try {
        await setDoc(
          doc(collection(db, TOURNAMENT_COLLECTION), slug),
          { coverImageUrl: reuseUrl },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to reuse cover image", err);
      }
    }
    if (circuitSlug) {
      const circuitPayload = {
        tournaments: arrayUnion(slug),
      };
      if (isCircuitFinal) {
        circuitPayload.finalTournamentSlug = slug;
      }
      try {
        await setDoc(
          doc(collection(db, CIRCUIT_COLLECTION), circuitSlug),
          circuitPayload,
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to link tournament to circuit", err);
        showToast?.("Tournament saved, but circuit update failed.", "error");
      }
    }
    setCurrentSlugState(slug);
    setCurrentTournamentMetaState(payload);
    showToast?.("Tournament saved.", "success");
    if (modal) {
      modal.style.display = "none";
      unlockBodyScroll();
    }
    await enterTournament(slug);
    await renderTournamentList();
  } catch (err) {
    console.error("Failed to save tournament", err);
    showToast?.(err?.message || "Failed to save tournament.", "error");
  }
}

function getAll1v1Maps() {
  const source =
    Array.isArray(mapCatalog) && mapCatalog.length
      ? mapCatalog
      : FALLBACK_LADDER_MAPS || [];
  return source.filter((m) => (m.mode || "").toLowerCase() === "1v1");
}

function getMapByName(name) {
  if (!name) return null;
  return getAll1v1Maps().find((m) => m.name === name) || null;
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

if (typeof window !== "undefined") {
  window.addEventListener("pulse-state-changed", (event) => {
    syncPulseRegistrationRequirements(event.detail);
    hydratePulseFromState(event.detail);
    if (currentTournamentMeta) {
      renderAll();
    }
  });
  window.addEventListener("pulse-sync-complete", (event) => {
    syncPulseRegistrationRequirements(getPulseState?.());
    pulseSyncSessionCompleted = true;
    if (event?.detail?.url) {
      lastPulseUrl = normalizePulseSyncUrl(event.detail.url);
    }
    if (currentTournamentMeta) {
      renderAll();
    }
  });
  window.addEventListener("pulse-secondary-sync-complete", () => {
    syncPulseRegistrationRequirements(getPulseState?.());
    secondaryPulseSyncSessionCompleted = true;
    if (currentTournamentMeta) {
      renderAll();
    }
  });
}

onAuthStateChanged?.(auth, (user) => {
  recomputeAdminFromMeta();
  recomputeCircuitAdminFromMeta();
  resetPulseSyncSessionState();
  if (user) {
    syncPulseRegistrationRequirements(getPulseState?.());
  }
  if (currentTournamentMeta) {
    renderAll();
  }
});

document.addEventListener("tournament:notification-action", (event) => {
  const detail = event.detail || {};
  if (detail.notification?.type === "tournament-checkin") {
    handleTournamentCheckInAction({
      notification: detail.notification,
      auth,
      db,
      currentSlug,
      checkInLocal: checkInCurrentPlayer,
      showToast,
    });
    return;
  }
  handleTournamentInviteAction({
    notification: detail.notification,
    action: detail.action,
    race: detail.race,
    auth,
    db,
    currentSlug,
    state,
    isLive: state.isLive,
    setSeedingNotice,
    saveState,
    renderAll,
    rebuildBracket,
    seedEligiblePlayers: seedEligiblePlayersWithMode,
    bracketHasResults,
    showToast,
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  window.addEventListener("popstate", async () => {
    try {
      await handleRouteChange();
    } catch (err) {
      console.error("Failed to handle history navigation", err);
    }
  });

  // Attach all UI handlers first so buttons work even if async setup below fails/awaits.
  configureFinalMapPool({
    getDefaultMapPoolNames,
    getAll1v1Maps,
    getMapByName,
    renderMapPoolPickerUI,
    renderChosenMapsUI,
    isDefaultLadderSelection,
  });
  initTournamentPage({
    handleRegistration,
    handleCreateTournament,
    handleCreateCircuit,
    openCircuitTournamentModal,
    openCircuitSettingsModal,
    closeCircuitSettingsModal,
    saveCircuitSettings,
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
    setManualSeedingEnabled,
    getManualSeedingActive,
    handleManualSeedingReorder,
    updateMatchScore,
    renderAll,
    saveState,
    handleAddCircuitPointsRow,
    handleRemoveCircuitPointsRow,
    handleApplyCircuitPoints,
    // test harness hooks
    setTestBracketCount,
    cycleTestBracketCount,
    resetTournament,
    checkInCurrentPlayer,
    notifyCheckInPlayers,
    goLiveTournament,
    syncPulseNow,
  });
  initCoverReuseModal();
  initCasterControls({ saveState });
  initFinalAdminSearch();
  initAdminInviteModal();
  initFinalAutoAddToggle();

  if (typeof window !== "undefined") {
    setInterval(() => {
      if (currentTournamentMeta) {
        updateCheckInUI();
      }
    }, 30000);
  }

  try {
    await loadMapCatalog();
    setMapPoolSelection(getDefaultMapPoolNames());
    resetFinalMapPoolSelection();
    ensureSettingsUiReady();
    initializeAuthUI();
    hydratePulseFromState(getPulseState());
    await handleRouteChange();
  } catch (err) {
    console.error("Tournament page init failed", err);
  }
});

initBroadcastSync(syncFromRemote, getPersistStorageKey, () => {});

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

if (typeof window !== "undefined") {
  window.__switchTournamentTab = switchTab;
}

function updateAdminVisibility() {
  const adminEls = document.querySelectorAll("[data-admin-only='true']");
  adminEls.forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });
  const seedingBtn = document.getElementById("seedingTabBtn");
  const settingsBtn = document.getElementById("settingsTabBtn");
  const circuitPointsBtn = document.getElementById("circuitPointsTabBtn");
  const adminTabs = document.querySelector(".tab-group.admin-tabs");
  if (seedingBtn) seedingBtn.style.display = isAdmin ? "" : "none";
  if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
  if (currentTournamentMeta?.isCircuitFinal) {
    if (circuitPointsBtn) {
      if (!circuitPointsBtnTemplate) {
        circuitPointsBtnTemplate = circuitPointsBtn.cloneNode(true);
      }
      if (
        document.querySelector(".tab-btn.active")?.dataset.tab ===
        "circuitPointsTab"
      ) {
        switchTab("bracketTab");
      }
      circuitPointsBtn.remove();
    }
  } else if (!circuitPointsBtn && circuitPointsBtnTemplate && adminTabs) {
    const restored = circuitPointsBtnTemplate.cloneNode(true);
    restored.addEventListener("click", () =>
      switchTab(restored.dataset.tab)
    );
    adminTabs.append(restored);
  }
  const liveCircuitPointsBtn = document.getElementById("circuitPointsTabBtn");
  if (liveCircuitPointsBtn) {
    liveCircuitPointsBtn.style.display =
      isAdmin && currentTournamentMeta?.circuitSlug ? "" : "none";
  }
  const testHarness = document.getElementById("testBracketPanel");
  if (testHarness) testHarness.style.display = isAdmin ? "" : "none";
  updateFinalAdminAddVisibility();
  updateFinalAutoAddRow();
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = isAdmin;
  }
}


function updateFinalAutoAddRow() {
  const row = document.getElementById("finalAutoAddRow");
  const toggle = document.getElementById("finalAutoAddToggle");
  if (!row || !toggle) return;
  const show = isAdmin && currentTournamentMeta?.isCircuitFinal;
  row.style.display = show ? "flex" : "none";
  toggle.checked = !state.disableFinalAutoAdd;
}

function setFinalAutoAddStatus(message) {
  const statusEl = document.getElementById("finalAutoAddStatus");
  if (statusEl) statusEl.textContent = message || "";
}

function updateFinalAdminAddVisibility() {
  const panel = document.getElementById("finalAdminAddPanel");
  if (!panel) return;
  panel.style.display = isAdmin ? "block" : "none";
}

function recomputeAdminFromMeta() {
  const uid = auth?.currentUser?.uid || null;
  const owns = Boolean(uid && isAdminForMeta(currentTournamentMeta, uid));
  setIsAdminState(owns);
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = owns;
  }
  updateAdminVisibility();
  renderTournamentAdmins(currentTournamentMeta);
}

function initFinalAutoAddToggle() {
  const toggle = document.getElementById("finalAutoAddToggle");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    const enabled = Boolean(toggle.checked);
    saveState({ disableFinalAutoAdd: !enabled });
    if (enabled) {
      maybeAutoAddFinalPlayers({ force: true });
    } else {
      showToast?.("Auto add from leaderboard disabled.", "info");
    }
  });
}

async function maybeAutoAddFinalPlayers({ force = false } = {}) {
  if (!currentTournamentMeta?.isCircuitFinal) return;
  if (!isAdmin) return;
  if (state.disableFinalAutoAdd && !force) {
    setFinalAutoAddStatus("Auto add is disabled.");
    return;
  }
  const circuitSlug = currentTournamentMeta?.circuitSlug || "";
  const qualifyCount = Number(currentTournamentMeta?.circuitQualifyCount);
  if (!circuitSlug) {
    setFinalAutoAddStatus("Circuit link is missing.");
    return;
  }
  if (!Number.isFinite(qualifyCount) || qualifyCount <= 0) {
    setFinalAutoAddStatus("Set a qualify count to auto add players.");
    return;
  }
  if (!force && (state.players || []).length >= qualifyCount) {
    setFinalAutoAddStatus("Auto add already applied.");
    return;
  }
  const circuitMeta = await fetchCircuitMeta(circuitSlug);
  if (!circuitMeta) {
    setFinalAutoAddStatus("Circuit not found.");
    return;
  }
  const { leaderboard } = await buildCircuitLeaderboard(circuitMeta, [], {
    excludeSlug: currentSlug,
  });
  if (!leaderboard?.length) {
    setFinalAutoAddStatus("Circuit leaderboard has no players yet.");
    return;
  }
  const finalists = leaderboard.slice(0, qualifyCount);
  let added = 0;
  for (const entry of finalists) {
    const name = (entry?.name || "").trim();
    if (!name) continue;
    const existing = (state.players || []).some(
      (player) =>
        (player.name || "").toLowerCase() === name.toLowerCase()
    );
    if (existing) continue;
    let userId = "";
    try {
      const lowerName = name.toLowerCase();
      let usernameSnap = await getDoc(doc(db, "usernames", name));
      if (!usernameSnap.exists() && lowerName !== name) {
        usernameSnap = await getDoc(doc(db, "usernames", lowerName));
      }
      if (usernameSnap.exists()) {
        userId = usernameSnap.data()?.userId || usernameSnap.data()?.uid || "";
      }
    } catch (err) {
      console.warn("Failed to resolve username", err);
    }
    let userData = {};
    if (userId) {
      try {
        const userSnap = await getDoc(doc(db, "users", userId));
        userData = userSnap.exists() ? userSnap.data() || {} : {};
      } catch (err) {
        console.warn("Failed to load user profile", err);
      }
    }
    const displayName = userData.username || name;
    const pulse = userData?.pulse || {};
    const byRace = pulse.lastMmrByRace || pulse.byRace || null;
    const fallbackMmr = Number(pulse.lastMmr ?? pulse.mmr);
    const pick = pickBestRace(byRace, fallbackMmr);
    const race = pick.race || "Random";
    const mmr = Number.isFinite(pick.mmr) ? pick.mmr : 0;
    const sc2Link = sanitizeUrl(
      userData.sc2PulseUrl || pulse.url || entry.sc2Link || ""
    );
    const avatarUrl =
      userData?.profile?.avatarUrl ||
      userData?.avatarUrl ||
      DEFAULT_PLAYER_AVATAR;
    const secondaryPulseProfiles = Array.isArray(pulse.secondary)
      ? pulse.secondary
      : [];
    const secondaryPulseLinks = secondaryPulseProfiles
      .map((entry) => (entry && typeof entry === "object" ? entry.url : ""))
      .filter(Boolean);
    let clanName = "";
    let clanAbbreviation = "";
    let clanLogoUrl = "";
    const mainClanId = userData?.settings?.mainClanId || "";
    if (mainClanId) {
      try {
        const clanDoc = await getDoc(doc(db, "clans", mainClanId));
        if (clanDoc.exists()) {
          const clanData = clanDoc.data() || {};
          clanName = clanData?.name || "";
          clanAbbreviation = clanData?.abbreviation || "";
          clanLogoUrl = clanData?.logoUrlSmall || clanData?.logoUrl || "";
        }
      } catch (err) {
        console.warn("Could not fetch clan data", err);
      }
    }
    createOrUpdatePlayer({
      name: displayName,
      race,
      sc2Link,
      mmr,
      points: Number.isFinite(entry.points) ? entry.points : 0,
      avatarUrl,
      twitchUrl: userData?.twitchUrl || "",
      secondaryPulseLinks,
      secondaryPulseProfiles,
      mmrByRace: byRace || null,
      country: (userData?.country || "").toUpperCase(),
      clan: clanName,
      clanAbbreviation,
      clanLogoUrl,
      pulseName: pulse.name || pulse.accountName || "",
      uid: userId || null,
    });
    added += 1;
  }
  if (!added) {
    setFinalAutoAddStatus("All qualifying players are already added.");
    return;
  }
  const hasCompletedMatches = bracketHasResults();
  const { mergedPlayers } = seedEligiblePlayersWithMode(state.players, state);
  saveState({
    players: mergedPlayers,
    needsReseed: hasCompletedMatches,
  });
  if (!hasCompletedMatches) {
    rebuildBracket(true, "Auto-added leaderboard finalists");
  } else {
    setSeedingNotice(true);
    renderAll();
  }
  setFinalAutoAddStatus(`Auto-added ${added} player(s).`);
  showToast?.(`Auto-added ${added} finalist(s).`, "success");
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

function populatePlayerNameFromProfile() {
  const input = document.getElementById("playerNameInput");
  if (!input) return;
  const current = (input.value || "").trim();
  if (current) return;
  const candidate = pulseProfile?.accountName || getCurrentUsername() || "";
  if (candidate) {
    input.value = candidate;
  }
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

  const seededPlayers = seedPlayersForState(state.players, state);
  saveState({ players: seededPlayers, needsReseed: false });
  rebuildBracket(true, "Dev auto-fill");
  addActivity("Auto-filled 32 players for testing.");
  showToast?.("Auto-filled 32 players.", "success");
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
  const clamped = Math.max(1, Math.min(32, count));
  bracketTestHarness.active = true;
  bracketTestHarness.count = clamped;
  const testPlayers = buildTestPlayers(clamped);
  const ledger = {};
  testPlayers.forEach((p) => {
    ledger[playerKey(p.name, p.sc2Link)] = p.points ?? 0;
  });
  state.players = testPlayers;
  state.pointsLedger = ledger;
  const seededPlayers = seedPlayersForState(state.players, state);
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
  if (state.isLive) {
    showToast?.("Tournament is live. Registration is closed.", "error");
    return;
  }
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
  const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);

  if (!auth.currentUser) {
    setStatus(
      statusEl,
      "Sign in and add your SC2Pulse link in Settings first.",
      true
    );
    return;
  }

  const existingPlayer = (state.players || []).find(
    (p) => p.uid === auth.currentUser?.uid
  );
  if (existingPlayer) {
    const inviteStatus = normalizeInviteStatus(existingPlayer.inviteStatus);
    if (inviteStatus === INVITE_STATUS.pending) {
      setStatus(statusEl, "Your invite is still pending.", true);
      return;
    }
    if (inviteStatus === INVITE_STATUS.denied) {
      setStatus(statusEl, "Your invite was declined.", true);
      return;
    }
    const remaining = (state.players || []).filter(
      (p) => p.uid !== auth.currentUser?.uid
    );
    saveState({ players: remaining, needsReseed: true });
    rebuildBracket(true, "Player removed");
    addActivity(`${existingPlayer.name} unregistered.`);
    showToast?.("You have been unregistered.", "success");
    event.target.reset();
    hydratePulseFromState(pulseProfile);
    renderAll();
    return;
  }

  if (isInviteOnly && !isAdmin) {
    setStatus(
      statusEl,
      "This tournament is invite-only. Ask an admin for an invite.",
      true
    );
    return;
  }

  const pulseGate = getPulseSyncGateStatus();
  if (pulseGate.needsSync) {
    setStatus(statusEl, pulseGate.message, true);
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
  let startingPoints =
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

  const qualification = await enforceCircuitFinalQualification({
    name,
    sc2Link: sc2LinkInput,
    currentTournamentMeta,
    currentSlug,
    fetchCircuitMeta,
    buildCircuitLeaderboard,
    playerKey,
  });
  if (!qualification.ok) {
    setStatus(statusEl, qualification.message || "Registration is restricted.", true);
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

  if (
    startingPoints === null &&
    currentTournamentMeta?.circuitSlug &&
    name
  ) {
    startingPoints = await getCircuitSeedPoints({
      name,
      sc2Link: sc2LinkInput,
      circuitSlug: currentTournamentMeta.circuitSlug,
      tournamentSlug: currentSlug,
    });
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
  const profileCountry = getCurrentUserProfile?.()?.country || "";
  const countryCode =
    document.getElementById("settingsCountrySelect")?.value?.trim().toUpperCase() ||
    String(profileCountry).trim().toUpperCase() ||
    "";
  let clanName = selectedClanOption?.textContent || "";
  let clanAbbreviation = selectedClanOption?.dataset?.abbr || "";
  let clanLogoUrl = selectedClanOption?.dataset?.logoUrl || "";
  if (selectedClanId) {
    try {
      const clanDoc = await getDoc(doc(db, "clans", selectedClanId));
      if (clanDoc.exists()) {
        const clanData = clanDoc.data();
        clanName = clanData?.name || clanName;
        clanAbbreviation = clanData?.abbreviation || clanAbbreviation;
        clanLogoUrl = clanData?.logoUrlSmall || clanData?.logoUrl || clanLogoUrl;
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
    inviteStatus: INVITE_STATUS.accepted,
    avatarUrl,
    twitchUrl,
    secondaryPulseLinks,
    secondaryPulseProfiles,
    mmrByRace,
    country: countryCode || "",
    clan: clanName === "None" ? "" : clanName,
    clanAbbreviation: clanAbbreviation || "",
    clanLogoUrl: clanLogoUrl || "",
    pulseName: pulseProfile?.accountName || "",
    uid: auth.currentUser?.uid || null,
  });

  const hasCompletedMatches = bracketHasResults();
  const { mergedPlayers } = seedEligiblePlayersWithMode(state.players, state);
  const nextState = {
    players: mergedPlayers,
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
  showToast?.(`${newPlayer.name} added to the bracket`, "success");

  event.target.reset();
  hydratePulseFromState(pulseProfile);
}

function setFinalAdminSearchStatus(message) {
  const statusEl = document.getElementById("finalAdminSearchStatus");
  if (statusEl) statusEl.textContent = message || "";
}

function renderFinalAdminSearchResults(results = []) {
  const resultsEl = document.getElementById("finalAdminSearchResults");
  if (!resultsEl) return;
  resultsEl.replaceChildren();
  results.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "admin-search-item";
    const label = document.createElement("span");
    label.textContent = entry.username;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cta small primary";
    button.textContent = "Invite";
    button.dataset.adminAddUsername = entry.username;
    if (entry.userId) {
      button.dataset.adminUserId = entry.userId;
    }
    const alreadyAdded = (state.players || []).some(
      (player) =>
        (entry.userId && player.uid === entry.userId) ||
        (player.name || "").toLowerCase() === entry.username.toLowerCase()
    );
    if (alreadyAdded) {
      button.disabled = true;
      button.textContent = "Invited";
    }
    row.append(label, button);
    resultsEl.append(row);
  });
}

function initFinalAdminSearch() {
  const input = document.getElementById("finalAdminSearchInput");
  const resultsEl = document.getElementById("finalAdminSearchResults");
  if (!input || !resultsEl) return;
  const search = createAdminPlayerSearch({
    db,
    getIsEnabled: () => isAdmin,
    getPlayers: () => state.players || [],
    onStatus: setFinalAdminSearchStatus,
    onResults: renderFinalAdminSearchResults,
    onError: (err) => {
      if (err?.message) showToast?.(err.message, "error");
    },
    onSuccess: () => {
      input.value = "";
      renderFinalAdminSearchResults([]);
      setFinalAdminSearchStatus("");
    },
    addPlayer: async ({ userId, username, userData }) => {
      const displayName = userData.username || username;
      const pulse = userData?.pulse || {};
      const byRace = pulse.lastMmrByRace || pulse.byRace || null;
      const fallbackMmr = Number(pulse.lastMmr ?? pulse.mmr);
      const pick = pickBestRace(byRace, fallbackMmr);
      const race = pick.race || "Random";
      const mmr = Number.isFinite(pick.mmr) ? pick.mmr : 0;
      const sc2Link = sanitizeUrl(userData.sc2PulseUrl || pulse.url || "");
      let startingPoints = null;
      if (currentTournamentMeta?.circuitSlug && displayName) {
        startingPoints = await getCircuitSeedPoints({
          name: displayName,
          sc2Link,
          circuitSlug: currentTournamentMeta.circuitSlug,
          tournamentSlug: currentSlug,
        });
      }
      const avatarUrl =
        userData?.profile?.avatarUrl ||
        userData?.avatarUrl ||
        DEFAULT_PLAYER_AVATAR;
      const secondaryPulseProfiles = Array.isArray(pulse.secondary)
        ? pulse.secondary
        : [];
      const secondaryPulseLinks = secondaryPulseProfiles
        .map((entry) => (entry && typeof entry === "object" ? entry.url : ""))
        .filter(Boolean);
      let clanName = "";
      let clanAbbreviation = "";
      let clanLogoUrl = "";
      const mainClanId = userData?.settings?.mainClanId || "";
      if (mainClanId) {
        try {
          const clanDoc = await getDoc(doc(db, "clans", mainClanId));
          if (clanDoc.exists()) {
            const clanData = clanDoc.data() || {};
            clanName = clanData?.name || "";
            clanAbbreviation = clanData?.abbreviation || "";
            clanLogoUrl = clanData?.logoUrlSmall || clanData?.logoUrl || "";
          }
        } catch (err) {
          console.warn("Could not fetch clan data", err);
        }
      }
      const inviterName = getCurrentUsername?.() || "Tournament admin";
      const newPlayer = createOrUpdatePlayer({
        name: displayName,
        race,
        sc2Link,
        mmr,
        points: Number.isFinite(startingPoints) ? startingPoints : 0,
        inviteStatus: INVITE_STATUS.pending,
        invitedAt: Date.now(),
        invitedByUid: auth.currentUser?.uid || "",
        invitedByName: inviterName,
        avatarUrl,
        twitchUrl: userData?.twitchUrl || "",
        secondaryPulseLinks,
        secondaryPulseProfiles,
        mmrByRace: byRace || null,
        country: (userData?.country || "").toUpperCase(),
        clan: clanName,
        clanAbbreviation,
        clanLogoUrl,
        pulseName: pulse.name || pulse.accountName || "",
        uid: userId,
      });
      const { mergedPlayers } = seedEligiblePlayersWithMode(state.players, state);
      saveState({ players: mergedPlayers });
      addActivity(`Admin invited ${newPlayer.name}.`);
      try {
        await sendTournamentInviteNotification({
          db,
          auth,
          getCurrentUsername,
          userId,
          playerName: newPlayer.name,
          tournamentMeta: currentTournamentMeta,
          slug: currentSlug,
        });
      } catch (err) {
        console.error("Failed to send invite notification", err);
        showToast?.("Invite created, but notification failed to send.", "error");
      }
      renderAll();
      showToast?.(`Invite sent to ${newPlayer.name}.`, "success");
    },
  });

  input.addEventListener("input", () => {
    search.debouncedSearch(input.value);
  });
  resultsEl.addEventListener("click", (event) => {
    const target = event.target.closest("[data-admin-add-username]");
    if (!target) return;
    const username = target.dataset.adminAddUsername || "";
    const userId = target.dataset.adminUserId || "";
    search.addByUsername(username, userId);
  });
}


function mmrForRace(raceLabel) {
  const key = normalizeRaceKey(raceLabel);
  const byRace = pulseProfile?.byRace || null;
  if (key && byRace && Number.isFinite(byRace[key])) {
    return Math.round(byRace[key]);
  }
  return null;
}

function updateMmrDisplay(statusEl, nextRace = null) {
  if (nextRace !== null) {
    setDerivedRaceState(nextRace || null);
    setDerivedMmrState(nextRace ? mmrForRace(nextRace) : null);
  }
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

  const pulseGate = getPulseSyncGateStatus();
  if (pulseGate.needsSync) {
    setStatus(statusEl, pulseGate.message, true);
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

function resolvePlayerAvatar(player) {
  const userPhoto = document.getElementById("userPhoto")?.src;
  return player?.avatarUrl || userPhoto || DEFAULT_PLAYER_AVATAR;
}

function serializeBracket(bracket) {
  if (!bracket || typeof bracket !== "object") return bracket;
  const toArr = (obj) =>
    Array.isArray(obj)
      ? obj
      : obj && typeof obj === "object"
      ? Object.keys(obj)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => obj[key])
      : [];
  const normalizeRounds = (rounds) =>
    toArr(rounds)
      .map((round) => toArr(round))
      .filter((round) => round.length);
  const toObj = (arr) =>
    Array.isArray(arr)
      ? arr.reduce((acc, round, idx) => {
          acc[idx] = round;
          return acc;
        }, {})
      : arr || {};
  const winnersRounds = normalizeRounds(bracket.winners);
  const losersRounds = normalizeRounds(bracket.losers);
  return {
    ...bracket,
    winners: toObj(winnersRounds),
    losers: toObj(losersRounds),
    groups: toArr(bracket.groups),
    winnersRoundCount: winnersRounds.length,
    losersRoundCount: losersRounds.length,
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
  const normalizeRounds = (rounds) =>
    toArr(rounds)
      .map((round) => toArr(round))
      .filter((round) => round.length);
  const clampRounds = (rounds, count) => {
    if (!Number.isFinite(count)) return rounds;
    return rounds.slice(0, Math.max(0, count));
  };
  const winners = clampRounds(
    normalizeRounds(bracket.winners),
    bracket.winnersRoundCount
  );
  const losers = clampRounds(
    normalizeRounds(bracket.losers),
    bracket.losersRoundCount
  );
  return {
    ...bracket,
    winners,
    losers,
    groups: toArr(bracket.groups),
  };
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
function getRoundLabel(titlePrefix, idx, totalRounds, { hasGrandFinal = false } = {}) {
  // idx is 0-based, totalRounds is the number of columns in this section
  const fromEnd = totalRounds - idx; // 1 = last round, 2 = second last, ...

  if (titlePrefix === "Upper") {
    if (fromEnd === 1) return hasGrandFinal ? "Grand Final" : "Final";
    if (fromEnd === 2) return hasGrandFinal ? "Upper Final" : "Semi-final";
    if (fromEnd === 3) return hasGrandFinal ? "Semi-final" : "Quarterfinal";
    if (fromEnd === 4) return hasGrandFinal ? "Quarterfinal" : `Upper Round ${idx + 1}`;
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

function getMatchLookupForTesting() {
  return getMatchLookup(state.bracket || {});
}
export { getMatchLookupForTesting, rebuildBracket };
