import {
  auth,
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
  collection,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { showToast } from "../toastHandler.js";
import DOMPurify from "dompurify";
import {
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
  renderVetoSelectionList,
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
  getStorageKey as getPersistStorageKey,
  getRegisteredTournaments,
  setRegisteredTournament,
} from "./sync/persistence.js";
const renderMapPoolPicker = renderMapPoolPickerUI;
const CURRENT_BRACKET_LAYOUT_VERSION = 54;
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

function renderAll() {
  // Update seeding table
  renderSeedingTable(applySeeding(state.players || []));

  if (currentTournamentMeta) {
    populateSettingsPanelUI({
      tournament: currentTournamentMeta,
      setMapPoolSelection,
      getDefaultMapPoolNames,
      updateSettingsDescriptionPreview,
      updateSettingsRulesPreview,
      syncFormatFieldVisibility,
    });
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
  if (!id) return;
  const players = (state.players || []).filter((p) => p.id !== id);
  saveState({ players, needsReseed: true });
  rebuildBracket(true, "Player removed");
}

function updatePlayerPoints(id, points) {
  if (!id) return;
  const players = (state.players || []).map((p) =>
    p.id === id ? { ...p, points } : p
  );
  saveState({ players, needsReseed: true });
  rebuildBracket(true, "Points updated");
}

function resetTournament() {
  const empty = { ...defaultState, lastUpdated: Date.now() };
  setStateObj(empty);
  saveState(empty);
  rebuildBracket(true, "Tournament reset");
  addActivity("Tournament reset.");
  setSeedingNotice(false);
}

function updateMatchScore(matchId, scoreA, scoreB) {
  updateMatchScoreCore(matchId, scoreA, scoreB, {
    saveState,
    renderAll,
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
  const activeFilter =
    document.querySelector("#tournamentListTabs .list-tab.active")
      ?.dataset.listFilter || "open";
  const userId = auth?.currentUser?.uid || null;
  const registered = new Set(getRegisteredTournaments());
  if (!listEl) return;
  listEl.innerHTML = `<li class="muted">Loading tournaments...</li>`;
  loadTournamentRegistry(true)
    .then((items) => {
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
              ? `${item.maxPlayers} players`
              : "players TBD";
            li.innerHTML = DOMPurify.sanitize(`
              <div>
                <p class="eyebrow">${escapeHtml(item.format)}</p>
                <h4>${escapeHtml(item.name)}</h4>
                <div class="meta">
                  <span>${escapeHtml(playerLabel)}</span>
                  <span>${escapeHtml(startLabel)}</span>
                  <span>Host: ${escapeHtml(item.createdByName || "Unknown")}</span>
                </div>
              </div>
              <button class="cta ghost small" data-slug="${escapeHtml(
                item.slug
              )}">View</button>
            `);
            const open = () => enterTournament(item.slug);
            li.addEventListener("click", open);
            li.querySelector("button")?.addEventListener("click", (e) => {
              e.stopPropagation();
              open();
            });
            listEl.appendChild(li);
          });
      }
      if (statTournaments) statTournaments.textContent = String(filtered.length);
      if (statNextStart) {
        const next = filtered.find((i) => i.startTime);
        statNextStart.textContent = next
          ? new Date(next.startTime).toLocaleString()
          : "TBD";
      }
    })
    .catch((err) => {
      console.error("Failed to load tournaments", err);
      listEl.innerHTML = `<li class="muted error">Failed to load tournaments.</li>`;
    });
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
    preview.textContent = slugInput.value || "";
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
}

function getSlugFromPath() {
  const parts = (window.location.pathname || "").split("/").filter(Boolean);
  if (parts.length === 1 && parts[0].toLowerCase() === "tournament") {
    return "";
  }
  return parts.length ? parts[parts.length - 1] : "";
}

async function enterTournament(slug) {
  setCurrentSlugState(slug || null);
  if (slug) {
    const target = `/tournament/${slug}`;
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
    if (snap.exists()) setCurrentTournamentMetaState(snap.data() || null);
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
  if (landingView) landingView.style.display = "none";
  if (tournamentView) tournamentView.style.display = "block";
  renderAll();
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
  if (landingView) landingView.style.display = "block";
  if (tournamentView) tournamentView.style.display = "none";
  switchTab("registrationTab");
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

async function handleSaveSettings(event) {
  event?.preventDefault?.();
  const formatSelect = document.getElementById("settingsFormatSelect");
  const descInput = document.getElementById("settingsDescriptionInput");
  const rulesInput = document.getElementById("settingsRulesInput");
  const slugInput = document.getElementById("settingsSlugInput");
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
  const mapPool = Array.from(mapPoolSelection || []);
  const rrSettings = extractRoundRobinSettingsUI("settings", defaultRoundRobinSettings);

  const meta = {
    ...(currentTournamentMeta || {}),
    slug: newSlug,
    format,
    description,
    rules,
    bestOf,
    mapPool,
    roundRobin: rrSettings,
    lastUpdated: Date.now(),
  };

  const previousSlug = currentSlug;
  if (slugChanged) {
    setCurrentSlugState(newSlug);
    try {
      localStorage.removeItem(getPersistStorageKey(previousSlug));
    } catch (_) {
      // ignore storage removal errors
    }
    window.history.pushState({}, "", `/tournament/${newSlug}`);
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

async function handleCreateTournament(event) {
  event?.preventDefault?.();
  const nameInput = document.getElementById("tournamentNameInput");
  const slugInput = document.getElementById("tournamentSlugInput");
  const formatSelect = document.getElementById("tournamentFormatSelect");
  const startInput = document.getElementById("tournamentStartInput");
  const maxPlayersInput = document.getElementById("tournamentMaxPlayersInput");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const modal = document.getElementById("createTournamentModal");
  const name = (nameInput?.value || "").trim();
  const slug = (slugInput?.value || "").trim() || (await generateUniqueSlug());
  const format = (formatSelect?.value || "Double Elimination").trim();
  const startTime = startInput?.value ? new Date(startInput.value) : null;
  const maxPlayers = maxPlayersInput?.value
    ? Number(maxPlayersInput.value)
    : null;
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
      startTime: startTime ? serverTimestamp() : null,
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
    };
    await setDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug), payload, {
      merge: true,
    });
    setCurrentSlugState(slug);
    setCurrentTournamentMetaState(payload);
    showToast?.("Tournament saved.", "success");
    if (modal) modal.style.display = "none";
    await enterTournament(slug);
    await renderTournamentList();
  } catch (err) {
    console.error("Failed to save tournament", err);
    showToast?.("Failed to save tournament.", "error");
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
});

document.addEventListener("DOMContentLoaded", async () => {
  window.addEventListener("popstate", async () => {
    const slugFromUrl = getSlugFromPath();
    try {
      if (slugFromUrl) {
        await enterTournament(slugFromUrl);
      } else {
        await showLanding();
      }
    } catch (err) {
      console.error("Failed to handle history navigation", err);
    }
  });

  // Attach all UI handlers first so buttons work even if async setup below fails/awaits.
  initTournamentPage({
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
    // test harness hooks
    setTestBracketCount,
    cycleTestBracketCount,
    resetTournament,
  });

  try {
    await loadMapCatalog();
    setMapPoolSelection(getDefaultMapPoolNames());
    initializeAuthUI();
    hydratePulseFromState(getPulseState());
    const slugFromUrl = getSlugFromPath();
    if (slugFromUrl) {
      await enterTournament(slugFromUrl);
    } else {
      await showLanding();
    }
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

function updateAdminVisibility() {
  const adminEls = document.querySelectorAll("[data-admin-only='true']");
  adminEls.forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });
  const seedingBtn = document.getElementById("seedingTabBtn");
  const settingsBtn = document.getElementById("settingsTabBtn");
  if (seedingBtn) seedingBtn.style.display = isAdmin ? "" : "none";
  if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
}

function recomputeAdminFromMeta() {
  const uid = auth?.currentUser?.uid || null;
  const owns = Boolean(uid && currentTournamentMeta?.createdBy === uid);
  setIsAdminState(owns);
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

function getMatchLookupForTesting() {
  return getMatchLookup(state.bracket || {});
}
export { getMatchLookupForTesting, rebuildBracket };
