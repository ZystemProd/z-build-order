import {
  auth,
  app,
  db,
  functions,
  ensureSettingsUiReady,
  getCurrentUsername,
  getCurrentUserAvatarUrl,
  getCurrentUserProfile,
  getPulseState,
  initializeAuthUI,
  rtdb,
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
  runTransaction,
  increment,
} from "firebase/firestore";
import {
  getStorage,
} from "firebase/storage";
import { ref as rtdbRef, remove as rtdbRemove } from "firebase/database";
import { showToast } from "../toastHandler.js";
import { logAnalyticsEvent } from "../analyticsHelper.js";
import DOMPurify from "dompurify";
import { prepareImageForUpload, validateImageFile } from "../imageUtils.js";
import { buildMmrBadges } from "../settings/pulse.js";
import {
  TOURNAMENT_COLLECTION,
  TOURNAMENT_STATE_COLLECTION,
  TOURNAMENT_INVITE_LINK_COLLECTION,
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
  isFinalResetActive,
  isFinalResetMatchId,
  shouldCountFinalReset,
} from "./bracket/finalsReset.js";
import {
  applySeeding,
  buildBracket,
  buildEliminationBracket,
  buildRoundRobinBracket,
  buildLosersBracket,
  createMatch,
  isDualTournamentFormat,
  normalizeRoundRobinSettings,
  normalizePlayoffMode,
} from "./bracket/build.js";
import { formatLocalDateTimeInput } from "./dateTime.js";
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
  handleCircuitPointsChange,
  handleEditCircuitPoints,
  handleSaveCircuitPoints,
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
import {
  bindCircuitFinalSocialControls,
  bindCircuitFinalSponsorControls,
  bindTournamentPromoSettingsControls,
  bindTournamentSocialControls,
  bindTournamentSponsorControls,
  getCopyFromCircuitPromos,
  readCircuitFinalSocials,
  readCircuitFinalSponsors,
  readTournamentSocials,
  readTournamentSponsors,
  refreshTournamentPromoSettings,
  refreshTournamentPromoStrip,
  renderCircuitFinalSocials,
  renderCircuitFinalSponsors,
} from "./promos.js";
import {
  getSocialLabelForType,
  normalizeSocialEntry,
  normalizeSponsorEntry,
  validateSocialUrl,
} from "./promosShared.js";
import { renderActivityList } from "./activity.js";
import {
  renderPlayerRow,
  renderScoreOptions,
  clampScoreSelectOptions,
  updateTreeMatchCards,
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
import {
  applyForfeitWalkovers,
  updateMatchScore as updateMatchScoreCore,
} from "./bracket/update.js";
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
  refreshPlayerDetailModalIfOpen,
} from "./playerDetail.js";
import { renderSeedingTable } from "./ui/seeding.js";
import { enableDragScroll } from "./ui/dragScroll.js";
import { showMatchReadyToastUi } from "./ui/matchReadyToast.js";
import {
  applyBestOfToSettings,
  populateSettingsPanel as populateSettingsPanelUI,
  readPrizeSplitRows,
  renderPrizeSplitRows,
  updatePrizeCurrencyCustomInputVisibility,
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
  openMatchInfoModalUsingDeps,
  hideMatchInfoModal,
  refreshMatchInfoModalIfOpen,
  refreshMatchInfoPresenceIfOpen,
  refreshVetoModalIfOpen,
} from "./maps/veto.js";
import { initTournamentPage } from "./tournamentPageInit.js";
import { registerTournamentEvents } from "./events.js";
import { createTournamentController } from "./controller.js";
import {
  renderBracketContent,
  renderTournamentMetaSection,
  updatePlacementsRowView,
} from "./view.js";
import {
  loadState as loadLocalState,
  hydrateStateFromRemote,
  saveState as persistState,
  persistTournamentStateRemote,
  submitMatchScoreRemote,
  loadTournamentStateRemote,
  getStorageKey as getPersistStorageKey,
  getRegisteredTournaments,
  setRegisteredTournament,
  loadTournamentRegistry,
  loadCircuitRegistry,
  updateTournamentRosterRemote,
} from "./sync/persistence.js";
import { syncFromRemoteCore } from "./sync/remoteMerge.js";
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
import { createTournamentCoverStorage } from "./media/coverStorage.js";
import {
  buildCreateTournamentPayload,
  buildFinalTournamentPayload,
  buildSettingsPayload,
  readBestOf,
} from "./tournamentPayloads.js";
import { syncQuillById } from "./markdownEditor.js";
import { createAdminManager } from "./admin/manageAdmins.js";
import { createAdminPlayerSearch } from "./admin/addSearchPlayer.js";
import { initCasterControls, renderCasterSection } from "./caster.js";
import { setTournamentListItems } from "./listSlider.js";
import {
  initTabAlerts,
  setTabAlertsBaseTitle,
  handleUnreadChatEvent,
  notifyMatchReadyAlert,
  clearNotifiedReadyMatch,
} from "./tabAlerts.js";
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
  sendTeamInviteNotification,
} from "./invites.js";
const renderMapPoolPicker = renderMapPoolPickerUI;
const CURRENT_BRACKET_LAYOUT_VERSION = 55;
const SUPER_ADMIN_UID = "3nCnDlMPCiTWNb1MyfvrU8OVvsF2";
const MAX_TOURNAMENT_IMAGE_SIZE = 12 * 1024 * 1024;
const COVER_TARGET_WIDTH = 1200;
const COVER_TARGET_HEIGHT = 675;
const COVER_CARD_WIDTH = 320;
const COVER_CARD_HEIGHT = 180;
const SPONSOR_LOGO_SIZE = 256;
const CUSTOM_MAP_WIDTH = 640;
const CUSTOM_MAP_HEIGHT = 400;
const COVER_QUALITY = 0.82;
const TOURNAMENT_MODES = new Set(["1v1", "2v2", "3v3", "4v4"]);
const TEAM_MEMBER_STATUS = {
  accepted: "accepted",
  pending: "pending",
  denied: "denied",
};
const PULSE_ENDPOINTS = (() => {
  const endpoints = ["/api/pulse-mmr"];
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    endpoints.push(
      "http://localhost:5001/z-build-order/us-central1/fetchPulseMmr",
    );
  }
  endpoints.push(
    "https://us-central1-z-build-order.cloudfunctions.net/fetchPulseMmr",
  );
  return endpoints;
})();
const storage = getStorage(app);
const {
  deleteTournamentCoverByUrl,
  deleteTournamentCoverFolder,
  deleteTournamentSponsorFolder,
  deleteTournamentMapFolder,
  uploadTournamentCover,
  uploadSponsorLogo,
  uploadCustomMapImage,
} = createTournamentCoverStorage({
  storage,
  loadTournamentRegistry,
  prepareImageForUpload,
  validateTournamentImage,
  coverTargetWidth: COVER_TARGET_WIDTH,
  coverTargetHeight: COVER_TARGET_HEIGHT,
  coverCardWidth: COVER_CARD_WIDTH,
  coverCardHeight: COVER_CARD_HEIGHT,
  sponsorLogoSize: SPONSOR_LOGO_SIZE,
  customMapWidth: CUSTOM_MAP_WIDTH,
  customMapHeight: CUSTOM_MAP_HEIGHT,
  coverQuality: COVER_QUALITY,
});
let currentCircuitMeta = null;
let isCircuitAdmin = false;
const chatCleanupDone = new Set();
let circuitPointsBtnTemplate = null;
let circuitFinalMapPoolSelection = new Set();
let circuitFinalMapPoolMode = "ladder";
let mapCatalogPromise = null;
let promoStripRenderKey = "";
let inviteLinkGate = {
  slug: "",
  token: "",
  status: "idle", // idle | loading | ready
  ok: false,
  message: "",
};
let selfClanHydrationInFlight = false;
let selfClanHydrated = false;
let adminSearchBootstrapPromise = null;
let teamInviteDraft = [];
let teamInviteDraftSlug = "";
let teamInviteSearchInitialized = false;
let teamInviteDraftDirty = false;
let createCustomMapsDraft = [];
let liveToggleInFlight = false;

async function ensureAdminSearchBootstrap() {
  if (adminSearchBootstrapPromise) return adminSearchBootstrapPromise;
  adminSearchBootstrapPromise = import("./admin/searchBootstrap.js")
    .then(({ initAdminSearchBootstrap }) =>
      initAdminSearchBootstrap({
        db,
        auth,
        functions,
        getState: () => state,
        getIsAdmin: () => isAdmin,
        isSuperAdminUser,
        showToast,
        normalizeRaceLabel,
        sanitizeUrl,
        getCircuitSeedPoints,
        getCurrentTournamentMeta: () => currentTournamentMeta,
        getCurrentSlug: () => currentSlug,
        hydrateStateFromRemote,
        applyRosterSeedingWithMode,
        deserializeBracket,
        saveState,
        renderAll,
        bracketHasRecordedResults,
        pickBestRace,
        DEFAULT_PLAYER_AVATAR,
        getDoc,
        doc,
        updateRosterWithTransaction,
        upsertRosterPlayer,
        addActivity,
        sendTournamentInviteNotification,
        getCurrentUsername,
        buildPlayerFromData,
        INVITE_STATUS,
      }),
    )
    .catch((err) => {
      adminSearchBootstrapPromise = null;
      console.error("Failed to initialize admin search bootstrap", err);
    });
  return adminSearchBootstrapPromise;
}

function isSuperAdminUser() {
  return auth?.currentUser?.uid === SUPER_ADMIN_UID;
}

function normalizeTournamentVisibility(value) {
  return String(value || "").toLowerCase() === "private" ? "private" : "public";
}

function normalizeTournamentAccess(value) {
  return String(value || "").toLowerCase() === "closed" ? "closed" : "open";
}

function isRoundRobinFormat(format) {
  return String(format || "")
    .toLowerCase()
    .includes("round robin");
}

function isGroupStageFormat(format) {
  return isRoundRobinFormat(format) || isDualTournamentFormat(format);
}

function allowGrandFinalReset(format, rrSettings) {
  const normalized = (format || "").toLowerCase();
  if (normalized.startsWith("double")) return true;
  if (isGroupStageFormat(format)) {
    const playoffs = (rrSettings?.playoffs || "").toLowerCase();
    return playoffs.startsWith("double");
  }
  return false;
}

function normalizeTournamentMode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (TOURNAMENT_MODES.has(normalized)) return normalized;
  return "1v1";
}

function getTournamentMode(meta = currentTournamentMeta) {
  return normalizeTournamentMode(meta?.mode);
}

function getTeamSizeFromMode(mode) {
  const normalized = normalizeTournamentMode(mode);
  const teamSize = Number(normalized.charAt(0));
  return Number.isFinite(teamSize) && teamSize > 1 ? teamSize : 1;
}

function getTournamentTeamSize(meta = currentTournamentMeta) {
  return getTeamSizeFromMode(getTournamentMode(meta));
}

function isTeamTournament(meta = currentTournamentMeta) {
  return getTournamentTeamSize(meta) > 1;
}

function normalizeTeamMemberStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (
    normalized === TEAM_MEMBER_STATUS.accepted ||
    normalized === TEAM_MEMBER_STATUS.pending ||
    normalized === TEAM_MEMBER_STATUS.denied
  ) {
    return normalized;
  }
  return TEAM_MEMBER_STATUS.pending;
}

function hasTeamMemberInviteBeenSent(member) {
  const sentAt = Number(member?.inviteSentAt);
  return Number.isFinite(sentAt) && sentAt > 0;
}

function normalizeTeamMembersFromPlayer(player, teamSize = getTournamentTeamSize()) {
  const rawMembers = Array.isArray(player?.team?.members) ? player.team.members : [];
  const memberStatusRank = (status) => {
    const normalized = normalizeTeamMemberStatus(status);
    if (normalized === TEAM_MEMBER_STATUS.accepted) return 0;
    if (normalized === TEAM_MEMBER_STATUS.pending) return 1;
    return 2;
  };
  const memberActivityTs = (member) =>
    Number(member?.respondedAt || member?.invitedAt || 0) || 0;
  const pickBetterMember = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    const roleA = a.role === "leader" ? 0 : 1;
    const roleB = b.role === "leader" ? 0 : 1;
    if (roleA !== roleB) return roleA < roleB ? a : b;
    const rankA = memberStatusRank(a.status);
    const rankB = memberStatusRank(b.status);
    if (rankA !== rankB) return rankA < rankB ? a : b;
    return memberActivityTs(a) >= memberActivityTs(b) ? a : b;
  };
  const normalized = rawMembers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const uid = String(entry.uid || "").trim();
      if (!uid) return null;
      return {
        uid,
        name: String(entry.name || "").trim() || "Unknown",
        role: entry.role === "leader" ? "leader" : "member",
        status:
          entry.role === "leader"
            ? TEAM_MEMBER_STATUS.accepted
            : normalizeTeamMemberStatus(entry.status),
        race: String(entry.race || "").trim(),
        sc2Link: String(entry.sc2Link || "").trim(),
        pulseName: String(entry.pulseName || "").trim(),
        mmr: Number.isFinite(Number(entry.mmr)) ? Math.max(0, Number(entry.mmr)) : 0,
        mmrByRace:
          entry.mmrByRace && typeof entry.mmrByRace === "object"
            ? { ...entry.mmrByRace }
            : null,
        secondaryPulseLinks: Array.isArray(entry.secondaryPulseLinks)
          ? entry.secondaryPulseLinks.slice()
          : [],
        secondaryPulseProfiles: Array.isArray(entry.secondaryPulseProfiles)
          ? entry.secondaryPulseProfiles.slice()
          : [],
        twitchUrl: String(entry.twitchUrl || "").trim(),
        country: String(entry.country || "").trim(),
        avatarUrl: String(entry.avatarUrl || "").trim(),
        invitedAt: Number.isFinite(Number(entry.invitedAt))
          ? Number(entry.invitedAt)
          : null,
        inviteSentAt: Number.isFinite(Number(entry.inviteSentAt))
          ? Number(entry.inviteSentAt)
          : null,
        respondedAt: Number.isFinite(Number(entry.respondedAt))
          ? Number(entry.respondedAt)
          : null,
      };
    })
    .filter(Boolean);
  if (!normalized.length) return [];
  const byUid = new Map();
  normalized.forEach((member) => {
    byUid.set(member.uid, pickBetterMember(byUid.get(member.uid), member));
  });
  const deduped = Array.from(byUid.values());
  const leaderUid = String(player?.uid || "").trim();
  const leaderName = String(player?.name || "").trim() || "Leader";
  const leaderIndex = deduped.findIndex((entry) => entry.uid === leaderUid);
  if (leaderUid) {
    const leader = {
      uid: leaderUid,
      name: leaderName,
      role: "leader",
      status: TEAM_MEMBER_STATUS.accepted,
      race: String(player?.race || "").trim(),
      sc2Link: String(player?.sc2Link || "").trim(),
      pulseName: String(player?.pulseName || "").trim(),
      mmr: Number.isFinite(Number(player?.mmr)) ? Math.max(0, Number(player.mmr)) : 0,
      mmrByRace:
        player?.mmrByRace && typeof player.mmrByRace === "object"
          ? { ...player.mmrByRace }
          : null,
      secondaryPulseLinks: Array.isArray(player?.secondaryPulseLinks)
        ? player.secondaryPulseLinks.slice()
        : [],
      secondaryPulseProfiles: Array.isArray(player?.secondaryPulseProfiles)
        ? player.secondaryPulseProfiles.slice()
        : [],
      twitchUrl: String(player?.twitchUrl || "").trim(),
      country: String(player?.country || "").trim(),
      avatarUrl: String(player?.avatarUrl || "").trim(),
      invitedAt:
        Number.isFinite(Number(player?.team?.createdAt))
          ? Number(player.team.createdAt)
          : Date.now(),
      inviteSentAt: null,
      respondedAt: Number.isFinite(Number(player?.team?.createdAt))
        ? Number(player.team.createdAt)
        : Date.now(),
    };
    if (leaderIndex >= 0) {
      deduped[leaderIndex] = { ...deduped[leaderIndex], ...leader };
    } else {
      deduped.unshift(leader);
    }
  }
  const maxMembers = Math.max(1, Number(teamSize) || 1);
  const leaders = deduped.filter((entry) => entry.role === "leader");
  const members = deduped
    .filter((entry) => entry.role !== "leader")
    .sort((a, b) => {
      const rankDiff = memberStatusRank(a.status) - memberStatusRank(b.status);
      if (rankDiff) return rankDiff;
      const aTs = memberActivityTs(a);
      const bTs = memberActivityTs(b);
      return bTs - aTs;
    });
  const primaryLeader = leaders[0];
  const capped = [
    ...(primaryLeader ? [primaryLeader] : []),
    ...members.slice(0, Math.max(0, maxMembers - 1)),
  ];
  return capped;
}

function findTeamMembership(players = [], uid, options = {}) {
  if (!uid) return null;
  const includeDenied = Boolean(options.includeDenied);
  const candidates = [];
  for (const player of players || []) {
    if (!player || typeof player !== "object") continue;
    const teamSize = getTeamSizeFromMode(player?.team?.mode || getTournamentMode());
    const members = normalizeTeamMembersFromPlayer(player, teamSize);
    if (!members.length) continue;
    const member = members.find((entry) => entry.uid === uid);
    if (!member) continue;
    const status = normalizeTeamMemberStatus(member.status);
    if (!includeDenied && status === TEAM_MEMBER_STATUS.denied) continue;
    candidates.push({
      player,
      member,
      role: member.role === "leader" ? "leader" : "member",
      status,
      teamSize,
      updatedAt:
        Number(player?.team?.updatedAt || player?.team?.createdAt || 0) ||
        Number(member?.respondedAt || member?.invitedAt || 0) ||
        0,
    });
  }
  if (!candidates.length) return null;
  const statusRank = (status) => {
    if (status === TEAM_MEMBER_STATUS.accepted) return 0;
    if (status === TEAM_MEMBER_STATUS.pending) return 1;
    return 2;
  };
  candidates.sort((a, b) => {
    const roleA = a.role === "leader" ? 0 : 1;
    const roleB = b.role === "leader" ? 0 : 1;
    if (roleA !== roleB) return roleA - roleB;
    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff) return statusDiff;
    return b.updatedAt - a.updatedAt;
  });
  return candidates[0];
}

function getTeamInviteUiRefs() {
  return {
    layout: document.getElementById("teamModeLayout"),
    section: document.getElementById("teamInviteSection"),
    teamNameInput: document.getElementById("teamNameInput"),
    helperText: document.getElementById("teamInviteHelperText"),
    slotsText: document.getElementById("teamInviteSlotsText"),
    searchInput: document.getElementById("teamInviteSearchInput"),
    searchResults: document.getElementById("teamInviteSearchResults"),
    list: document.getElementById("teamInviteList"),
    status: document.getElementById("teamInviteStatus"),
    currentSection: document.getElementById("teamCurrentSection"),
    currentList: document.getElementById("teamCurrentList"),
    currentStatus: document.getElementById("teamCurrentStatus"),
    leaveBtn: document.getElementById("leaveTeamBtn"),
  };
}

function resetTeamInviteDraftForCurrentSlug() {
  if (teamInviteDraftSlug === currentSlug) return;
  teamInviteDraftSlug = currentSlug || "";
  teamInviteDraft = [];
  teamInviteDraftDirty = false;
  const refs = getTeamInviteUiRefs();
  if (refs.teamNameInput) {
    refs.teamNameInput.value = "";
  }
}

function setTeamInviteStatus(message = "", isError = false) {
  const { status } = getTeamInviteUiRefs();
  setStatus(status, message, isError);
}

function setTeamCurrentStatus(message = "", isError = false) {
  const { currentStatus } = getTeamInviteUiRefs();
  setStatus(currentStatus, message, isError);
}

function syncTeamInviteDraftFromPlayer(player, teamSize) {
  if (!player || !isTeamTournament(currentTournamentMeta)) return;
  const members = normalizeTeamMembersFromPlayer(player, teamSize)
    .filter((entry) => entry.role !== "leader")
    .map((entry) => ({ ...entry }));
  teamInviteDraft = members;
  teamInviteDraftDirty = false;
}

function getRequiredTeammateCount(meta = currentTournamentMeta) {
  return Math.max(0, getTournamentTeamSize(meta) - 1);
}

function getActiveMembershipForUser(uid) {
  if (!uid) return null;
  return findTeamMembership(state.players || [], uid, { includeDenied: false });
}

function isUidInAnotherTeam(uid, ignoreTeamId = "") {
  if (!uid) return false;
  const membership = findTeamMembership(state.players || [], uid, {
    includeDenied: false,
  });
  if (!membership) return false;
  const memberTeamId = String(membership.player?.team?.teamId || "");
  if (ignoreTeamId && memberTeamId && memberTeamId === ignoreTeamId) {
    return false;
  }
  return true;
}

function getInviteTokenStorageKey(slug) {
  return `zboInviteToken:${slug || ""}`;
}

function readInviteTokenFromStorage(slug) {
  if (typeof window === "undefined" || !slug) return "";
  try {
    return String(
      sessionStorage.getItem(getInviteTokenStorageKey(slug)) || "",
    ).trim();
  } catch (_) {
    return "";
  }
}

function writeInviteTokenToStorage(slug, token) {
  if (typeof window === "undefined" || !slug) return;
  try {
    if (token) {
      sessionStorage.setItem(getInviteTokenStorageKey(slug), token);
    } else {
      sessionStorage.removeItem(getInviteTokenStorageKey(slug));
    }
  } catch (_) {
    // ignore storage errors
  }
}

function getInviteTokenFromUrl(slug = currentSlug) {
  if (typeof window === "undefined") return "";
  try {
    const token = String(
      new URLSearchParams(window.location.search).get("invite") || "",
    ).trim();
    if (token) return token;
  } catch (_) {
    // ignore
  }
  return readInviteTokenFromStorage(slug);
}

function getInviteTokenSource(slug = currentSlug) {
  if (typeof window === "undefined") {
    return { token: readInviteTokenFromStorage(slug), fromUrl: false };
  }
  try {
    const token = String(
      new URLSearchParams(window.location.search).get("invite") || "",
    ).trim();
    if (token) return { token, fromUrl: true };
  } catch (_) {
    // ignore
  }
  return { token: readInviteTokenFromStorage(slug), fromUrl: false };
}

function getInviteLinkRef(slug, token) {
  if (!slug || !token) return null;
  return doc(
    collection(db, TOURNAMENT_INVITE_LINK_COLLECTION, slug, "links"),
    token,
  );
}

function evaluateInviteLinkDoc(docData) {
  if (!docData || typeof docData !== "object") {
    return { ok: false, message: "Invite link not found." };
  }
  if (docData.revoked) {
    return { ok: false, message: "Invite link revoked." };
  }
  const now = Date.now();
  const expiresAt = Number(docData.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && now >= expiresAt) {
    return { ok: false, message: "Invite link expired." };
  }
  const maxUses = Number(docData.maxUses);
  const uses = Number(docData.uses || 0);
  if (Number.isFinite(maxUses) && maxUses > 0 && uses >= maxUses) {
    return { ok: false, message: "Invite link has no remaining uses." };
  }
  return { ok: true, message: "Invite link accepted." };
}

async function refreshInviteLinkGate(slug) {
  const { token, fromUrl } = getInviteTokenSource(slug);
  inviteLinkGate = {
    slug: slug || "",
    token,
    status: token ? "loading" : "idle",
    ok: false,
    message: token ? "Checking invite link..." : "",
  };
  if (!token || !slug) return;
  try {
    const ref = getInviteLinkRef(slug, token);
    if (!ref) return;
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      inviteLinkGate = {
        slug,
        token,
        status: "ready",
        ok: false,
        message: "Invite link not found.",
      };
      return;
    }
    const verdict = evaluateInviteLinkDoc(snap.data() || {});
    inviteLinkGate = {
      slug,
      token,
      status: "ready",
      ok: verdict.ok,
      message: verdict.message,
    };
    if (verdict.ok) {
      writeInviteTokenToStorage(slug, token);
      if (fromUrl && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        const next =
          url.pathname +
          (url.searchParams.toString() ? `?${url.searchParams}` : "") +
          url.hash;
        window.history.replaceState({}, "", next);
      }
    } else if (!fromUrl) {
      writeInviteTokenToStorage(slug, "");
    }
  } catch (_) {
    inviteLinkGate = {
      slug,
      token,
      status: "ready",
      ok: false,
      message: "Could not verify invite link.",
    };
  }
}

