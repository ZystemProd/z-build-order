import {
  auth,
  app,
  db,
  getCurrentUsername,
  getCurrentUserAvatarUrl,
  getPulseState,
  initializeAuthUI,
} from "../../../app.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
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
  renderCircuitView,
  generateCircuitSlug,
  updateCircuitSlugPreview,
  populateCreateCircuitForm,
} from "./circuit.js";
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
import { loadTournamentRegistry } from "./sync/persistence.js";
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
} from "./sync/persistence.js";
import { createFinalTournamentForCircuit } from "./finalsCreate.js";
const renderMapPoolPicker = renderMapPoolPickerUI;
const CURRENT_BRACKET_LAYOUT_VERSION = 54;
const MAX_TOURNAMENT_IMAGE_SIZE = 12 * 1024 * 1024;
const COVER_TARGET_WIDTH = 1200;
const COVER_TARGET_HEIGHT = 675;
const COVER_QUALITY = 0.82;
const storage = getStorage(app);
let currentCircuitMeta = null;
let isCircuitAdmin = false;
let finalMapPoolSelection = new Set();
let finalMapPoolMode = "ladder";
function renderMarkdown(text = "") {
  return DOMPurify.sanitize(text || "").replace(/\n/g, "<br>");
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

  if (incoming.lastUpdated && incoming.lastUpdated <= state.lastUpdated) {
    if (presenceChanged) {
      setStateObj({ ...state, presence: { matchInfo: incomingPresence } });
      refreshMatchInfoPresenceIfOpen?.();
    }
    return;
  }
  setStateObj({
    ...defaultState,
    ...incoming,
    players: applySeeding(incoming.players || []),
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
  renderSeedingTable(applySeeding(state.players || []), {
    isLive: state.isLive,
    isAdmin,
  });

  if (currentTournamentMeta) {
    const tournamentTitle = document.getElementById("tournamentTitle");
    const tournamentFormat = document.getElementById("tournamentFormat");
    const tournamentStart = document.getElementById("tournamentStart");
    const statPlayers = document.getElementById("statPlayers");
    const registerBtn = document.getElementById("registerBtn");
    const goLiveBtn = document.getElementById("rebuildBracketBtn");
    const removeNotCheckedInBtn = document.getElementById("removeNotCheckedInBtn");
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

    if (tournamentTitle) {
      tournamentTitle.textContent = currentTournamentMeta.name || "Tournament";
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
    if (statPlayers) statPlayers.textContent = String(state.players?.length || 0);

    if (registerBtn) {
      if (state.isLive) {
        registerBtn.textContent = "Registration closed";
        registerBtn.disabled = true;
      } else if (currentPlayer) {
        registerBtn.textContent = "Unregister";
        registerBtn.disabled = false;
      } else {
        registerBtn.textContent = "Register";
        registerBtn.disabled = false;
      }
    }

    if (goLiveBtn) {
      goLiveBtn.disabled = state.isLive;
      goLiveBtn.textContent = state.isLive ? "Live" : "Go Live";
    }
    if (removeNotCheckedInBtn) {
      removeNotCheckedInBtn.disabled = state.isLive;
    }

    updateCheckInUI();

    if (liveDot) {
      liveDot.textContent = state.isLive ? "Live" : "Not Live";
      liveDot.classList.toggle("not-live", !state.isLive);
    }

    if (bracketGrid && bracketNotLive) {
      if (!state.isLive && !isAdmin) {
        bracketGrid.style.display = "none";
        bracketNotLive.style.display = "block";
        if (registeredPlayersList) {
          const items = (state.players || []).map((p) => {
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
  const layoutVersion = state.bracketLayoutVersion || 1;
  const needsLayoutUpgrade =
    bracket &&
    layoutVersion < CURRENT_BRACKET_LAYOUT_VERSION &&
    !bracketHasRecordedResults(bracket);
  if (needsLayoutUpgrade) {
    rebuildBracket(true, "Updated bracket layout");
    return;
  }
  if (bracketContainer && bracket) {
    const format = currentTournamentMeta?.format || "Tournament";
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

function removeNotCheckedInPlayers() {
  if (state.isLive) {
    showToast?.("Tournament is live. Seeding is locked.", "error");
    return;
  }
  const players = state.players || [];
  const remaining = players.filter((p) => p.checkedInAt);
  const removedCount = players.length - remaining.length;
  if (!removedCount) {
    showToast?.("No players to remove.", "success");
    return;
  }
  saveState({ players: remaining, needsReseed: true });
  rebuildBracket(true, "Removed unchecked-in players");
  addActivity(`Removed ${removedCount} unchecked-in player(s).`);
}

function goLiveTournament() {
  if (state.isLive) {
    showToast?.("Tournament is already live.", "success");
    return;
  }
  const checkedInPlayers = (state.players || []).filter((p) => p.checkedInAt);
  if (!checkedInPlayers.length) {
    showToast?.("No checked-in players to go live.", "error");
    return;
  }
  const seededPlayers = applySeeding(checkedInPlayers);
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

function addActivity(message) {
  if (!message) return;
  const entry = { message, time: Date.now() };
  const next = {
    activity: [entry, ...(state.activity || [])].slice(0, 50),
  };
  saveState(next);
}

function setSeedingNotice(show) {
  const el = document.getElementById("seedingNotice");
  if (el) {
    el.style.display = show ? "block" : "none";
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
  updateMatchScoreCore(matchId, scoreA, scoreB, {
    saveState,
    renderAll,
    ...options,
  });
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
  const seededPlayers = applySeeding(state.players || []);
  setStateObj({ ...state, players: seededPlayers, needsReseed: false });
  const isRoundRobin = (fmt) =>
    (fmt || "").toLowerCase().includes("round robin");
  const bracket = buildBracket(
    seededPlayers,
    currentTournamentMeta || {},
    isRoundRobin
  );
    saveState({
      players: seededPlayers,
      bracket,
      needsReseed: false,
      bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
    });
  if (reason) addActivity(reason);
  renderAll();
}

function renderTournamentList() {
  const listEl = document.getElementById("tournamentList");
  const statTournaments = document.getElementById("statTournaments");
  const statNextStart = document.getElementById("statNextStart");
  const listTitle = document.getElementById("tournamentListTitle");
  const activeFilter =
    document.querySelector("#tournamentListTabs .list-tab.active")
      ?.dataset.listFilter || "open";
  if (activeFilter === "circuits") {
    if (listTitle) listTitle.textContent = "Circuits";
    renderCircuitList({ onEnterCircuit: enterCircuit });
    return;
  }
  if (listTitle) listTitle.textContent = "Open tournaments";
  const userId = auth?.currentUser?.uid || null;
  const registered = new Set(getRegisteredTournaments());
  if (!listEl) return;
  listEl.innerHTML = `<li class="muted">Loading tournaments...</li>`;
  loadTournamentRegistry(true)
    .then((items) => {
      const progressTargets = [];
      const filtered = (items || []).filter((item) => {
        if (activeFilter === "hosted") {
          return userId && item.createdBy === userId;
        }
        if (activeFilter === "mine") {
          return (
            (userId && item.createdBy === userId) ||
            registered.has(item.slug || item.id)
          );
        }
        return true; // open = all
      });

      listEl.innerHTML = "";
      if (!filtered.length) {
        listEl.innerHTML = `<li class="muted">No tournaments found.</li>`;
      } else {
        filtered
          .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
          .forEach((item) => {
            const li = document.createElement("li");
            li.className = "tournament-card";
            li.dataset.slug = item.slug;
            const startLabel = item.startTime
              ? new Date(item.startTime).toLocaleString()
              : "TBD";
            const playerLabel = item.maxPlayers
              ? `Up to ${item.maxPlayers} players`
              : "Players TBD";
            const coverUrl = sanitizeUrl(item.coverImageUrl || "");
            const now = Date.now();
            const isStarted = Boolean(item.startTime && item.startTime <= now);
            let statusLabel = "TBD";
            let statusClass = "status-tbd";
            if (item.startTime) {
              if (item.startTime <= now) {
                statusLabel = "Started";
                statusClass = "status-started";
              } else {
                statusLabel = "Upcoming";
                statusClass = "status-upcoming";
              }
            }
            li.innerHTML = DOMPurify.sanitize(`
              <div class="card-cover${coverUrl ? " has-image" : ""}"${
                coverUrl ? ` style="background-image:url('${escapeHtml(coverUrl)}')"` : ""
              }></div>
              <div class="card-top">
                <div class="time-block">
                  <span class="time-label">Start</span>
                  <span class="time-value">${escapeHtml(startLabel)}</span>
                </div>
              <span class="status-chip ${statusClass}">${statusLabel}</span>
            </div>
            <h4>${escapeHtml(item.name)}</h4>
            <p class="tournament-format">${escapeHtml(item.format)}</p>
            <div class="meta">
              <span>${escapeHtml(playerLabel)}</span>
              <span>Host: ${escapeHtml(item.createdByName || "Unknown")}</span>
            </div>
            ${
              isStarted
                ? `<div class="tournament-progress" data-slug="${escapeHtml(
                    item.slug
                  )}">
                    <span class="progress-label">Progress</span>
                    <div class="progress-track">
                      <div class="progress-fill" style="width:0%"></div>
                    </div>
                    <div class="progress-meta">Loading progress…</div>
                  </div>`
                : ""
            }
            `);
            const open = () =>
              enterTournament(item.slug, { circuitSlug: item.circuitSlug || "" });
            li.addEventListener("click", open);
            listEl.appendChild(li);
            if (isStarted) {
              progressTargets.push({ slug: item.slug, el: li });
            }
          });
      }
      if (statTournaments) statTournaments.textContent = String(filtered.length);
      if (statNextStart) {
        const next = filtered.find((i) => i.startTime);
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
    })
    .catch((err) => {
      console.error("Failed to load tournaments", err);
      listEl.innerHTML = `<li class="muted error">Failed to load tournaments.</li>`;
    });
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
  return { completed, total: matches.length, percent };
}

function updateTournamentProgress(targets = []) {
  if (!targets.length) return;
  Promise.all(
    targets.map(async ({ slug, el }) => {
      if (!slug || !el) return;
      const progressEl = el.querySelector(".tournament-progress");
      if (!progressEl) return;
      try {
        const remote = await loadTournamentStateRemote(slug);
        const bracket = deserializeBracket(remote?.bracket);
        const progress = computeTournamentProgress(bracket);
        const fill = progressEl.querySelector(".progress-fill");
        const meta = progressEl.querySelector(".progress-meta");
        if (!fill || !meta) return;
        if (!progress) {
          fill.style.width = "0%";
          meta.textContent = "No matches yet";
          return;
        }
        const percent = Math.max(0, Math.min(100, progress.percent));
        fill.style.width = `${percent}%`;
        meta.textContent = `${progress.completed}/${progress.total} matches`;
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

async function generateUniqueSlug() {
  return `t-${Date.now().toString(36)}`;
}

async function validateSlug() {
  return true;
}

function updateSlugPreview() {
  const slugInput = document.getElementById("tournamentSlugInput");
  const preview = document.getElementById("slugPreview");
  if (slugInput && preview) {
    const next = (slugInput.value || "").toLowerCase();
    if (slugInput.value !== next) slugInput.value = next;
    preview.textContent = next;
  }
}

function updateFinalSlugPreview() {
  const slugInput = document.getElementById("finalTournamentSlugInput");
  const preview = document.getElementById("finalSlugPreview");
  if (slugInput && preview) {
    const next = (slugInput.value || "").toLowerCase();
    if (slugInput.value !== next) slugInput.value = next;
    const circuitSlug = (document.getElementById("circuitSlugInput")?.value || "")
      .trim()
      .toLowerCase();
    preview.textContent = circuitSlug && next ? `${circuitSlug}/${next}` : next;
  }
}

async function populateCreateForm() {
  renderMapPoolPicker("mapPoolPicker", {
    mapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  const slugInput = document.getElementById("tournamentSlugInput");
  if (slugInput && !slugInput.value) {
    slugInput.value = await generateUniqueSlug();
    updateSlugPreview();
  }
  const imageInput = document.getElementById("tournamentImageInput");
  const imagePreview = document.getElementById("tournamentImagePreview");
  const checkInHoursInput = document.getElementById("checkInHoursInput");
  const checkInMinutesInput = document.getElementById("checkInMinutesInput");
  if (imageInput) imageInput.value = "";
  if (imagePreview) {
    imagePreview.removeAttribute("src");
    imagePreview.style.display = "none";
    delete imagePreview.dataset.tempPreview;
  }
  if (checkInHoursInput) checkInHoursInput.value = "";
  if (checkInMinutesInput) checkInMinutesInput.value = "";
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
  if (modal) modal.style.display = "flex";
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
  }
}

function closeDeleteTournamentModal() {
  const modal = document.getElementById("confirmDeleteTournamentModal");
  if (!modal) return;
  delete modal.dataset.slug;
  delete modal.dataset.circuitSlug;
  modal.style.display = "none";
}

async function confirmDeleteTournament() {
  const modal = document.getElementById("confirmDeleteTournamentModal");
  if (!modal?.dataset.slug) return;
  const slug = modal.dataset.slug;
  const circuitSlug = modal.dataset.circuitSlug || currentTournamentMeta?.circuitSlug || "";
  try {
    await deleteDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
    await deleteDoc(doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug));
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
  // Load local state for this slug
  const local = loadLocalState(slug, applySeeding, deserializeBracket);
  setStateObj(local);
  // Try remote meta first
  try {
    const snap = await getDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
    if (snap.exists()) {
      const meta = snap.data() || null;
      setCurrentTournamentMetaState(meta);
      const metaCircuitSlug = meta?.circuitSlug || "";
      if (slug && metaCircuitSlug && !circuitSlug) {
        const target = `/tournament/${metaCircuitSlug}/${slug}`;
        if (window.location.pathname !== target) {
          window.history.pushState({}, "", target);
        }
      }
    }
  } catch (_) {
    // ignore
  }
  // Update admin flag based on ownership
  recomputeAdminFromMeta();
  // Hydrate remote state (merge) and render
  await hydrateStateFromRemote(
    slug,
    applySeeding,
    deserializeBracket,
    saveState,
    renderAll
  );
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

async function enterCircuit(slug, options = {}) {
  if (!slug) return;
  const { skipPush = false, meta = null } = options;
  try {
    unsubscribeRemoteState?.();
  } catch (_) {
    // ignore
  }
  unsubscribeRemoteState = null;
  setIsAdminState(false);
  updateAdminVisibility();
  const target = `/tournament/${slug}`;
  if (!skipPush && window.location.pathname !== target) {
    window.history.pushState({}, "", target);
  }
  const landingView = document.getElementById("landingView");
  const tournamentView = document.getElementById("tournamentView");
  const circuitView = document.getElementById("circuitView");
  if (landingView) landingView.style.display = "none";
  if (tournamentView) tournamentView.style.display = "none";
  if (circuitView) circuitView.style.display = "block";
  try {
    const fetched = meta || (await fetchCircuitMeta(slug));
    if (!fetched) {
      showToast?.("Circuit not found.", "error");
      await showLanding();
      return;
    }
    currentCircuitMeta = fetched;
    recomputeCircuitAdminFromMeta();
    await renderCircuitView(currentCircuitMeta, {
      onEnterTournament: (tournamentSlug) =>
        enterTournament(tournamentSlug, { circuitSlug: currentCircuitMeta?.slug || "" }),
      onDeleteTournament: (tournamentSlug) =>
        openDeleteTournamentModal({
          slug: tournamentSlug,
          circuitSlug: currentCircuitMeta?.slug || "",
        }),
      showDelete: isCircuitAdmin,
      showEdit: isCircuitAdmin,
    });
    updateCircuitAdminVisibility();
  } catch (err) {
    console.error("Failed to load circuit", err);
    showToast?.("Failed to load circuit.", "error");
    await showLanding();
  }
}

async function refreshCircuitView() {
  if (!currentCircuitMeta?.slug) return;
  await enterCircuit(currentCircuitMeta.slug, { skipPush: true });
}

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
  el.classList.toggle("status-ok", !isError);
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

function updateFinalMapButtons() {
  const ladderBtn = document.getElementById("finalUseLadderMapsBtn");
  const customBtn = document.getElementById("finalClearMapPoolBtn");
  const isLadder = finalMapPoolMode === "ladder";
  ladderBtn?.classList.toggle("active", isLadder);
  customBtn?.classList.toggle("active", !isLadder);
}

function renderFinalMapPoolSelection() {
  renderMapPoolPickerUI("finalMapPoolPicker", {
    mapPoolSelection: finalMapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("finalChosenMapList", {
    mapPoolSelection: finalMapPoolSelection,
    getMapByName,
  });
  updateFinalMapButtons();
}

function setFinalMapPoolSelection(names) {
  finalMapPoolSelection = new Set((names || []).filter(Boolean));
  finalMapPoolMode = isDefaultLadderSelection(finalMapPoolSelection, getDefaultMapPoolNames)
    ? "ladder"
    : "custom";
  renderFinalMapPoolSelection();
}

function toggleFinalMapSelection(name) {
  if (!name) return;
  if (finalMapPoolSelection.has(name)) {
    finalMapPoolSelection.delete(name);
  } else {
    finalMapPoolSelection.add(name);
  }
  finalMapPoolMode = isDefaultLadderSelection(finalMapPoolSelection, getDefaultMapPoolNames)
    ? "ladder"
    : "custom";
  renderFinalMapPoolSelection();
}

function resetFinalMapPoolSelection() {
  setFinalMapPoolSelection(getDefaultMapPoolNames());
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
    checkInStatus.textContent = "Register to check in.";
    checkInStatus.classList.add("is-open");
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

function getCheckInWindowMinutes(hoursInput, minutesInput) {
  const hours = Number(hoursInput?.value || 0);
  const minutes = Number(minutesInput?.value || 0);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  return safeHours * 60 + safeMinutes;
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
  const checkInHoursInput = document.getElementById("settingsCheckInHoursInput");
  const checkInMinutesInput = document.getElementById("settingsCheckInMinutesInput");
  const qualifyInput = document.getElementById("settingsCircuitQualifyCount");
  const imageInput = document.getElementById("settingsImageInput");
  const imageFile = imageInput?.files?.[0] || null;
  const newSlugRaw = (slugInput?.value || "").trim();
  const newSlug = newSlugRaw || currentSlug || "";
  const slugChanged = newSlug && newSlug !== currentSlug;
  const bestOf = {
    upper: Number(document.getElementById("settingsBestOfUpper")?.value || defaultBestOf.upper),
    lower: Number(document.getElementById("settingsBestOfLower")?.value || defaultBestOf.lower),
    quarter: Number(
      document.getElementById("settingsBestOfQuarter")?.value || defaultBestOf.quarter
    ),
    semi: Number(document.getElementById("settingsBestOfSemi")?.value || defaultBestOf.semi),
    final: Number(document.getElementById("settingsBestOfFinal")?.value || defaultBestOf.final),
  };
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
  const checkInWindowMinutes = getCheckInWindowMinutes(
    checkInHoursInput,
    checkInMinutesInput
  );
  const mapPool = Array.from(mapPoolSelection || []);
  const rrSettings = extractRoundRobinSettingsUI("settings", defaultRoundRobinSettings);
  const circuitPoints = currentTournamentMeta?.circuitSlug
    ? readCircuitPointsTable()
    : null;
  let coverImageUrl = currentTournamentMeta?.coverImageUrl || "";
  if (imageFile) {
    try {
      coverImageUrl = await uploadTournamentCover(imageFile, newSlug);
    } catch (err) {
      showToast?.(err?.message || "Failed to upload cover image.", "error");
      return;
    }
  }

  const meta = {
    ...(currentTournamentMeta || {}),
    slug: newSlug,
    format,
    description,
    rules,
    coverImageUrl,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    circuitQualifyCount:
      currentTournamentMeta?.isCircuitFinal &&
      Number.isFinite(qualifyCount) &&
      qualifyCount >= 0
        ? qualifyCount
        : null,
    bestOf,
    mapPool,
    roundRobin: rrSettings,
    lastUpdated: Date.now(),
  };
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
  const finalNameInput = document.getElementById("finalTournamentNameInput");
  const finalSlugInput = document.getElementById("finalTournamentSlugInput");
  const finalFormatSelect = document.getElementById("finalFormatSelect");
  const finalStartInput = document.getElementById("finalTournamentStartInput");
  const finalMaxPlayersInput = document.getElementById("finalTournamentMaxPlayersInput");
  const finalCheckInHoursInput = document.getElementById("finalCheckInHoursInput");
  const finalCheckInMinutesInput = document.getElementById("finalCheckInMinutesInput");
  const finalDescriptionInput = document.getElementById("finalTournamentDescriptionInput");
  const finalRulesInput = document.getElementById("finalTournamentRulesInput");
  const finalImageInput = document.getElementById("finalTournamentImageInput");
  const finalQualifyInput = document.getElementById("finalQualifyCountInput");
  const modal = document.getElementById("createCircuitModal");
  const name = (nameInput?.value || "").trim();
  const slug =
    (slugInput?.value || "").trim().toLowerCase() ||
    (await generateCircuitSlug());
  const description = descriptionInput?.value || "";
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
  const finalCheckInWindowMinutes = getCheckInWindowMinutes(
    finalCheckInHoursInput,
    finalCheckInMinutesInput
  );
  const finalDescription = finalDescriptionInput?.value || "";
  const finalRules = finalRulesInput?.value || "";
  const finalImageFile = finalImageInput?.files?.[0] || null;
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
    tournaments: [],
    finalTournamentSlug: "",
    createdBy: auth.currentUser.uid,
    createdByName:
      getCurrentUsername?.() || auth.currentUser.displayName || "Unknown",
    createdAt: serverTimestamp(),
  };
  const finalPayload = {
    slug: finalSlug,
    name: finalName,
    description: finalDescription,
    rules: finalRules,
    format: finalFormat,
    maxPlayers: Number.isFinite(finalMaxPlayers) ? finalMaxPlayers : null,
    startTime: finalStartTime ? finalStartTime.getTime() : null,
    checkInWindowMinutes: finalCheckInWindowMinutes,
    mapPool: Array.from(finalMapPoolSelection || []),
    createdBy: auth.currentUser?.uid || null,
    createdByName: getCurrentUsername() || "Unknown host",
    roundRobin: rrSettings,
    bestOf: {
      upper: Number(
        document.getElementById("finalBestOfUpperInput")?.value || defaultBestOf.upper
      ),
      lower: Number(
        document.getElementById("finalBestOfLowerInput")?.value || defaultBestOf.lower
      ),
      lowerSemi: Number(
        document.getElementById("finalBestOfLowerSemiInput")?.value ||
          defaultBestOf.lowerSemi
      ),
      lowerFinal: Number(
        document.getElementById("finalBestOfLowerFinalInput")?.value ||
          defaultBestOf.lowerFinal
      ),
      quarter: Number(
        document.getElementById("finalBestOfQuarterInput")?.value ||
          defaultBestOf.quarter
      ),
      semi: Number(
        document.getElementById("finalBestOfSemiInput")?.value || defaultBestOf.semi
      ),
      final: Number(
        document.getElementById("finalBestOfFinalInput")?.value || defaultBestOf.final
      ),
    },
    circuitSlug: slug,
    isCircuitFinal: true,
    circuitQualifyCount:
      Number.isFinite(finalQualifyCount) && finalQualifyCount >= 0
        ? finalQualifyCount
        : null,
  };
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
      });
      finalCreated = true;
    } catch (err) {
      console.error("Failed to create final tournament", err);
      showToast?.("Circuit saved, but final tournament failed.", "error");
    }
    if (finalCreated) {
      showToast?.("Circuit saved.", "success");
    }
    if (modal) modal.style.display = "none";
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
  const checkInHoursInput = document.getElementById("checkInHoursInput");
  const checkInMinutesInput = document.getElementById("checkInMinutesInput");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const imageInput = document.getElementById("tournamentImageInput");
  const imageFile = imageInput?.files?.[0] || null;
  const modal = document.getElementById("createTournamentModal");
  const circuitSlug = (modal?.dataset.circuitSlug || "").trim();
  const isCircuitFinal = circuitSlug
    ? Boolean(document.getElementById("circuitFinalToggle")?.checked)
    : false;
  const name = (nameInput?.value || "").trim();
  const slug =
    (slugInput?.value || "").trim().toLowerCase() ||
    (await generateUniqueSlug());
  const format = (formatSelect?.value || "Double Elimination").trim();
  const startTime = startInput?.value ? new Date(startInput.value) : null;
  const maxPlayers = maxPlayersInput?.value
    ? Number(maxPlayersInput.value)
    : null;
  const checkInWindowMinutes = getCheckInWindowMinutes(
    checkInHoursInput,
    checkInMinutesInput
  );
  const description = descriptionInput?.value || "";
  const rules = rulesInput?.value || "";
  const rrSettings = extractRoundRobinSettingsUI("create", defaultRoundRobinSettings);
  if (!name) {
    showToast?.("Tournament name is required.", "error");
    return;
  }
  try {
    const payload = {
      slug,
      name,
      description,
      rules,
      format,
      maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
      startTime: startTime ? startTime.getTime() : null,
      checkInWindowMinutes,
      mapPool: Array.from(mapPoolSelection || []),
      createdBy: auth.currentUser?.uid || null,
      createdByName: getCurrentUsername() || "Unknown host",
      roundRobin: rrSettings,
      bestOf: {
        upper: Number(
          document.getElementById("bestOfUpperInput")?.value || defaultBestOf.upper
        ),
        lower: Number(
          document.getElementById("bestOfLowerInput")?.value || defaultBestOf.lower
        ),
        lowerSemi: Number(
          document.getElementById("bestOfLowerSemiInput")?.value ||
            defaultBestOf.lowerSemi
        ),
        lowerFinal: Number(
          document.getElementById("bestOfLowerFinalInput")?.value ||
            defaultBestOf.lowerFinal
        ),
        quarter: Number(
          document.getElementById("bestOfQuarterInput")?.value ||
            defaultBestOf.quarter
        ),
        semi: Number(
          document.getElementById("bestOfSemiInput")?.value || defaultBestOf.semi
        ),
        final: Number(
          document.getElementById("bestOfFinalInput")?.value ||
            defaultBestOf.final
        ),
      },
      circuitSlug: circuitSlug || null,
      isCircuitFinal: circuitSlug ? isCircuitFinal : false,
    };
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
    if (modal) modal.style.display = "none";
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
    hydratePulseFromState(event.detail);
  });
}

onAuthStateChanged?.(auth, () => {
  recomputeAdminFromMeta();
  recomputeCircuitAdminFromMeta();
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
  initTournamentPage({
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
    // test harness hooks
    setTestBracketCount,
    cycleTestBracketCount,
    resetTournament,
    checkInCurrentPlayer,
    removeNotCheckedInPlayers,
    goLiveTournament,
  });

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
  if (seedingBtn) seedingBtn.style.display = isAdmin ? "" : "none";
  if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
  if (circuitPointsBtn) {
    circuitPointsBtn.style.display =
      isAdmin && currentTournamentMeta?.circuitSlug ? "" : "none";
  }
  const testHarness = document.getElementById("testBracketPanel");
  if (testHarness) testHarness.style.display = isAdmin ? "" : "none";
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = isAdmin;
  }
}

function updateCircuitAdminVisibility() {
  const createBtn = document.getElementById("openCreateCircuitTournament");
  if (createBtn) {
    createBtn.style.display = isCircuitAdmin ? "inline-flex" : "none";
  }
}

function recomputeCircuitAdminFromMeta() {
  const uid = auth?.currentUser?.uid || null;
  isCircuitAdmin = Boolean(uid && currentCircuitMeta?.createdBy === uid);
  updateCircuitAdminVisibility();
}

function recomputeAdminFromMeta() {
  const uid = auth?.currentUser?.uid || null;
  const owns = Boolean(uid && currentTournamentMeta?.createdBy === uid);
  setIsAdminState(owns);
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = owns;
  }
  updateAdminVisibility();
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

  const seededPlayers = applySeeding(state.players);
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

  const qualifyCount = Number(currentTournamentMeta?.circuitQualifyCount);
  if (
    currentTournamentMeta?.isCircuitFinal &&
    Number.isFinite(qualifyCount) &&
    qualifyCount > 0
  ) {
    const circuitSlug = currentTournamentMeta?.circuitSlug || "";
    if (!circuitSlug) {
      setStatus(
        statusEl,
        "Circuit leaderboard is unavailable for this finals event.",
        true
      );
      return;
    }
    const circuitMeta = await fetchCircuitMeta(circuitSlug);
    if (!circuitMeta) {
      setStatus(
        statusEl,
        "Circuit leaderboard is unavailable for this finals event.",
        true
      );
      return;
    }
    let leaderboard = null;
    try {
      ({ leaderboard } = await buildCircuitLeaderboard(circuitMeta, [], { excludeSlug: currentSlug }));
    } catch (err) {
      console.error("Failed to load circuit leaderboard", err);
    }
    if (!leaderboard) {
      setStatus(statusEl, "Circuit leaderboard is unavailable.", true);
      return;
    }
    if (!leaderboard.length) {
      setStatus(statusEl, "Circuit leaderboard is empty.", true);
      return;
    }
    const key = playerKey(name, sc2LinkInput);
    const qualified = leaderboard
      .slice(0, qualifyCount)
      .some((entry) => entry.key === key);
    if (!qualified) {
      setStatus(
        statusEl,
        `You must be in the top ${qualifyCount} of the circuit leaderboard to register.`,
        true
      );
      return;
    }
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
  const countryCode = document.getElementById("settingsCountrySelect")?.value?.trim().toUpperCase() || "";
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
  showToast?.(`${newPlayer.name} added to the bracket`, "success");

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

function resolvePlayerAvatar(player) {
  const userPhoto = document.getElementById("userPhoto")?.src;
  return player?.avatarUrl || userPhoto || DEFAULT_PLAYER_AVATAR;
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

function getMatchLookupForTesting() {
  return getMatchLookup(state.bracket || {});
}
export { getMatchLookupForTesting, rebuildBracket };