async function claimInviteLinkUse({ slug, token }) {
  if (!slug || !token) return { ok: false, message: "Invite link missing." };
  const ref = getInviteLinkRef(slug, token);
  if (!ref) return { ok: false, message: "Invite link missing." };
  try {
    const verdict = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        return { ok: false, message: "Invite link not found." };
      }
      const data = snap.data() || {};
      const evalResult = evaluateInviteLinkDoc(data);
      if (!evalResult.ok) return evalResult;
      tx.update(ref, {
        uses: increment(1),
        lastUsedAt: Date.now(),
      });
      return { ok: true, message: "Invite link accepted." };
    });
    return verdict;
  } catch (_) {
    return { ok: false, message: "Could not use invite link." };
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 = typeof btoa === "function" ? btoa(binary) : "";
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateInviteToken() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
  } catch (_) {
    return `inv-${Date.now().toString(36)}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }
}

function buildInviteUrl(token) {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("invite", token);
    return url.toString();
  } catch (_) {
    return "";
  }
}

async function copyToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_) {
    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "true");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch (_) {
      return false;
    }
  }
}

function setInviteLinkStatus(message) {
  const statusEl = document.getElementById("inviteLinkStatus");
  if (statusEl) statusEl.textContent = message || "";
}

async function loadInviteLinks(slug) {
  if (!slug) return [];
  const snap = await getDocs(
    collection(db, TOURNAMENT_INVITE_LINK_COLLECTION, slug, "links"),
  );
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      token: d.id,
      ...data,
      createdAt: data.createdAt?.toMillis
        ? data.createdAt.toMillis()
        : data.createdAt || null,
      lastUsedAt: data.lastUsedAt?.toMillis
        ? data.lastUsedAt.toMillis()
        : data.lastUsedAt || null,
    };
  });
}

function renderInviteLinkList(items = [], { slug } = {}) {
  const listEl = document.getElementById("inviteLinkList");
  if (!listEl) return;
  const header = listEl.querySelector(".invite-link-header");
  listEl.replaceChildren();
  if (header) listEl.appendChild(header);
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No invite links yet.";
    listEl.appendChild(empty);
    return;
  }
  rows
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "invite-link-row invite-link-card";
      const statusPill = document.createElement("span");
      statusPill.className = "invite-link-status";
      const uses = Number(item.uses || 0);
      const maxUses = Number(item.maxUses);
      const useLabel =
        Number.isFinite(maxUses) && maxUses > 0
          ? `${uses}/${maxUses}`
          : `${uses}/∞`;
      const expiresAt = Number(item.expiresAt);
      const expired =
        Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() >= expiresAt;
      const status = item.revoked ? "revoked" : expired ? "expired" : "active";
      statusPill.textContent = status;
      statusPill.classList.toggle("is-active", status === "active");
      statusPill.classList.toggle("is-expired", status === "expired");
      statusPill.classList.toggle("is-revoked", status === "revoked");

      const name = document.createElement("span");
      name.className = "invite-link-name";
      name.textContent = String(item.name || "").trim() || "—";

      const usesEl = document.createElement("span");
      usesEl.className = "invite-link-uses";
      usesEl.textContent = useLabel;

      const expiresEl = document.createElement("span");
      expiresEl.className = "invite-link-expires";
      expiresEl.textContent =
        Number.isFinite(expiresAt) && expiresAt > 0
          ? new Date(expiresAt).toLocaleString([], {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Never";

      const actions = document.createElement("div");
      actions.className = "invite-link-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "cta small ghost";
      copyBtn.textContent = "Copy";
      copyBtn.dataset.inviteCopy = item.token;
      const revokeBtn = document.createElement("button");
      revokeBtn.type = "button";
      revokeBtn.className = "cta small subtle";
      revokeBtn.textContent = "Revoke";
      revokeBtn.disabled = Boolean(item.revoked);
      revokeBtn.dataset.inviteRevoke = item.token;
      actions.append(copyBtn, revokeBtn);
      row.append(statusPill, name, usesEl, expiresEl, actions);
      listEl.appendChild(row);
    });
}

async function refreshInviteLinksPanel() {
  const slug = currentSlug || currentTournamentMeta?.slug || "";
  if (!slug || !isAdmin || !currentTournamentMeta?.isInviteOnly) return;
  try {
    setInviteLinkStatus("Loading invite links...");
    const links = await loadInviteLinks(slug);
    renderInviteLinkList(links, { slug });
    setInviteLinkStatus("");
  } catch (_) {
    setInviteLinkStatus("Failed to load invite links.");
  }
}

function initInviteLinksPanel() {
  const createBtn = document.getElementById("createInviteLinkBtn");
  const listEl = document.getElementById("inviteLinkList");
  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      const slug = currentSlug || currentTournamentMeta?.slug || "";
      if (!slug || !isAdmin) return;
      const name = (
        document.getElementById("inviteLinkNameInput")?.value || ""
      ).trim();
      const maxUsesRaw =
        document.getElementById("inviteLinkMaxUsesInput")?.value ?? "";
      const expiresInput = document.getElementById("inviteLinkExpiresInput");
      const maxUses =
        maxUsesRaw === "" || maxUsesRaw === null || maxUsesRaw === undefined
          ? null
          : Number(maxUsesRaw);
      const pickedDate = expiresInput?._flatpickr?.selectedDates?.[0] || null;
      const expiresRaw = expiresInput?.value || "";
      const expiresAt = pickedDate
        ? pickedDate.getTime()
        : expiresRaw
          ? new Date(expiresRaw).getTime()
          : null;
      const token = generateInviteToken();
      try {
        setInviteLinkStatus("Creating invite link...");
        await setDoc(
          doc(
            collection(db, TOURNAMENT_INVITE_LINK_COLLECTION, slug, "links"),
            token,
          ),
          {
            token,
            createdAt: serverTimestamp(),
            createdByUid: auth.currentUser?.uid || "",
            createdByName: getCurrentUsername?.() || "",
            name: name || "",
            maxUses:
              Number.isFinite(maxUses) && maxUses > 0
                ? Math.floor(maxUses)
                : null,
            expiresAt:
              Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null,
            uses: 0,
            revoked: false,
          },
          { merge: true },
        );
        await refreshInviteLinksPanel();
        const url = buildInviteUrl(token);
        if (url && (await copyToClipboard(url))) {
          setInviteLinkStatus("Invite link copied.");
        } else {
          setInviteLinkStatus(
            url ? "Invite link created." : "Invite link created.",
          );
        }
      } catch (err) {
        console.error("Failed to create invite link", err);
        setInviteLinkStatus("Failed to create invite link.");
      }
    });
  }
  if (listEl) {
    listEl.addEventListener("click", async (event) => {
      const copyBtn = event.target.closest("[data-invite-copy]");
      const revokeBtn = event.target.closest("[data-invite-revoke]");
      const slug = currentSlug || currentTournamentMeta?.slug || "";
      if (!slug || !isAdmin) return;
      if (copyBtn) {
        const token = copyBtn.dataset.inviteCopy || "";
        const url = buildInviteUrl(token);
        if (url && (await copyToClipboard(url))) {
          showToast?.("Invite link copied.", "success");
        } else {
          showToast?.("Could not copy invite link.", "error");
        }
        return;
      }
      if (revokeBtn) {
        const token = revokeBtn.dataset.inviteRevoke || "";
        try {
          await setDoc(
            doc(
              collection(db, TOURNAMENT_INVITE_LINK_COLLECTION, slug, "links"),
              token,
            ),
            { revoked: true, revokedAt: Date.now() },
            { merge: true },
          );
          await refreshInviteLinksPanel();
          showToast?.("Invite link revoked.", "success");
        } catch (err) {
          console.error("Failed to revoke invite link", err);
          showToast?.("Failed to revoke invite link.", "error");
        }
      }
    });
  }
}
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
  if (mapCatalogPromise) return mapCatalogPromise;
  mapCatalogPromise = (async () => {
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
  })();
  return mapCatalogPromise;
}

function refreshMapCatalogUi() {
  renderCustomMapSections();
  renderMapPoolPickerUI("mapPoolPicker", { mapPoolSelection, getAll1v1Maps });
  renderMapPoolPickerUI("settingsMapPoolPicker", {
    mapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("chosenMapList", { mapPoolSelection, getMapByName });
  renderChosenMapsUI("settingsChosenMapList", {
    mapPoolSelection,
    getMapByName,
  });
  updateMapButtonsUI(currentMapPoolMode);
  renderMapsTabUI(currentTournamentMeta, {
    mapPoolSelection,
    getDefaultMapPoolNames,
    getMapByName,
  });
  renderCircuitFinalMapPoolSelection();
  if (typeof getFinalMapPoolSelection === "function") {
    setFinalMapPoolSelection(Array.from(getFinalMapPoolSelection()));
  }
}

function ensureMapCatalogLoadedForUi() {
  if (mapCatalogLoaded) return;
  void loadMapCatalog()
    .then(() => refreshMapCatalogUi())
    .catch((err) => {
      console.warn("Failed to load map catalog", err);
    });
}

const TOURNAMENT_PERF_STORAGE_KEY = "zboTournamentPerf";
const TOURNAMENT_PERF_MAX_EVENTS = 500;
const BRACKET_LIVE_BADGE_IDLE_HIDE_MS = 1200;
let bracketLiveBadgeHideTimer = null;

function markBracketLiveUpdating() {
  if (typeof document === "undefined") return;
  const badge = document.getElementById("bracketLiveUpdatingBadge");
  if (!badge) return;
  badge.classList.add("is-active");
  if (bracketLiveBadgeHideTimer) {
    clearTimeout(bracketLiveBadgeHideTimer);
  }
  bracketLiveBadgeHideTimer = setTimeout(() => {
    bracketLiveBadgeHideTimer = null;
    badge.classList.remove("is-active");
  }, BRACKET_LIVE_BADGE_IDLE_HIDE_MS);
}

function isTournamentPerfEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TOURNAMENT_PERF_STORAGE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function getTournamentPerfStore() {
  if (!isTournamentPerfEnabled() || typeof window === "undefined") return null;
  const existing = window.__zboTournamentPerf;
  if (existing && typeof existing === "object") return existing;
  const created = {
    enabledAt: Date.now(),
    events: [],
  };
  window.__zboTournamentPerf = created;
  return created;
}

function beginTournamentPerfSpan(name, details = {}) {
  const store = getTournamentPerfStore();
  if (!store) return null;
  const nowPerf =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  return {
    store,
    name,
    details,
    startedPerf: nowPerf,
    startedAt: Date.now(),
  };
}

function endTournamentPerfSpan(span, details = {}) {
  if (!span?.store) return;
  const nowPerf =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  const durationMs = Number((nowPerf - span.startedPerf).toFixed(2));
  const nextEvent = {
    name: span.name,
    startedAt: span.startedAt,
    endedAt: Date.now(),
    durationMs,
    ...span.details,
    ...details,
  };
  const events = Array.isArray(span.store.events) ? span.store.events : [];
  events.push(nextEvent);
  if (events.length > TOURNAMENT_PERF_MAX_EVENTS) {
    events.splice(0, events.length - TOURNAMENT_PERF_MAX_EVENTS);
  }
  span.store.events = events;
}

function estimateJsonSizeBytes(value) {
  try {
    const json = JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch (_) {
    return null;
  }
}

function safeJsonEqual(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

function isSameSources(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i] || {};
    const right = b[i] || {};
    if ((left.type || "") !== (right.type || "")) return false;
    if ((left.matchId || "") !== (right.matchId || "")) return false;
    if ((left.outcome || "") !== (right.outcome || "")) return false;
    if ((left.playerId || "") !== (right.playerId || "")) return false;
  }
  return true;
}

function buildDependencyMapFromLookup(lookup) {
  const dependencies = new Map();
  if (!lookup) return dependencies;
  for (const match of lookup.values()) {
    const sources = Array.isArray(match.sources) ? match.sources : [];
    sources.forEach((src) => {
      if (src?.type !== "match" || !src.matchId) return;
      if (!dependencies.has(src.matchId)) {
        dependencies.set(src.matchId, new Set());
      }
      dependencies.get(src.matchId).add(match.id);
    });
  }
  return dependencies;
}

function collectDependentMatchIdsFromLookup(startIds, lookup) {
  const dependencies = buildDependencyMapFromLookup(lookup);
  const visited = new Set();
  const queue = Array.isArray(startIds) ? [...startIds] : [];
  while (queue.length) {
    const sourceId = queue.shift();
    if (!sourceId || visited.has(sourceId)) continue;
    visited.add(sourceId);
    const dependents = dependencies.get(sourceId);
    if (!dependents) continue;
    dependents.forEach((depId) => {
      if (!visited.has(depId)) queue.push(depId);
    });
  }
  return visited;
}

function getChangedMatchIdsFromMap(prevMap, nextMap) {
  const prev = prevMap || {};
  const next = nextMap || {};
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = new Set();
  ids.forEach((id) => {
    if (!safeJsonEqual(prev[id], next[id])) {
      changed.add(id);
    }
  });
  return changed;
}

function getBracketMatchIdsForPartial(prevBracket, nextBracket) {
  if (!prevBracket || !nextBracket) return null;
  const prevLookup = getMatchLookup(prevBracket);
  const nextLookup = getMatchLookup(nextBracket);
  if (!prevLookup || !nextLookup) return null;
  if (prevLookup.size !== nextLookup.size) return null;
  for (const id of nextLookup.keys()) {
    if (!prevLookup.has(id)) return null;
  }
  const changed = new Set();
  for (const [id, nextMatch] of nextLookup.entries()) {
    const prevMatch = prevLookup.get(id);
    if (!prevMatch) return null;
    if (!isSameSources(prevMatch.sources || [], nextMatch.sources || [])) {
      return null;
    }
    const prevScores = prevMatch.scores || [];
    const nextScores = nextMatch.scores || [];
    const scoreChanged =
      (prevScores[0] || 0) !== (nextScores[0] || 0) ||
      (prevScores[1] || 0) !== (nextScores[1] || 0);
    const statusChanged =
      prevMatch.walkover !== nextMatch.walkover ||
      prevMatch.status !== nextMatch.status ||
      prevMatch.winnerId !== nextMatch.winnerId ||
      prevMatch.loserId !== nextMatch.loserId;
    if (scoreChanged || statusChanged) changed.add(id);
  }
  if (!changed.size) return [];
  return Array.from(
    collectDependentMatchIdsFromLookup(Array.from(changed), nextLookup),
  );
}

function shouldUsePartialRender(prevState, nextState, format) {
  if (!prevState?.bracket || !nextState?.bracket) return false;
  if (isGroupStageFormat(format)) return false;
  if (prevState.isLive !== nextState.isLive) return false;
  if (prevState.hasBeenLive !== nextState.hasBeenLive) return false;
  if (prevState.disableFinalAutoAdd !== nextState.disableFinalAutoAdd)
    return false;
  if (prevState.needsReseed !== nextState.needsReseed) return false;
  if (prevState.bracketLayoutVersion !== nextState.bracketLayoutVersion)
    return false;
  if (!safeJsonEqual(prevState.players || [], nextState.players || []))
    return false;
  if (
    !safeJsonEqual(prevState.pointsLedger || {}, nextState.pointsLedger || {})
  )
    return false;
  if (
    !safeJsonEqual(
      prevState.manualSeedingEnabled,
      nextState.manualSeedingEnabled,
    )
  )
    return false;
  if (
    !safeJsonEqual(
      prevState.manualSeedingOrder || [],
      nextState.manualSeedingOrder || [],
    )
  )
    return false;
  if (!safeJsonEqual(prevState.casters || [], nextState.casters || []))
    return false;
  if (
    !safeJsonEqual(
      prevState.casterRequests || [],
      nextState.casterRequests || [],
    )
  )
    return false;
  return true;
}

function syncFromRemote(incoming) {
  markBracketLiveUpdating();
  const span = beginTournamentPerfSpan("syncFromRemote", {
    slug: currentSlug || "",
    incomingBytes: estimateJsonSizeBytes(incoming),
  });
  try {
    const incomingLastUpdated = Number(incoming?.lastUpdated) || 0;
    const localLastUpdated = Number(state?.lastUpdated) || 0;
    const incomingBestOf =
      incoming?.bestOf && typeof incoming.bestOf === "object"
        ? incoming.bestOf
        : null;
    if (
      incomingBestOf &&
      currentTournamentMeta &&
      (!incomingLastUpdated || incomingLastUpdated >= localLastUpdated)
    ) {
      const currentBestOf = currentTournamentMeta?.bestOf || {};
      if (!safeJsonEqual(currentBestOf, incomingBestOf)) {
        const mergedBestOf = {
          ...defaultBestOf,
          ...incomingBestOf,
        };
        setCurrentTournamentMetaState({
          ...currentTournamentMeta,
          bestOf: mergedBestOf,
        });
        applyBestOfToSettings(mergedBestOf);
        updateSettingsScoreLocks();
      }
    }

    syncFromRemoteCore({
      incoming,
      getState: () => state,
      setStateObj,
      currentSlug,
      safeJsonEqual,
      refreshMatchInfoPresenceIfOpen,
      applyRosterSeedingWithMode,
      deserializeBracket,
      currentVetoMatchId,
      vetoState,
      defaultState,
      shouldUsePartialRender,
      getFormat: () => currentTournamentMeta?.format,
      getBracketMatchIdsForPartial,
      getChangedMatchIdsFromMap,
      maybeToastMyMatchReady,
      refreshMatchInfoModalIfOpen,
      refreshVetoModalIfOpen,
      renderAll,
      renderActivityList,
      escapeHtml,
      formatTime,
      refreshPlayerDetailModalIfOpen,
      getPlayersMap,
    });
  } finally {
    endTournamentPerfSpan(span, {
      localPlayers: Array.isArray(state?.players) ? state.players.length : 0,
      hasBracket: Boolean(state?.bracket),
    });
  }
}

function isCurrentUserTournamentPlayer(player) {
  if (!player) return false;

  const uid = auth?.currentUser?.uid ? String(auth.currentUser.uid).trim() : "";
  if (uid && player?.uid && String(player.uid).trim() === uid) return true;

  const currentUsername = (getCurrentUsername?.() || "").trim().toLowerCase();
  if (!currentUsername) return false;

  const name = String(player?.name || "")
    .trim()
    .toLowerCase();
  const pulseName = String(player?.pulseName || "")
    .trim()
    .toLowerCase();

  return name === currentUsername || pulseName === currentUsername;
}

function isCurrentUserTournamentPlayerByUid(player) {
  if (!player) return false;
  const uid = auth?.currentUser?.uid ? String(auth.currentUser.uid).trim() : "";
  if (!uid || !player?.uid) return false;
  return String(player.uid).trim() === uid;
}

function getPromoStripRenderKey(meta) {
  if (!meta) return "";
  return JSON.stringify({
    sponsors: meta.sponsors || [],
    socials: meta.socials || [],
    circuitSlug: meta.circuitSlug || "",
    copyFromCircuitPromos: getCopyFromCircuitPromos(meta),
  });
}

let unsubscribeRemoteState = null;
let pendingRemoteSyncState = null;
let remoteSyncRafId = null;
let remoteSyncTimerId = null;
let lastRemoteSyncAt = 0;
const REMOTE_SYNC_MIN_INTERVAL_MS = 75;

function flushPendingRemoteSync() {
  if (!pendingRemoteSyncState) return;
  const nextState = pendingRemoteSyncState;
  pendingRemoteSyncState = null;
  lastRemoteSyncAt = Date.now();
  syncFromRemote(nextState);
}

function scheduleRemoteSync(nextState) {
  pendingRemoteSyncState = nextState;
  if (remoteSyncRafId != null || remoteSyncTimerId != null) return;
  const elapsedMs = Date.now() - lastRemoteSyncAt;
  const waitMs = Math.max(0, REMOTE_SYNC_MIN_INTERVAL_MS - elapsedMs);
  const run = () => {
    remoteSyncTimerId = null;
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      remoteSyncRafId = window.requestAnimationFrame(() => {
        remoteSyncRafId = null;
        flushPendingRemoteSync();
      });
      return;
    }
    flushPendingRemoteSync();
  };
  if (waitMs > 0) {
    remoteSyncTimerId = setTimeout(run, waitMs);
    return;
  }
  run();
}

function subscribeTournamentStateRemote(slug) {
  try {
    unsubscribeRemoteState?.();
  } catch (_) {
    // ignore
  }
  unsubscribeRemoteState = null;
  pendingRemoteSyncState = null;
  if (remoteSyncRafId != null && typeof window !== "undefined") {
    window.cancelAnimationFrame?.(remoteSyncRafId);
    remoteSyncRafId = null;
  }
  if (remoteSyncTimerId != null) {
    clearTimeout(remoteSyncTimerId);
    remoteSyncTimerId = null;
  }
  if (!slug) return;

  const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug);

  unsubscribeRemoteState = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;

      const data = snap.data() || {};
      const lastUpdated = data.lastUpdated?.toMillis
        ? data.lastUpdated.toMillis()
        : Number(data.lastUpdated) || 0;

      const incomingPlayers = Array.isArray(data.players) ? data.players : [];

      // debug logging removed

      // Guard: don't let an "empty players" snapshot overwrite a non-empty local state.
      if (incomingPlayers.length === 0 && state?.players?.length) {
        console.warn("🛑 [tournament-sync] Ignoring empty players snapshot", {
          slug,
          lastUpdated,
          localPlayersCount: state.players.length,
        });
        return;
      }

      scheduleRemoteSync({
        ...data,
        lastUpdated,
      });
    },
    (err) => {
      console.warn("Remote tournament state listener error", err);
    },
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
    `.markdown-surface[data-editor-for="${textareaId}"]`,
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

function getMmrSeedingMode(snapshot = state) {
  return snapshot?.mmrSeedingMode === "registered" ? "registered" : "current";
}

function applySeedingMmr(players = [], mode = "current") {
  return (players || []).map((player) => {
    const base =
      mode === "registered"
        ? player?.mmr
        : Number.isFinite(player?.currentMmr)
          ? player.currentMmr
          : player?.mmr;
    return { ...player, seedMmr: Number.isFinite(base) ? base : null };
  });
}

function buildManualOrder(
  players = [],
  manualOrder = [],
  seedMode = "current",
) {
  const byId = new Map((players || []).map((player) => [player.id, player]));
  const nextOrder = [];
  const used = new Set();
  (manualOrder || []).forEach((id) => {
    if (!id || used.has(id) || !byId.has(id)) return;
    nextOrder.push(id);
    used.add(id);
  });
  const remaining = (players || []).filter(
    (player) => player?.id && !used.has(player.id),
  );
  if (!remaining.length) return nextOrder;
  const seededRemaining = applySeeding(
    applySeedingMmr(
      remaining.map((player) => ({ ...player })),
      seedMode,
    ),
  );
  seededRemaining.forEach((player) => {
    if (!player?.id || used.has(player.id)) return;
    nextOrder.push(player.id);
    used.add(player.id);
  });
  return nextOrder;
}

function applyManualSeeding(
  players = [],
  manualOrder = [],
  seedMode = "current",
) {
  const clones = (players || []).map((player) => ({ ...player }));
  const byId = new Map(clones.map((player) => [player.id, player]));
  const nextOrder = buildManualOrder(clones, manualOrder, seedMode);
  const seeded = nextOrder.map((id) => byId.get(id)).filter(Boolean);
  seeded.forEach((player, idx) => {
    player.seed = idx + 1;
  });
  return seeded;
}

function seedPlayersForState(players = [], snapshot = state) {
  const { enabled, order } = getManualSeedingSettings(snapshot);
  const seedMode = getMmrSeedingMode(snapshot);
  if (enabled) {
    return applyManualSeeding(players, order, seedMode);
  }
  return applySeeding(
    applySeedingMmr(
      (players || []).map((player) => ({ ...player })),
      seedMode,
    ),
  );
}

function seedEligiblePlayersWithMode(
  players = [],
  snapshot = state,
  { forceRecompute = false } = {},
) {
  const eligible = getEligiblePlayers(players);
  const hasSeedSnapshot =
    eligible.length > 0 &&
    eligible.every((player) => Number.isFinite(player?.seed));
  const seededEligible =
    hasSeedSnapshot && !forceRecompute
    ? eligible.map((player) => ({ ...player }))
    : seedPlayersForState(eligible, snapshot);
  const seedById = new Map(
    seededEligible.map((player) => [player.id, player.seed]),
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

function getSeedingTablePlayers(players = [], snapshot = state) {
  const eligible = getEligiblePlayers(players);
  const hasSeeds =
    eligible.length > 0 &&
    eligible.every((player) => Number.isFinite(player?.seed));
  if (!hasSeeds) {
    return seedPlayersForState(players, snapshot);
  }
  const seeded = (players || []).map((player) => ({ ...player }));
  const seededWithSeeds = seeded.filter((player) =>
    Number.isFinite(player?.seed),
  );
  const unseeded = seeded.filter(
    (player) => !Number.isFinite(player?.seed),
  );
  seededWithSeeds.sort((a, b) => (a.seed || 0) - (b.seed || 0));
  return [...seededWithSeeds, ...unseeded];
}

async function persistSeedSnapshot(reason = "") {
  const seeded = seedEligiblePlayersWithMode(state.players || [], state, {
    forceRecompute: true,
  }).mergedPlayers;
  await updateRosterWithTransaction(
    () => seeded,
    { needsReseed: false },
  );
  if (reason) {
    addActivity(reason, { skipRemote: true });
  }
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
    nextSnapshot,
    { forceRecompute: true },
  );
  saveState(
    {
      manualSeedingEnabled: nextSnapshot.manualSeedingEnabled,
      manualSeedingOrder: nextSnapshot.manualSeedingOrder,
      players: mergedPlayers,
      needsReseed: hasCompletedMatches,
    },
    { skipRoster: true },
  );
  renderAll();
}

function setManualSeedingEnabled(nextEnabled) {
  if (state.isLive) {
    showToast?.("Tournament is live. Seeding is locked.", "error");
    renderAll();
    return;
  }
  if (bracketHasRecordedResults(state.bracket)) {
    showToast?.("Seeding is locked once scores are recorded.", "error");
    renderAll();
    return;
  }
  const enabled = Boolean(nextEnabled);
  const current = getManualSeedingSettings(state);
  const seedMode = getMmrSeedingMode(state);
  const nextOrder = enabled
    ? buildManualOrder(state.players || [], current.order, seedMode)
    : current.order;
  const nextSnapshot = {
    ...state,
    manualSeedingEnabled: enabled,
    manualSeedingOrder: nextOrder,
  };
  applySeedingStateUpdate(
    nextSnapshot,
    enabled ? "Manual seeding enabled" : "Automatic seeding enabled",
  );
}

function setMmrSeedingMode(nextMode) {
  if (state.isLive) {
    showToast?.("Tournament is live. Seeding is locked.", "error");
    renderAll();
    return;
  }
  if (bracketHasRecordedResults(state.bracket)) {
    showToast?.("Seeding is locked once scores are recorded.", "error");
    renderAll();
    return;
  }
  const mode = nextMode === "registered" ? "registered" : "current";
  if (getMmrSeedingMode(state) === mode) {
    updateMmrSeedingUi();
    return;
  }
  const nextSnapshot = {
    ...state,
    mmrSeedingMode: mode,
  };
  applySeedingStateUpdate(
    nextSnapshot,
    `Seeding uses ${mode === "current" ? "current" : "registered"} MMR`,
  );
}

function handleManualSeedingReorder(nextOrder = []) {
  if (!Array.isArray(nextOrder) || !nextOrder.length) return;
  if (state.isLive) return;
  if (bracketHasRecordedResults(state.bracket)) {
    showToast?.("Seeding is locked once scores are recorded.", "error");
    renderAll();
    return;
  }
  const seedMode = getMmrSeedingMode(state);
  const normalizedOrder = buildManualOrder(
    state.players || [],
    nextOrder,
    seedMode,
  );
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
  const updatedMeta = {
    ...(currentTournamentMeta || {}),
    circuitPointsApplied: true,
  };
  setCurrentTournamentMetaState(updatedMeta);
  renderCircuitPointsSettings();
  setDoc(
    doc(collection(db, TOURNAMENT_COLLECTION), currentTournamentMeta.slug),
    { circuitPointsApplied: true },
    { merge: true },
  ).catch((err) => {
    console.error("Failed to store circuit points applied flag", err);
  });
  setDoc(
    doc(
      collection(db, TOURNAMENT_STATE_COLLECTION),
      currentTournamentMeta.slug,
    ),
    { circuitPointsApplied: true },
    { merge: true },
  ).catch((err) => {
    console.error("Failed to store circuit points applied flag in state", err);
  });
}

function updatePlacementsRow() {
  updatePlacementsRowView({
    currentTournamentMeta,
    state,
    getEligiblePlayers,
    computePlacementsForBracket,
    getPlayersMap,
  });
}

function renderAll(matchIds = null) {
  const span = beginTournamentPerfSpan("renderAll", {
    slug: currentSlug || "",
    requestedMatchIds: Array.isArray(matchIds) ? matchIds.length : 0,
  });
  let renderMode = "full";
  try {
    const bracketContainer = document.getElementById("bracketGrid");
    bindRoundBestOfEditor();
    const bracket = state.bracket;
    const playersArr = state.players || [];
    const format = currentTournamentMeta?.format || "Tournament";
    if (
      !state.isLive &&
      state.needsReseed &&
      !bracketHasRecordedResults(state.bracket)
    ) {
      renderMode = "rebuild";
      rebuildBracket(true);
      return;
    }
    syncMatchReadySince();
    const shouldPartialUpdate =
      Array.isArray(matchIds) &&
      matchIds.length &&
      bracketContainer &&
      bracket &&
      !isGroupStageFormat(format);

    if (shouldPartialUpdate) {
      const lookup = getMatchLookup(bracket);
      const playersById = getPlayersMap();
      const didPartialUpdate = updateTreeMatchCards(
        matchIds,
        lookup,
        playersById,
        {
          currentUsername: getCurrentUsername?.() || "",
          currentUid: auth.currentUser?.uid || "",
        },
      );
      if (didPartialUpdate) {
        renderMode = "partial";
        annotateConnectorPlayers(lookup, playersById);
        clampScoreSelectOptions();
        updatePlacementsRow();
        applyBracketReadOnlyState(!state.isLive && !isAdmin);
        updateTooltips?.();
        return;
      }
    }
    // Update seeding table
    const seedingSnapshot = getSeedingTablePlayers(state.players || [], state);
    const forfeitUndoBlocked = getForfeitUndoBlockedIds();
    const seededWithForfeitStatus = seedingSnapshot.map((player) => ({
      ...player,
      forfeitUndoBlocked: forfeitUndoBlocked.has(player.id),
    }));
    renderSeedingTable(seededWithForfeitStatus, {
      isLive: state.isLive,
      isAdmin,
      manualSeeding: state.manualSeedingEnabled,
    });
    updateManualSeedingUi();
    updateMmrSeedingUi();
    updateBotManagerCount();

    renderTournamentMetaSection({
      currentTournamentMeta,
      state,
      isAdmin,
      currentSlug,
      inviteLinkGate,
      auth,
      setTabAlertsBaseTitle,
      sanitizeUrl,
      renderMarkdown,
      renderPrizeInfoMarkup,
      isDualTournamentFormat,
      getStartTimeMs,
      getEligiblePlayers,
      formatPrizePoolTotal,
      isInviteOnlyTournament,
      normalizeInviteStatus,
      INVITE_STATUS,
      updatePlacementsRow,
      getCheckInWindowState,
      bracketHasResults,
      normalizeSc2PulseIdUrl,
      updateCheckInUI,
      renderCasterSection,
      saveState,
      renderAll,
      hideMatchInfoModal,
      escapeHtml,
      raceClassName,
      renderActivityList,
      formatTime,
      populateSettingsPanelUI,
      setMapPoolSelection,
      getDefaultMapPoolNames,
      updateSettingsDescriptionPreview,
      updateSettingsRulesPreview,
      syncFormatFieldVisibility,
      updatePrizeSplitWarning,
      updateSettingsScoreLocks,
      getPromoStripRenderKey,
      promoStripRenderKey,
      setPromoStripRenderKey: (next) => {
        promoStripRenderKey = next;
      },
      refreshTournamentPromoStrip,
      refreshTournamentPromoSettings,
      renderCircuitPointsSettings,
      hydrateCurrentUserClanLogo,
      getTeamMembership: findTeamMembership,
      getTournamentTeamSize,
      normalizeTournamentMode,
    });
    renderTeamInviteSection();

    // Render maps tab from current meta or default pool
    renderMapsTabUI(currentTournamentMeta, {
      mapPoolSelection,
      getDefaultMapPoolNames,
      getMapByName,
    });

    const layoutVersion = state.bracketLayoutVersion || 1;
    const repairVersion = Number(state.bracketRepairVersion) || 0;
    const hasScoreReports = Object.keys(state.scoreReports || {}).length > 0;
    const canAutoRebuild =
      !hasScoreReports && !bracketHasRecordedResults(bracket);
    const canAutoRepair =
      canAutoRebuild && repairVersion < CURRENT_BRACKET_LAYOUT_VERSION;
    const needsLayoutUpgrade =
      bracket &&
      layoutVersion < CURRENT_BRACKET_LAYOUT_VERSION &&
      canAutoRepair;
    if (needsLayoutUpgrade) {
      renderMode = "rebuild";
      rebuildBracket(true, "Updated bracket layout");
      return;
    }
    const needsBracketRepair = (() => {
      if (!bracket || !playersArr.length) return false;
      if (!canAutoRepair) return false;
      if (isGroupStageFormat(format)) return false;
      const { seededEligible } = seedEligiblePlayersWithMode(
        state.players || [],
        state,
      );
      const expected = buildBracket(
        seededEligible,
        currentTournamentMeta || {},
        isRoundRobinFormat,
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
      renderMode = "rebuild";
      rebuildBracket(true, "Bracket repaired");
      return;
    }
    renderBracketContent({
      bracketContainer,
      bracket,
      playersArr,
      format,
      matchIds,
      isGroupStageFormat,
      getMatchLookup,
      getPlayersMap,
      updateTreeMatchCards,
      getCurrentUsername,
      auth,
      annotateConnectorPlayers,
      clampScoreSelectOptions,
      ensureRoundRobinPlayoffs,
      saveState,
      renderRoundRobinView,
      computeGroupStandings,
      DOMPurify,
      attachMatchActionHandlers,
      renderBracketView,
      attachMatchHoverHandlers,
      enableDragScroll,
    });
    applyBracketReadOnlyState(!state.isLive && !isAdmin);
    updateTooltips?.();
  } finally {
    endTournamentPerfSpan(span, {
      mode: renderMode,
      players: Array.isArray(state?.players) ? state.players.length : 0,
      hasBracket: Boolean(state?.bracket),
      isLive: Boolean(state?.isLive),
    });
  }
}

const matchReadyToastShown = new Set();
const matchReadyToastDismissed = new Set();

function normalizeMatchReadySince(source) {
  if (!source || typeof source !== "object") return {};
  const normalized = {};
  for (const [matchId, value] of Object.entries(source)) {
    if (!matchId) continue;
    const ts = Number(value);
    if (Number.isFinite(ts) && ts > 0) {
      normalized[matchId] = Math.floor(ts);
    }
  }
  return normalized;
}

function isSameMatchReadySince(a, b) {
  const left = normalizeMatchReadySince(a);
  const right = normalizeMatchReadySince(b);
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function syncMatchReadySince() {
  const bracket = state?.bracket;
  const currentReadySince = normalizeMatchReadySince(state?.matchReadySince);
  if (!bracket) {
    if (Object.keys(currentReadySince).length) {
      saveState({ matchReadySince: {} }, { skipRoster: true });
    }
    return;
  }
  const lookup = getMatchLookup(bracket);
  const playersById = getPlayersMap();
  const now = Date.now();
  const nextReadySince = {};
  for (const match of getAllMatches(bracket)) {
    if (!match?.id) continue;
    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    const hasTwoPlayers = Boolean(pA && pB);
    const isComplete = match.status === "complete";
    if (hasTwoPlayers && !isComplete) {
      const existing = Number(currentReadySince[match.id]);
      nextReadySince[match.id] =
        Number.isFinite(existing) && existing > 0 ? existing : now;
    }
  }
  for (const matchId of Object.keys(currentReadySince)) {
    if (!Object.prototype.hasOwnProperty.call(nextReadySince, matchId)) {
      clearNotifiedReadyMatch(matchId);
    }
  }
  if (!isSameMatchReadySince(currentReadySince, nextReadySince)) {
    saveState({ matchReadySince: nextReadySince }, { skipRoster: true });
  }
}

function getMatchReadySince(matchId) {
  if (!matchId) return null;
  const ts = Number(state?.matchReadySince?.[matchId]);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

function showMatchReadyToast({
  matchId,
  message,
  opponentName,
  opponentAvatarUrl,
}) {
  showMatchReadyToastUi({
    matchId,
    message,
    opponentName,
    opponentAvatarUrl,
    defaultAvatarUrl: DEFAULT_PLAYER_AVATAR,
    shownSet: matchReadyToastShown,
    dismissedSet: matchReadyToastDismissed,
    onGo: (id) => {
      openMatchInfoModalUsingDeps(id);
    },
  });
}

async function checkInCurrentPlayer() {
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
  const isTeamMode = getTournamentTeamSize(meta) > 1;
  if (isTeamMode) {
    const membership = findTeamMembership(state.players || [], uid, {
      includeDenied: false,
    });
    if (membership?.role === "member") {
      showToast?.("Only the team leader checks in for team tournaments.", "error");
      return;
    }
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
  const checkedInAt = Date.now();
  await updateRosterWithTransaction((roster) =>
    roster.map((player) => {
      if (player?.uid !== uid) return player;
      if (!isInviteAccepted(player)) return player;
      return { ...player, checkedInAt: player.checkedInAt || checkedInAt };
    }),
  );
  addActivity(`${players[idx].name || "Player"} checked in.`);
  renderAll();
}

async function leaveCurrentTeam() {
  if (state.isLive) {
    showToast?.("Tournament is live. Team changes are locked.", "error");
    return;
  }
  const uid = auth.currentUser?.uid || "";
  if (!uid) {
    showToast?.("Sign in to leave team.", "error");
    return;
  }
  if (bracketHasRecordedResults(state.bracket)) {
    showToast?.("Registration is locked once scores are recorded.", "error");
    return;
  }
  const membership = findTeamMembership(state.players || [], uid, {
    includeDenied: false,
  });
  if (!membership || membership.role !== "member") {
    showToast?.("You are not currently in a team as teammate.", "error");
    return;
  }
  const now = Date.now();
  let changed = false;
  await updateRosterWithTransaction(
    (players) =>
      (players || []).map((player) => {
        const team = player?.team && typeof player.team === "object" ? player.team : null;
        if (!team) return player;
        const teamSize = Math.max(
          1,
          Number(team.size) || getTeamSizeFromMode(team.mode || getTournamentMode()),
        );
        const normalizedMembers = normalizeTeamMembersFromPlayer(player, teamSize);
        const nextMembers = normalizedMembers.filter(
          (entry) => String(entry?.uid || "") !== uid,
        );
        if (nextMembers.length === normalizedMembers.length) return player;
        changed = true;
        const required = Math.max(0, teamSize - 1);
        const acceptedCount = nextMembers.filter(
          (entry) =>
            entry.role !== "leader" &&
            normalizeTeamMemberStatus(entry.status) === TEAM_MEMBER_STATUS.accepted,
        ).length;
        const inviteStatus =
          acceptedCount >= required ? INVITE_STATUS.accepted : INVITE_STATUS.pending;
        return {
          ...player,
          inviteStatus,
          checkedInAt: inviteStatus === INVITE_STATUS.accepted ? player.checkedInAt || null : null,
          team: {
            ...team,
            mode: normalizeTournamentMode(team.mode || getTournamentMode()),
            size: teamSize,
            updatedAt: now,
            members: nextMembers,
          },
        };
      }),
    { needsReseed: true },
    { optimistic: true },
  );
  if (!changed) {
    showToast?.("Could not leave team.", "error");
    return;
  }
  teamInviteDraft = [];
  teamInviteDraftDirty = false;
  addActivity(`${getCurrentUsername?.() || "Teammate"} left the team.`);
  showToast?.("You left the team.", "success");
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
  const targetSlug =
    currentSlug || currentTournamentMeta.slug || currentTournamentMeta.id || "";
  if (!targetSlug) {
    showToast?.("Missing tournament slug.", "error");
    return;
  }
  const eligiblePlayers = getEligiblePlayers(state.players || []).filter(
    (player) => player?.uid && !player.checkedInAt,
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

async function refreshRosterMmrFromPulse() {
  if (!isAdmin) {
    showToast?.("Only admins can refresh MMR.", "error");
    return;
  }
  if (state.isLive) {
    showToast?.("Tournament is live. MMR refresh is locked.", "error");
    return;
  }
  const eligiblePlayers = getEligiblePlayers(state.players || []);
  const targets = eligiblePlayers.filter((player) =>
    normalizeSc2PulseIdUrl(player?.sc2Link || ""),
  );
  if (!targets.length) {
    showToast?.("No SC2Pulse links to refresh.", "error");
    return;
  }

  const refreshBtn = document.getElementById("refreshMmrBtn");
  const originalLabel = refreshBtn?.textContent;
  const statusWrap = document.getElementById("mmrRefreshStatus");
  const statusText = document.getElementById("mmrRefreshText");
  const statusFill = document.getElementById("mmrRefreshFill");
  const total = targets.length;
  let completed = 0;
  const updateProgress = () => {
    if (!statusText || !statusFill) return;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    statusText.textContent = `Refreshing MMR... ${completed} of ${total}`;
    statusFill.style.width = `${percent}%`;
  };
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }
  if (statusWrap) {
    statusWrap.style.display = "flex";
  }
  updateProgress();

  const updatesById = new Map();
  let updatedCount = 0;
  let failedCount = 0;

  try {
    for (const player of targets) {
      const url = normalizeSc2PulseIdUrl(player?.sc2Link || "");
      if (!url) {
        failedCount += 1;
        completed += 1;
        updateProgress();
        continue;
      }
      try {
        const payload = await fetchPulseMmrFromBackend(url);
        const byRace = payload.byRace || null;
        const nextMmr = resolveRaceMmr(byRace, player?.race || "", payload.mmr);
        if (!Number.isFinite(nextMmr)) {
          failedCount += 1;
          completed += 1;
          updateProgress();
          continue;
        }
        updatesById.set(player.id, {
          currentMmr: nextMmr,
          mmrByRace: byRace || null,
          pulseName: payload.pulseName || player?.pulseName || "",
          sc2Link: url,
        });
        updatedCount += 1;
      } catch (_) {
        failedCount += 1;
      }
      completed += 1;
      updateProgress();
    }

    if (!updatesById.size) {
      showToast?.("No MMR updates found.", "error");
      return;
    }

    await updateRosterWithTransaction(
      (players) =>
        (players || []).map((player) => {
          const patch = updatesById.get(player?.id);
          return patch ? { ...player, ...patch } : player;
        }),
      { needsReseed: true },
    );
    await persistSeedSnapshot("MMR refresh updated seeding.");

    const failedSuffix = failedCount ? ` (${failedCount} failed)` : "";
    showToast?.(
      `Updated ${updatedCount} player${
        updatedCount === 1 ? "" : "s"
      }${failedSuffix}.`,
      "success",
    );
  } finally {
    if (statusText && statusFill) {
      statusText.textContent = "MMR refresh complete.";
      statusFill.style.width = "100%";
    }
    if (statusWrap) {
      setTimeout(() => {
        statusWrap.style.display = "none";
      }, 1200);
    }
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel || "Refresh MMR";
    }
  }
}

async function toggleCheckInManualClose() {
  if (!isAdmin) {
    showToast?.("Only admins can update check-in.", "error");
    return;
  }
  if (!currentTournamentMeta) {
    showToast?.("Tournament data not loaded yet.", "error");
    return;
  }
  if (state.isLive) {
    showToast?.("Tournament is live. Check-in is closed.", "error");
    return;
  }
  const checkInState = getCheckInWindowState(currentTournamentMeta);
  if (!checkInState.allowAfterStart) {
    showToast?.("Manual check-in close is disabled in settings.", "error");
    return;
  }
  if (!checkInState.hasOpened) {
    showToast?.("Check-in has not opened yet.", "error");
    return;
  }
  const targetSlug =
    currentSlug || currentTournamentMeta.slug || currentTournamentMeta.id || "";
  if (!targetSlug) {
    showToast?.("Missing tournament slug.", "error");
    return;
  }

  const previousMeta = currentTournamentMeta;
  const nextClosed = !Boolean(previousMeta?.checkInManuallyClosed);
  const nextMeta = {
    ...previousMeta,
    checkInManuallyClosed: nextClosed,
  };
  setCurrentTournamentMetaState(nextMeta);
  renderAll();
  try {
    await setDoc(
      doc(collection(db, TOURNAMENT_COLLECTION), targetSlug),
      { checkInManuallyClosed: nextClosed },
      { merge: true },
    );
    showToast?.(
      nextClosed ? "Check-in closed." : "Check-in opened.",
      "success",
    );
  } catch (err) {
    console.error("Failed to toggle check-in", err);
    setCurrentTournamentMetaState(previousMeta);
    renderAll();
    showToast?.("Failed to update check-in.", "error");
  }
}

async function goLiveTournament() {
  if (state.isLive) {
    showToast?.("Tournament is already live.", "success");
    return;
  }
  const canResumeExistingBracket =
    Boolean(state.hasBeenLive) && bracketHasResults() && Boolean(state.bracket);
  if (canResumeExistingBracket) {
    saveState({ isLive: true, hasBeenLive: true }, { skipRoster: true });
    addActivity("Tournament resumed live.");
    renderAll();
    return;
  }
  const checkInState = getCheckInWindowState(currentTournamentMeta);
  if (checkInState.allowAfterStart && checkInState.isOpen) {
    showToast?.("Close check-in before going live.", "error");
    return;
  }
  const checkedInPlayers = getEligiblePlayers(state.players || []).filter(
    (p) => p.checkedInAt,
  );
  if (!checkedInPlayers.length) {
    showToast?.("No checked-in players to go live.", "error");
    return;
  }
  await persistSeedSnapshot("Seeding locked for live.");
  const { mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    state,
  );
  const seededPlayers = getSeedingTablePlayers(checkedInPlayers, state).filter(
    (player) => player?.checkedInAt,
  );
  const bracket = buildBracket(
    seededPlayers,
    currentTournamentMeta || {},
    (fmt) => (fmt || "").toLowerCase().includes("round robin"),
  );
  saveState(
    {
      players: mergedPlayers,
      bracket,
      needsReseed: false,
      bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
      bracketRepairVersion: CURRENT_BRACKET_LAYOUT_VERSION,
      isLive: true,
      hasBeenLive: true,
    },
    { skipRoster: true },
  );
  addActivity("Tournament went live.");
  renderAll();
}

function setTournamentNotLive() {
  if (!state.isLive) {
    showToast?.("Tournament is already not live.", "success");
    return;
  }
  saveState({ isLive: false, hasBeenLive: true }, { skipRoster: true });
  addActivity("Tournament set to not live.");
  renderAll();
}

async function toggleLiveTournament() {
  if (liveToggleInFlight) return;
  liveToggleInFlight = true;
  try {
    if (state.isLive) {
      setTournamentNotLive();
      return;
    }
    await goLiveTournament();
  } finally {
    liveToggleInFlight = false;
  }
}

function recreateLiveBracket(options = {}) {
  const forceResetScores = Boolean(options?.forceResetScores);
  if (state.isLive) {
    showToast?.("Set tournament to not live before recreating bracket.", "error");
    return false;
  }
  if (forceResetScores) {
    resetScores({ clearReadyTimer: true });
    showToast?.(
      "Bracket re-created. Scores, results, and veto outcomes were reset.",
      "success",
    );
    return true;
  }
  const hasScores = bracketHasRecordedResults(state.bracket);
  if (hasScores && !forceResetScores) {
    showToast?.("Reset scores first before re-creating bracket.", "error");
    return false;
  }
  rebuildBracket(true, "Bracket re-created.");
  showToast?.("Bracket re-created.", "success");
  return true;
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
  saveState(next, {
    skipRemote: Boolean(options.skipRemote),
    skipRoster: true,
  });
  renderActivityList({ state, escapeHtml, formatTime });
}

function updateManualSeedingUi() {
  const toggle = document.getElementById("manualSeedingToggle");
  const help = document.getElementById("seedingModeHelp");
  const enabled = Boolean(state.manualSeedingEnabled);
  const locked = state.isLive || bracketHasRecordedResults(state.bracket);
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
      const mode = getMmrSeedingMode(state);
      help.textContent = locked
        ? "Seeding is locked while live."
        : mode === "current"
          ? "Sorting uses current MMR."
          : "Sorting uses registered MMR.";
    }
  }
}

function updateMmrSeedingUi() {
  const toggle = document.getElementById("mmrSeedingToggle");
  const mode = getMmrSeedingMode(state);
  const locked =
    state.isLive ||
    state.manualSeedingEnabled ||
    bracketHasRecordedResults(state.bracket);
  if (toggle) {
    toggle.checked = mode === "current";
    toggle.disabled = locked;
  }
}

function updateSettingsScoreLocks() {
  const hasScores = bracketHasRecordedResults(state.bracket);
  const locks = getBracketScoreLocks(state.bracket);
  const formatSelect = document.getElementById("settingsFormatSelect");
  const grandFinalResetToggle = document.getElementById(
    "settingsGrandFinalResetToggle",
  );
  const rrGroups = document.getElementById("settingsRoundRobinGroups");
  const rrAdvance = document.getElementById("settingsRoundRobinAdvance");
  const rrPlayoffs = document.getElementById("settingsRoundRobinPlayoffs");
  const rrBestOf = document.getElementById("settingsRoundRobinBestOf");
  const upperInput = document.getElementById("settingsBestOfUpper");
  const lowerInput = document.getElementById("settingsBestOfLower");
  const quarterInput = document.getElementById("settingsBestOfQuarter");
  const semiInput = document.getElementById("settingsBestOfSemi");
  const upperFinalInput = document.getElementById("settingsBestOfUpperFinal");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const finalResetInput = document.getElementById("settingsBestOfFinalReset");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");

  if (formatSelect) formatSelect.disabled = hasScores;
  if (grandFinalResetToggle) grandFinalResetToggle.disabled = hasScores;

  if (rrGroups) rrGroups.disabled = hasScores || locks.roundRobin;
  if (rrAdvance) rrAdvance.disabled = hasScores || locks.roundRobin;
  if (rrPlayoffs) rrPlayoffs.disabled = hasScores || locks.roundRobin;
  if (rrBestOf) rrBestOf.disabled = hasScores || locks.roundRobin;

  if (upperInput) upperInput.disabled = locks.upper;
  if (quarterInput) quarterInput.disabled = locks.quarter;
  if (semiInput) semiInput.disabled = locks.semi;
  if (upperFinalInput) upperFinalInput.disabled = locks.upperFinal;
  if (finalInput) finalInput.disabled = locks.final;
  if (finalResetInput) finalResetInput.disabled = locks.finalReset;

  if (lowerInput) lowerInput.disabled = locks.lower;
  if (lbSemiInput) lbSemiInput.disabled = locks.lowerSemi;
  if (lbFinalInput) lbFinalInput.disabled = locks.lowerFinal;
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

function matchHasRecordedScore(match) {
  if (!match) return false;
  if (match.status === "complete") return true;
  if (match.winnerId || match.walkover) return true;
  const scores = match.scores || [];
  return (scores[0] || 0) + (scores[1] || 0) > 0;
}

function getBracketScoreLocks(bracket) {
    const locks = {
      upper: false,
      quarter: false,
      semi: false,
      upperFinal: false,
      final: false,
      finalReset: false,
      lower: false,
      lowerSemi: false,
      lowerFinal: false,
      roundRobin: false,
    };
  if (!bracket) return locks;
  const winners = Array.isArray(bracket.winners) ? bracket.winners : [];
  const losers = Array.isArray(bracket.losers) ? bracket.losers : [];
  const winnersRounds = winners.length;
  const losersRounds = losers.length;

  winners.forEach((round, idx) => {
    const roundNum = idx + 1;
    (round || []).forEach((match) => {
      if (!matchHasRecordedScore(match)) return;
      if (roundNum === winnersRounds) {
        if (bracket.finals) {
          locks.upperFinal = true;
        } else {
          locks.final = true;
        }
      } else if (roundNum === winnersRounds - 1) {
        locks.semi = true;
      } else if (roundNum === winnersRounds - 2) {
        locks.quarter = true;
      } else {
        locks.upper = true;
      }
    });
  });

  losers.forEach((round, idx) => {
    const roundNum = idx + 1;
    (round || []).forEach((match) => {
      if (!matchHasRecordedScore(match)) return;
      if (roundNum === losersRounds) {
        locks.lowerFinal = true;
      } else if (roundNum === losersRounds - 1) {
        locks.lowerSemi = true;
      } else {
        locks.lower = true;
      }
    });
  });

  if (bracket.finals && matchHasRecordedScore(bracket.finals)) {
    locks.final = true;
  }
  if (bracket.finalsReset && matchHasRecordedScore(bracket.finalsReset)) {
    locks.final = true;
    locks.finalReset = true;
  }

  const groups = Array.isArray(bracket.groups) ? bracket.groups : [];
  groups.forEach((group) => {
    (group?.matches || []).forEach((match) => {
      if (matchHasRecordedScore(match)) {
        locks.roundRobin = true;
      }
    });
  });

  return locks;
}

function applyBracketReadOnlyState(readOnly) {
  const bracketGrid = document.getElementById("bracketGrid");
  if (!bracketGrid) return;
  bracketGrid.classList.toggle("bracket-readonly", readOnly);
  bracketGrid
    .querySelectorAll("select.result-select, select.score-select")
    .forEach((el) => {
      if (readOnly) {
        if (!el.disabled) {
          el.dataset.readOnlyDisabled = "true";
          el.disabled = true;
        }
      } else if (el.dataset.readOnlyDisabled === "true") {
        el.disabled = false;
        delete el.dataset.readOnlyDisabled;
      }
    });
  bracketGrid.querySelectorAll("button.veto-btn").forEach((btn) => {
    if (readOnly) {
      if (!btn.disabled) {
        btn.dataset.readOnlyDisabled = "true";
        btn.disabled = true;
      }
      btn.setAttribute("aria-disabled", "true");
    } else if (btn.dataset.readOnlyDisabled === "true") {
      btn.disabled = false;
      btn.setAttribute("aria-disabled", "false");
      delete btn.dataset.readOnlyDisabled;
    }
  });
}

function isBestOfKeyLocked(key, locks) {
  if (!key || !locks) return false;
  return Boolean(locks[key]);
}

async function updateRoundBestOfOverride(key, value, label = "") {
  const currentBest = {
    ...defaultBestOf,
    ...(currentTournamentMeta?.bestOf || {}),
  };
  const previousMeta = currentTournamentMeta
    ? {
        ...currentTournamentMeta,
        bestOf: { ...(currentTournamentMeta.bestOf || {}) },
      }
    : null;
  const nextBestOf = {
    ...currentBest,
    [key]: value,
  };
  const nextMeta = {
    ...(currentTournamentMeta || {}),
    bestOf: nextBestOf,
    lastUpdated: Date.now(),
  };
  setCurrentTournamentMetaState(nextMeta);
  applyBestOfToSettings(nextBestOf);
  updateSettingsScoreLocks();
  saveState(
    { bestOf: nextBestOf, bracket: state.bracket },
    { skipRoster: true },
  );
  renderAll();

  const targetSlug = currentSlug || currentTournamentMeta?.slug || "";
  if (!targetSlug) {
    showToast?.(`Best-of updated for ${label || key} (local only).`, "success");
    return;
  }

  try {
    await setDoc(
      doc(collection(db, TOURNAMENT_COLLECTION), targetSlug),
      {
        bestOf: nextBestOf,
        lastUpdated: nextMeta.lastUpdated,
      },
      { merge: true },
    );
    showToast?.(`Best-of updated for ${label || key}.`, "success");
  } catch (err) {
    console.error("Failed to update round best-of", err);
    if (previousMeta) {
      setCurrentTournamentMetaState(previousMeta);
      applyBestOfToSettings({
        ...defaultBestOf,
        ...(previousMeta.bestOf || {}),
      });
      updateSettingsScoreLocks();
      renderAll();
    }
    showToast?.("Failed to update best-of.", "error");
  }
}

function bindRoundBestOfEditor() {
  const bracketGrid = document.getElementById("bracketGrid");
  if (!bracketGrid) return;
  if (bracketGrid.dataset.roundBoEditorBound === "true") return;
  bracketGrid.dataset.roundBoEditorBound = "true";
  const onActivate = (badge) => {
    if (!badge || !bracketGrid.contains(badge)) return;
    if (!isAdmin) return;
    const key = String(badge.dataset.bestofKey || "").trim();
    if (!key) return;
    const label = String(badge.dataset.bestofLabel || key).trim();
    const locks = getBracketScoreLocks(state.bracket);
    const lockedByRound = badge.dataset.bestofLocked === "true";
    if (lockedByRound || isBestOfKeyLocked(key, locks)) {
      showToast?.(`${label} is locked because scores are recorded.`, "error");
      return;
    }
    const currentBest = {
      ...defaultBestOf,
      ...(currentTournamentMeta?.bestOf || {}),
    };
    const currentValue = Number(currentBest[key]) || 1;
    const promptValue = window.prompt(
      `Set Best-of for ${label} (odd integer >= 1):`,
      String(currentValue),
    );
    if (promptValue == null) return;
    const parsed = Number(promptValue);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed % 2 === 0) {
      showToast?.("Best-of must be an odd integer (1, 3, 5, ...).", "error");
      return;
    }
    const normalized = Math.floor(parsed);
    if (normalized === currentValue) return;
    void updateRoundBestOfOverride(key, normalized, label);
  };
  bracketGrid.addEventListener("click", (event) => {
    const badge = event.target.closest?.(".round-bo[data-bestof-key]");
    onActivate(badge);
  });
  bracketGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const badge = event.target.closest?.(".round-bo[data-bestof-key]");
    if (!badge) return;
    event.preventDefault();
    onActivate(badge);
  });
}

function buildPlayerFromData(data, players = state.players || []) {
  if (!data) return null;
  const id =
    data.id ||
    `p-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  const existing = (players || []).find(
    (p) => p.id === id || (data.name && p.name === data.name),
  );
  if (existing) return { ...existing, ...data, id: existing.id || id };
  const created = { ...data, id };
  if (created.currentMmr === undefined && Number.isFinite(created.mmr)) {
    created.currentMmr = created.mmr;
  }
  return created;
}

async function hydrateCurrentUserClanLogo() {
  if (selfClanHydrationInFlight || selfClanHydrated) return;
  const user = auth.currentUser;
  if (!user) return;
  const profile = getCurrentUserProfile?.() || {};
  const mainClanId = profile?.settings?.mainClanId || "";
  if (!mainClanId) return;
  const target = (state.players || []).find(
    (player) => player?.uid === user.uid && !player?.clanLogoUrl,
  );
  if (!target) {
    selfClanHydrated = true;
    return;
  }
  selfClanHydrationInFlight = true;
  try {
    const clanDoc = await getDoc(doc(db, "clans", mainClanId));
    if (!clanDoc.exists()) {
      selfClanHydrated = true;
      return;
    }
    const clanData = clanDoc.data() || {};
    const clanLogoUrl = clanData?.logoUrlSmall || clanData?.logoUrl || "";
    await updateRosterWithTransaction((players) =>
      updateRosterById(players, target.id, {
        clan: clanData?.name || target.clan || "",
        clanAbbreviation:
          clanData?.abbreviation || target.clanAbbreviation || "",
        clanLogoUrl,
      }),
    );
    selfClanHydrated = true;
  } catch (_) {
    // ignore hydration errors
  } finally {
    selfClanHydrationInFlight = false;
  }
}

async function removePlayer(id) {
  if (state.isLive) return;
  if (!id) return;
  await updateRosterWithTransaction(
    (players) => removeRosterById(players, id),
    {
      needsReseed: true,
    },
  );
  rebuildBracket(true, "Player removed");
}

async function updatePlayerPoints(id, points) {
  if (state.isLive) return;
  if (!id) return;
  await updateRosterWithTransaction(
    (players) => updateRosterById(players, id, { points }),
    { needsReseed: true },
  );
  rebuildBracket(true, "Points updated");
}

function matchHasManualResult(match) {
  if (!match || match.forfeitApplied) return false;
  const scores = Array.isArray(match.scores) ? match.scores : [];
  const hasScore = (scores[0] || 0) + (scores[1] || 0) > 0;
  const hasWalkover = Boolean(match.walkover);
  const hasWinner = Boolean(match.winnerId);
  const isComplete = match.status === "complete";
  return hasScore || hasWalkover || (hasWinner && isComplete);
}

function getForfeitUndoBlockedIds() {
  const blocked = new Set();
  if (!state?.bracket) return blocked;
  const lookup = getMatchLookup(state.bracket);
  const playersById = getPlayersMap();
  for (const match of lookup.values()) {
    if (!match || !matchHasManualResult(match)) continue;
    const participants = resolveParticipants(match, lookup, playersById);
    participants.forEach((player) => {
      if (player?.id && player?.forfeit) {
        blocked.add(player.id);
      }
    });
  }
  return blocked;
}

async function setPlayerForfeit(id, shouldForfeit) {
  if (!id) return;
  if (!shouldForfeit && state?.bracket) {
    const lookup = getMatchLookup(state.bracket);
    const playersById = getPlayersMap();
    for (const match of lookup.values()) {
      if (!match) continue;
      const participants = resolveParticipants(match, lookup, playersById);
      const ids = [participants[0]?.id, participants[1]?.id].filter(Boolean);
      if (!ids.includes(id)) continue;
      if (matchHasManualResult(match)) {
        showToast?.(
          "Cannot undo forfeit after a later match has a recorded score.",
          "error",
        );
        return;
      }
    }
  }
  await updateRosterWithTransaction((players) =>
    updateRosterById(players, id, { forfeit: shouldForfeit }),
  );
  renderAll();
  applyForfeitWalkovers({ saveState, renderAll });
  const changed = (state.players || []).find((p) => p.id === id);
  if (changed) {
    addActivity(
      `${changed.name || "Player"} ${
        shouldForfeit ? "marked as forfeit" : "forfeit removed"
      }.`,
    );
  }
}

async function setPlayerCheckIn(id, shouldCheckIn) {
  if (!id) return;
  const checkedInAt = Date.now();
  await updateRosterWithTransaction((players) =>
    players.map((p) => {
      if (p.id !== id) return p;
      if (!isInviteAccepted(p)) return p;
      if (shouldCheckIn) {
        return { ...p, checkedInAt: p.checkedInAt || checkedInAt };
      }
      return { ...p, checkedInAt: null };
    }),
  );
  const changed = (state.players || []).find((p) => p.id === id);
  if (changed) {
    addActivity(
      `${changed.name || "Player"} marked ${
        changed.checkedInAt ? "checked in" : "not checked in"
      }.`,
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
}

function resetScores(options = {}) {
  const clearReadyTimer = Boolean(options?.clearReadyTimer);
  if (!state?.bracket) return;
  const { seededEligible, mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    state,
  );
  const isRoundRobin = (fmt) =>
    (fmt || "").toLowerCase().includes("round robin");
  const bracket = buildBracket(
    seededEligible,
    currentTournamentMeta || {},
    isRoundRobin,
  );
  setCurrentVetoMatchIdState(null);
  setVetoStateState(null);
  saveState(
    {
      players: mergedPlayers,
      bracket,
      needsReseed: false,
      scoreReports: {},
      matchCasts: {},
      matchVetoes: {},
      ...(clearReadyTimer ? { matchReadySince: {} } : {}),
      bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
      bracketRepairVersion: CURRENT_BRACKET_LAYOUT_VERSION,
    },
    { skipRoster: true },
  );
  addActivity("Scores reset.");
  renderAll();
}

function resetVetoScoreChat() {
  if (!state?.bracket) return;
  const { seededEligible, mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    state,
  );
  const isRoundRobin = (fmt) =>
    (fmt || "").toLowerCase().includes("round robin");
  const bracket = buildBracket(
    seededEligible,
    currentTournamentMeta || {},
    isRoundRobin,
  );
  setCurrentVetoMatchIdState(null);
  setVetoStateState(null);
  saveState(
    {
      players: mergedPlayers,
      bracket,
      needsReseed: false,
      scoreReports: {},
      matchCasts: {},
      matchVetoes: {},
      bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
      bracketRepairVersion: CURRENT_BRACKET_LAYOUT_VERSION,
    },
    { skipRoster: true },
  );
  const targetSlug = currentSlug || currentTournamentMeta?.slug || "";
  if (targetSlug) {
    void deleteTournamentChatHistory(targetSlug);
  }
  addActivity("Scores, veto, and chat reset.");
  renderAll();
}
function updateMatchScore(matchId, scoreA, scoreB, options = {}) {
  if (!state.isLive && !isAdmin) {
    showToast?.("Tournament is not live. Bracket is read-only.", "error");
    return;
  }
  if (isFinalResetMatchId(state?.bracket, matchId)) {
    const lookup = state?.bracket ? getMatchLookup(state.bracket) : null;
    if (!lookup || !isFinalResetActive(state?.bracket, lookup)) {
      showToast?.(
        "Grand Final Reset is only played if the lower bracket wins the first final.",
        "error",
      );
      return;
    }
  }
  if (!isAdmin) {
    const lookup = state?.bracket ? getMatchLookup(state.bracket) : null;
    const match = lookup?.get(matchId) || null;
    const playersById = getPlayersMap();
    const [pA, pB] = match
      ? resolveParticipants(match, lookup, playersById)
      : [null, null];
    const currentUid = auth?.currentUser?.uid || "";
    const isTeamMode = getTournamentTeamSize(currentTournamentMeta) > 1;
    const canSubmit = isTeamMode
      ? Boolean(currentUid && (currentUid === pA?.uid || currentUid === pB?.uid))
      : Boolean(
          isCurrentUserTournamentPlayerByUid(pA) ||
            isCurrentUserTournamentPlayerByUid(pB),
        );
    if (!canSubmit) {
      showToast?.(
        isTeamMode
          ? "Only team leaders can report scores."
          : "Only match participants can report scores.",
        "error",
      );
      return;
    }
  }
  const lookupBefore = state?.bracket ? getMatchLookup(state.bracket) : null;
  const matchBefore = lookupBefore?.get(matchId) || null;
  const prevScores = Array.isArray(matchBefore?.scores)
    ? [...matchBefore.scores]
    : null;
  const prevWalkover = matchBefore?.walkover || null;
  const prevStatus = matchBefore?.status || null;
  const prevWinnerId = matchBefore?.winnerId || null;
  const saveLocalState = (next, opts = {}) =>
    saveState(next, { ...opts, skipRemote: true, keepTimestamp: true });
  updateMatchScoreCore(matchId, scoreA, scoreB, {
    saveState: saveLocalState,
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
  const participants = resolveParticipants(
    matchAfter,
    lookupAfter,
    playersById,
  );
  // Don't toast here; wait for the updated bracket snapshot so opponent is accurate.
  const nameA = participants[0]?.name || "TBD";
  const nameB = participants[1]?.name || "TBD";
  const scoreAOut = Number.isFinite(nextScores[0]) ? nextScores[0] : 0;
  const scoreBOut = Number.isFinite(nextScores[1]) ? nextScores[1] : 0;
  addActivity(`Score submitted: ${nameA} ${scoreAOut}-${scoreBOut} ${nameB}`, {
    type: "score",
    score: {
      nameA,
      nameB,
      scoreA: scoreAOut,
      scoreB: scoreBOut,
    },
    skipRemote: true,
  });
  const targetSlug = currentSlug || currentTournamentMeta?.slug || "";
  if (isAdmin && state?.bracket) {
    const progress = computeTournamentProgress(state.bracket);
    if (
      progress?.isFinished &&
      targetSlug &&
      !chatCleanupDone.has(targetSlug)
    ) {
      chatCleanupDone.add(targetSlug);
      void deleteTournamentChatHistory(targetSlug);
    }
  }
  if (targetSlug) {
    void submitMatchScoreRemote(
      {
        slug: targetSlug,
        matchId,
        scoreA,
        scoreB,
        finalize: true,
      },
      showToast,
    ).then((result) => {
      if (result?.updated) return;
      void hydrateStateFromRemote(
        targetSlug,
        applyRosterSeedingWithMode,
        deserializeBracket,
        saveState,
        renderAll,
      );
    });
  }
}

function collectReadyMatchIdsForCurrentUser(snapshot) {
  const out = new Set();
  if (!snapshot?.bracket) return out;

  const lookup = getMatchLookup(snapshot.bracket);
  const playersById = new Map(
    (snapshot?.players || []).map((player) => [player?.id, player]),
  );

  for (const match of getAllMatches(snapshot.bracket)) {
    if (!match?.id) continue;
    if (match.status === "complete") continue;

    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    if (!pA || !pB) continue; // not ready yet

    // Match-ready alerts should only target authenticated participants.
    // Using UID-only checks avoids false positives from display-name matches.
    if (
      isCurrentUserTournamentPlayerByUid(pA) ||
      isCurrentUserTournamentPlayerByUid(pB)
    ) {
      out.add(match.id);
    }
  }
  return out;
}

function resolveOpponentInfoForMatch(snapshot, matchId) {
  const fallback = { name: "TBD", avatarUrl: DEFAULT_PLAYER_AVATAR };
  if (!snapshot?.bracket || !matchId) return fallback;
  const lookup = getMatchLookup(snapshot.bracket);
  const match = lookup.get(matchId);
  if (!match) return fallback;
  const playersById = new Map(
    (snapshot?.players || []).map((player) => [player?.id, player]),
  );
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  if (!pA || !pB) return fallback;
  const isA = isCurrentUserTournamentPlayerByUid(pA);
  const isB = isCurrentUserTournamentPlayerByUid(pB);
  let opponent = null;
  if (isA && !isB) opponent = pB;
  if (isB && !isA) opponent = pA;
  if (!opponent) opponent = pA || pB;
  return {
    name: opponent?.name || "TBD",
    avatarUrl: opponent?.avatarUrl || DEFAULT_PLAYER_AVATAR,
  };
}

function maybeToastMyMatchReady(prevSnapshot, nextSnapshot) {
  if (!nextSnapshot?.isLive) return;
  const prevReady = collectReadyMatchIdsForCurrentUser(prevSnapshot);
  const nextReady = collectReadyMatchIdsForCurrentUser(nextSnapshot);

  // If inspector is already open on that match, don't toast.
  const modal = document.getElementById("matchInfoModal");
  const openMatchId = modal?.classList.contains("is-open")
    ? modal.dataset.matchId || ""
    : "";

  for (const matchId of nextReady) {
    if (prevReady.has(matchId)) continue; // not newly ready
    if (openMatchId === matchId) continue;
    const opponent = resolveOpponentInfoForMatch(nextSnapshot, matchId);

    showMatchReadyToast({
      matchId,
      opponentName: opponent.name,
      opponentAvatarUrl: opponent.avatarUrl,
      message: "Your next match is ready.",
    });
    notifyMatchReadyAlert({
      matchId,
      opponentName: opponent.name,
      tournamentName:
        currentTournamentMeta?.name ||
        nextSnapshot?.name ||
        document.getElementById("tournamentTitle")?.textContent ||
        "Tournament",
    });
  }
}

function normalizePlayerName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function upsertRosterPlayer(players, incoming) {
  if (!incoming) return players;
  const uid = incoming.uid || null;
  const nameKey = normalizePlayerName(incoming.name);
  const idx = players.findIndex((player) => {
    if (uid && player?.uid === uid) return true;
    if (nameKey && normalizePlayerName(player?.name) === nameKey) return true;
    return false;
  });
  if (idx < 0) return [...players, incoming];
  const existing = players[idx] || {};
  const merged = { ...existing, ...incoming, id: existing.id || incoming.id };
  const next = [...players];
  next[idx] = merged;
  return next;
}

function updateRosterById(players, id, patch) {
  if (!id) return players;
  return players.map((player) =>
    player?.id === id ? { ...player, ...(patch || {}) } : player,
  );
}

function updateRosterByUid(players, uid, patch) {
  if (!uid) return players;
  return players.map((player) =>
    player?.uid === uid ? { ...player, ...(patch || {}) } : player,
  );
}

function removeRosterById(players, id) {
  if (!id) return players;
  return players.filter((player) => player?.id !== id);
}

function removeRosterByUid(players, uid) {
  if (!uid) return players;
  return players.filter((player) => player?.uid !== uid);
}

async function updateRosterWithTransaction(updater, patch = {}, options = {}) {
  const slug = currentSlug || currentTournamentMeta?.slug || "";
  const optimisticEnabled = options.optimistic !== false;
  const applyLocal = (players, localPatch = {}) => {
    const snapshot = { ...state, ...patch, ...localPatch, players };
    const mergedPlayers = applyRosterSeedingWithMode(players, snapshot);
    const nextState = {
      ...patch,
      ...localPatch,
      players: mergedPlayers,
    };
    if (typeof localPatch.lastUpdated === "number") {
      nextState.lastUpdated = localPatch.lastUpdated;
    }
    saveState(nextState, {
      skipRemote: true,
      keepTimestamp: typeof localPatch.lastUpdated === "number",
    });
    return mergedPlayers;
  };

  if (optimisticEnabled) {
    const optimistic = updater(state.players || [], state);
    const optimisticPlayers = Array.isArray(optimistic?.players)
      ? optimistic.players
      : Array.isArray(optimistic)
        ? optimistic
        : state.players || [];
    applyLocal(optimisticPlayers);
  }

  if (!slug) return null;

  const result = await updateTournamentRosterRemote(slug, updater, patch);
  if (!result?.players) {
    if (optimisticEnabled) {
      await hydrateStateFromRemote(
        slug,
        applyRosterSeedingWithMode,
        deserializeBracket,
        saveState,
        renderAll,
        state.lastUpdated,
      );
    }
    showToast?.(
      "Roster update failed. Changes may not have been saved.",
      "error",
    );
    return null;
  }
  applyLocal(result.players, { lastUpdated: result.lastUpdated });
  return result;
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
    (snapshot, persistOptions) =>
      persistTournamentStateRemote(
        snapshot,
        currentSlug,
        serializeBracket,
        showToast,
        persistOptions,
      ),
  );
}

function rebuildBracket(force = false, reason = "") {
  const { seededEligible, mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    state,
  );
  setStateObj({ ...state, players: mergedPlayers, needsReseed: false });
  const isRoundRobin = (fmt) =>
    (fmt || "").toLowerCase().includes("round robin");
  const bracket = buildBracket(
    seededEligible,
    currentTournamentMeta || {},
    isRoundRobin,
  );
  saveState(
    {
      players: mergedPlayers,
      bracket,
      needsReseed: false,
      bracketLayoutVersion: CURRENT_BRACKET_LAYOUT_VERSION,
      bracketRepairVersion: CURRENT_BRACKET_LAYOUT_VERSION,
    },
    { skipRoster: true },
  );
  if (reason) addActivity(reason);
  renderAll();
}

function resolveCoverUrlSmall(item = {}) {
  const small = item.coverImageUrlSmall || "";
  if (small) return small;
  const large = item.coverImageUrl || "";
  if (large.includes("/tournamentCovers/") && large.includes("-1200.")) {
    return large.replace("-1200.", "-320.");
  }
  return large;
}

async function renderTournamentList() {
  const listEl = document.getElementById("tournamentList");
  const statTournaments = document.getElementById("statTournaments");
  const statNextStart = document.getElementById("statNextStart");
  const listTitle = document.getElementById("tournamentListTitle");
  const tableHeader = document.querySelector(".tournament-list-table-header");
  const typeFilter =
    document.querySelector("#tournamentTypeTabs .list-tab.active")?.dataset
      .typeFilter || "tournaments";
  const statusFilter =
    document.getElementById("tournamentStatusSelect")?.value || "all";
  const roleFilter =
    document.getElementById("tournamentRoleSelect")?.value || "all";
  const ownerBtn = document.getElementById("tournamentMyFilterBtn");
  const ownerFilterActive = ownerBtn?.classList.contains("active") || false;
  const filterControls = document.getElementById("tournamentFilterControls");
  if (listTitle) {
    listTitle.textContent =
      typeFilter === "circuits" ? "Circuits" : "Tournaments";
  }
  if (tableHeader) {
    tableHeader.innerHTML =
      typeFilter === "circuits"
        ? `
            <span class="tournament-list-header-cell tournament-list-header-title">Circuit</span>
            <span class="tournament-list-header-cell">Host</span>
            <span class="tournament-list-header-cell">Events</span>
            <span class="tournament-list-header-cell">Start</span>
            <span class="tournament-list-header-cell">End</span>
            <span class="tournament-list-header-cell">Status</span>
          `
        : `
            <span class="tournament-list-header-cell tournament-list-header-title">Tournament</span>
            <span class="tournament-list-header-cell">Host</span>
            <span class="tournament-list-header-cell">Format</span>
            <span class="tournament-list-header-cell">Mode</span>
            <span class="tournament-list-header-cell">Start</span>
            <span class="tournament-list-header-cell">Status</span>
            <span class="tournament-list-header-cell">Access</span>
            <span class="tournament-list-header-cell">Progress</span>
          `;
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
  const renderListLoadingState = (label) => {
    if (!listEl) return;
    listEl.innerHTML = DOMPurify.sanitize(`
      <li class="tournament-list-loading" aria-live="polite" aria-busy="true">
        <div class="tournament-list-loading-spinner" aria-hidden="true"></div>
        <div class="tournament-list-loading-text">${escapeHtml(label)}</div>
      </li>
    `);
  };
  const userId = auth?.currentUser?.uid || null;
  const registered = new Set(getRegisteredTournaments());
  if (!listEl) return;
  renderListLoadingState(
    typeFilter === "circuits" ? "Loading circuits..." : "Loading tournaments...",
  );
  try {
    if (typeFilter === "circuits") {
      const now = Date.now();
      const [circuits, tournaments] = await Promise.all([
        loadCircuitRegistry(true),
        loadTournamentRegistry(true),
      ]);
      const tournamentBySlug = new Map(
        (tournaments || []).map((item) => [item.slug || item.id, item]),
      );
      const circuitItems = await Promise.all(
        (circuits || []).map(async (item) => {
          const tournamentSlugs = Array.isArray(item.tournaments)
            ? item.tournaments
                .map((entry) =>
                  typeof entry === "string"
                    ? entry
                    : entry?.slug || entry?.tournamentSlug || "",
                )
                .filter(Boolean)
            : [];
          const relatedTournamentMetas = tournamentSlugs
            .map((slug) => tournamentBySlug.get(slug))
            .filter(Boolean);
          const sortedRelatedMetas = relatedTournamentMetas
            .filter((meta) => Number.isFinite(meta?.startTime))
            .sort((a, b) => a.startTime - b.startTime);
          const earliestMeta = sortedRelatedMetas[0] || null;
          const finalMeta = item.finalTournamentSlug
            ? tournamentBySlug.get(item.finalTournamentSlug)
            : null;
          const coverMeta = finalMeta || earliestMeta || relatedTournamentMetas[0] || null;
          const finalStartTime = Number.isFinite(finalMeta?.startTime)
            ? finalMeta.startTime
            : null;
          const startTime = Number.isFinite(earliestMeta?.startTime)
            ? earliestMeta.startTime
            : null;
          const finalStarted = finalStartTime && finalStartTime <= now;
          const finalFinished =
            finalStarted && item.finalTournamentSlug
              ? await getTournamentFinishedStatus(item.finalTournamentSlug)
              : false;
          let circuitStatusLabel = "Planning";
          let circuitStatusClass = "status-tbd";
          if (finalFinished) {
            circuitStatusLabel = "Finished";
            circuitStatusClass = "status-finished";
          } else if (finalStarted) {
            circuitStatusLabel = "Live";
            circuitStatusClass = "status-started";
          } else if (finalStartTime) {
            circuitStatusLabel = "Scheduled";
            circuitStatusClass = "status-upcoming";
          }
          return {
            ...item,
            type: "circuit",
            finalMeta,
            finalStartTime,
            startTime,
            coverImageUrl: coverMeta ? resolveCoverUrlSmall(coverMeta) : "",
            circuitStatusLabel,
            circuitStatusClass,
          };
        }),
      );
      circuitItems.sort((a, b) => {
        const aTime = Number.isFinite(a.startTime)
          ? a.startTime
          : Number.MAX_SAFE_INTEGER;
        const bTime = Number.isFinite(b.startTime)
          ? b.startTime
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime || String(a.name || "").localeCompare(String(b.name || ""));
      });
      if (!circuitItems.length) {
        listEl.innerHTML = `<li class="muted">No circuits found.</li>`;
        setTournamentListItems([], { mode: "circuits" });
      } else {
        setTournamentListItems(circuitItems, {
          mode: "circuits",
          renderItem: (item, targetList) => {
            const li = document.createElement("li");
            li.className =
              "tournament-card tournament-list-row circuit-card circuit-list-row";
            const tournamentCount = item.tournaments?.length || 0;
            const hostName = escapeHtml(item.createdByName || "Unknown");
            const coverUrl = sanitizeUrl(item.coverImageUrl || "");
            const startLabel = item.startTime
              ? new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(item.startTime))
              : "TBD";
            const endLabel = item.finalStartTime
              ? new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(item.finalStartTime))
              : "TBD";
            li.innerHTML = DOMPurify.sanitize(`
              <div class="card-cover${coverUrl ? " has-image" : ""}"${
                coverUrl
                  ? ` style="background-image:url('${escapeHtml(coverUrl)}')"`
                  : ""
              }>
              </div>
              <div class="content-stack circuit-list-row-grid">
                <div class="tournament-list-cell tournament-list-cell-title">
                  <h4 title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h4>
                </div>
                <div class="tournament-list-cell tournament-list-cell-host">
                  <span class="tournament-data-value" translate="no">${hostName}</span>
                </div>
                <div class="tournament-list-cell circuit-list-cell-events">
                  <span class="tournament-data-value">${escapeHtml(
                    `${tournamentCount} event${tournamentCount === 1 ? "" : "s"}`,
                  )}</span>
                </div>
                <div class="tournament-list-cell circuit-list-cell-start">
                  <span class="tournament-data-value">${escapeHtml(startLabel)}</span>
                </div>
                <div class="tournament-list-cell circuit-list-cell-end">
                  <span class="tournament-data-value">${escapeHtml(endLabel)}</span>
                </div>
                <div class="tournament-list-cell circuit-list-cell-status">
                  <div class="tournament-list-row-chips">
                    <span class="status-chip ${escapeHtml(
                      item.circuitStatusClass,
                    )}">${escapeHtml(item.circuitStatusLabel)}</span>
                  </div>
                </div>
              </div>
            `);
            li.addEventListener("click", () => enterCircuit(item.slug));
            targetList.appendChild(li);
          },
        });
      }
      if (statTournaments)
        statTournaments.textContent = String(circuitItems.length);
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
        filtered = filtered.filter(
          (item) =>
            item.createdBy === userId || registered.has(item.slug || item.id),
        );
      }
    }
    if (roleFilter === "hosting") {
      filtered = filtered.filter((item) => userId && item.createdBy === userId);
    } else if (roleFilter === "registered") {
      filtered = filtered.filter((item) =>
        registered.has(item.slug || item.id),
      );
    } else if (roleFilter === "casting") {
      if (!userId) {
        filtered = [];
      } else {
        const checks = await Promise.all(
          filtered.map(async (item) => ({
            item,
            isCaster: await isCasterForTournament(item.slug, userId),
          })),
        );
        filtered = checks.filter((row) => row.isCaster).map((row) => row.item);
      }
    }

    if (!ownerFilterActive && roleFilter === "all") {
      filtered = filtered.filter(
        (item) => normalizeTournamentVisibility(item.visibility) !== "private",
      );
    }

    const now = Date.now();
    if (statusFilter === "upcoming") {
      filtered = filtered.filter(
        (item) => item.startTime && item.startTime > now,
      );
    } else if (statusFilter === "live" || statusFilter === "finished") {
      const candidates = filtered.filter(
        (item) => item.startTime && item.startTime <= now,
      );
      const checks = await Promise.all(
        candidates.map(async (item) => ({
          item,
          finished: await getTournamentFinishedStatus(item.slug),
        })),
      );
      filtered = checks
        .filter((row) =>
          statusFilter === "finished" ? row.finished : !row.finished,
        )
        .map((row) => row.item);
    }

    const rowsWithStatus = await Promise.all(
      filtered.map(async (item) => {
        const hasStarted = item.startTime && item.startTime <= now;
        return {
          item,
          finished: hasStarted
            ? await getTournamentFinishedStatus(item.slug)
            : false,
        };
      }),
    );
    const rankTournamentRow = (row) => {
      const startTime = Number.isFinite(row.item?.startTime) ? row.item.startTime : null;
      if (row.finished) return 2;
      if (startTime && startTime <= now) return 0;
      if (startTime && startTime > now) return 1;
      return 3;
    };
    const sorted = rowsWithStatus
      .sort((a, b) => {
        const rankDiff = rankTournamentRow(a) - rankTournamentRow(b);
        if (rankDiff !== 0) return rankDiff;
        const aTime = Number.isFinite(a.item?.startTime) ? a.item.startTime : 0;
        const bTime = Number.isFinite(b.item?.startTime) ? b.item.startTime : 0;
        if (rankTournamentRow(a) === 2) return bTime - aTime;
        return aTime - bTime;
      })
      .map((row) => row.item);
    const listItems = sorted.map((item) => ({ ...item, type: "tournament" }));

    if (!listItems.length) {
      listEl.innerHTML = `<li class="muted">No tournaments found.</li>`;
      setTournamentListItems([], {
        mode: `${statusFilter}-${roleFilter}-${
          ownerFilterActive ? "mine" : "all"
        }`,
      });
    } else {
      setTournamentListItems(listItems, {
        mode: `${statusFilter}-${roleFilter}-${
          ownerFilterActive ? "mine" : "all"
        }`,
        onPageRender: (targetList) => {
          const targets = Array.from(
            targetList.querySelectorAll(".tournament-progress"),
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
          li.className = "tournament-card tournament-list-row";
          li.dataset.slug = item.slug;
          const startLabel = item.startTime
            ? new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(item.startTime))
            : "TBD";
          const coverUrl = sanitizeUrl(resolveCoverUrlSmall(item));
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
          const accessClass = item.isInviteOnly
            ? "status-closed"
            : "status-open";
          const overlayChip = `<span class="status-chip ${statusClass} status-chip-overlay">${statusLabel}</span>`;
          const accessChip = `<span class="status-chip ${accessClass} status-chip-access">${accessLabel}</span>`;
          const formatLabel = item.format || "Tournament";
          const modeLabel = item.mode || "1v1";
          li.innerHTML = DOMPurify.sanitize(`
            <div class="card-cover${coverUrl ? " has-image" : ""}"${
              coverUrl
                ? ` style="background-image:url('${escapeHtml(coverUrl)}')"`
                : ""
            }>
            </div>
            <div class="content-stack tournament-list-row-grid">
              <div class="tournament-list-cell tournament-list-cell-title">
                <h4 title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h4>
              </div>
              <div class="tournament-list-cell tournament-list-cell-host">
                <span class="tournament-data-value" translate="no">${escapeHtml(
                  item.createdByName || "Unknown",
                )}</span>
              </div>
              <div class="tournament-list-cell tournament-list-cell-format">
                <span class="tournament-data-subtle">${escapeHtml(formatLabel)}</span>
              </div>
              <div class="tournament-list-cell tournament-list-cell-mode">
                <span class="mode-chip">${escapeHtml(modeLabel)}</span>
              </div>
              <div class="tournament-list-cell tournament-list-cell-start">
                <span class="tournament-data-value">${escapeHtml(startLabel)}</span>
              </div>
              <div class="tournament-list-cell tournament-list-cell-status">
                <div class="tournament-list-row-chips">
                  ${overlayChip}
                </div>
              </div>
              <div class="tournament-list-cell tournament-list-cell-access">
                <div class="tournament-list-row-chips">
                  ${accessChip}
                </div>
              </div>
              <div class="tournament-list-cell tournament-list-cell-progress">
                <div class="tournament-progress" data-slug="${escapeHtml(
                  item.slug,
                )}">
                  <span class="progress-label">Progress</span>
                  <div class="progress-track">
                    <div class="progress-fill" style="width:0%"></div>
                  </div>
                  <div class="progress-meta">Loading progress…</div>
                </div>
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
  let matches = getAllMatches(bracket);
  const lookup = getMatchLookup(bracket);
  if (bracket.finalsReset && !shouldCountFinalReset(bracket, lookup)) {
    matches = matches.filter((match) => match?.id !== bracket.finalsReset?.id);
  }
  if (!matches.length) return null;
  let completed = 0;
  const isWalkoverScore = (value) => {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "w" || normalized === "wo" || normalized === "w/o";
  };
  const isMatchComplete = (match) => {
    if (!match) return false;
    if (match.status === "complete" || match.winnerId || match.walkover) {
      return true;
    }
    const aRaw = match?.scores?.[0];
    const bRaw = match?.scores?.[1];
    if (isWalkoverScore(aRaw) || isWalkoverScore(bRaw)) return true;
    const a = Number(aRaw);
    const b = Number(bRaw);
    const validA = Number.isFinite(a) ? a : 0;
    const validB = Number.isFinite(b) ? b : 0;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return false;
    const bestOf = getBestOfForMatch(match) || 1;
    const needed = Math.max(1, Math.ceil(bestOf / 2));
    return Math.max(validA, validB) >= needed;
  };
  matches.forEach((match) => {
    if (isMatchComplete(match)) {
      completed += 1;
    }
  });
  const percent = Math.round((completed / matches.length) * 100);
  const finalsComplete = isMatchComplete(bracket.finals);
  const resetActive = isFinalResetActive(bracket, lookup);
  const finalsResetComplete = isMatchComplete(bracket.finalsReset);
  let winnersFinalComplete = false;
  const winners = Array.isArray(bracket.winners) ? bracket.winners : [];
  if (winners.length) {
    const lastRound = winners[winners.length - 1] || [];
    const finalMatch = lastRound[0];
    winnersFinalComplete = isMatchComplete(finalMatch);
  }
  const groups = Array.isArray(bracket.groups) ? bracket.groups : [];
  const hasPlayoffs =
    winners.flat().length ||
    (Array.isArray(bracket.losers) ? bracket.losers.flat().length : 0) ||
    bracket.finals;
  let groupsComplete = false;
  if (groups.length && !hasPlayoffs) {
    const groupMatches = groups.flatMap((group) => group?.matches || []);
    groupsComplete =
      groupMatches.length > 0 && groupMatches.every(isMatchComplete);
  }
  const isFinished =
    (resetActive ? finalsResetComplete : finalsComplete) ||
    winnersFinalComplete ||
    groupsComplete ||
    completed === matches.length;
  return {
    completed,
    total: matches.length,
    percent,
    isFinished,
  };
}

const tournamentStateCache = new Map();
const TOURNAMENT_PROGRESS_TTL_MS = 30000;

async function getTournamentStateCached(
  slug,
  { maxAgeMs = TOURNAMENT_PROGRESS_TTL_MS } = {},
) {
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
          statusChip.classList.remove(
            "status-upcoming",
            "status-started",
            "status-tbd",
          );
          statusChip.classList.add("status-finished");
        }
      } catch (err) {
        console.warn("Failed to load progress", err);
      }
    }),
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
  await loadMapCatalog();
  clearCreateCustomMapsDraft();
  setMapPoolSelection(getDefaultMapPoolNames("1v1"));
  renderCustomMapSections();
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
  const modeSelect = document.getElementById("tournamentModeSelect");
  const checkInSelect = document.getElementById("checkInSelect");
  const accessSelect = document.getElementById("tournamentAccessSelect");
  const visibilitySelect = document.getElementById(
    "tournamentVisibilitySelect",
  );
  const templateSelect = document.getElementById("tournamentTemplateSelect");
  const templateNameInput = document.getElementById(
    "tournamentTemplateNameInput",
  );
  if (imageInput) imageInput.value = "";
  if (imagePreview) {
    imagePreview.removeAttribute("src");
    imagePreview.style.display = "none";
    delete imagePreview.dataset.tempPreview;
    delete imagePreview.dataset.reuseUrl;
    delete imagePreview.dataset.clearCover;
  }
  if (checkInSelect) checkInSelect.value = "0";
  if (modeSelect) modeSelect.value = "1v1";
  if (accessSelect) accessSelect.value = "open";
  if (visibilitySelect) visibilitySelect.value = "public";
  if (templateSelect) templateSelect.value = "";
  if (templateNameInput) {
    templateNameInput.value = "";
    delete templateNameInput.dataset.templateId;
  }
  const bestOfUpperInput = document.getElementById("bestOfUpperInput");
  const bestOfLowerInput = document.getElementById("bestOfLowerInput");
  const bestOfLowerSemiInput = document.getElementById("bestOfLowerSemiInput");
  const bestOfLowerFinalInput = document.getElementById(
    "bestOfLowerFinalInput",
  );
  const bestOfQuarterInput = document.getElementById("bestOfQuarterInput");
  const bestOfSemiInput = document.getElementById("bestOfSemiInput");
  const bestOfUpperFinalInput = document.getElementById(
    "bestOfUpperFinalInput",
  );
  const bestOfFinalInput = document.getElementById("bestOfFinalInput");
  const grandFinalResetToggle = document.getElementById(
    "grandFinalResetToggle",
  );
  if (bestOfUpperInput) bestOfUpperInput.value = String(defaultBestOf.upper);
  if (bestOfLowerInput) bestOfLowerInput.value = String(defaultBestOf.lower);
  if (bestOfLowerSemiInput)
    bestOfLowerSemiInput.value = String(defaultBestOf.lowerSemi);
  if (bestOfLowerFinalInput)
    bestOfLowerFinalInput.value = String(defaultBestOf.lowerFinal);
  if (bestOfQuarterInput)
    bestOfQuarterInput.value = String(defaultBestOf.quarter);
  if (bestOfSemiInput) bestOfSemiInput.value = String(defaultBestOf.semi);
  if (bestOfUpperFinalInput) {
    bestOfUpperFinalInput.value = String(defaultBestOf.upperFinal);
  }
  if (bestOfFinalInput) bestOfFinalInput.value = String(defaultBestOf.final);
  if (grandFinalResetToggle) grandFinalResetToggle.checked = false;
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
  const nameInput = document.getElementById("circuitSettingsNameInput");
  const slugInput = document.getElementById("circuitSettingsSlugInput");
  const descriptionInput = document.getElementById(
    "circuitSettingsDescriptionInput",
  );
  const finalNameInput = document.getElementById("circuitFinalNameInput");
  const finalSlugInput = document.getElementById("circuitFinalSlugInput");
  const finalVisibilitySelect = document.getElementById(
    "circuitFinalVisibilitySelect",
  );
  const finalAccessSelect = document.getElementById("circuitFinalAccessSelect");
  const finalStartInput = document.getElementById("circuitFinalStartInput");
  const finalMaxPlayersInput = document.getElementById(
    "circuitFinalMaxPlayersInput",
  );
  const finalQualifyInput = document.getElementById(
    "circuitFinalQualifyCountInput",
  );
  const finalCheckInSelect = document.getElementById(
    "circuitFinalCheckInSelect",
  );
  const finalDescriptionInput = document.getElementById(
    "circuitFinalDescriptionInput",
  );
  const finalRulesInput = document.getElementById("circuitFinalRulesInput");
  const finalFormatSelect = document.getElementById("circuitFinalFormatSelect");
  const finalGrandFinalResetToggle = document.getElementById(
    "circuitFinalGrandFinalResetToggle",
  );
  const finalImagePreview = document.getElementById("circuitFinalImagePreview");
  const sponsorsList = document.getElementById("circuitFinalSponsorsList");
  const socialsList = document.getElementById("circuitFinalSocialsList");
  if (toggle) toggle.checked = Boolean(currentCircuitMeta?.sortByFirstPlace);
  if (nameInput) nameInput.value = currentCircuitMeta?.name || "";
  if (slugInput) slugInput.value = currentCircuitMeta?.slug || "";
  if (descriptionInput)
    descriptionInput.value = currentCircuitMeta?.description || "";
  if (finalVisibilitySelect) finalVisibilitySelect.value = "public";
  if (finalAccessSelect) finalAccessSelect.value = "open";
  const finalSlug = currentCircuitMeta?.finalTournamentSlug || "";
  if (finalSlugInput) finalSlugInput.value = finalSlug;
  if (modal) {
    modal.style.display = "flex";
    lockBodyScroll();
  }
  if (sponsorsList) {
    renderCircuitFinalSponsors([]);
  }
  if (socialsList) {
    renderCircuitFinalSocials([]);
  }
  bindCircuitFinalSponsorControls();
  bindCircuitFinalSocialControls();
  if (!finalSlug) return;
  getDoc(doc(collection(db, TOURNAMENT_COLLECTION), finalSlug))
    .then((snap) => {
      if (!snap.exists()) return;
      const meta = snap.data() || {};
      if (finalNameInput) finalNameInput.value = meta.name || "";
      if (finalVisibilitySelect) {
        finalVisibilitySelect.value = normalizeTournamentVisibility(
          meta.visibility,
        );
      }
      if (finalAccessSelect) {
        finalAccessSelect.value = meta.isInviteOnly ? "closed" : "open";
      }
      if (finalStartInput && meta.startTime) {
        try {
          finalStartInput.value = formatLocalDateTimeInput(meta.startTime);
          if (finalStartInput._flatpickr) {
            finalStartInput._flatpickr.setDate(new Date(meta.startTime), false);
          }
        } catch (_) {
          // ignore
        }
      }
      if (finalMaxPlayersInput && meta.maxPlayers) {
        finalMaxPlayersInput.value = String(meta.maxPlayers);
      }
      if (finalQualifyInput && Number.isFinite(meta.circuitQualifyCount)) {
        finalQualifyInput.value = String(meta.circuitQualifyCount);
      }
      if (finalCheckInSelect) {
        finalCheckInSelect.value = String(meta.checkInWindowMinutes || 0);
      }
      if (finalDescriptionInput)
        finalDescriptionInput.value = meta.description || "";
      if (finalRulesInput) finalRulesInput.value = meta.rules || "";
      syncQuillById?.(
        "circuitFinalDescriptionInput",
        finalDescriptionInput?.value || "",
      );
      syncQuillById?.("circuitFinalRulesInput", finalRulesInput?.value || "");
      if (finalFormatSelect) {
        finalFormatSelect.value = meta.format || "Double Elimination";
        syncFormatFieldVisibility("circuitfinal");
      }
      const rr = meta.roundRobin || defaultRoundRobinSettings;
      const rrGroups = document.getElementById(
        "circuitFinalRoundRobinGroupsInput",
      );
      const rrAdvance = document.getElementById(
        "circuitFinalRoundRobinAdvanceInput",
      );
      const rrPlayoffs = document.getElementById(
        "circuitFinalRoundRobinPlayoffsSelect",
      );
      const rrBestOf = document.getElementById(
        "circuitFinalRoundRobinBestOfInput",
      );
      if (rrGroups)
        rrGroups.value = String(rr.groups ?? defaultRoundRobinSettings.groups);
      if (rrAdvance)
        rrAdvance.value = String(
          rr.advancePerGroup ?? defaultRoundRobinSettings.advancePerGroup,
        );
      if (rrPlayoffs)
        rrPlayoffs.value = rr.playoffs || defaultRoundRobinSettings.playoffs;
      if (rrBestOf)
        rrBestOf.value = String(rr.bestOf ?? defaultRoundRobinSettings.bestOf);
      if (finalImagePreview) {
        if (finalImagePreview.dataset.tempPreview) {
          try {
            URL.revokeObjectURL(finalImagePreview.dataset.tempPreview);
          } catch (_) {}
        }
        finalImagePreview.src = meta.coverImageUrl || "";
        finalImagePreview.style.display = meta.coverImageUrl ? "block" : "none";
        delete finalImagePreview.dataset.tempPreview;
        delete finalImagePreview.dataset.reuseUrl;
        delete finalImagePreview.dataset.clearCover;
      }
      setCircuitFinalMapPoolSelection(
        Array.isArray(meta.mapPool) && meta.mapPool.length
          ? meta.mapPool
          : getDefaultMapPoolNames(),
      );
      const bestOf = meta.bestOf || defaultBestOf;
      const assignBestOf = (id, value) => {
        const input = document.getElementById(id);
        if (input && value) input.value = String(value);
      };
      assignBestOf("circuitFinalBestOfUpperInput", bestOf.upper);
      assignBestOf("circuitFinalBestOfLowerInput", bestOf.lower);
      assignBestOf("circuitFinalBestOfLowerSemiInput", bestOf.lowerSemi);
      assignBestOf("circuitFinalBestOfLowerFinalInput", bestOf.lowerFinal);
      assignBestOf("circuitFinalBestOfQuarterInput", bestOf.quarter);
      assignBestOf("circuitFinalBestOfSemiInput", bestOf.semi);
      assignBestOf("circuitFinalBestOfUpperFinalInput", bestOf.upperFinal);
      assignBestOf("circuitFinalBestOfFinalInput", bestOf.final);
      const circuitFinalResetToggle = document.getElementById(
        "circuitFinalGrandFinalResetToggle",
      );
      if (circuitFinalResetToggle) {
        circuitFinalResetToggle.checked = Boolean(meta.grandFinalReset);
      }
      renderCircuitFinalSponsors(meta.sponsors || []);
      renderCircuitFinalSocials(meta.socials || []);
    })
    .catch(() => {});
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
  const nameInput = document.getElementById("circuitSettingsNameInput");
  const descriptionInput = document.getElementById(
    "circuitSettingsDescriptionInput",
  );
  const finalNameInput = document.getElementById("circuitFinalNameInput");
  const finalSlugInput = document.getElementById("circuitFinalSlugInput");
  const finalVisibilitySelect = document.getElementById(
    "circuitFinalVisibilitySelect",
  );
  const finalAccessSelect = document.getElementById("circuitFinalAccessSelect");
  const finalStartInput = document.getElementById("circuitFinalStartInput");
  const finalMaxPlayersInput = document.getElementById(
    "circuitFinalMaxPlayersInput",
  );
  const finalQualifyInput = document.getElementById(
    "circuitFinalQualifyCountInput",
  );
  const finalCheckInSelect = document.getElementById(
    "circuitFinalCheckInSelect",
  );
  const finalDescriptionInput = document.getElementById(
    "circuitFinalDescriptionInput",
  );
  const finalRulesInput = document.getElementById("circuitFinalRulesInput");
  const finalFormatSelect = document.getElementById("circuitFinalFormatSelect");
  const finalImageInput = document.getElementById("circuitFinalImageInput");
  const finalImagePreview = document.getElementById("circuitFinalImagePreview");
  const sponsors = readCircuitFinalSponsors();
  const socials = readCircuitFinalSocials();
  const sortByFirstPlace = Boolean(toggle?.checked);
  const circuitName = (nameInput?.value || "").trim();
  const circuitDescription = descriptionInput?.value || "";
  try {
    await setDoc(
      doc(collection(db, CIRCUIT_COLLECTION), currentCircuitMeta.slug),
      {
        sortByFirstPlace,
        name: circuitName || currentCircuitMeta?.name || "",
        description: circuitDescription,
      },
      { merge: true },
    );
    currentCircuitMeta = {
      ...currentCircuitMeta,
      sortByFirstPlace,
      name: circuitName || currentCircuitMeta?.name || "",
      description: circuitDescription,
    };
    const finalSlug = (finalSlugInput?.value || "").trim();
    if (finalSlug) {
      const finalVisibility = normalizeTournamentVisibility(
        finalVisibilitySelect?.value,
      );
      const finalAccess = normalizeTournamentAccess(finalAccessSelect?.value);
      const finalStartTime = finalStartInput?.value
        ? new Date(finalStartInput.value)
        : null;
      const finalMaxPlayers = normalizeMaxPlayersForFormat(
        finalMaxPlayersInput?.value,
        finalFormatSelect?.value || "Double Elimination",
        finalMaxPlayersInput,
      );
      if (finalMaxPlayersInput && Number.isFinite(finalMaxPlayers)) {
        finalMaxPlayersInput.value = String(finalMaxPlayers);
      }
      const finalQualifyRaw = finalQualifyInput?.value ?? "";
      const finalQualifyCount =
        finalQualifyRaw === "" ||
        finalQualifyRaw === null ||
        finalQualifyRaw === undefined
          ? null
          : Number(finalQualifyRaw);
      const finalPayload = buildFinalTournamentPayload({
        slug: finalSlug,
        name: (finalNameInput?.value || "").trim() || "Circuit Finals",
        description: finalDescriptionInput?.value || "",
        rules: finalRulesInput?.value || "",
        format: (finalFormatSelect?.value || "Double Elimination").trim(),
        grandFinalReset:
          allowGrandFinalReset(
            finalFormatSelect?.value || "Double Elimination",
            extractRoundRobinSettingsUI("circuitfinal", defaultRoundRobinSettings),
          ) && Boolean(finalGrandFinalResetToggle?.checked),
        maxPlayers: finalMaxPlayers,
        startTime: finalStartTime,
        checkInWindowMinutes: getCheckInWindowMinutes(finalCheckInSelect),
        isInviteOnly: finalAccess === "closed",
        visibility: finalVisibility,
        mapPool: getCircuitFinalMapPoolSelection(),
        createdBy: auth.currentUser?.uid || null,
        createdByName: getCurrentUsername() || "Unknown host",
        roundRobin: extractRoundRobinSettingsUI(
          "circuitfinal",
          defaultRoundRobinSettings,
        ),
        bestOf: readBestOf("circuitfinal", defaultBestOf),
        circuitSlug: currentCircuitMeta.slug,
        circuitQualifyCount: finalQualifyCount,
      });
      const processedSponsors = [];
      for (const sponsor of sponsors) {
        if (!sponsor) continue;
        let imageUrl = sponsor.imageUrl || "";
        if (sponsor.file) {
          try {
            imageUrl = await uploadSponsorLogo(sponsor.file, finalSlug);
          } catch (err) {
            showToast?.(
              err?.message || "Failed to upload sponsor logo.",
              "error",
            );
            return;
          }
        }
        const entry = normalizeSponsorEntry(
          { name: sponsor.name, imageUrl, linkUrl: sponsor.linkUrl },
          { allowEmpty: false },
        );
        if (entry) processedSponsors.push(entry);
      }
      finalPayload.sponsors = processedSponsors;
      const processedSocials = socials
        .map((entry) =>
          normalizeSocialEntry(
            { type: entry.type, label: entry.label, url: entry.url },
            { allowEmpty: false },
          ),
        )
        .filter(Boolean);
      for (const entry of processedSocials) {
        const error = validateSocialUrl(entry.type, entry.url);
        if (error) {
          showToast?.(
            `Invalid ${getSocialLabelForType(entry.type)} URL. ${error}`,
            "error",
          );
          return;
        }
      }
      finalPayload.socials = processedSocials;
      const finalTournamentRef = doc(collection(db, TOURNAMENT_COLLECTION), finalSlug);
      try {
        const existingFinalSnap = await getDoc(finalTournamentRef);
        if (existingFinalSnap.exists()) {
          const existingFinal = existingFinalSnap.data() || {};
          if (existingFinal.createdBy) {
            finalPayload.createdBy = existingFinal.createdBy;
          }
          if (existingFinal.createdByName) {
            finalPayload.createdByName = existingFinal.createdByName;
          }
          if (existingFinal.circuitSlug) {
            finalPayload.circuitSlug = existingFinal.circuitSlug;
          }
          // Keep existing tournament admin ownership untouched for non-host updates.
          delete finalPayload.admins;
          delete finalPayload.adminUids;
        }
      } catch (err) {
        console.warn("Failed to load existing final tournament metadata", err);
      }
      await setDoc(
        finalTournamentRef,
        finalPayload,
        { merge: true },
      );
      const imageFile = finalImageInput?.files?.[0] || null;
      const reuseUrl = finalImagePreview?.dataset?.reuseUrl || "";
      const clearCover = finalImagePreview?.dataset?.clearCover === "true";
      if (imageFile) {
        try {
          const uploaded = await uploadTournamentCover(imageFile, finalSlug);
          finalPayload.coverImageUrl = uploaded.coverImageUrl;
          finalPayload.coverImageUrlSmall = uploaded.coverImageUrlSmall;
          await setDoc(
            finalTournamentRef,
            {
              coverImageUrl: uploaded.coverImageUrl,
              coverImageUrlSmall: uploaded.coverImageUrlSmall,
            },
            { merge: true },
          );
        } catch (err) {
          showToast?.(err?.message || "Failed to upload cover image.", "error");
        }
      } else if (reuseUrl) {
        try {
          await setDoc(
            finalTournamentRef,
            { coverImageUrl: reuseUrl, coverImageUrlSmall: "" },
            { merge: true },
          );
        } catch (err) {
          console.error("Failed to reuse cover image", err);
        }
      } else if (clearCover) {
        try {
          await setDoc(
            finalTournamentRef,
            { coverImageUrl: "", coverImageUrlSmall: "" },
            { merge: true },
          );
        } catch (err) {
          console.error("Failed to clear cover image", err);
        }
      }
    }
    await renderCircuitLeaderboard(
      currentCircuitMeta,
      normalizeCircuitTournamentSlugs(currentCircuitMeta),
      { showEdit: isCircuitAdmin },
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

async function getTournamentCoverUrlsForDelete(slug) {
  if (!slug) return "";
  if (currentTournamentMeta?.slug === slug) {
    return {
      coverImageUrl: currentTournamentMeta?.coverImageUrl || "",
      coverImageUrlSmall: currentTournamentMeta?.coverImageUrlSmall || "",
    };
  }
  try {
    const tournamentSnap = await getDoc(
      doc(collection(db, TOURNAMENT_COLLECTION), slug),
    );
    if (!tournamentSnap.exists()) {
      return { coverImageUrl: "", coverImageUrlSmall: "" };
    }
    const data = tournamentSnap.data() || {};
    return {
      coverImageUrl: data.coverImageUrl || "",
      coverImageUrlSmall: data.coverImageUrlSmall || "",
    };
  } catch (err) {
    console.warn("Failed to load tournament cover image", err);
    return { coverImageUrl: "", coverImageUrlSmall: "" };
  }
}

async function deleteTournamentBundle(
  slug,
  { coverImageUrl = "", coverImageUrlSmall = "" } = {},
) {
  if (!slug) return;
  await deleteTournamentChatHistory(slug);
  await deleteTournamentPresence(slug);
  await deleteTournamentInviteLinks(slug);
  if (coverImageUrl) {
    await deleteTournamentCoverByUrl(coverImageUrl, slug);
  }
  if (coverImageUrlSmall) {
    await deleteTournamentCoverByUrl(coverImageUrlSmall, slug);
  }
  await deleteTournamentCoverFolder(slug);
  await deleteDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
  await deleteDoc(doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug));
  await deleteTournamentSponsorFolder(slug);
  await deleteTournamentMapFolder(slug);
  try {
    localStorage.removeItem(getPersistStorageKey(slug));
  } catch (_) {
    // ignore
  }
}

async function confirmDeleteTournament() {
  const modal = document.getElementById("confirmDeleteTournamentModal");
  if (!modal?.dataset.slug) return;
  const slug = modal.dataset.slug;
  const circuitSlug =
    modal.dataset.circuitSlug || currentTournamentMeta?.circuitSlug || "";
  try {
    const coverUrls = await getTournamentCoverUrlsForDelete(slug);
    await deleteTournamentBundle(slug, coverUrls);
    if (circuitSlug) {
      const updates = { tournaments: arrayRemove(slug) };
      if (currentCircuitMeta?.finalTournamentSlug === slug) {
        updates.finalTournamentSlug = "";
      }
      await setDoc(
        doc(collection(db, CIRCUIT_COLLECTION), circuitSlug),
        updates,
        {
          merge: true,
        },
      );
      if (currentCircuitMeta?.slug === circuitSlug) {
        currentCircuitMeta = {
          ...currentCircuitMeta,
          tournaments: (currentCircuitMeta.tournaments || []).filter(
            (t) => t !== slug,
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
    const redirectTarget = circuitSlug
      ? `/tournament/${circuitSlug}`
      : "/tournament/";
    if (typeof window !== "undefined") {
      window.location.href = redirectTarget;
    }
  } catch (err) {
    console.error("Failed to delete tournament", err);
    showToast?.("Failed to delete tournament.", "error");
  }
}

function openDeleteCircuitModal() {
  if (!currentCircuitMeta?.slug || !isCircuitAdmin) return;
  const modal = document.getElementById("confirmDeleteCircuitModal");
  const message = document.getElementById("confirmDeleteCircuitMessage");
  const circuitSlug = currentCircuitMeta.slug;
  if (modal) {
    modal.dataset.slug = circuitSlug;
    const tournamentSlugs = normalizeCircuitTournamentSlugs(currentCircuitMeta);
    const count = tournamentSlugs.length;
    if (message) {
      message.textContent = `Are you sure you want to delete "${circuitSlug}"? This will delete ${count} tournament${
        count === 1 ? "" : "s"
      } and all related data.`;
    }
    modal.style.display = "flex";
    lockBodyScroll();
  }
}

function closeDeleteCircuitModal() {
  const modal = document.getElementById("confirmDeleteCircuitModal");
  if (!modal) return;
  delete modal.dataset.slug;
  modal.style.display = "none";
  const settingsModal = document.getElementById("circuitSettingsModal");
  if (!settingsModal || settingsModal.style.display !== "flex") {
    unlockBodyScroll();
  }
}

async function confirmDeleteCircuit() {
  const modal = document.getElementById("confirmDeleteCircuitModal");
  const circuitSlug = modal?.dataset.slug || currentCircuitMeta?.slug || "";
  if (!circuitSlug) return;
  try {
    const meta =
      currentCircuitMeta?.slug === circuitSlug
        ? currentCircuitMeta
        : await fetchCircuitMeta(circuitSlug);
    const tournamentSlugs = normalizeCircuitTournamentSlugs(meta || {});
    for (const slug of tournamentSlugs) {
      const coverUrls = await getTournamentCoverUrlsForDelete(slug);
      await deleteTournamentBundle(slug, coverUrls);
    }
    await deleteDoc(doc(collection(db, CIRCUIT_COLLECTION), circuitSlug));
    if (currentCircuitMeta?.slug === circuitSlug) {
      currentCircuitMeta = null;
      isCircuitAdmin = false;
      updateCircuitAdminVisibility();
    }
    showToast?.("Circuit deleted.", "success");
    closeDeleteCircuitModal();
    closeCircuitSettingsModal();
    if (typeof window !== "undefined") {
      window.location.href = "/tournament/";
    }
  } catch (err) {
    console.error("Failed to delete circuit", err);
    showToast?.("Failed to delete circuit.", "error");
  }
}

let enterCircuit = async () => {};
const {
  getRouteFromPath,
  handleRouteChange,
  enterTournament,
  showLanding,
} = createTournamentController({
  db,
  TOURNAMENT_COLLECTION,
  setCurrentSlugState,
  loadLocalState,
  applyRosterSeedingWithMode,
  deserializeBracket,
  setStateObj,
  getDoc,
  doc,
  collection,
  setCurrentTournamentMetaState,
  refreshInviteLinkGate,
  recomputeAdminFromMeta,
  refreshInviteLinksPanel,
  hydrateStateFromRemote,
  saveState,
  renderAll,
  refreshPlayerDetailModalIfOpen,
  getPlayersMap,
  getState: () => state,
  subscribeTournamentStateRemote,
  setCurrentCircuitMeta: (next) => {
    currentCircuitMeta = next;
  },
  setIsCircuitAdmin: (next) => {
    isCircuitAdmin = next;
  },
  updateCircuitAdminVisibility: () => updateCircuitAdminVisibility(),
  logAnalyticsEvent,
  switchTab,
  setIsAdminState,
  updateAdminVisibility,
  getUnsubscribeRemoteState: () => unsubscribeRemoteState,
  setUnsubscribeRemoteState: (next) => {
    unsubscribeRemoteState = next;
  },
  fetchCircuitMeta,
  getEnterCircuit: () => enterCircuit,
});

const circuitPageHandlers = createCircuitPageHandlers({
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
enterCircuit = circuitPageHandlers.enterCircuit;

const {
  refreshCircuitView,
  updateCircuitAdminVisibility,
  recomputeCircuitAdminFromMeta,
} = circuitPageHandlers;

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.style.display = message ? "block" : "none";
  el.classList.toggle("error", !!isError);
  el.classList.toggle("status-ok", !isError);
}

function setRegisterLoadingState(isLoading) {
  const registerBtn = document.getElementById("registerBtn");
  if (!registerBtn) return;
  const current = Number(registerBtn.dataset.loadingCount || "0");
  const next = Math.max(0, current + (isLoading ? 1 : -1));
  registerBtn.dataset.loadingCount = String(next);
  registerBtn.classList.toggle("is-loading", next > 0);
  if (next > 0) {
    if (registerBtn.dataset.prevDisabled === undefined) {
      registerBtn.dataset.prevDisabled = registerBtn.disabled
        ? "true"
        : "false";
    }
    registerBtn.disabled = true;
    registerBtn.setAttribute("aria-busy", "true");
  } else {
    if (registerBtn.dataset.prevDisabled !== undefined) {
      registerBtn.disabled = registerBtn.dataset.prevDisabled === "true";
      delete registerBtn.dataset.prevDisabled;
    }
    registerBtn.removeAttribute("aria-busy");
    delete registerBtn.dataset.loadingCount;
  }
}

function normalizeSc2PulseIdUrl(raw = "") {
  const normalized = sanitizeUrl((raw || "").trim());
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    if (url.hostname !== "sc2pulse.nephest.com") return "";
    const idParam = url.searchParams.get("id");
    const idNum = Number(idParam);
    if (!Number.isFinite(idNum) || idNum <= 0) return "";
    return url.toString();
  } catch (_) {
    return "";
  }
}

async function fetchPulseMmrFromBackend(url) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please sign in first.");
  }

  let lastError = null;

  for (const endpoint of PULSE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, url }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (_) {
        // ignore json parse errors; handled below
      }

      if (!response.ok) {
        const message =
          (payload && payload.error) ||
          `Failed to fetch MMR (status ${response.status}).`;
        lastError = new Error(message);
        continue;
      }

      if (!Number.isFinite(payload?.mmr)) {
        lastError = new Error("Could not read MMR from SC2Pulse.");
        continue;
      }

      return payload;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error("Failed to fetch MMR from SC2Pulse.");
}

function isInviteOnlyTournament(meta) {
  if (!meta) return false;
  if (typeof meta.isInviteOnly === "boolean") return meta.isInviteOnly;
  const access = String(
    meta.accessType || meta.registrationType || "",
  ).toLowerCase();
  return access === "closed" || access === "invite-only" || access === "invite";
}

function getCreateModalModeIfOpen() {
  const modal = document.getElementById("createTournamentModal");
  if (!modal) return null;
  const isVisible =
    typeof window !== "undefined" &&
    window.getComputedStyle(modal).display !== "none";
  if (!isVisible) return null;
  const modeSelect = document.getElementById("tournamentModeSelect");
  return normalizeTournamentMode(modeSelect?.value || "1v1");
}

function getActiveMapPoolMode() {
  const createMode = getCreateModalModeIfOpen();
  if (createMode) return createMode;
  return normalizeTournamentMode(currentTournamentMeta?.mode || "1v1");
}

function getDefaultMapPoolNames(mode = null) {
  const resolvedMode = normalizeTournamentMode(mode || getActiveMapPoolMode());
  const list = (mapCatalog || []).filter((m) => {
    const folder = (m.folder || "").toLowerCase();
    const isArchive = folder.includes("archive");
    return normalizeTournamentMode(m.mode || "1v1") === resolvedMode && !isArchive;
  });
  if (list.length) {
    return list.map((m) => m.name);
  }
  // Fallback exists only for 1v1 bundled ladder maps.
  if (resolvedMode !== "1v1") return [];
  return FALLBACK_LADDER_MAPS.map((m) => m.name);
}

function getTournamentCustomMaps(mode = null) {
  const resolvedMode = normalizeTournamentMode(mode || getActiveMapPoolMode());
  if (getCreateModalModeIfOpen()) {
    return (createCustomMapsDraft || [])
      .filter(
        (entry) =>
          normalizeTournamentMode(entry?.mode || "1v1") === resolvedMode,
      )
      .map((entry) => ({
        id: String(entry.id || ""),
        name: String(entry.name || "").trim(),
        mode: normalizeTournamentMode(entry.mode || "1v1"),
        imageUrl: String(entry.imageUrl || "").trim(),
        isCustom: true,
      }))
      .filter((entry) => entry.name);
  }
  const source = Array.isArray(currentTournamentMeta?.customMaps)
    ? currentTournamentMeta.customMaps
    : [];
  const deduped = new Map();
  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const name = String(entry.name || "").trim();
    const imageUrl = String(entry.imageUrl || "").trim();
    if (!name) return;
    const itemMode = normalizeTournamentMode(
      entry.mode || currentTournamentMeta?.mode || "1v1",
    );
    if (itemMode !== resolvedMode) return;
    const key = name.toLowerCase();
    if (deduped.has(key)) return;
    deduped.set(key, {
      id: String(entry.id || key),
      name,
      mode: itemMode,
      imageUrl,
      isCustom: true,
    });
  });
  return Array.from(deduped.values());
}

function clearCreateCustomMapsDraft() {
  (createCustomMapsDraft || []).forEach((entry) => {
    const url = String(entry?.imageUrl || "");
    if (!url.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(url);
    } catch (_) {
      // ignore
    }
  });
  createCustomMapsDraft = [];
}

function renderCustomMapSection(targetId, maps = []) {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  const items = Array.isArray(maps) ? maps : [];
  if (!items.length) {
    grid.innerHTML = DOMPurify.sanitize(`<p class="helper">No custom maps yet.</p>`);
    return;
  }
  const cards = items.map((entry) => {
    const name = escapeHtml(String(entry?.name || "").trim());
    const imageUrl = String(entry?.imageUrl || "").trim();
    return `<div class="tournament-map-card">
      <div class="map-thumb"${
        imageUrl ? ` style="background-image:url('${imageUrl}')"` : ""
      }></div>
      <div class="map-meta">
        <div class="map-name" translate="no">${name}</div>
      </div>
    </div>`;
  });
  grid.innerHTML = DOMPurify.sanitize(cards.join(""));
}

function renderCustomMapSections() {
  const createMaps = getTournamentCustomMaps(
    getCreateModalModeIfOpen() || "1v1",
  );
  const settingsMode = normalizeTournamentMode(currentTournamentMeta?.mode || "1v1");
  const settingsMaps = getCreateModalModeIfOpen()
    ? []
    : getTournamentCustomMaps(settingsMode);
  renderCustomMapSection("createCustomMapGrid", createMaps);
  renderCustomMapSection("settingsCustomMapGrid", settingsMaps);
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
  renderCustomMapSections();
}

function validateTournamentImage(file) {
  return validateImageFile(file, { maxBytes: MAX_TOURNAMENT_IMAGE_SIZE });
}

async function handleAddCustomMap({ name, file, source } = {}) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    return { ok: false, message: "Enter a map name." };
  }
  if (trimmedName.length > 60) {
    return { ok: false, message: "Map name must be 60 characters or fewer." };
  }
  if (file) {
    const imageValidationError = validateTournamentImage(file);
    if (imageValidationError) {
      return { ok: false, message: imageValidationError };
    }
  }
  const createMode = normalizeTournamentMode(
    document.getElementById("tournamentModeSelect")?.value || "1v1",
  );
  if (source === "create") {
    const existingName = getAll1v1Maps(createMode).some(
      (map) =>
        String(map?.name || "").trim().toLowerCase() ===
        trimmedName.toLowerCase(),
    );
    if (existingName) {
      return { ok: false, message: "A map with this name already exists." };
    }
    const previewUrl = file ? URL.createObjectURL(file) : "";
    createCustomMapsDraft.push({
      id: `cmd-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      name: trimmedName,
      mode: createMode,
      imageUrl: previewUrl,
      file,
      createdAt: Date.now(),
      createdBy: auth?.currentUser?.uid || null,
    });
    if (!mapPoolSelection.has(trimmedName)) {
      setMapPoolSelection(Array.from(new Set([
        ...Array.from(mapPoolSelection || []),
        trimmedName,
      ])));
    } else {
      renderCustomMapSections();
    }
    return { ok: true, message: "Custom map added. It will upload on create." };
  }
  const slug = String(currentTournamentMeta?.slug || currentSlug || "").trim();
  if (!slug) {
    return {
      ok: false,
      message: "Open a tournament first.",
    };
  }
  if (!isAdmin) {
    return {
      ok: false,
      message: "Only tournament admins can add custom maps.",
    };
  }
  const mode = normalizeTournamentMode(currentTournamentMeta?.mode || "1v1");
  const existingName = getAll1v1Maps(mode).some(
    (map) =>
      String(map?.name || "").trim().toLowerCase() ===
      trimmedName.toLowerCase(),
  );
  if (existingName) {
    return { ok: false, message: "A map with this name already exists." };
  }
  try {
    const mapId = `cm-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const uploaded = file ? await uploadCustomMapImage(file, slug, mapId) : null;
    const nextEntry = {
      id: mapId,
      name: trimmedName,
      mode,
      imageUrl: uploaded?.imageUrl || "",
      createdAt: Date.now(),
      createdBy: auth?.currentUser?.uid || null,
    };
    const existing = Array.isArray(currentTournamentMeta?.customMaps)
      ? currentTournamentMeta.customMaps
      : [];
    const nextCustomMaps = [...existing, nextEntry];
    const nextMapPool = Array.from(
      new Set([...(currentTournamentMeta?.mapPool || []), trimmedName]),
    );
    await setDoc(
      doc(collection(db, TOURNAMENT_COLLECTION), slug),
      {
        customMaps: nextCustomMaps,
        mapPool: nextMapPool,
        lastUpdated: Date.now(),
      },
      { merge: true },
    );
    setCurrentTournamentMetaState({
      ...(currentTournamentMeta || {}),
      slug,
      customMaps: nextCustomMaps,
      mapPool: nextMapPool,
      lastUpdated: Date.now(),
    });
    setMapPoolSelection(nextMapPool);
    renderAll();
    return { ok: true, message: "Custom map added and selected." };
  } catch (err) {
    console.error("Failed to add custom map", err);
    return {
      ok: false,
      message: err?.message || "Failed to upload custom map.",
    };
  }
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

function normalizeBooleanSetting(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
  }
  return Boolean(value);
}

function getRequirePulseLinkEnabled(meta = currentTournamentMeta) {
  return normalizeBooleanSetting(
    meta?.requirePulseLink,
    requirePulseLinkSetting,
  );
}

function normalizeMaxPlayersForFormat(rawValue, format, input = null) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return null;
  const maxCap = Number(input?.max || 0) || 32;
  const minCap = isDualTournamentFormat(format)
    ? 4
    : Number(input?.min || 0) || 2;
  if (!isDualTournamentFormat(format)) {
    return Math.min(maxCap, Math.max(minCap, parsed));
  }
  const snapped = Math.round(parsed / 4) * 4;
  return Math.min(maxCap, Math.max(minCap, snapped));
}

function getCheckInWindowState(meta) {
  const startMs = getStartTimeMs(meta);
  const windowMinutes = getCheckInWindowMinutesFromMeta(meta);
  const allowAfterStart = normalizeBooleanSetting(
    meta?.allowCheckInAfterStart,
    false,
  );
  const isManuallyClosed = Boolean(meta?.checkInManuallyClosed);
  if (!startMs || !windowMinutes) {
    return {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      hasOpened: false,
      allowAfterStart,
      isManuallyClosed,
    };
  }
  const now = Date.now();
  const opensAt = startMs - windowMinutes * 60 * 1000;
  const hasOpened = now >= opensAt;
  const closesAt = allowAfterStart ? null : startMs;
  if (!hasOpened) {
    return {
      isOpen: false,
      opensAt,
      closesAt,
      hasOpened,
      allowAfterStart,
      isManuallyClosed,
    };
  }
  if (allowAfterStart) {
    return {
      isOpen: !isManuallyClosed,
      opensAt,
      closesAt,
      hasOpened,
      allowAfterStart,
      isManuallyClosed,
    };
  }
  const beforeStart = now < startMs;
  return {
    isOpen: beforeStart && !isManuallyClosed,
    opensAt,
    closesAt: startMs,
    hasOpened,
    allowAfterStart,
    isManuallyClosed,
  };
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

function formatPrizePoolTotal(value) {
  const total = Number(value?.total ?? value);
  if (!Number.isFinite(total)) return "TBD";
  if (total === 0) return "No prize pool";
  if (total < 0) return "TBD";
  const currency = String(value?.currency || "USD").toUpperCase();
  const customCurrency = String(value?.customCurrency || "").trim();
  if (currency === "CUSTOM") {
    return customCurrency
      ? `${customCurrency} ${Math.round(total).toLocaleString()}`
      : `${Math.round(total).toLocaleString()}`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(total));
  } catch (_) {
    return `${currency} ${Math.round(total).toLocaleString()}`;
  }
}

function renderPrizeInfoMarkup(meta) {
  const total = Number(meta?.prizePoolTotal);
  if (!Number.isFinite(total) || total <= 0) return "";
  const currency = String(meta?.prizePoolCurrency || "USD").toUpperCase();
  const customCurrency = String(meta?.prizePoolCurrencyCustom || "").trim();
  const rows = normalizeStoredPrizeSplitRows(meta?.prizePoolSplit, total);
  const splitRows = rows
    .map((row) => {
      const amountText = formatPrizePoolTotal({
        total: row.amount,
        currency,
        customCurrency,
      });
      return `<li>${escapeHtml(String(row.place))} place: ${escapeHtml(
        amountText,
      )}</li>`;
    })
    .join("");
  const totalText = formatPrizePoolTotal({ total, currency, customCurrency });
  return `
    <p><strong>Total:</strong> ${escapeHtml(totalText)}</p>
    ${
      splitRows
        ? `<p><strong>Split:</strong></p><ul>${splitRows}</ul>`
        : `<p><strong>Split:</strong> Not set</p>`
    }
  `;
}

function normalizeStoredPrizeSplitRows(value, total = null) {
  const raw = Array.isArray(value) ? value : [];
  const rows = raw
    .map((row, idx) => {
      if (row && typeof row === "object") {
        const legacyPercent = Number(row.percent);
        const amountFromPercent =
          Number.isFinite(legacyPercent) &&
          legacyPercent >= 0 &&
          Number.isFinite(total) &&
          total > 0
            ? Math.round((total * legacyPercent) / 100)
            : NaN;
        return {
          place: Number(row.place),
          amount: Number(
            row.amount ?? row.value ?? row.points ?? amountFromPercent ?? 0,
          ),
        };
      }
      return { place: idx + 1, amount: Number(row) };
    })
    .filter(
      (row) =>
        Number.isFinite(row.place) &&
        row.place > 0 &&
        Number.isFinite(row.amount) &&
        row.amount >= 0,
    );
  const deduped = new Map();
  rows.forEach((row) => deduped.set(row.place, row.amount));
  return Array.from(deduped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([place, amount]) => ({ place, amount }));
}

function handleAddPrizeSplitRow(event) {
  event?.preventDefault?.();
  const rows = readPrizeSplitRows();
  const nextPlace = rows.length
    ? Math.max(...rows.map((row) => row.place)) + 1
    : 1;
  renderPrizeSplitRows([...rows, { place: nextPlace, amount: 0 }]);
  updatePrizeSplitWarning();
}

function handleRemovePrizeSplitRow(event) {
  event?.preventDefault?.();
  const row = event.target?.closest?.("[data-prize-split-row]");
  if (!row) return;
  row.remove();
  updatePrizeSplitWarning();
}

function updatePrizeSplitWarning() {
  const warningEl = document.getElementById("settingsPrizeSplitWarning");
  if (!warningEl) return;
  const totalInput = document.getElementById("settingsPrizePoolTotal");
  const total = Number(totalInput?.value || 0);
  const rows = readPrizeSplitRows();
  const splitTotal = rows.reduce(
    (sum, row) => sum + Number(row?.amount || 0),
    0,
  );
  if (!Number.isFinite(total)) {
    warningEl.textContent = "Set prize pool total to validate split.";
    warningEl.style.color = "";
    return;
  }
  if (total === 0) {
    warningEl.textContent = "No prize pool configured (total 0).";
    warningEl.style.color = "";
    return;
  }
  if (total < 0) {
    warningEl.textContent = "Prize pool total must be 0 or more.";
    warningEl.style.color = "#ff8b8b";
    return;
  }
  if (splitTotal !== Math.round(total)) {
    warningEl.textContent = `Warning: split total is ${splitTotal}, expected ${Math.round(
      total,
    )}.`;
    warningEl.style.color = "#ff8b8b";
    return;
  }
  warningEl.textContent = "Split total matches prize pool total.";
  warningEl.style.color = "#8fe3a2";
}

function updateCheckInUI() {
  if (!currentTournamentMeta) return;
  const checkInBtn = document.getElementById("checkInBtn");
  const checkInStatus = document.getElementById("checkInStatus");
  const checkInCard = document.getElementById("checkInCard");
  const checkInToggleBtn = document.getElementById("checkInToggleBtn");
  if (!checkInBtn || !checkInStatus || !checkInCard) return;

  checkInStatus.classList.remove("is-open", "is-checked", "is-closed");
  const startMs = getStartTimeMs(currentTournamentMeta);
  const checkInState = getCheckInWindowState(currentTournamentMeta);
  const currentUid = auth.currentUser?.uid || null;
  const isTeamMode = getTournamentTeamSize(currentTournamentMeta) > 1;
  const teamMembership = currentUid
    ? findTeamMembership(state.players || [], currentUid, { includeDenied: false })
    : null;
  const currentPlayer = currentUid
    ? (state.players || []).find((p) => p.uid === currentUid)
    : null;
  const inviteStatus = normalizeInviteStatus(currentPlayer?.inviteStatus);
  const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);

  if (checkInToggleBtn) {
    const shouldShowToggle = isAdmin && checkInState.allowAfterStart;
    checkInToggleBtn.style.display = shouldShowToggle ? "" : "none";
    if (shouldShowToggle) {
      checkInToggleBtn.disabled = !checkInState.hasOpened || state.isLive;
      checkInToggleBtn.textContent = checkInState.isManuallyClosed
        ? "Open check-in"
        : "Close check-in";
    }
  }

  if (
    state.isLive ||
    !getCheckInWindowMinutesFromMeta(currentTournamentMeta) ||
    !startMs
  ) {
    checkInBtn.style.display = "none";
    checkInStatus.textContent = "";
    checkInCard.style.display = "none";
    return;
  }

  if (!checkInState.isOpen) {
    checkInBtn.style.display = "none";
    const timeUntil = checkInState.opensAt
      ? checkInState.opensAt - Date.now()
      : 0;
    if (checkInState.hasOpened && checkInState.isManuallyClosed) {
      checkInStatus.textContent = "Check-in closed by admin.";
      checkInStatus.classList.add("is-closed");
      checkInCard.style.display = "flex";
    } else {
      checkInStatus.textContent = checkInState.opensAt
        ? `Check-in opens in ${formatCountdown(timeUntil)}`
        : "Check-in is not open yet.";
      checkInStatus.classList.add("is-closed");
      checkInCard.style.display = "none";
    }
    return;
  }

  checkInCard.style.display = "flex";

  if (!currentPlayer) {
    checkInBtn.style.display = "none";
    if (isTeamMode && teamMembership?.role === "member") {
      checkInStatus.textContent = "Only the team leader checks in and reports scores.";
      checkInStatus.classList.add("is-open");
    } else {
      checkInStatus.textContent =
        isInviteOnly && !isAdmin
          ? "Invite required to check in."
          : "Register to check in.";
      checkInStatus.classList.add("is-open");
    }
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

  const closesIn = checkInState.closesAt
    ? checkInState.closesAt - Date.now()
    : 0;
  checkInBtn.style.display = "inline-flex";
  checkInStatus.textContent = checkInState.closesAt
    ? `Check-in open · closes in ${formatCountdown(closesIn)}`
    : "Check-in open · close manually.";
  checkInStatus.classList.add("is-open");
}

function getCheckInWindowMinutes(selectInput) {
  const minutes = Number(selectInput?.value || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

async function deleteTournamentPresence(slug) {
  if (!slug) return;
  try {
    await rtdbRemove(rtdbRef(rtdb, `tournamentPresence/${slug}`));
  } catch (err) {
    console.warn("Failed to delete tournament presence data", err);
  }
}

async function deleteTournamentChatHistory(slug) {
  if (!slug) return;
  try {
    await rtdbRemove(rtdbRef(rtdb, `tournamentChats/${slug}`));
  } catch (err) {
    console.warn("Failed to delete tournament chat history", err);
  }
}

async function deleteTournamentInviteLinks(slug) {
  if (!slug) return;
  try {
    const linksRef = collection(
      db,
      TOURNAMENT_INVITE_LINK_COLLECTION,
      slug,
      "links",
    );
    const snap = await getDocs(linksRef);
    await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.warn("Failed to delete tournament invite links", err);
  }
}

async function handleSaveSettings(event) {
  event?.preventDefault?.();
  const activeSettingsTab =
    document.querySelector("#settingsTab .settings-panel.active")?.id ||
    "settingsGeneral";
  const isGeneralTab = activeSettingsTab === "settingsGeneral";
  const isPrizeTab = activeSettingsTab === "settingsPrize";
  const isDescTab = activeSettingsTab === "settingsDesc";
  const isMapsTab = activeSettingsTab === "settingsMaps";
  const isFormatTab = activeSettingsTab === "settingsFormat";
  const isSponsorsTab = activeSettingsTab === "settingsSponsors";
  const isSocialsTab = activeSettingsTab === "settingsSocials";
  const isPromosTab = isSponsorsTab || isSocialsTab;
  if (state.isLive && !isDescTab) {
    showToast?.(
      "Set the tournament to Not Live before saving settings.",
      "error",
    );
    return;
  }
  const formatSelect = document.getElementById("settingsFormatSelect");
  const descInput = document.getElementById("settingsDescriptionInput");
  const rulesInput = document.getElementById("settingsRulesInput");
  const slugInput = document.getElementById("settingsSlugInput");
  const startInput = document.getElementById("settingsStartInput");
  const maxPlayersInput = document.getElementById("settingsMaxPlayersInput");
  const checkInSelect = document.getElementById("settingsCheckInSelect");
  const checkInAfterStartToggle = document.getElementById(
    "settingsCheckInAfterStartToggle",
  );
  const accessSelect = document.getElementById("settingsAccessSelect");
  const visibilitySelect = document.getElementById("settingsVisibilitySelect");
  const qualifyInput = document.getElementById("settingsCircuitQualifyCount");
  const requirePulseInput = document.getElementById("settingsRequirePulseLink");
  const prizePoolTotalInput = document.getElementById("settingsPrizePoolTotal");
  const prizePoolCurrencyInput = document.getElementById(
    "settingsPrizePoolCurrency",
  );
  const prizePoolCurrencyCustomInput = document.getElementById(
    "settingsPrizePoolCurrencyCustom",
  );
  const imageInput = document.getElementById("settingsImageInput");
  const imagePreview = document.getElementById("settingsImagePreview");
  const copySponsorsToggle = document.getElementById(
    "settingsCopyCircuitSponsorsToggle",
  );
  const imageFile = isGeneralTab ? imageInput?.files?.[0] || null : null;
  const reuseUrl = isGeneralTab ? imagePreview?.dataset.reuseUrl || "" : "";
  const clearCover = isGeneralTab
    ? imagePreview?.dataset.clearCover === "true"
    : false;
  const newSlugRaw = isGeneralTab ? (slugInput?.value || "").trim() : "";
  const newSlug = newSlugRaw || currentSlug || "";
  const slugChanged = newSlug && newSlug !== currentSlug;
  const bestOf = isFormatTab
    ? readBestOf("settings", defaultBestOf)
    : { ...defaultBestOf, ...(currentTournamentMeta?.bestOf || {}) };
  const format = (
    (isFormatTab ? formatSelect?.value : "") ||
    currentTournamentMeta?.format ||
    "Tournament"
  ).trim();
  const rrSettings = isFormatTab
    ? extractRoundRobinSettingsUI("settings", defaultRoundRobinSettings)
    : normalizeRoundRobinSettings(currentTournamentMeta?.roundRobin || {});
  let grandFinalReset = Boolean(currentTournamentMeta?.grandFinalReset);
  if (allowGrandFinalReset(format, rrSettings) && grandFinalResetToggle) {
    grandFinalReset = Boolean(grandFinalResetToggle.checked);
  }
  const description = isDescTab
    ? descInput?.value || ""
    : currentTournamentMeta?.description || "";
  const rules = isDescTab
    ? rulesInput?.value || ""
    : currentTournamentMeta?.rules || "";
  const startTime = isGeneralTab
    ? startInput?.value
      ? new Date(startInput.value)
      : null
    : Number.isFinite(currentTournamentMeta?.startTime)
      ? new Date(currentTournamentMeta.startTime)
      : null;
  const maxPlayers = isGeneralTab
    ? normalizeMaxPlayersForFormat(
        maxPlayersInput?.value,
        format,
        maxPlayersInput,
      )
    : Number.isFinite(currentTournamentMeta?.maxPlayers)
      ? currentTournamentMeta.maxPlayers
      : null;
  if (isGeneralTab && maxPlayersInput && Number.isFinite(maxPlayers)) {
    maxPlayersInput.value = String(maxPlayers);
  }
  const qualifyRaw = isGeneralTab
    ? (qualifyInput?.value ?? "")
    : (currentTournamentMeta?.circuitQualifyCount ?? "");
  const qualifyCount =
    qualifyRaw === "" || qualifyRaw === null || qualifyRaw === undefined
      ? null
      : Number(qualifyRaw);
  const checkInWindowMinutes = isGeneralTab
    ? getCheckInWindowMinutes(checkInSelect)
    : (currentTournamentMeta?.checkInWindowMinutes ?? 0);
  const allowCheckInAfterStart = isGeneralTab
    ? Boolean(checkInAfterStartToggle?.checked)
    : Boolean(currentTournamentMeta?.allowCheckInAfterStart);
  const checkInManuallyClosed = allowCheckInAfterStart
    ? Boolean(currentTournamentMeta?.checkInManuallyClosed)
    : false;
  const isInviteOnly = isGeneralTab
    ? accessSelect?.value === "closed"
    : Boolean(currentTournamentMeta?.isInviteOnly);
  const visibility = isGeneralTab
    ? normalizeTournamentVisibility(visibilitySelect?.value)
    : normalizeTournamentVisibility(currentTournamentMeta?.visibility);
  const mapPool = isMapsTab
    ? Array.from(mapPoolSelection || [])
    : currentTournamentMeta?.mapPool || [];
  const hasScores = bracketHasRecordedResults(state.bracket);
  const scoreLocks = getBracketScoreLocks(state.bracket);
  const currentFormat = (currentTournamentMeta?.format || "Tournament").trim();
  const currentGrandFinalReset = Boolean(
    currentTournamentMeta?.grandFinalReset,
  );
  const currentRoundRobin = normalizeRoundRobinSettings(
    currentTournamentMeta?.roundRobin || {},
  );
  const nextRoundRobin = normalizeRoundRobinSettings(rrSettings);
  const currentBestOf = {
    ...defaultBestOf,
    ...(currentTournamentMeta?.bestOf || {}),
  };
  const circuitPoints = currentTournamentMeta?.circuitSlug
    ? readCircuitPointsTable()
    : null;
  const requirePulseLink =
    (isGeneralTab ? requirePulseInput?.checked : undefined) ??
    currentTournamentMeta?.requirePulseLink ??
    true;
  const copyFromCircuitPromos = currentTournamentMeta?.circuitSlug
    ? Boolean(
        (isPromosTab ? copySponsorsToggle?.checked : undefined) ??
        getCopyFromCircuitPromos(currentTournamentMeta),
      )
    : false;
  const rawPrizePoolTotal = isGeneralTab || isPrizeTab
    ? String(prizePoolTotalInput?.value ?? "").trim()
    : Number(currentTournamentMeta?.prizePoolTotal);
  const parsedPrizePoolTotal =
    typeof rawPrizePoolTotal === "string"
      ? rawPrizePoolTotal === ""
        ? null
        : Number(rawPrizePoolTotal)
      : rawPrizePoolTotal;
  const prizePoolTotal =
    Number.isFinite(parsedPrizePoolTotal) && parsedPrizePoolTotal >= 0
      ? Math.round(parsedPrizePoolTotal)
      : null;
  const prizePoolCurrency = isGeneralTab || isPrizeTab
    ? String(prizePoolCurrencyInput?.value || "USD").toUpperCase()
    : String(currentTournamentMeta?.prizePoolCurrency || "USD").toUpperCase();
  const prizePoolCurrencyCustom = isGeneralTab || isPrizeTab
    ? String(prizePoolCurrencyCustomInput?.value || "").trim()
    : String(currentTournamentMeta?.prizePoolCurrencyCustom || "").trim();
  if ((isGeneralTab || isPrizeTab) && prizePoolCurrency === "CUSTOM") {
    if (!prizePoolCurrencyCustom) {
      showToast?.("Enter a custom currency label.", "error");
      return;
    }
  }
  const prizePoolSplit = isGeneralTab || isPrizeTab
    ? readPrizeSplitRows()
    : normalizeStoredPrizeSplitRows(
        currentTournamentMeta?.prizePoolSplit,
        Number(currentTournamentMeta?.prizePoolTotal),
      );
  const splitTotal = prizePoolSplit.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  if ((isGeneralTab || isPrizeTab) && Number.isFinite(prizePoolTotal) && prizePoolTotal > 0) {
    if (splitTotal !== prizePoolTotal) {
      showToast?.("Prize split total must equal prize pool total.", "error");
      return;
    }
  }
  if (isGeneralTab || isPrizeTab) {
    const places = prizePoolSplit.map((row) => Number(row.place));
    if (new Set(places).size !== places.length) {
      showToast?.("Prize split placements must be unique.", "error");
      return;
    }
  }
  let coverImageUrl = currentTournamentMeta?.coverImageUrl || "";
  let coverImageUrlSmall = currentTournamentMeta?.coverImageUrlSmall || "";
  if (clearCover && !imageFile && !reuseUrl) {
    coverImageUrl = "";
    coverImageUrlSmall = "";
  }
  if (!imageFile && reuseUrl) {
    coverImageUrl = reuseUrl;
    coverImageUrlSmall = "";
  }
  if (imageFile) {
    try {
      const uploaded = await uploadTournamentCover(imageFile, newSlug);
      coverImageUrl = uploaded.coverImageUrl;
      coverImageUrlSmall = uploaded.coverImageUrlSmall;
    } catch (err) {
      showToast?.(err?.message || "Failed to upload cover image.", "error");
      return;
    }
  }

  if (hasScores) {
    if (format !== currentFormat) {
      showToast?.(
        "Format is locked once scores are recorded. Reset scores to change it.",
        "error",
      );
      return;
    }
    if (grandFinalReset !== currentGrandFinalReset) {
      showToast?.(
        "Grand Final Reset is locked once scores are recorded. Reset scores to change it.",
        "error",
      );
      return;
    }
    if (JSON.stringify(nextRoundRobin) !== JSON.stringify(currentRoundRobin)) {
      showToast?.(
        "Round robin settings are locked once scores are recorded.",
        "error",
      );
      return;
    }
    const lockedBestOf = [];
    if (bestOf.upper !== currentBestOf.upper && scoreLocks.upper)
      lockedBestOf.push("Upper");
    if (bestOf.quarter !== currentBestOf.quarter && scoreLocks.quarter)
      lockedBestOf.push("Quarter");
    if (bestOf.semi !== currentBestOf.semi && scoreLocks.semi)
      lockedBestOf.push("Semi");
    if (bestOf.upperFinal !== currentBestOf.upperFinal && scoreLocks.upperFinal)
      lockedBestOf.push("Upper Final");
    if (bestOf.final !== currentBestOf.final && scoreLocks.final)
      lockedBestOf.push("Final");
    if (bestOf.finalReset !== currentBestOf.finalReset && scoreLocks.finalReset)
      lockedBestOf.push("Final Reset");
    if (bestOf.lower !== currentBestOf.lower && scoreLocks.lower)
      lockedBestOf.push("Lower");
    if (bestOf.lowerSemi !== currentBestOf.lowerSemi && scoreLocks.lowerSemi)
      lockedBestOf.push("Lower Semi");
    if (bestOf.lowerFinal !== currentBestOf.lowerFinal && scoreLocks.lowerFinal)
      lockedBestOf.push("Lower Final");
    if (
      nextRoundRobin.bestOf !== currentRoundRobin.bestOf &&
      scoreLocks.roundRobin
    )
      lockedBestOf.push("Round Robin");
    if (lockedBestOf.length) {
      showToast?.(
        `Best-of is locked for rounds with recorded scores: ${lockedBestOf.join(
          ", ",
        )}.`,
        "error",
      );
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
    coverImageUrlSmall,
    maxPlayers,
    startTime,
    checkInWindowMinutes,
    allowCheckInAfterStart,
    checkInManuallyClosed,
    isInviteOnly,
    visibility,
    bestOf,
    mapPool,
    roundRobin: rrSettings,
    requirePulseLink,
    grandFinalReset,
    prizePoolTotal,
    prizePoolCurrency,
    prizePoolCurrencyCustom,
    prizePoolSplit,
    circuitQualifyCount:
      currentTournamentMeta?.isCircuitFinal &&
      Number.isFinite(qualifyCount) &&
      qualifyCount >= 0
        ? qualifyCount
        : null,
  });
  if (currentTournamentMeta?.circuitSlug && isPromosTab) {
    meta.copyFromCircuitPromos = copyFromCircuitPromos;
  }
  if (isPromosTab && !copyFromCircuitPromos) {
    if (isSponsorsTab) {
      const sponsors = readTournamentSponsors();
      const processedSponsors = [];
      for (const sponsor of sponsors) {
        if (!sponsor) continue;
        let imageUrl = sponsor.imageUrl || "";
        if (sponsor.file) {
          try {
            imageUrl = await uploadSponsorLogo(sponsor.file, newSlug);
          } catch (err) {
            showToast?.(
              err?.message || "Failed to upload sponsor logo.",
              "error",
            );
            return;
          }
        }
        const entry = normalizeSponsorEntry(
          { name: sponsor.name, imageUrl, linkUrl: sponsor.linkUrl },
          { allowEmpty: false },
        );
        if (entry) processedSponsors.push(entry);
      }
      meta.sponsors = processedSponsors;
    }
    if (isSocialsTab) {
      const socials = readTournamentSocials();
      const processedSocials = socials
        .map((entry) =>
          normalizeSocialEntry(
            { type: entry.type, label: entry.label, url: entry.url },
            { allowEmpty: false },
          ),
        )
        .filter(Boolean);
      for (const entry of processedSocials) {
        const error = validateSocialUrl(entry.type, entry.url);
        if (error) {
          showToast?.(
            `Invalid ${getSocialLabelForType(entry.type)} URL. ${error}`,
            "error",
          );
          return;
        }
      }
      meta.socials = processedSocials;
    }
  }
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
    const target = circuitSlug
      ? `/tournament/${circuitSlug}/${newSlug}`
      : `/tournament/${newSlug}`;
    window.history.pushState({}, "", target);
  }

  setCurrentTournamentMetaState(meta);
  updateAdminVisibility();
  await refreshInviteLinksPanel();
  setRequirePulseLinkSettingState(requirePulseLink);
  updateMmrDisplay(document.getElementById("mmrStatus"));
  saveState({ bracket: state.bracket }, { skipRoster: true }); // keep bracket but bump timestamp via saveState
  // Reflect slug in the settings input
  const settingsSlugInput = document.getElementById("settingsSlugInput");
  if (settingsSlugInput) settingsSlugInput.value = newSlug;

  const targetSlug = currentSlug || newSlug;
  if (targetSlug) {
    try {
      await setDoc(
        doc(collection(db, TOURNAMENT_COLLECTION), targetSlug),
        meta,
        { merge: true },
      );
      showToast?.("Settings saved.", "success");
    } catch (err) {
      console.error("Failed to save settings", err);
      showToast?.("Failed to save settings.", "error");
    }
  } else {
    showToast?.("Settings saved locally.", "success");
  }
  const shouldRebuild =
    isFormatTab &&
    (format !== currentFormat ||
      grandFinalReset !== currentGrandFinalReset) &&
    !bracketHasRecordedResults(state.bracket);
  if (shouldRebuild) {
    rebuildBracket(true, "Settings updated");
  } else {
    renderAll();
  }
}

async function handleCreateCircuit(event) {
  event?.preventDefault?.();
  const nameInput = document.getElementById("circuitNameInput");
  const slugInput = document.getElementById("circuitSlugInput");
  const descriptionInput = document.getElementById("circuitDescriptionInput");
  const firstPlaceToggle = document.getElementById(
    "circuitFirstPlaceSortToggle",
  );
  const finalNameInput = document.getElementById("finalTournamentNameInput");
  const finalSlugInput = document.getElementById("finalTournamentSlugInput");
  const finalVisibilitySelect = document.getElementById(
    "finalTournamentVisibilitySelect",
  );
  const finalAccessSelect = document.getElementById(
    "finalTournamentAccessSelect",
  );
  const finalFormatSelect = document.getElementById("finalFormatSelect");
  const finalGrandFinalResetToggle = document.getElementById(
    "finalGrandFinalResetToggle",
  );
  const finalStartInput = document.getElementById("finalTournamentStartInput");
  const finalMaxPlayersInput = document.getElementById(
    "finalTournamentMaxPlayersInput",
  );
  const finalCheckInSelect = document.getElementById("finalCheckInSelect");
  const finalCheckInAfterStartToggle = document.getElementById(
    "finalCheckInAfterStartToggle",
  );
  const finalDescriptionInput = document.getElementById(
    "finalTournamentDescriptionInput",
  );
  const finalRulesInput = document.getElementById("finalTournamentRulesInput");
  const finalImageInput = document.getElementById("finalTournamentImageInput");
  const finalImagePreview = document.getElementById(
    "finalTournamentImagePreview",
  );
  const finalQualifyInput = document.getElementById("finalQualifyCountInput");
  const modal = document.getElementById("createCircuitModal");
  const name = (nameInput?.value || "").trim();
  const slug =
    (slugInput?.value || "").trim().toLowerCase() ||
    (await generateCircuitSlug());
  const description = descriptionInput?.value || "";
  const sortByFirstPlace = Boolean(firstPlaceToggle?.checked);
  const finalVisibility = normalizeTournamentVisibility(
    finalVisibilitySelect?.value,
  );
  const finalAccess = normalizeTournamentAccess(finalAccessSelect?.value);
  const finalName =
    (finalNameInput?.value || "").trim() || (name ? `${name} Finals` : "");
  let finalSlug = (finalSlugInput?.value || "").trim().toLowerCase();
  if (!finalSlug) {
    finalSlug = slug ? `${slug}-final` : await generateUniqueSlug();
  }
  const finalFormat = (finalFormatSelect?.value || "Double Elimination").trim();
  const finalStartTime = finalStartInput?.value
    ? new Date(finalStartInput.value)
    : null;
  const finalMaxPlayers = normalizeMaxPlayersForFormat(
    finalMaxPlayersInput?.value,
    finalFormat,
    finalMaxPlayersInput,
  );
  if (finalMaxPlayersInput && Number.isFinite(finalMaxPlayers)) {
    finalMaxPlayersInput.value = String(finalMaxPlayers);
  }
  const finalCheckInWindowMinutes = getCheckInWindowMinutes(finalCheckInSelect);
  const finalAllowCheckInAfterStart = Boolean(
    finalCheckInAfterStartToggle?.checked,
  );
  const finalDescription = finalDescriptionInput?.value || "";
  const finalRules = finalRulesInput?.value || "";
  const finalImageFile = finalImageInput?.files?.[0] || null;
  const finalReuseUrl = finalImagePreview?.dataset.reuseUrl || "";
  const finalQualifyRaw = finalQualifyInput?.value ?? "";
  const finalQualifyCount =
    finalQualifyRaw === "" ||
    finalQualifyRaw === null ||
    finalQualifyRaw === undefined
      ? null
      : Number(finalQualifyRaw);
  const rrSettings = extractRoundRobinSettingsUI(
    "final",
    defaultRoundRobinSettings,
  );
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
    adminUids: [],
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
    grandFinalReset:
      allowGrandFinalReset(finalFormat, rrSettings) &&
      Boolean(finalGrandFinalResetToggle?.checked),
    maxPlayers: finalMaxPlayers,
    startTime: finalStartTime,
    checkInWindowMinutes: finalCheckInWindowMinutes,
    allowCheckInAfterStart: finalAllowCheckInAfterStart,
    isInviteOnly: finalAccess === "closed",
    visibility: finalVisibility,
    mapPool: getFinalMapPoolSelection(),
    createdBy: auth.currentUser?.uid || null,
    createdByName: getCurrentUsername() || "Unknown host",
    roundRobin: rrSettings,
    bestOf: readBestOf("final", defaultBestOf),
    circuitSlug: slug,
    circuitQualifyCount: finalQualifyCount,
  });
  try {
    await setDoc(doc(collection(db, CIRCUIT_COLLECTION), slug), payload, {
      merge: true,
    });
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
    logAnalyticsEvent("circuit_created");
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
  const modeSelect = document.getElementById("tournamentModeSelect");
  const formatSelect = document.getElementById("tournamentFormatSelect");
  const grandFinalResetToggle = document.getElementById(
    "grandFinalResetToggle",
  );
  const startInput = document.getElementById("tournamentStartInput");
  const maxPlayersInput = document.getElementById("tournamentMaxPlayersInput");
  const checkInSelect = document.getElementById("checkInSelect");
  const checkInAfterStartToggle = document.getElementById(
    "checkInAfterStartToggle",
  );
  const accessSelect = document.getElementById("tournamentAccessSelect");
  const visibilitySelect = document.getElementById(
    "tournamentVisibilitySelect",
  );
  const descriptionInput = document.getElementById(
    "tournamentDescriptionInput",
  );
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
  const mode = normalizeTournamentMode(modeSelect?.value || "1v1");
  const startTime = startInput?.value ? new Date(startInput.value) : null;
  const maxPlayers = normalizeMaxPlayersForFormat(
    maxPlayersInput?.value,
    format,
    maxPlayersInput,
  );
  if (maxPlayersInput && Number.isFinite(maxPlayers)) {
    maxPlayersInput.value = String(maxPlayers);
  }
  const checkInWindowMinutes = getCheckInWindowMinutes(checkInSelect);
  const allowCheckInAfterStart = Boolean(checkInAfterStartToggle?.checked);
  const isInviteOnly = accessSelect?.value === "closed";
  const visibility = normalizeTournamentVisibility(visibilitySelect?.value);
  const description = descriptionInput?.value || "";
  const rules = rulesInput?.value || "";
  const rrSettings = extractRoundRobinSettingsUI(
    "create",
    defaultRoundRobinSettings,
  );
  const grandFinalReset =
    allowGrandFinalReset(format, rrSettings) &&
    Boolean(grandFinalResetToggle?.checked);
  const createCustomMapsForMode = (createCustomMapsDraft || []).filter(
    (entry) => normalizeTournamentMode(entry?.mode || "1v1") === mode,
  );
  try {
    const payload = buildCreateTournamentPayload({
      slug,
      name,
      mode,
      description,
      rules,
      format,
      maxPlayers,
      startTime,
      checkInWindowMinutes,
      allowCheckInAfterStart,
      isInviteOnly,
      visibility,
      mapPool: Array.from(mapPoolSelection || []),
      createdBy: auth.currentUser?.uid || null,
      createdByName: getCurrentUsername() || "Unknown host",
      roundRobin: rrSettings,
      bestOf: readBestOf("create", defaultBestOf),
      grandFinalReset,
      circuitSlug: circuitSlug || null,
      isCircuitFinal: circuitSlug ? isCircuitFinal : false,
    });
    payload.customMaps = [];
    await setDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug), payload, {
      merge: true,
    });
    if (imageFile) {
      try {
        const uploaded = await uploadTournamentCover(imageFile, slug);
        payload.coverImageUrl = uploaded.coverImageUrl;
        payload.coverImageUrlSmall = uploaded.coverImageUrlSmall;
        await setDoc(
          doc(collection(db, TOURNAMENT_COLLECTION), slug),
          {
            coverImageUrl: uploaded.coverImageUrl,
            coverImageUrlSmall: uploaded.coverImageUrlSmall,
          },
          { merge: true },
        );
      } catch (err) {
        showToast?.(err?.message || "Failed to upload cover image.", "error");
      }
    } else if (reuseUrl) {
      try {
        payload.coverImageUrl = reuseUrl;
        payload.coverImageUrlSmall = "";
        await setDoc(
          doc(collection(db, TOURNAMENT_COLLECTION), slug),
          { coverImageUrl: reuseUrl, coverImageUrlSmall: "" },
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to reuse cover image", err);
      }
    }
    if (createCustomMapsForMode.length) {
      const uploadedCustomMaps = [];
      for (const entry of createCustomMapsForMode) {
        const imageFile = entry?.file || null;
        const normalizedEntry = {
          id: String(entry.id || ""),
          name: String(entry.name || "").trim(),
          mode: normalizeTournamentMode(entry.mode || mode || "1v1"),
          imageUrl: "",
          createdAt: Number(entry.createdAt) || Date.now(),
          createdBy: entry.createdBy || auth.currentUser?.uid || null,
        };
        if (!normalizedEntry.name) continue;
        if (!imageFile) {
          uploadedCustomMaps.push(normalizedEntry);
          continue;
        }
        try {
          const uploaded = await uploadCustomMapImage(imageFile, slug, entry.id);
          uploadedCustomMaps.push({
            ...normalizedEntry,
            imageUrl: uploaded.imageUrl,
          });
        } catch (err) {
          console.error("Failed to upload custom map image", err);
          showToast?.(
            `Failed to upload custom map "${entry?.name || "Unknown"}".`,
            "error",
          );
          uploadedCustomMaps.push(normalizedEntry);
        }
      }
      if (uploadedCustomMaps.length) {
        payload.customMaps = uploadedCustomMaps;
        await setDoc(
          doc(collection(db, TOURNAMENT_COLLECTION), slug),
          { customMaps: uploadedCustomMaps },
          { merge: true },
        );
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
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to link tournament to circuit", err);
        showToast?.("Tournament saved, but circuit update failed.", "error");
      }
    }
    setCurrentSlugState(slug);
    setCurrentTournamentMetaState(payload);
    clearCreateCustomMapsDraft();
    logAnalyticsEvent("tournament_created");
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

function getAll1v1Maps(mode = null) {
  const resolvedMode = normalizeTournamentMode(mode || getActiveMapPoolMode());
  const source =
    Array.isArray(mapCatalog) && mapCatalog.length
      ? mapCatalog
      : FALLBACK_LADDER_MAPS || [];
  const customMaps = getTournamentCustomMaps(resolvedMode);
  const filtered = source.filter(
    (m) => normalizeTournamentMode(m.mode || "1v1") === resolvedMode,
  );
  if (filtered.length || customMaps.length) {
    const byName = new Map();
    [...customMaps, ...filtered].forEach((map) => {
      const key = String(map?.name || "").trim().toLowerCase();
      if (!key || byName.has(key)) return;
      byName.set(key, map);
    });
    return Array.from(byName.values());
  }
  if (resolvedMode !== "1v1") return [];
  const fallback = source.filter(
    (m) => normalizeTournamentMode(m.mode || "1v1") === "1v1",
  );
  if (!customMaps.length) return fallback;
  const byName = new Map();
  [...customMaps, ...fallback].forEach((map) => {
    const key = String(map?.name || "").trim().toLowerCase();
    if (!key || byName.has(key)) return;
    byName.set(key, map);
  });
  return Array.from(byName.values());
}

function getMapByName(name, mode = null) {
  if (!name) return null;
  const normalizedName = String(name).trim().toLowerCase();
  const scoped = getAll1v1Maps(mode).find(
    (m) => String(m?.name || "").trim().toLowerCase() === normalizedName,
  );
  if (scoped) return scoped;
  const source =
    Array.isArray(mapCatalog) && mapCatalog.length
      ? mapCatalog
      : FALLBACK_LADDER_MAPS || [];
  const custom = getTournamentCustomMaps(mode);
  return (
    source.find(
      (m) => String(m?.name || "").trim().toLowerCase() === normalizedName,
    ) ||
    custom.find(
      (m) => String(m?.name || "").trim().toLowerCase() === normalizedName,
    ) ||
    null
  );
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

function updateCircuitFinalMapButtons() {
  const ladderBtn = document.getElementById("circuitFinalUseLadderMapsBtn");
  const customBtn = document.getElementById("circuitFinalClearMapPoolBtn");
  const isLadder = circuitFinalMapPoolMode === "ladder";
  ladderBtn?.classList.toggle("active", isLadder);
  customBtn?.classList.toggle("active", !isLadder);
}

function renderCircuitFinalMapPoolSelection() {
  renderMapPoolPickerUI("circuitFinalMapPoolPicker", {
    mapPoolSelection: circuitFinalMapPoolSelection,
    getAll1v1Maps,
  });
  renderChosenMapsUI("circuitFinalChosenMapList", {
    mapPoolSelection: circuitFinalMapPoolSelection,
    getMapByName,
  });
  updateCircuitFinalMapButtons();
}

function setCircuitFinalMapPoolSelection(names) {
  circuitFinalMapPoolSelection = new Set((names || []).filter(Boolean));
  circuitFinalMapPoolMode = isDefaultLadderSelection(
    circuitFinalMapPoolSelection,
    getDefaultMapPoolNames,
  )
    ? "ladder"
    : "custom";
  renderCircuitFinalMapPoolSelection();
}

function toggleCircuitFinalMapSelection(name) {
  if (!name) return;
  if (circuitFinalMapPoolSelection.has(name)) {
    circuitFinalMapPoolSelection.delete(name);
  } else {
    circuitFinalMapPoolSelection.add(name);
  }
  circuitFinalMapPoolMode = isDefaultLadderSelection(
    circuitFinalMapPoolSelection,
    getDefaultMapPoolNames,
  )
    ? "ladder"
    : "custom";
  renderCircuitFinalMapPoolSelection();
}

function resetCircuitFinalMapPoolSelection() {
  setCircuitFinalMapPoolSelection(getDefaultMapPoolNames());
}

function getCircuitFinalMapPoolSelection() {
  return new Set(circuitFinalMapPoolSelection);
}

registerTournamentEvents({
  auth,
  db,
  onAuthStateChanged,
  getCurrentSlug: () => currentSlug,
  getState: () => state,
  getCurrentTournamentMeta: () => currentTournamentMeta,
  getCurrentUserAvatarUrl,
  getPulseState,
  showToast,
  saveState,
  renderAll,
  rebuildBracket,
  bracketHasResults,
  seedEligiblePlayersWithMode,
  checkInCurrentPlayer,
  syncCurrentPlayerAvatar,
  hydratePulseFromState,
  recomputeAdminFromMeta,
  recomputeCircuitAdminFromMeta,
  handleTournamentCheckInAction,
  handleTournamentInviteAction,
  initTabAlerts,
  handleUnreadChatEvent,
  handleRouteChange,
  configureFinalMapPool,
  getDefaultMapPoolNames,
  getAll1v1Maps,
  getMapByName,
  renderMapPoolPickerUI,
  renderChosenMapsUI,
  isDefaultLadderSelection,
  initTournamentPage,
  buildTournamentPageInitArgs: () => ({
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
    handleAddCustomMap,
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
    getMatchReadySince,
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
    handleAddPrizeSplitRow,
    handleRemovePrizeSplitRow,
    handlePrizeSplitChange: updatePrizeSplitWarning,
    handlePrizeCurrencyChange: updatePrizeCurrencyCustomInputVisibility,
    addBotPlayer,
    removeBotPlayer,
    removeAllBots,
    resetTournament,
    resetScores,
    resetVetoScoreChat,
    checkInCurrentPlayer,
    leaveCurrentTeam,
    notifyCheckInPlayers,
    toggleCheckInManualClose,
    toggleLiveTournament,
    recreateLiveBracket,
    showToast,
    refreshRosterMmrFromPulse,
  }),
  ensureMapCatalogLoadedForUi,
  initCoverReuseModal,
  initCasterControls,
  ensureAdminSearchBootstrap,
  getIsAdmin: () => isAdmin,
  bindTournamentSponsorControls,
  bindTournamentSocialControls,
  bindTournamentPromoSettingsControls,
  initInviteLinksPanel,
  initAdminInviteModal,
  updateCheckInUI,
  setMapPoolSelection,
  resetFinalMapPoolSelection,
  ensureSettingsUiReady,
  initializeAuthUI,
});

initBroadcastSync(syncFromRemote, getPersistStorageKey, () => {});

function switchTab(targetId) {
  const targetPanel = document.getElementById(targetId);
  if (targetPanel && targetPanel.dataset.adminOnly === "true" && !isAdmin) {
    return;
  }
  if (targetId === "superAdminTab" && !isSuperAdminUser()) {
    return;
  }
  if (targetId === "mapsTab" || targetId === "settingsTab") {
    ensureMapCatalogLoadedForUi();
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
  const deleteTournamentBtn = document.getElementById("deleteTournamentBtn");
  const hostUid = currentTournamentMeta?.createdBy || "";
  const currentUid = auth?.currentUser?.uid || "";
  const isHost = Boolean(hostUid && currentUid && hostUid === currentUid);
  if (deleteTournamentBtn) {
    deleteTournamentBtn.style.display = isHost ? "" : "none";
  }
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
    restored.addEventListener("click", () => switchTab(restored.dataset.tab));
    adminTabs.append(restored);
  }
  const liveCircuitPointsBtn = document.getElementById("circuitPointsTabBtn");
  if (liveCircuitPointsBtn) {
    liveCircuitPointsBtn.style.display =
      isAdmin && currentTournamentMeta?.circuitSlug ? "" : "none";
  }
  updateSuperAdminVisibility();
  updateFinalAdminAddVisibility();
  updateInviteLinksPanelVisibility();
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = isAdmin;
  }
}

function updateSuperAdminVisibility() {
  const allowed = isSuperAdminUser();
  document.querySelectorAll("[data-super-admin-only='true']").forEach((el) => {
    el.style.display = allowed ? "" : "none";
  });
  if (!allowed && document.querySelector(".tab-btn.active")?.dataset.tab === "superAdminTab") {
    switchTab("registrationTab");
  }
}

function updateFinalAdminAddVisibility() {
  const panel = document.getElementById("finalAdminAddPanel");
  if (!panel) return;
  panel.style.display = isAdmin ? "block" : "none";
}

function updateInviteLinksPanelVisibility() {
  const panel = document.getElementById("inviteLinksPanel");
  if (!panel) return;
  const show = isAdmin && Boolean(currentTournamentMeta?.isInviteOnly);
  panel.style.display = show ? "block" : "none";
}

function recomputeAdminFromMeta() {
  const uid = auth?.currentUser?.uid || null;
  const owns = Boolean(uid && isAdminForMeta(currentTournamentMeta, uid));
  setIsAdminState(owns);
  if (owns || isSuperAdminUser()) {
    void ensureAdminSearchBootstrap();
  }
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = owns;
  }
  updateAdminVisibility();
  renderTournamentAdmins(currentTournamentMeta);
}

function renderRegistrationPulseSummary() {
  const summaryEl = document.getElementById("registrationPulseSummary");
  if (!summaryEl) return;
  if (!pulseProfile?.url) {
    summaryEl.style.display = "none";
    summaryEl.innerHTML = "";
    return;
  }
  const byRace = pulseProfile?.byRace || null;
  const overall = Number.isFinite(pulseProfile?.mmr)
    ? Math.round(pulseProfile.mmr)
    : null;
  const updatedAt = pulseProfile?.fetchedAt || null;
  const badges = buildMmrBadges(byRace, overall, updatedAt);
  summaryEl.innerHTML = "";
  summaryEl.style.display = "none";
}

function hydratePulseFromState(pulseState) {
  const raceSelect = document.getElementById("raceSelect");
  const pulseLinkDisplay = document.getElementById("pulseLinkDisplay");
  const statusEl = document.getElementById("mmrStatus");

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
    pulseState && (normalizedUrl || overallMmr || bestRace || secondary.length)
      ? {
          ...pulseState,
          url: normalizedUrl,
          byRace,
          mmr: overallMmr,
          secondary,
        }
      : null,
  );

  const existingSelection = pulseProfile
    ? normalizeRaceLabel(raceSelect?.value)
    : "";
  setDerivedRaceState(existingSelection || (pulseProfile ? bestRace : null));
  setDerivedMmrState(
    pulseProfile
      ? derivedRace
        ? mmrForRace(derivedRace)
        : (bestMmr ?? overallMmr ?? null)
      : null,
  );

  const hasProfileUrl = Boolean(pulseProfile?.url);
  if (raceSelect) {
    raceSelect.disabled = false;
    if (derivedRace) {
      raceSelect.value = derivedRace;
    } else {
      raceSelect.value = raceSelect.value || "";
    }
  }
  if (pulseLinkDisplay) {
    const manualCleared = pulseLinkDisplay.dataset.manualCleared === "true";
    if (normalizedUrl && !(manualCleared && !pulseLinkDisplay.value.trim())) {
      pulseLinkDisplay.value = normalizedUrl;
    }
  }

  updateMmrDisplay(statusEl);
  renderRegistrationPulseSummary();
  updateRegistrationRequirementIcons();
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
  const username =
    getCurrentUsername() || getCurrentUserProfile?.()?.username || "";
  const pulseName = pulseProfile?.accountName || "";
  if (current) {
    if (username && current === pulseName && current !== username) {
      input.value = username;
    }
    updateRegistrationRequirementIcons();
    return;
  }
  const candidate = username || pulseName;
  if (candidate && candidate.toLowerCase() !== "guest") {
    input.value = candidate;
  }
  updateRegistrationRequirementIcons();
}

function getPulseRequirementStatus() {
  const requirePulseLinkEnabled = getRequirePulseLinkEnabled();
  const manualLink =
    document.getElementById("pulseLinkDisplay")?.value?.trim() || "";
  const manualUrl = manualLink ? normalizeSc2PulseIdUrl(manualLink) : "";
  const settingsUrl = normalizeSc2PulseIdUrl(pulseProfile?.url || "");
  const hasValid = manualLink ? Boolean(manualUrl) : false;
  return { requirePulseLinkEnabled, hasValid };
}

function updateRegistrationRequirementIcons() {
  const nameInput = document.getElementById("playerNameInput");
  const nameIcon = document.getElementById("playerNameStatusIcon");
  const pulseIcon = document.getElementById("pulseLinkStatusIcon");

  if (nameInput && nameIcon) {
    const name = (nameInput.value || "").trim();
    const hasLetter = /[A-Za-z]/.test(name);
    nameIcon.classList.toggle("is-valid", Boolean(name && hasLetter));
    nameIcon.classList.toggle("is-invalid", !name || (name && !hasLetter));
  }

  if (pulseIcon) {
    const { requirePulseLinkEnabled, hasValid } = getPulseRequirementStatus();
    pulseIcon.classList.toggle("is-valid", hasValid);
    pulseIcon.classList.toggle(
      "is-invalid",
      requirePulseLinkEnabled && !hasValid,
    );
  }
}

function getNormalizedTeamInviteDraft(requiredCount = getRequiredTeammateCount()) {
  const limit = Math.max(0, Number(requiredCount) || 0);
  const unique = [];
  const seen = new Set();
  for (const rawEntry of teamInviteDraft || []) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const uid = String(rawEntry.uid || "").trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    unique.push({
      uid,
      name: String(rawEntry.name || "").trim() || "Unknown",
      role: "member",
      status: normalizeTeamMemberStatus(rawEntry.status),
      race: String(rawEntry.race || "").trim(),
      sc2Link: String(rawEntry.sc2Link || "").trim(),
      pulseName: String(rawEntry.pulseName || "").trim(),
      mmr: Number.isFinite(Number(rawEntry.mmr))
        ? Math.max(0, Number(rawEntry.mmr))
        : 0,
      mmrByRace:
        rawEntry.mmrByRace && typeof rawEntry.mmrByRace === "object"
          ? { ...rawEntry.mmrByRace }
          : null,
      secondaryPulseLinks: Array.isArray(rawEntry.secondaryPulseLinks)
        ? rawEntry.secondaryPulseLinks.slice()
        : [],
      secondaryPulseProfiles: Array.isArray(rawEntry.secondaryPulseProfiles)
        ? rawEntry.secondaryPulseProfiles.slice()
        : [],
      twitchUrl: String(rawEntry.twitchUrl || "").trim(),
      country: String(rawEntry.country || "").trim(),
      avatarUrl: String(rawEntry.avatarUrl || "").trim(),
      invitedAt: Number.isFinite(Number(rawEntry.invitedAt))
        ? Number(rawEntry.invitedAt)
        : Date.now(),
      inviteSentAt: Number.isFinite(Number(rawEntry.inviteSentAt))
        ? Number(rawEntry.inviteSentAt)
        : null,
      respondedAt: Number.isFinite(Number(rawEntry.respondedAt))
        ? Number(rawEntry.respondedAt)
        : null,
    });
    if (unique.length >= limit) break;
  }
  teamInviteDraft = unique;
  return unique;
}

function removeDraftInviteByUid(uid) {
  const targetUid = String(uid || "").trim();
  if (!targetUid) return;
  teamInviteDraft = (teamInviteDraft || []).filter(
    (entry) => String(entry?.uid || "").trim() !== targetUid,
  );
  teamInviteDraftDirty = true;
}

function canEditTeamInviteDraft(activeMembership) {
  if (!isTeamTournament(currentTournamentMeta)) return false;
  if (state.isLive) return false;
  if (!auth.currentUser?.uid) return false;
  if (!activeMembership) return true;
  return false;
}

function buildCurrentTeamEntries(activeMembership, entries = []) {
  const currentUid = auth.currentUser?.uid || "";
  const currentName =
    (document.getElementById("playerNameInput")?.value || "").trim() ||
    getCurrentUsername?.() ||
    getCurrentUserProfile?.()?.username ||
    "You";
  if (activeMembership?.player) {
    const teamSize = getTournamentTeamSize(currentTournamentMeta);
    return normalizeTeamMembersFromPlayer(activeMembership.player, teamSize);
  }
  if (!currentUid) return [];
  return [
    {
      uid: currentUid,
      name: currentName,
      role: "leader",
      status: TEAM_MEMBER_STATUS.accepted,
      invitedAt: Date.now(),
      inviteSentAt: null,
      respondedAt: Date.now(),
    },
    ...(entries || []).map((entry) => ({
      uid: entry.uid,
      name: entry.name,
      role: "member",
      status: normalizeTeamMemberStatus(entry.status),
      invitedAt: Number.isFinite(Number(entry.invitedAt))
        ? Number(entry.invitedAt)
        : null,
      inviteSentAt: Number.isFinite(Number(entry.inviteSentAt))
        ? Number(entry.inviteSentAt)
        : null,
      respondedAt: Number.isFinite(Number(entry.respondedAt))
        ? Number(entry.respondedAt)
        : null,
    })),
  ];
}

function renderTeamInviteSection() {
  const refs = getTeamInviteUiRefs();
  if (!refs.layout && !refs.section) return;
  initTeamInviteSearchUi();
  resetTeamInviteDraftForCurrentSlug();

  const teamSize = getTournamentTeamSize(currentTournamentMeta);
  const required = getRequiredTeammateCount(currentTournamentMeta);
  const isTeamMode = teamSize > 1;
  const currentUid = auth.currentUser?.uid || "";
  const activeMembership = getActiveMembershipForUser(currentUid);
  const hasRegisteredTeam = Boolean(activeMembership?.player);
  const editable = canEditTeamInviteDraft(activeMembership);

  if (!isTeamMode) {
    if (refs.layout) refs.layout.style.display = "none";
    if (refs.section) refs.section.style.display = "none";
    if (refs.currentSection) refs.currentSection.style.display = "none";
    if (refs.teamNameInput) refs.teamNameInput.value = "";
    setTeamInviteStatus("");
    setTeamCurrentStatus("");
    if (refs.searchResults) refs.searchResults.replaceChildren();
    if (refs.currentList) refs.currentList.replaceChildren();
    if (refs.leaveBtn) refs.leaveBtn.style.display = "none";
    return;
  }

  if (refs.layout) refs.layout.style.display = "";
  if (refs.section) refs.section.style.display = "";
  if (refs.currentSection) refs.currentSection.style.display = "";
  if (refs.helperText) {
    refs.helperText.textContent = hasRegisteredTeam
      ? "Teammates must accept their invitation in the Notification Center before your team is registered."
      : "Teammate invitations are sent after you press Register team.";
  }
  if (refs.teamNameInput) {
    const savedTeamName = String(activeMembership?.player?.team?.teamName || "").trim();
    if (savedTeamName && !refs.teamNameInput.value.trim()) {
      refs.teamNameInput.value = savedTeamName;
    }
  }

  if (activeMembership && !teamInviteDraftDirty) {
    syncTeamInviteDraftFromPlayer(activeMembership.player, teamSize);
  }

  const entries = getNormalizedTeamInviteDraft(required);
  const acceptedCount = entries.filter(
    (entry) => normalizeTeamMemberStatus(entry.status) === TEAM_MEMBER_STATUS.accepted,
  ).length;
  const currentTeamEntries = buildCurrentTeamEntries(activeMembership, entries);

  if (refs.slotsText) {
    refs.slotsText.textContent = hasRegisteredTeam
      ? `Mode ${getTournamentMode(
          currentTournamentMeta,
        )}: invite ${required} teammate${required === 1 ? "" : "s"} (${acceptedCount}/${required} accepted).`
      : `Mode ${getTournamentMode(
          currentTournamentMeta,
        )}: select ${required} teammate${required === 1 ? "" : "s"} (${entries.length}/${required} selected).`;
  }

  if (refs.searchInput) {
    refs.searchInput.disabled = !editable || entries.length >= required;
    if (editable) {
      refs.searchInput.placeholder = "Search username...";
    } else if (activeMembership?.role === "leader") {
      refs.searchInput.placeholder = "Unregister team to edit teammates";
    } else {
      refs.searchInput.placeholder = "Only the team leader can manage invites";
    }
  }
  if (refs.teamNameInput) {
    refs.teamNameInput.disabled = !editable;
    if (editable) {
      refs.teamNameInput.placeholder = "Enter team name...";
    } else if (activeMembership?.role === "leader") {
      refs.teamNameInput.placeholder = "Unregister team to edit team name";
    } else {
      refs.teamNameInput.placeholder = "Only the team leader can manage team";
    }
  }

  if (refs.list) {
    refs.list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "team-invite-empty";
      empty.textContent = "No teammates invited yet.";
      refs.list.appendChild(empty);
    } else {
      entries.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "team-invite-row";
        const nameEl = document.createElement("span");
        nameEl.className = "team-invite-name";
        nameEl.setAttribute("translate", "no");
        nameEl.textContent = entry.name || "Unknown";
        const meta = document.createElement("div");
        meta.className = "team-invite-meta";
        const status = document.createElement("span");
        const normalizedStatus = normalizeTeamMemberStatus(entry.status);
        const isQueued =
          normalizedStatus === TEAM_MEMBER_STATUS.pending &&
          !hasTeamMemberInviteBeenSent(entry);
        status.className = `seed-status ${normalizedStatus}`;
        status.textContent = isQueued
          ? "Queued"
          : normalizedStatus === TEAM_MEMBER_STATUS.accepted
            ? "Accepted"
            : normalizedStatus === TEAM_MEMBER_STATUS.denied
              ? "Denied"
              : "Pending";
        meta.appendChild(status);
        if (editable) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "cta small subtle";
          removeBtn.dataset.teamInviteRemoveUid = entry.uid;
          removeBtn.textContent = "Remove";
          meta.appendChild(removeBtn);
        }
        row.append(nameEl, meta);
        refs.list.appendChild(row);
      });
    }
  }

  if (refs.currentList) {
    refs.currentList.replaceChildren();
    if (!currentTeamEntries.length) {
      const empty = document.createElement("p");
      empty.className = "team-invite-empty";
      empty.textContent = "No active team yet.";
      refs.currentList.appendChild(empty);
    } else {
      currentTeamEntries.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "team-current-row";
        const nameEl = document.createElement("span");
        nameEl.className = "team-current-name";
        nameEl.setAttribute("translate", "no");
        const roleLabel = entry.role === "leader" ? "Leader" : "Teammate";
        nameEl.textContent = entry.name || "Unknown";
        const roleBadge = document.createElement("span");
        roleBadge.className = "role-badge";
        roleBadge.textContent = roleLabel;
        nameEl.appendChild(roleBadge);
        const status = document.createElement("span");
        const normalized = normalizeTeamMemberStatus(entry.status);
        status.className = `seed-status ${normalized}`;
        const isQueued =
          entry.role !== "leader" &&
          normalized === TEAM_MEMBER_STATUS.pending &&
          !hasTeamMemberInviteBeenSent(entry);
        status.textContent = isQueued
          ? "Queued"
          : normalized === TEAM_MEMBER_STATUS.accepted
            ? "Accepted"
            : normalized === TEAM_MEMBER_STATUS.denied
              ? "Denied"
              : "Pending";
        row.append(nameEl, status);
        refs.currentList.appendChild(row);
      });
    }
  }

  if (refs.leaveBtn) {
    const canLeave = Boolean(
      activeMembership && activeMembership.role === "member" && !state.isLive,
    );
    refs.leaveBtn.style.display = canLeave ? "" : "none";
    refs.leaveBtn.disabled = !canLeave;
  }

  if (!editable && activeMembership?.role === "leader") {
    const leaderInviteStatus = normalizeInviteStatus(
      activeMembership.player?.inviteStatus,
    );
    if (leaderInviteStatus === INVITE_STATUS.pending) {
      setTeamInviteStatus(
        "Waiting for teammates to accept in Notification Center.",
        false,
      );
      setTeamCurrentStatus("Team is pending teammate acceptance.", false);
    } else if (leaderInviteStatus === INVITE_STATUS.accepted) {
      setTeamInviteStatus("Team registration is complete.", false);
      setTeamCurrentStatus("Team is fully registered.", false);
    } else {
      setTeamInviteStatus("", false);
      setTeamCurrentStatus("", false);
    }
  } else if (!editable && activeMembership?.role === "member") {
    if (activeMembership.status === TEAM_MEMBER_STATUS.pending) {
      const inviteSent = hasTeamMemberInviteBeenSent(activeMembership.member);
      if (inviteSent) {
        setTeamInviteStatus(
          "You have a pending team invitation. Accept it in the Notification Center.",
          false,
        );
        setTeamCurrentStatus("You have not accepted this team yet.", false);
      } else {
        setTeamInviteStatus(
          `Your leader has not registered this ${getTournamentMode(
            currentTournamentMeta,
          )} team yet. Invitation will appear after they press Register team.`,
          false,
        );
        setTeamCurrentStatus("Team is still in draft.", false);
      }
    } else if (activeMembership.status === TEAM_MEMBER_STATUS.accepted) {
      setTeamInviteStatus("You are already part of a registered team.", false);
      setTeamCurrentStatus("You are currently in this team.", false);
    } else {
      setTeamInviteStatus("", false);
      setTeamCurrentStatus("", false);
    }
  } else if (entries.length < required) {
    setTeamInviteStatus(
      `Invite ${required - entries.length} more teammate${
        required - entries.length === 1 ? "" : "s"
      } to submit team registration.`,
      false,
    );
    setTeamCurrentStatus(
      activeMembership ? "Team is pending teammate acceptance." : "Build your team, then register.",
      false,
    );
  } else {
    if (!hasRegisteredTeam) {
      setTeamInviteStatus(
        `Ready to register. Invitations will be sent when you press Register ${getTournamentMode(
          currentTournamentMeta,
        )} team.`,
        false,
      );
      setTeamCurrentStatus("Team is not registered yet.", false);
      return;
    }
    setTeamInviteStatus("", false);
    setTeamCurrentStatus(
      activeMembership ? "Waiting for teammates to accept in Notification Center." : "",
      false,
    );
  }
}

function initTeamInviteSearchUi() {
  if (teamInviteSearchInitialized) return;
  const refs = getTeamInviteUiRefs();
  if (!refs.searchInput || !refs.searchResults || !refs.list) return;
  teamInviteSearchInitialized = true;

  const renderSearchResults = (results = []) => {
    refs.searchResults.replaceChildren();
    const currentUid = auth.currentUser?.uid || "";
    const activeMembership = getActiveMembershipForUser(currentUid);
    const editable = canEditTeamInviteDraft(activeMembership);
    const required = getRequiredTeammateCount(currentTournamentMeta);
    const entries = getNormalizedTeamInviteDraft(required);
    results.forEach((entry) => {
      const username = String(entry?.username || "").trim();
      const userId = String(entry?.userId || "").trim();
      if (!username || !userId) return;
      const row = document.createElement("div");
      row.className = "admin-search-item";
      const label = document.createElement("span");
      label.textContent = username;
      label.setAttribute("translate", "no");
      const inviteBtn = document.createElement("button");
      inviteBtn.type = "button";
      inviteBtn.className = "cta small ghost";
      inviteBtn.textContent = "Invite";
      inviteBtn.dataset.teamInviteUsername = username;
      inviteBtn.dataset.teamInviteUid = userId;
      const alreadyDrafted = entries.some((item) => item.uid === userId);
      const blockedByTeam = isUidInAnotherTeam(userId, activeMembership?.player?.team?.teamId || "");
      const selfInvite = userId === currentUid;
      const noSlotsLeft = entries.length >= required;
      if (!editable || alreadyDrafted || blockedByTeam || selfInvite || noSlotsLeft) {
        inviteBtn.disabled = true;
        if (alreadyDrafted) inviteBtn.textContent = "Invited";
        else if (blockedByTeam) inviteBtn.textContent = "In team";
        else if (selfInvite) inviteBtn.textContent = "You";
        else if (noSlotsLeft) inviteBtn.textContent = "Full";
      }
      row.append(label, inviteBtn);
      refs.searchResults.appendChild(row);
    });
  };

  const search = createAdminPlayerSearch({
    db,
    getIsEnabled: () => canEditTeamInviteDraft(getActiveMembershipForUser(auth.currentUser?.uid || "")),
    getPlayers: () => [],
    onStatus: (message) => {
      if (!message || message.startsWith("Found")) {
        if (!message) setTeamInviteStatus("", false);
        return;
      }
      setTeamInviteStatus(message, false);
    },
    onResults: renderSearchResults,
    onError: (err) => {
      if (err?.message) {
        setTeamInviteStatus(err.message, true);
      }
    },
    onSuccess: () => {
      refs.searchInput.value = "";
      refs.searchResults.replaceChildren();
    },
    addPlayer: async ({ userId, username }) => {
      const currentUid = auth.currentUser?.uid || "";
      const activeMembership = getActiveMembershipForUser(currentUid);
      const editable = canEditTeamInviteDraft(activeMembership);
      const required = getRequiredTeammateCount(currentTournamentMeta);
      const entries = getNormalizedTeamInviteDraft(required);
      if (!editable) {
        setTeamInviteStatus("Only the team leader can invite teammates.", true);
        return;
      }
      if (entries.length >= required) {
        setTeamInviteStatus("Team invite slots are full.", true);
        return;
      }
      if (userId === currentUid) {
        setTeamInviteStatus("You cannot invite yourself.", true);
        return;
      }
      if (entries.some((entry) => entry.uid === userId)) {
        setTeamInviteStatus("Teammate already invited.", true);
        return;
      }
      if (isUidInAnotherTeam(userId, activeMembership?.player?.team?.teamId || "")) {
        setTeamInviteStatus("This user is already in another team.", true);
        return;
      }
      teamInviteDraft = [
        ...entries,
        {
          uid: userId,
          name: username,
          role: "member",
          status: TEAM_MEMBER_STATUS.pending,
          invitedAt: Date.now(),
          inviteSentAt: null,
          respondedAt: null,
        },
      ];
      teamInviteDraftDirty = true;
      renderTeamInviteSection();
      refs.searchInput.value = "";
      refs.searchResults.replaceChildren();
      setTeamInviteStatus(`Teammate ${username} added.`, false);
    },
  });

  refs.searchInput.addEventListener("input", () => {
    const currentUid = auth.currentUser?.uid || "";
    const activeMembership = getActiveMembershipForUser(currentUid);
    if (!canEditTeamInviteDraft(activeMembership)) {
      refs.searchResults.replaceChildren();
      return;
    }
    search.debouncedSearch(refs.searchInput.value);
  });

  refs.searchResults.addEventListener("click", (event) => {
    const target = event.target.closest("[data-team-invite-username]");
    if (!target) return;
    const username = target.dataset.teamInviteUsername || "";
    const userId = target.dataset.teamInviteUid || "";
    search.addByUsername(username, userId, {});
  });

  refs.list.addEventListener("click", (event) => {
    const removeBtn = event.target.closest("[data-team-invite-remove-uid]");
    if (!removeBtn) return;
    const uid = removeBtn.dataset.teamInviteRemoveUid || "";
    removeDraftInviteByUid(uid);
    renderTeamInviteSection();
  });
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

function resolveRaceMmr(byRace, raceLabel, fallbackMmr) {
  const key = normalizeRaceKey(raceLabel);
  if (key && byRace && Number.isFinite(byRace[key])) {
    return Math.round(byRace[key]);
  }
  if (Number.isFinite(fallbackMmr)) {
    return Math.round(fallbackMmr);
  }
  return null;
}

async function autoFillPlayers() {
  if (bracketHasRecordedResults(state.bracket)) {
    showToast?.("Cannot add players after scores are recorded.", "error");
    return;
  }
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

  const createdPlayers = [];
  picks.forEach((p) => {
    const created = buildPlayerFromData({
      name: p.name,
      race: p.race,
      sc2Link: "",
      mmr: p.mmr,
      points: p.points,
    });
    if (created) createdPlayers.push(created);
  });

  await updateRosterWithTransaction(
    (roster) =>
      createdPlayers.reduce(
        (acc, player) => upsertRosterPlayer(acc, player),
        roster,
      ),
    { needsReseed: false },
    { optimistic: true },
  );
  rebuildBracket(true, "Dev auto-fill");
  addActivity("Auto-filled 32 players for testing.");
  showToast?.("Auto-filled 32 players.", "success");
}

const BOT_NAME_POOL = [
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
const BOT_RACES = ["Zerg", "Protoss", "Terran", "Random"];
const BOT_TEAM_NAME_POOL = [
  "Void Syndicate",
  "Warp Runners",
  "Omega Forge",
  "Nova Pact",
  "Iron Swarm",
  "Arc Tempest",
  "Lunar Echo",
  "Shadow Circuit",
  "Starlight Crew",
  "Quantum Raiders",
];

function isBotPlayer(player) {
  if (!player) return false;
  if (player.isBot) return true;
  const id = String(player.id || "");
  return id.startsWith("bot-") || id.startsWith("test-");
}

function pickBotName(existingNames) {
  const found = BOT_NAME_POOL.find(
    (name) => !existingNames.has(name.toLowerCase()),
  );
  if (found) return found;
  let idx = existingNames.size + 1;
  let name = `Bot ${idx}`;
  while (existingNames.has(name.toLowerCase())) {
    idx += 1;
    name = `Bot ${idx}`;
  }
  return name;
}

function pickBotTeamName(existingTeamNames) {
  const found = BOT_TEAM_NAME_POOL.find(
    (name) => !existingTeamNames.has(name.toLowerCase()),
  );
  if (found) return found;
  let idx = existingTeamNames.size + 1;
  let name = `Team Bot ${idx}`;
  while (existingTeamNames.has(name.toLowerCase())) {
    idx += 1;
    name = `Team Bot ${idx}`;
  }
  return name;
}

async function addBotPlayer() {
  if (state.isLive) {
    showToast?.("Tournament is live. Registration is closed.", "error");
    return;
  }
  if (!isAdmin) {
    showToast?.("Only admins can add bots.", "error");
    return;
  }
  if (bracketHasRecordedResults(state.bracket)) {
    showToast?.("Cannot add bots after scores are recorded.", "error");
    return;
  }
  const players = Array.isArray(state.players) ? [...state.players] : [];
  const existingNames = new Set(
    players
      .map((player) => (player?.name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const tournamentMode = getTournamentMode(currentTournamentMeta);
  const teamSize = getTeamSizeFromMode(tournamentMode);
  const isTeamMode = teamSize > 1;
  const existingTeamNames = new Set(
    players
      .map((player) => String(player?.team?.teamName || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const createdAt = Date.now();
  const botId = `bot-${createdAt.toString(36)}-${Math.random()
    .toString(16)
    .slice(2, 6)}`;
  const leaderName = pickBotName(existingNames);
  existingNames.add(leaderName.toLowerCase());
  const leaderRace = BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)];
  const leaderUid = `${botId}-leader`;
  const bot = {
    id: botId,
    uid: leaderUid,
    name: leaderName,
    race: leaderRace,
    sc2Link: "",
    mmr: 0,
    points: 0,
    seed: null,
    createdAt,
    isBot: true,
  };
  if (isTeamMode) {
    const teamId = `team-${createdAt.toString(36)}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;
    const teamName = pickBotTeamName(existingTeamNames);
    const members = [
      {
        uid: leaderUid,
        name: leaderName,
        role: "leader",
        status: TEAM_MEMBER_STATUS.accepted,
        race: leaderRace,
        sc2Link: "",
        pulseName: "",
        mmr: 0,
        mmrByRace: null,
        secondaryPulseLinks: [],
        secondaryPulseProfiles: [],
        twitchUrl: "",
        country: "",
        avatarUrl: "",
        invitedAt: createdAt,
        inviteSentAt: null,
        respondedAt: createdAt,
      },
    ];
    for (let idx = 1; idx < teamSize; idx += 1) {
      const memberName = pickBotName(existingNames);
      existingNames.add(memberName.toLowerCase());
      const memberRace = BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)];
      members.push({
        uid: `${botId}-m${idx}`,
        name: memberName,
        role: "member",
        status: TEAM_MEMBER_STATUS.accepted,
        race: memberRace,
        sc2Link: "",
        pulseName: "",
        mmr: 0,
        mmrByRace: null,
        secondaryPulseLinks: [],
        secondaryPulseProfiles: [],
        twitchUrl: "",
        country: "",
        avatarUrl: "",
        invitedAt: createdAt,
        inviteSentAt: null,
        respondedAt: createdAt,
      });
    }
    bot.team = {
      teamId,
      mode: tournamentMode,
      size: teamSize,
      leaderUid,
      leaderName,
      teamName,
      createdAt,
      updatedAt: createdAt,
      members,
    };
    bot.inviteStatus = INVITE_STATUS.accepted;
  }
  await updateRosterWithTransaction(
    (roster) => upsertRosterPlayer(roster, bot),
    { needsReseed: true },
  );
  const activityLabel =
    isTeamMode && bot.team?.teamName
      ? `${bot.team.teamName} added`
      : `${leaderName} added`;
  rebuildBracket(true, activityLabel);
  addActivity(`${activityLabel}.`);
}

async function removeAllBots() {
  if (state.isLive) {
    showToast?.("Tournament is live. Registration is closed.", "error");
    return;
  }
  if (!isAdmin) {
    showToast?.("Only admins can remove bots.", "error");
    return;
  }
  const players = Array.isArray(state.players) ? state.players : [];
  const remaining = players.filter((player) => !isBotPlayer(player));
  if (remaining.length === players.length) {
    showToast?.("No bots to remove.", "success");
    return;
  }
  await updateRosterWithTransaction(
    (roster) => roster.filter((player) => !isBotPlayer(player)),
    { needsReseed: true },
  );
  rebuildBracket(true, "Bots removed");
  addActivity("All bots removed.");
}

function updateBotManagerCount() {
  const label = document.getElementById("botCountText");
  const addBotBtn = document.getElementById("addBotBtn");
  const tournamentMode = getTournamentMode(currentTournamentMeta);
  const teamSize = getTeamSizeFromMode(tournamentMode);
  if (addBotBtn) {
    addBotBtn.textContent = teamSize > 1 ? "Add Team Bot" : "Add bot";
  }
  if (!label) return;
  const players = Array.isArray(state.players) ? state.players : [];
  const count = players.filter((player) => isBotPlayer(player)).length;
  label.textContent = `Bots: ${count}`;
}

async function removeBotPlayer() {
  if (state.isLive) {
    showToast?.("Tournament is live. Registration is closed.", "error");
    return;
  }
  if (!isAdmin) {
    showToast?.("Only admins can remove bots.", "error");
    return;
  }
  const players = Array.isArray(state.players) ? state.players : [];
  const idx = players.findIndex((player) => isBotPlayer(player));
  if (idx < 0) {
    showToast?.("No bots to remove.", "success");
    return;
  }
  const removed = players[idx];
  await updateRosterWithTransaction(
    (roster) => removeRosterById(roster, removed.id),
    { needsReseed: true },
  );
  rebuildBracket(true, "Bot removed");
  addActivity(`${removed?.name || "Bot"} removed.`);
}

async function handleRegistration(event) {
  event.preventDefault();
  if (state.isLive) {
    showToast?.("Tournament is live. Registration is closed.", "error");
    return;
  }
  const name = document.getElementById("playerNameInput")?.value.trim();
  const statusEl = document.getElementById("mmrStatus");
  const pulseProfileUrl = normalizeSc2PulseIdUrl(pulseProfile?.url || "");
  const pulseLinkInput = document.getElementById("pulseLinkDisplay");
  const manualPulseLink = pulseLinkInput?.value?.trim() || "";
  const manualPulseUrl = manualPulseLink
    ? normalizeSc2PulseIdUrl(manualPulseLink)
    : "";
  const sc2LinkInput = pulseProfileUrl || manualPulseUrl || "";
  const requirePulseLinkEnabled = getRequirePulseLinkEnabled();
  const pointsField = document.getElementById("pointsInput");
  const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);
  const inviteToken = getInviteTokenFromUrl();
  const needsInviteLink = Boolean(isInviteOnly && !isAdmin);
  const tournamentMode = getTournamentMode(currentTournamentMeta);
  const teamSize = getTeamSizeFromMode(tournamentMode);
  const isTeamMode = teamSize > 1;
  const requiredTeammates = Math.max(0, teamSize - 1);
  const teamNameInput = document.getElementById("teamNameInput");
  const teamName = String(teamNameInput?.value || "").trim();

  if (!auth.currentUser) {
    setStatus(
      statusEl,
      "Sign in and add your SC2Pulse link in Settings first.",
      true,
    );
    return;
  }

  const currentUid = auth.currentUser?.uid || "";
  const activeTeamMembership = getActiveMembershipForUser(currentUid);
  if (isTeamMode && activeTeamMembership?.role === "member") {
    const status = activeTeamMembership.status;
    if (status === TEAM_MEMBER_STATUS.pending) {
      const inviteSent = hasTeamMemberInviteBeenSent(activeTeamMembership.member);
      setStatus(
        statusEl,
        inviteSent
          ? "Your team invite is still pending. Accept it in Notification Center."
          : "Your leader has not registered this team yet.",
        true,
      );
      return;
    }
    if (status === TEAM_MEMBER_STATUS.accepted) {
      setStatus(statusEl, "You are already part of a registered team.", true);
      return;
    }
  }

  const existingPlayer = (state.players || []).find(
    (p) => p.uid === auth.currentUser?.uid,
  );
  if (existingPlayer) {
    const inviteStatus = normalizeInviteStatus(existingPlayer.inviteStatus);
    if (!isTeamMode && inviteStatus === INVITE_STATUS.pending) {
      setStatus(statusEl, "Your invite is still pending.", true);
      return;
    }
    if (!isTeamMode && inviteStatus === INVITE_STATUS.denied) {
      setStatus(statusEl, "Your invite was declined.", true);
      return;
    }
    await updateRosterWithTransaction(
      (players) => removeRosterByUid(players, auth.currentUser?.uid),
      { needsReseed: true },
    );
    rebuildBracket(true, "Player removed");
    addActivity(`${existingPlayer.name} unregistered.`);
    showToast?.("You have been unregistered.", "success");
    if (isTeamMode) {
      teamInviteDraft = [];
      teamInviteDraftDirty = false;
      setTeamInviteStatus("");
    }
    event.target.reset();
    hydratePulseFromState(pulseProfile);
    renderAll();
    return;
  }

  if (needsInviteLink) {
    if (!inviteToken) {
      setStatus(
        statusEl,
        "This tournament is invite-only. Ask an admin for an invite link or a manual invite.",
        true,
      );
      return;
    }
    const gateMatches =
      inviteLinkGate?.slug === currentSlug &&
      inviteLinkGate?.token === inviteToken;
    if (
      gateMatches &&
      inviteLinkGate.status === "ready" &&
      !inviteLinkGate.ok
    ) {
      setStatus(
        statusEl,
        inviteLinkGate.message || "Invite link invalid.",
        true,
      );
      return;
    }
  }

  if (!name) {
    const message = "Player name is required.";
    setStatus(statusEl, message, true);
    showToast?.(message, "error");
    return;
  }
  if (bracketHasRecordedResults(state.bracket)) {
    setStatus(
      statusEl,
      "Registration is locked once scores are recorded.",
      true,
    );
    showToast?.("Registration is locked once scores are recorded.", "error");
    return;
  }
  if (name.toLowerCase() === "guest") {
    const message = 'Player name cannot be "Guest".';
    setStatus(statusEl, message, true);
    showToast?.(message, "error");
    return;
  }
  if (!/[A-Za-z]/.test(name)) {
    const message = "Player name must include at least one letter.";
    setStatus(statusEl, message, true);
    showToast?.(message, "error");
    return;
  }
  if (isTeamMode && !teamName) {
    const message = "Team name is required for team registration.";
    setStatus(statusEl, message, true);
    setTeamInviteStatus(message, true);
    showToast?.(message, "error");
    return;
  }

  const teamInviteEntries = isTeamMode
    ? getNormalizedTeamInviteDraft(requiredTeammates)
    : [];
  if (isTeamMode) {
    if (teamInviteEntries.length !== requiredTeammates) {
      const message = `Invite exactly ${requiredTeammates} teammate${
        requiredTeammates === 1 ? "" : "s"
      } for ${tournamentMode}.`;
      setStatus(statusEl, message, true);
      setTeamInviteStatus(message, true);
      return;
    }
    const seen = new Set([currentUid]);
    const ignoreTeamId = String(activeTeamMembership?.player?.team?.teamId || "");
    for (const teammate of teamInviteEntries) {
      const teammateUid = String(teammate?.uid || "").trim();
      if (!teammateUid) {
        const message = "Each teammate invite must target a valid user.";
        setStatus(statusEl, message, true);
        setTeamInviteStatus(message, true);
        return;
      }
      if (seen.has(teammateUid)) {
        const message = "Duplicate teammate invites are not allowed.";
        setStatus(statusEl, message, true);
        setTeamInviteStatus(message, true);
        return;
      }
      seen.add(teammateUid);
      if (isUidInAnotherTeam(teammateUid, ignoreTeamId)) {
        const message = `${teammate.name || "A teammate"} is already in another team.`;
        setStatus(statusEl, message, true);
        setTeamInviteStatus(message, true);
        return;
      }
    }
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
    const message = "This tournament requires your SC2Pulse link.";
    setStatus(statusEl, message, true);
    showToast?.(message, "error");
    return;
  }
  if (manualPulseLink && !manualPulseUrl) {
    const message = "SC2Pulse link must include a character id (id=...).";
    setStatus(statusEl, message, true);
    if (requirePulseLinkEnabled) {
      showToast?.(message, "error");
    }
    return;
  }
  if (!manualPulseLink && pulseProfile?.url && !pulseProfileUrl) {
    const message =
      "Update your SC2Pulse link in Settings to include a character id.";
    setStatus(statusEl, message, true);
    if (requirePulseLinkEnabled) {
      showToast?.(message, "error");
    }
    return;
  }

  setRegisterLoadingState(true);
  try {
    if (sc2LinkInput) {
      try {
        const payload = await fetchPulseMmrFromBackend(sc2LinkInput);
        const byRace = payload.byRace || null;
        const overall = Number.isFinite(payload.mmr)
          ? Math.round(payload.mmr)
          : null;
        hydratePulseFromState({
          url: payload.url || sc2LinkInput,
          byRace,
          mmr: overall,
          fetchedAt: payload.fetchedAt ?? Date.now(),
          accountName: payload.pulseName || "",
          secondary: pulseProfile?.secondary || [],
        });
        updateMmrDisplay(statusEl);
      } catch (err) {
        const message = err?.message || "Failed to fetch MMR from SC2Pulse.";
        setStatus(statusEl, message, true);
        return;
      }
    }

    const raceSelect = document.getElementById("raceSelect");
    const selectedRace =
      normalizeRaceLabel(raceSelect?.value) || derivedRace || "";
    const race = selectedRace;
    const mmr = mmrForRace(race);

    const qualification = await enforceCircuitFinalQualification({
      name,
      sc2Link: sc2LinkInput,
      uid: auth.currentUser?.uid || "",
      currentTournamentMeta,
      currentSlug,
      fetchCircuitMeta,
      buildCircuitLeaderboard,
      playerKey,
    });
    if (!qualification.ok) {
      setStatus(
        statusEl,
        qualification.message || "Registration is restricted.",
        true,
      );
      return;
    }

    if (!race) {
      setStatus(
        statusEl,
        "Could not load your MMR. Refresh SC2Pulse in Settings.",
        true,
      );
      return;
    }

    if (startingPoints === null && currentTournamentMeta?.circuitSlug && name) {
      startingPoints = await getCircuitSeedPoints({
        name,
        sc2Link: sc2LinkInput,
        uid: auth.currentUser?.uid || "",
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
      setStatus(statusEl, `No rank found for ${race} - seeding as 0.`, true);
    }

    const avatarUrl = getCurrentUserAvatarUrl();
    if (!avatarUrl || isGoogleAvatarUrl(avatarUrl)) {
      setStatus(
        statusEl,
        "Choose your Z-Build Order avatar in Settings before registering (Google profile pictures are not allowed).",
        true,
      );
      return;
    }
    const profile = getCurrentUserProfile?.() || {};
    const twitchUrl =
      document.getElementById("settingsTwitchInput")?.value?.trim() ||
      profile?.twitchUrl ||
      "";
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
    const profileCountry = profile?.country || "";
    const profileMainClanId =
      getCurrentUserProfile?.()?.settings?.mainClanId || "";
    const effectiveClanId = selectedClanId || profileMainClanId;
    const countryCode =
      document
        .getElementById("settingsCountrySelect")
        ?.value?.trim()
        .toUpperCase() ||
      String(profileCountry).trim().toUpperCase() ||
      "";
    let clanName = selectedClanOption?.textContent || "";
    let clanAbbreviation = selectedClanOption?.dataset?.abbr || "";
    let clanLogoUrl = selectedClanOption?.dataset?.logoUrl || "";
    if (effectiveClanId) {
      try {
        const clanDoc = await getDoc(doc(db, "clans", effectiveClanId));
        if (clanDoc.exists()) {
          const clanData = clanDoc.data();
          clanName = clanData?.name || clanName;
          clanAbbreviation = clanData?.abbreviation || clanAbbreviation;
          clanLogoUrl =
            clanData?.logoUrlSmall || clanData?.logoUrl || clanLogoUrl;
        }
      } catch (err) {
        console.warn("Could not fetch clan abbreviation", err);
      }
    }

    let inviteLinkMeta = null;
    if (needsInviteLink) {
      const claim = await claimInviteLinkUse({
        slug: currentSlug,
        token: inviteToken,
      });
      if (!claim.ok) {
        setStatus(statusEl, claim.message || "Invite link invalid.", true);
        await refreshInviteLinkGate(currentSlug);
        renderAll();
        return;
      }
      inviteLinkMeta = {
        invitedAt: Date.now(),
        invitedByName: "Invite link",
      };
    }

    const now = Date.now();
    const checkInState = getCheckInWindowState(currentTournamentMeta);
    const autoCheckedInAt = checkInState.isOpen ? now : null;
    const leaderName = name;
    const teamId =
      existingPlayer?.team?.teamId ||
      `team-${now.toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    const normalizedTeamMembers = isTeamMode
      ? [
          {
            uid: currentUid,
            name: leaderName,
            role: "leader",
            status: TEAM_MEMBER_STATUS.accepted,
            race,
            sc2Link: sc2LinkInput,
            pulseName: pulseProfile?.accountName || "",
            mmr: Number.isFinite(mmr) ? Math.max(0, Number(mmr)) : 0,
            mmrByRace: mmrByRace || null,
            secondaryPulseLinks,
            secondaryPulseProfiles,
            twitchUrl,
            country: countryCode || "",
            avatarUrl,
            invitedAt:
              Number.isFinite(Number(existingPlayer?.team?.createdAt))
                ? Number(existingPlayer.team.createdAt)
                : now,
            inviteSentAt: null,
            respondedAt: now,
          },
          ...teamInviteEntries.map((entry) => ({
            uid: entry.uid,
            name: entry.name,
            role: "member",
            status: normalizeTeamMemberStatus(entry.status),
            race: String(entry?.race || "").trim(),
            sc2Link: String(entry?.sc2Link || "").trim(),
            pulseName: String(entry?.pulseName || "").trim(),
            mmr: Number.isFinite(Number(entry?.mmr)) ? Math.max(0, Number(entry.mmr)) : 0,
            mmrByRace:
              entry?.mmrByRace && typeof entry.mmrByRace === "object"
                ? { ...entry.mmrByRace }
                : null,
            secondaryPulseLinks: Array.isArray(entry?.secondaryPulseLinks)
              ? entry.secondaryPulseLinks
              : [],
            secondaryPulseProfiles: Array.isArray(entry?.secondaryPulseProfiles)
              ? entry.secondaryPulseProfiles
              : [],
            twitchUrl: String(entry?.twitchUrl || "").trim(),
            country: String(entry?.country || "").trim(),
            avatarUrl: String(entry?.avatarUrl || "").trim(),
            invitedAt: Number.isFinite(Number(entry.invitedAt))
              ? Number(entry.invitedAt)
              : now,
            inviteSentAt: Number.isFinite(Number(entry.inviteSentAt))
              ? Number(entry.inviteSentAt)
              : null,
            respondedAt: Number.isFinite(Number(entry.respondedAt))
              ? Number(entry.respondedAt)
              : null,
          })),
        ]
      : [];
    const allTeamMembersAccepted =
      !isTeamMode ||
      (normalizedTeamMembers.length === teamSize &&
        normalizedTeamMembers.every(
          (member) =>
            normalizeTeamMemberStatus(member.status) === TEAM_MEMBER_STATUS.accepted,
        ));
    const inviteStatus = allTeamMembersAccepted
      ? INVITE_STATUS.accepted
      : INVITE_STATUS.pending;
    const newPlayer = buildPlayerFromData({
      name,
      race,
      sc2Link: sc2LinkInput,
      mmr: Number.isFinite(mmr) ? mmr : 0,
      points: startingPoints,
      inviteStatus,
      ...(autoCheckedInAt && inviteStatus === INVITE_STATUS.accepted
        ? { checkedInAt: autoCheckedInAt }
        : {}),
      ...(inviteLinkMeta || {}),
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
      ...(isTeamMode
        ? {
            team: {
              teamId,
              mode: tournamentMode,
              size: teamSize,
              leaderUid: currentUid,
              leaderName,
              teamName,
              createdAt:
                Number.isFinite(Number(existingPlayer?.team?.createdAt))
                  ? Number(existingPlayer.team.createdAt)
                  : now,
              updatedAt: now,
              members: normalizedTeamMembers,
            },
          }
        : {}),
    });

    const hasCompletedMatches = bracketHasResults();
    await updateRosterWithTransaction(
      (players) => upsertRosterPlayer(players, newPlayer),
      { needsReseed: hasCompletedMatches },
      { optimistic: true },
    );
    addActivity(
      `${newPlayer.name} saved (${newPlayer.mmr || "MMR?"} MMR, ${
        newPlayer.points
      } pts)`,
    );

    if (!isTeamMode || inviteStatus === INVITE_STATUS.accepted) {
      markRegisteredTournament(currentSlug);
    }

    if (isTeamMode) {
      const pendingTeammates = normalizedTeamMembers.filter(
        (member) =>
          member.role !== "leader" &&
          normalizeTeamMemberStatus(member.status) === TEAM_MEMBER_STATUS.pending &&
          !member.inviteSentAt,
      );
      if (pendingTeammates.length) {
        const sentUids = [];
        let failedCount = 0;
        for (const teammate of pendingTeammates) {
          try {
            await sendTeamInviteNotification({
              db,
              auth,
              getCurrentUsername,
              userId: teammate.uid,
              teammateName: teammate.name,
              tournamentMeta: currentTournamentMeta,
              slug: currentSlug,
              teamId,
              leaderName,
              mode: tournamentMode,
            });
            sentUids.push(teammate.uid);
          } catch (err) {
            console.error("Failed to send teammate invite notification", err);
            failedCount += 1;
          }
        }
        if (failedCount > 0) {
          showToast?.(
            "Team created, but some teammate notifications failed to send.",
            "error",
          );
        }
        if (sentUids.length) {
          const sentAt = Date.now();
          await updateRosterWithTransaction(
            (players) =>
              (players || []).map((player) => {
                if ((player?.id || "") !== (newPlayer?.id || "")) return player;
                const members = Array.isArray(player?.team?.members)
                  ? player.team.members
                  : [];
                return {
                  ...player,
                  team: {
                    ...(player.team || {}),
                    updatedAt: sentAt,
                    members: members.map((member) => {
                      if (!sentUids.includes(member?.uid)) return member;
                      return {
                        ...member,
                        inviteSentAt:
                          Number.isFinite(Number(member?.inviteSentAt))
                            ? Number(member.inviteSentAt)
                            : sentAt,
                      };
                    }),
                  },
                };
              }),
            {},
            { optimistic: true },
          );
        }
      }
      teamInviteDraftDirty = false;
      syncTeamInviteDraftFromPlayer(newPlayer, teamSize);
    }

    const shouldAutoRebuild = !hasCompletedMatches;
    if (shouldAutoRebuild) {
      rebuildBracket(true, "Roster updated");
    } else {
      if (!state.bracket || !state.bracket.winners?.length) {
        rebuildBracket(true, "Initial bracket");
      } else {
        renderAll();
      }
    }
    if (isTeamMode && inviteStatus !== INVITE_STATUS.accepted) {
      showToast?.(
        `${teamName}'s team is pending. Teammates must accept in Notification Center.`,
        "success",
      );
    } else {
      showToast?.(`${newPlayer.name} added to the bracket`, "success");
    }

    event.target.reset();
    hydratePulseFromState(pulseProfile);
  } finally {
    setRegisterLoadingState(false);
  }
}

function mmrForRace(raceLabel) {
  const key = normalizeRaceKey(raceLabel);
  const byRace = pulseProfile?.byRace || null;
  if (key && byRace && Number.isFinite(byRace[key])) {
    return Math.round(byRace[key]);
  }
  return null;
}

function updateMmrDisplay(statusEl, nextRace = null, options = {}) {
  if (nextRace !== null) {
    setDerivedRaceState(nextRace || null);
    setDerivedMmrState(nextRace ? mmrForRace(nextRace) : null);
  }

  if (!statusEl) statusEl = document.getElementById("mmrStatus");
  if (!statusEl) return;

  const resolveOverride = (value, fallback) =>
    value === undefined ? fallback : Boolean(value);
  const requirePulseLinkEnabled = resolveOverride(
    options.requirePulseLinkEnabled,
    getRequirePulseLinkEnabled(),
  );

  if (!auth.currentUser) {
    setStatus(
      statusEl,
      requirePulseLinkEnabled
        ? "Sign in and set your SC2Pulse link in Settings to register."
        : "Sign in to register.",
      true,
    );
    return;
  }

  if (!pulseProfile?.url) {
    setStatus(
      statusEl,
      requirePulseLinkEnabled
        ? "Set your SC2Pulse link in Settings to load race and MMR."
        : "SC2Pulse link is optional. Add one in Settings to load race and MMR.",
      requirePulseLinkEnabled,
    );
    return;
  }

  if (derivedRace && Number.isFinite(derivedMmr)) {
    setStatus(
      statusEl,
      `Using ${derivedRace} @ ${derivedMmr} MMR from SC2Pulse.`,
      false,
    );
  } else if (derivedRace) {
    setStatus(
      statusEl,
      `No rank found for ${derivedRace} — seeding as 0.`,
      true,
    );
  } else if (pulseProfile?.url) {
    setStatus(statusEl, "Waiting for MMR. Refresh SC2Pulse in Settings.", true);
  }
}

function collectSecondaryPulseLinks() {
  const inputs = document.querySelectorAll(
    "#secondaryPulseList .secondary-pulse-input",
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

async function syncCurrentPlayerAvatar(avatarUrl) {
  const uid = auth?.currentUser?.uid || null;
  if (!uid) return;
  const normalized = String(avatarUrl || "").trim();
  if (!normalized) return;
  const players = state.players || [];
  const idx = players.findIndex((player) => player.uid === uid);
  if (idx < 0) return;
  const existing = players[idx] || {};
  if (existing.avatarUrl === normalized) return;
  await updateRosterWithTransaction((roster) =>
    updateRosterByUid(roster, uid, { avatarUrl: normalized }),
  );
  renderAll();
  refreshPlayerDetailModalIfOpen(getPlayersMap);
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
    bracket.winnersRoundCount,
  );
  const losers = clampRounds(
    normalizeRounds(bracket.losers),
    bracket.losersRoundCount,
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

function getMatchLookupForTesting() {
  return getMatchLookup(state.bracket || {});
}
export { getMatchLookupForTesting, rebuildBracket };
