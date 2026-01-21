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
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
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
  renderSimpleMatch,
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
  openMatchInfoModalUsingDeps,
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
  submitMatchScoreRemote,
  loadTournamentStateRemote,
  getStorageKey as getPersistStorageKey,
  getRegisteredTournaments,
  setRegisteredTournament,
  loadTournamentRegistry,
  loadCircuitRegistry,
  updateTournamentRosterRemote,
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
import { syncQuillById } from "./markdownEditor.js";
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
const CURRENT_BRACKET_LAYOUT_VERSION = 55;
const MAX_TOURNAMENT_IMAGE_SIZE = 12 * 1024 * 1024;
const COVER_TARGET_WIDTH = 1200;
const COVER_TARGET_HEIGHT = 675;
const COVER_CARD_WIDTH = 320;
const COVER_CARD_HEIGHT = 180;
const SPONSOR_LOGO_SIZE = 256;
const COVER_QUALITY = 0.82;
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
  if (!incoming || typeof incoming !== "object") return;
  const incomingPlayersArr = Array.isArray(incoming?.players)
    ? incoming.players
    : [];
  const localPlayersArr = Array.isArray(state?.players) ? state.players : [];

  const incomingUids = incomingPlayersArr.map((p) => p?.uid).filter(Boolean);
  const localUids = localPlayersArr.map((p) => p?.uid).filter(Boolean);

  const incomingNames = incomingPlayersArr.map((p) => p?.name).filter(Boolean);
  const localNames = localPlayersArr.map((p) => p?.name).filter(Boolean);

  const localOnly = localUids.filter((uid) => !incomingUids.includes(uid));
  const incomingOnly = incomingUids.filter((uid) => !localUids.includes(uid));

  // debug logging removed

  if (
    incomingPlayersArr.length === 0 &&
    Array.isArray(state?.players) &&
    state.players.length > 0
  ) {
    console.warn(
      "🛑 [tournament-sync] syncFromRemote ignored empty incoming.players",
      {
        slug: currentSlug,
        incomingLastUpdated: Number(incoming?.lastUpdated) || 0,
        localPlayersCount: state.players.length,
      },
    );
    return;
  }

  const incomingPresence = incoming.presence?.matchInfo || null;
  const currentPresence = state?.presence?.matchInfo || null;
  const presenceChanged =
    incomingPresence &&
    JSON.stringify(incomingPresence) !== JSON.stringify(currentPresence || {});
  const matchVetoesChangedEarly = !safeJsonEqual(
    incoming.matchVetoes || {},
    state.matchVetoes || {},
  );
  const casterChanged =
    JSON.stringify(incoming.casterRequests || []) !==
      JSON.stringify(state.casterRequests || []) ||
    JSON.stringify(incoming.casters || []) !==
      JSON.stringify(state.casters || []) ||
    JSON.stringify(incoming.matchCasts || {}) !==
      JSON.stringify(state.matchCasts || {});

  if (
    incoming.lastUpdated &&
    incoming.lastUpdated <= state.lastUpdated &&
    !casterChanged &&
    !matchVetoesChangedEarly
  ) {
    if (presenceChanged) {
      setStateObj({ ...state, presence: { matchInfo: incomingPresence } });
      refreshMatchInfoPresenceIfOpen?.();
    }
    return;
  }
  const prevState = state;
  const nextPlayers = applyRosterSeedingWithMode(
    incoming.players || [],
    incoming,
  );
  const nextBracket = deserializeBracket(incoming.bracket);
  const inProgressVetoId =
    currentVetoMatchId && vetoState && vetoState.stage !== "done"
      ? currentVetoMatchId
      : null;
  const inProgressVeto = inProgressVetoId
    ? {
        maps: vetoState?.picks || [],
        vetoed: vetoState?.vetoed || [],
        bestOf: vetoState?.bestOf || 1,
        updatedAt: vetoState?.updatedAt || Date.now(),
        participants: {
          lower: vetoState?.lowerName || "Lower seed",
          higher: vetoState?.higherName || "Higher seed",
        },
        mapResults: state.matchVetoes?.[inProgressVetoId]?.mapResults || [],
      }
    : null;
  const nextState = {
    ...defaultState,
    ...incoming,
    players: nextPlayers,
    pointsLedger: incoming.pointsLedger || {},
    activity: incoming.activity || [],
    bracket: nextBracket,
  };
  nextState.matchVetoes = mergeMatchVetoes(
    state.matchVetoes || {},
    nextState.matchVetoes || {},
  );
  if (inProgressVetoId && inProgressVeto) {
    const incomingEntry = nextState.matchVetoes?.[inProgressVetoId] || null;
    const incomingUpdated = Number(incomingEntry?.updatedAt) || 0;
    const localUpdated = Number(inProgressVeto.updatedAt) || 0;
    if (localUpdated >= incomingUpdated) {
      nextState.matchVetoes = {
        ...(nextState.matchVetoes || {}),
        [inProgressVetoId]: inProgressVeto,
      };
    }
  }
  const activityChanged = !safeJsonEqual(
    prevState.activity || [],
    nextState.activity || [],
  );
  const matchVetoesChanged = !safeJsonEqual(
    prevState.matchVetoes || {},
    nextState.matchVetoes || {},
  );
  const onlyVetoChange =
    matchVetoesChanged &&
    !activityChanged &&
    prevState.isLive === nextState.isLive &&
    prevState.hasBeenLive === nextState.hasBeenLive &&
    prevState.disableFinalAutoAdd === nextState.disableFinalAutoAdd &&
    prevState.needsReseed === nextState.needsReseed &&
    prevState.bracketLayoutVersion === nextState.bracketLayoutVersion &&
    safeJsonEqual(prevState.players || [], nextState.players || []) &&
    safeJsonEqual(prevState.bracket || null, nextState.bracket || null) &&
    safeJsonEqual(prevState.pointsLedger || {}, nextState.pointsLedger || {}) &&
    safeJsonEqual(
      prevState.manualSeedingEnabled,
      nextState.manualSeedingEnabled,
    ) &&
    safeJsonEqual(
      prevState.manualSeedingOrder || [],
      nextState.manualSeedingOrder || [],
    ) &&
    safeJsonEqual(prevState.matchCasts || {}, nextState.matchCasts || {}) &&
    safeJsonEqual(prevState.scoreReports || {}, nextState.scoreReports || {}) &&
    safeJsonEqual(prevState.casters || [], nextState.casters || []) &&
    safeJsonEqual(
      prevState.casterRequests || [],
      nextState.casterRequests || [],
    );
  const stripVetoState = (value) => {
    const trimmed = { ...(value || {}) };
    delete trimmed.matchVetoes;
    delete trimmed.lastUpdated;
    delete trimmed.presence;
    return trimmed;
  };
  const vetoOnlyChange =
    matchVetoesChanged &&
    safeJsonEqual(stripVetoState(prevState), stripVetoState(nextState));
  let allowPartial = shouldUsePartialRender(
    prevState,
    nextState,
    currentTournamentMeta?.format,
  );
  let matchIds = [];
  if (allowPartial) {
    const bracketMatchIds = getBracketMatchIdsForPartial(
      prevState.bracket,
      nextBracket,
    );
    if (bracketMatchIds === null) {
      allowPartial = false;
    } else {
      const combined = new Set(bracketMatchIds);
      getChangedMatchIdsFromMap(
        prevState.matchCasts,
        nextState.matchCasts,
      ).forEach((id) => combined.add(id));
      getChangedMatchIdsFromMap(
        prevState.scoreReports,
        nextState.scoreReports,
      ).forEach((id) => combined.add(id));
      matchIds = Array.from(combined).filter(Boolean);
    }
  }
  setStateObj(nextState);
  maybeToastMyMatchReady(prevState, nextState);

  // Auto-open the inspector when a user match becomes ready (opponent advances)
  maybeAutoOpenReadyMatch(prevState, nextState);

  if (onlyVetoChange || vetoOnlyChange) {
    refreshMatchInfoModalIfOpen?.();
    refreshVetoModalIfOpen?.();
    return;
  }

  if (
    allowPartial &&
    !matchIds.length &&
    matchVetoesChanged &&
    !activityChanged
  ) {
    refreshMatchInfoModalIfOpen?.();
    refreshVetoModalIfOpen?.();
    return;
  }
  if (allowPartial && matchIds.length) {
    renderAll(matchIds);
    if (activityChanged) {
      renderActivityList({ state, escapeHtml, formatTime });
    }
  } else if (allowPartial && activityChanged) {
    renderActivityList({ state, escapeHtml, formatTime });
  } else {
    renderAll();
  }
  refreshPlayerDetailModalIfOpen(getPlayersMap);
  refreshMatchInfoModalIfOpen?.();
  if (matchVetoesChanged) {
    refreshVetoModalIfOpen?.();
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

function findFirstReadyMatchForCurrentUser(snapshot) {
  if (!snapshot?.bracket) return null;

  const lookup = getMatchLookup(snapshot.bracket);
  const playersById = getPlayersMap(); // you already have this helper in index.js

  for (const match of getAllMatches(snapshot.bracket)) {
    if (!match?.id) continue;
    if (match.status === "complete") continue;

    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    if (!pA || !pB) continue; // not ready

    if (
      isCurrentUserTournamentPlayer(pA) ||
      isCurrentUserTournamentPlayer(pB)
    ) {
      return match;
    }
  }
  return null;
}

function collectUserReadyMatchIds(snapshot) {
  const uid = auth?.currentUser?.uid || null;
  if (!uid) return new Set();
  const bracket = snapshot?.bracket || null;
  if (!bracket) return new Set();

  const lookup = getMatchLookup(bracket);
  const playersById = new Map(
    (snapshot?.players || []).map((player) => [player?.id, player]),
  );

  const out = new Set();
  getAllMatches(bracket).forEach((match) => {
    if (!match || !match.id) return;
    if (match.status === "complete") return;

    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    if (!pA || !pB) return; // not ready yet

    if (pA?.uid === uid || pB?.uid === uid) {
      out.add(match.id);
    }
  });

  return out;
}

function isMatchInspectorOpen() {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return false;
  return modal.classList.contains("is-open");
}

function maybeAutoOpenReadyMatch(prevSnapshot, nextSnapshot) {
  const { isOpen, matchId: inspectorMatchId } = getMatchInspectorState();

  const prevReady = collectUserReadyMatchIds(prevSnapshot);
  const nextReady = collectUserReadyMatchIds(nextSnapshot);

  // Find first "newly ready" match for current user
  let newlyReadyId = "";
  for (const id of nextReady) {
    if (!prevReady.has(id)) {
      newlyReadyId = id;
      break;
    }
  }
  if (!newlyReadyId) return;

  // If inspector closed, open it.
  if (!isOpen) {
    openMatchInfoModalUsingDeps(newlyReadyId);
    return;
  }

  // If inspector already on that match, do nothing.
  if (inspectorMatchId === newlyReadyId) return;

  // If user is currently "waiting" inside inspector on their own match, do nothing.
  // (This preserves your original requirement.)
  if (isInspectorShowingUserWaitingMatch(nextSnapshot, inspectorMatchId))
    return;

  // Otherwise: inspector is open on some other match (like your screenshot),
  // so switch it to your newly ready match.
  openMatchInfoModalUsingDeps(newlyReadyId);
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

function mergeMatchVetoes(local = {}, incoming = {}) {
  const out = { ...incoming };
  Object.keys(local || {}).forEach((matchId) => {
    const localEntry = local[matchId];
    const incomingEntry = incoming[matchId];
    const localUpdated = Number(localEntry?.updatedAt) || 0;
    const incomingUpdated = Number(incomingEntry?.updatedAt) || 0;
    if (!incomingEntry || localUpdated > incomingUpdated) {
      out[matchId] = localEntry;
    }
  });
  return out;
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

      syncFromRemote({
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

function seedEligiblePlayersWithMode(players = [], snapshot = state) {
  const eligible = getEligiblePlayers(players);
  const seededEligible = seedPlayersForState(eligible, snapshot);
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
  if (!currentTournamentMeta) return;
  const placementsRow = document.getElementById("tournamentPlacements");
  const placementFirst = document.getElementById("placementFirst");
  const placementSecond = document.getElementById("placementSecond");
  const placementThirdFourth = document.getElementById("placementThirdFourth");
  if (
    !placementsRow ||
    !placementFirst ||
    !placementSecond ||
    !placementThirdFourth
  )
    return;
  const eligiblePlayers = getEligiblePlayers(state.players || []);
  const placements = computePlacementsForBracket(
    state.bracket,
    eligiblePlayers.length || 0,
  );
  if (!placements) {
    placementsRow.style.display = "none";
    return;
  }
  const playersById = getPlayersMap();
  const firstId = Array.from(placements.entries()).find(
    ([, p]) => p === 1,
  )?.[0];
  const secondId = Array.from(placements.entries()).find(
    ([, p]) => p === 2,
  )?.[0];
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

function renderAll(matchIds = null) {
  const bracketContainer = document.getElementById("bracketGrid");
  const bracket = state.bracket;
  const playersArr = state.players || [];
  const format = currentTournamentMeta?.format || "Tournament";
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
      annotateConnectorPlayers(lookup, playersById);
      clampScoreSelectOptions();
      updatePlacementsRow();
      applyBracketReadOnlyState(!state.isLive && !isAdmin);
      updateTooltips?.();
      return;
    }
  }
  // Update seeding table
  const seedingSnapshot = seedPlayersForState(state.players || [], state);
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

  if (currentTournamentMeta) {
    const tournamentTitle = document.getElementById("tournamentTitle");
    const tournamentFormat = document.getElementById("tournamentFormat");
    const tournamentStart = document.getElementById("tournamentStart");
    const descriptionBody = document.getElementById(
      "tournamentDescriptionBody",
    );
    const rulesBody = document.getElementById("tournamentRulesBody");
    const statPlayers = document.getElementById("statPlayers");
    const registerBtn = document.getElementById("registerBtn");
    const goLiveBtn = document.getElementById("rebuildBracketBtn");
    const notifyCheckInBtn = document.getElementById("notifyCheckInBtn");
    const refreshMmrBtn = document.getElementById("refreshMmrBtn");
    const resetTournamentBtn = document.getElementById("resetTournamentBtn");
    const resetScoresBtn = document.getElementById("resetScoresBtn");
    const resetVetoScoreChatBtn = document.getElementById(
      "resetVetoScoreChatBtn",
    );
    const startMs = getStartTimeMs(currentTournamentMeta);
    const liveDot = document.getElementById("liveDot");
    const bracketGrid = document.getElementById("bracketGrid");
    const bracketNotLive = document.getElementById("bracketNotLive");
    const matchInfoModal = document.getElementById("matchInfoModal");
    const bracketNotLiveMessage = document.getElementById(
      "bracketNotLiveMessage",
    );
    const registeredPlayersList = document.getElementById(
      "registeredPlayersList",
    );
    const activityCard = document.getElementById("activityCard");
    const casterLiveCard = document.getElementById("casterLiveCard");
    const bracketTitle = document.getElementById("bracketTitle");
    const currentUid = auth.currentUser?.uid || null;
    const currentPlayer = currentUid
      ? (state.players || []).find((p) => p.uid === currentUid)
      : null;
    const currentInviteStatus = normalizeInviteStatus(
      currentPlayer?.inviteStatus,
    );
    const eligiblePlayers = getEligiblePlayers(state.players || []);
    const hasCheckedIn = eligiblePlayers.some((player) => player.checkedInAt);
    const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);
    const accessNote = document.getElementById("registrationAccessNote");
    const registrationForm = document.getElementById("registrationForm");
    const registrationCard = document.getElementById("registrationCard");
    const registrationGuestMessage = document.getElementById(
      "registrationGuestMessage",
    );
    const isGuest = !auth.currentUser;

    hydrateCurrentUserClanLogo();

    if (registrationGuestMessage) {
      registrationGuestMessage.style.display = isGuest ? "block" : "none";
    }
    if (registrationCard) {
      registrationCard.style.display = isGuest ? "none" : "";
    }

    if (tournamentTitle) {
      tournamentTitle.textContent = currentTournamentMeta.name || "Tournament";
    }
    const tournamentHero = document.querySelector("#tournamentView .hero");
    if (tournamentHero) {
      const coverUrl = sanitizeUrl(currentTournamentMeta.coverImageUrl || "");
      if (coverUrl) {
        if (tournamentHero.dataset.coverUrl !== coverUrl) {
          tournamentHero.classList.add("has-cover");
          tournamentHero.style.setProperty(
            "--hero-cover-image",
            `url("${coverUrl}")`,
          );
          tournamentHero.dataset.coverUrl = coverUrl;
        } else {
          tournamentHero.classList.add("has-cover");
        }
      } else {
        tournamentHero.classList.remove("has-cover");
        tournamentHero.style.removeProperty("--hero-cover-image");
        if (tournamentHero.dataset.coverUrl) {
          delete tournamentHero.dataset.coverUrl;
        }
      }
    }
    if (tournamentFormat) {
      tournamentFormat.textContent =
        currentTournamentMeta.format || "Tournament";
    }
    if (descriptionBody) {
      descriptionBody.innerHTML = renderMarkdown(
        currentTournamentMeta.description || "",
      );
    }
    if (rulesBody) {
      rulesBody.innerHTML = renderMarkdown(currentTournamentMeta.rules || "");
    }
    if (bracketTitle) {
      const formatLabel = (currentTournamentMeta.format || "").toLowerCase();
      const isGroupStage =
        formatLabel.includes("round robin") ||
        isDualTournamentFormat(formatLabel);
      bracketTitle.textContent = isGroupStage
        ? "Group Stage"
        : currentTournamentMeta.format || "Bracket";
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
    if (statPlayers)
      statPlayers.textContent = String(eligiblePlayers.length || 0);

    const tokenActive =
      isInviteOnly &&
      !isAdmin &&
      !currentPlayer &&
      inviteLinkGate?.slug === currentSlug &&
      Boolean(inviteLinkGate?.token);
    const inviteLinkExhausted =
      tokenActive &&
      inviteLinkGate.status === "ready" &&
      !inviteLinkGate.ok &&
      String(inviteLinkGate.message || "")
        .toLowerCase()
        .includes("no remaining uses");

    if (accessNote) {
      accessNote.classList.toggle("is-blocking", inviteLinkExhausted);
      if (isInviteOnly && !isAdmin) {
        if (tokenActive) {
          accessNote.textContent =
            inviteLinkGate.message || "Invite link detected.";
        } else {
          accessNote.textContent =
            "This tournament is invite-only. Ask an admin for an invite.";
        }
        accessNote.style.display = "block";
      } else {
        accessNote.textContent = "";
        accessNote.style.display = "none";
      }
    }

    if (registrationForm) {
      if (inviteLinkExhausted) {
        registrationForm.style.display = "none";
      } else {
        registrationForm.style.display = "";
      }
    }

    updatePlacementsRow();

    if (registerBtn) {
      const isRegisterLoading = registerBtn.classList.contains("is-loading");
      if (state.isLive) {
        registerBtn.textContent = "Registration closed";
        registerBtn.disabled = true;
      } else if (
        currentPlayer &&
        currentInviteStatus === INVITE_STATUS.pending
      ) {
        registerBtn.textContent = "Invitation pending";
        registerBtn.disabled = true;
      } else if (
        currentPlayer &&
        currentInviteStatus === INVITE_STATUS.denied
      ) {
        registerBtn.textContent = "Invite declined";
        registerBtn.disabled = true;
      } else if (currentPlayer) {
        registerBtn.textContent = "Unregister";
        registerBtn.disabled = false;
      } else if (isInviteOnly && !isAdmin) {
        const tokenActive =
          inviteLinkGate?.slug === currentSlug &&
          Boolean(inviteLinkGate?.token);
        if (!tokenActive) {
          registerBtn.textContent = "Invite required";
          registerBtn.disabled = true;
        } else if (inviteLinkGate.status === "loading") {
          registerBtn.textContent = "Checking invite link...";
          registerBtn.disabled = true;
        } else if (!inviteLinkGate.ok) {
          registerBtn.textContent = "Invite link invalid";
          registerBtn.disabled = true;
        } else {
          registerBtn.textContent = "Register";
          registerBtn.disabled = isRegisterLoading ? true : false;
        }
      } else {
        registerBtn.textContent = "Register";
        registerBtn.disabled = isRegisterLoading ? true : false;
      }
    }

    if (goLiveBtn) {
      const checkInState = getCheckInWindowState(currentTournamentMeta);
      const requiresManualClose =
        checkInState.allowAfterStart && checkInState.isOpen;
      if (state.isLive) {
        goLiveBtn.disabled = false;
        goLiveBtn.textContent = "Set Not Live";
        goLiveBtn.classList.add("danger");
        goLiveBtn.classList.remove("success");
      } else {
        goLiveBtn.disabled = !hasCheckedIn || requiresManualClose;
        goLiveBtn.textContent = "Go Live";
        goLiveBtn.classList.add("success");
        goLiveBtn.classList.remove("danger");
      }
    }
    if (resetTournamentBtn) {
      resetTournamentBtn.classList.add("danger");
    }
    if (resetScoresBtn) {
      resetScoresBtn.classList.add("danger");
    }
    if (resetVetoScoreChatBtn) {
      resetVetoScoreChatBtn.classList.add("danger");
    }
    if (notifyCheckInBtn) {
      const checkInState = getCheckInWindowState(currentTournamentMeta);
      const eligibleNotCheckedIn = eligiblePlayers.filter(
        (p) => !p.checkedInAt,
      );
      notifyCheckInBtn.disabled =
        state.isLive ||
        !checkInState.isOpen ||
        eligibleNotCheckedIn.length === 0;
    }
    if (refreshMmrBtn) {
      const refreshable = eligiblePlayers.some((player) =>
        normalizeSc2PulseIdUrl(player?.sc2Link || ""),
      );
      refreshMmrBtn.disabled = state.isLive || !refreshable;
    }

    updateCheckInUI();
    renderCasterSection();

    if (liveDot) {
      liveDot.textContent = state.isLive ? "Live" : "Not Live";
      liveDot.classList.toggle("not-live", !state.isLive);
    }

    if (bracketGrid && bracketNotLive) {
      if (!state.isLive) {
        const hasBeenLive =
          Boolean(state.hasBeenLive) ||
          (state.activity || []).some(
            (entry) =>
              entry?.message === "Tournament went live." ||
              entry?.message === "Tournament set to not live.",
          );

        if (bracketNotLiveMessage) {
          bracketNotLiveMessage.style.display = hasBeenLive ? "" : "none";
        }

        bracketGrid.style.display = "none";
        bracketNotLive.style.display = "block";

        // ✅ ADD THIS: hide match inspector when not live
        if (matchInfoModal) matchInfoModal.style.display = "none";
        // ✅ ADD THIS: ensure it's closed if it was open
        window.setMatchInspectorOpen?.(false);

        if (registeredPlayersList) {
          registeredPlayersList.style.display = "";
          const listKey = JSON.stringify(
            eligiblePlayers.map((p) => ({
              id: p.id || "",
              name: p.name || "",
              race: p.race || "",
              mmr: Number.isFinite(p.mmr) ? Math.round(p.mmr) : "",
              clan: p.clan || "",
              clanLogoUrl: p.clanLogoUrl || "",
            })),
          );
          if (registeredPlayersList.dataset.listKey !== listKey) {
            registeredPlayersList.dataset.listKey = listKey;
            const items = eligiblePlayers.map((p) => {
              const name = escapeHtml(p.name || "Unknown");
              const race = (p.race || "").trim();
              const raceClass = raceClassName(race);
              const raceLabel = race ? escapeHtml(race) : "Race TBD";
              const mmr = Number.isFinite(p.mmr)
                ? `${Math.round(p.mmr)} MMR`
                : "MMR TBD";
              const clanLogo = p?.clanLogoUrl ? sanitizeUrl(p.clanLogoUrl) : "";
              const clanName = (p?.clan || "").trim();
              const clanImg = clanLogo
                ? `<img class="registered-clan-logo" src="${escapeHtml(
                    clanLogo,
                  )}" alt="Clan logo" ${
                    clanName ? `data-tooltip="${escapeHtml(clanName)}"` : ""
                  } />`
                : `<img class="registered-clan-logo is-placeholder" src="img/clan/logo-18px.webp" alt="No clan logo" />`;
              return `<li data-player-id="${escapeHtml(p.id || "")}">
                  <span class="race-strip ${raceClass}"></span>
                  ${clanImg}
                  <span class="name-text" translate="no">${name}</span>
                  <span class="registered-meta">${raceLabel} - ${mmr}</span>
                </li>`;
            });
            registeredPlayersList.innerHTML = items.join("");
          }
        }
      } else {
        if (bracketNotLiveMessage) {
          bracketNotLiveMessage.style.display = "";
        }
        bracketGrid.style.display = "flex";
        bracketNotLive.style.display = "none";

        // ✅ ADD THIS: show match inspector again when live
        if (matchInfoModal) matchInfoModal.style.display = "";
      }
    }

    if (activityCard) {
      activityCard.style.display = state.isLive ? "" : "none";
    }
    if (casterLiveCard) {
      casterLiveCard.style.display = state.isLive ? "" : "none";
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
    updateSettingsScoreLocks();
    const nextPromoKey = getPromoStripRenderKey(currentTournamentMeta);
    if (nextPromoKey && nextPromoKey !== promoStripRenderKey) {
      promoStripRenderKey = nextPromoKey;
      void refreshTournamentPromoStrip(currentTournamentMeta);
    }
    void refreshTournamentPromoSettings(currentTournamentMeta);
    renderCircuitPointsSettings();
  }

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
    bracket && layoutVersion < CURRENT_BRACKET_LAYOUT_VERSION && canAutoRepair;
  if (needsLayoutUpgrade) {
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
    rebuildBracket(true, "Bracket repaired");
    return;
  }
  if (bracketContainer && bracket) {
    let lookup = getMatchLookup(bracket);
    const playersById = getPlayersMap();
    const shouldPartialUpdate =
      Array.isArray(matchIds) && matchIds.length && !isGroupStageFormat(format);
    let didPartialUpdate = false;
    if (shouldPartialUpdate) {
      didPartialUpdate = updateTreeMatchCards(matchIds, lookup, playersById, {
        currentUsername: getCurrentUsername?.() || "",
        currentUid: auth.currentUser?.uid || "",
      });
      if (didPartialUpdate) {
        annotateConnectorPlayers(lookup, playersById);
        clampScoreSelectOptions();
      }
    }
    if (!didPartialUpdate) {
      if (isGroupStageFormat(format)) {
        const changed = ensureRoundRobinPlayoffs(bracket, playersById, lookup);
        if (changed) {
          lookup = getMatchLookup(bracket);
          saveState({ bracket }, { skipRoster: true });
        }
        const html = renderRoundRobinView(
          { ...bracket },
          playersById,
          computeGroupStandings,
        );
        bracketContainer.innerHTML = DOMPurify.sanitize(html);
        attachMatchActionHandlers?.();
      } else {
        renderBracketView({
          bracket,
          players: playersArr,
          format,
          ensurePlayoffs: (b) =>
            ensureRoundRobinPlayoffs(b, playersById, lookup),
          getPlayersMap,
          attachMatchActionHandlers,
          computeGroupStandings,
          currentUsername: getCurrentUsername?.() || "",
          currentUid: auth.currentUser?.uid || "",
        });
      }
      attachMatchHoverHandlers();
      annotateConnectorPlayers(lookup, playersById);
      clampScoreSelectOptions();
      const groupScrolls = bracketContainer.querySelectorAll(
        ".group-stage-scroll, .playoff-scroll",
      );
      groupScrolls.forEach((el) => {
        if (el.dataset.dragScrollBound === "true") return;
        enableDragScroll(el, {
          axisLock: true,
          scrollXElement: el,
          scrollYElement: el,
          ignoreSelector:
            'a, button, input, select, textarea, label, [contenteditable="true"], [data-no-drag]',
        });
        el.dataset.dragScrollBound = "true";
      });
    }
  }
  applyBracketReadOnlyState(!state.isLive && !isAdmin);
  updateTooltips?.();
}

function getMatchInspectorState() {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return { isOpen: false, matchId: "" };
  return {
    isOpen: modal.classList.contains("is-open"),
    matchId: modal.dataset.matchId || "",
  };
}

// True only when the inspector is showing a match that includes the current user,
// but the match is NOT ready yet (missing opponent). This is your “I’m waiting here” case.
function isInspectorShowingUserWaitingMatch(snapshot, inspectorMatchId) {
  const uid = auth?.currentUser?.uid || null;
  if (!uid) return false;
  if (!snapshot?.bracket || !inspectorMatchId) return false;

  const lookup = getMatchLookup(snapshot.bracket);
  const playersById = new Map((snapshot.players || []).map((p) => [p?.id, p]));

  const match = getAllMatches(snapshot.bracket).find(
    (m) => m?.id === inspectorMatchId,
  );
  if (!match) return false;
  if (match.status === "complete") return false;

  const [pA, pB] = resolveParticipants(match, lookup, playersById);

  // If user is not part of this match, they are not "waiting" here.
  const userInThisMatch = pA?.uid === uid || pB?.uid === uid;
  if (!userInThisMatch) return false;

  // Waiting = one side missing
  return !(pA && pB);
}

const matchReadyToastShown = new Set();
const matchReadyToastDismissed = new Set();

function showMatchReadyToast({ matchId, message }) {
  if (!matchId) return;
  if (matchReadyToastDismissed.has(matchId)) return;
  if (matchReadyToastShown.has(matchId)) return;

  const container = document.getElementById("toast-container");
  if (!container) return;

  matchReadyToastShown.add(matchId);

  const toast = document.createElement("div");
  toast.className = "toast toast--action";
  toast.dataset.matchId = matchId;

  const text = document.createElement("div");
  text.className = "toast__text";
  text.textContent = message || "Your match is ready.";

  const actions = document.createElement("div");
  actions.className = "toast__actions";

  const goBtn = document.createElement("button");
  goBtn.type = "button";
  goBtn.className = "toast__btn toast__btn--primary";
  goBtn.textContent = "Go";
  goBtn.onclick = () => {
    matchReadyToastShown.delete(matchId);
    toast.remove();
    openMatchInfoModalUsingDeps(matchId);
  };

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "toast__btn";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.onclick = () => {
    matchReadyToastShown.delete(matchId);
    matchReadyToastDismissed.add(matchId);
    toast.remove();
  };

  actions.append(goBtn, dismissBtn);
  toast.append(text, actions);
  container.appendChild(toast);
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

function goLiveTournament() {
  if (state.isLive) {
    showToast?.("Tournament is already live.", "success");
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
  const { mergedPlayers } = seedEligiblePlayersWithMode(
    state.players || [],
    state,
  );
  const seededPlayers = seedPlayersForState(checkedInPlayers, state);
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

function toggleLiveTournament() {
  if (state.isLive) {
    setTournamentNotLive();
    return;
  }
  goLiveTournament();
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
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");

  if (formatSelect) formatSelect.disabled = hasScores;

  if (rrGroups) rrGroups.disabled = hasScores || locks.roundRobin;
  if (rrAdvance) rrAdvance.disabled = hasScores || locks.roundRobin;
  if (rrPlayoffs) rrPlayoffs.disabled = hasScores || locks.roundRobin;
  if (rrBestOf) rrBestOf.disabled = hasScores || locks.roundRobin;

  if (upperInput) upperInput.disabled = locks.upper;
  if (quarterInput) quarterInput.disabled = locks.quarter;
  if (semiInput) semiInput.disabled = locks.semi;
  if (upperFinalInput) upperFinalInput.disabled = locks.upperFinal;
  if (finalInput) finalInput.disabled = locks.final;

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

function createOrUpdatePlayer(data) {
  const merged = buildPlayerFromData(data);
  if (!merged) return null;
  const existing = (state.players || []).find((p) => p.id === merged.id);
  const players = existing
    ? state.players.map((p) => (p.id === merged.id ? merged : p))
    : [...(state.players || []), merged];
  setStateObj({ ...state, players });
  return merged;
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

function resetScores() {
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
  saveState(
    {
      players: mergedPlayers,
      bracket,
      needsReseed: false,
      scoreReports: {},
      matchCasts: {},
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
  // If this confirm completed the match AND the current user was a participant,
  // auto-jump the inspector to the next ready match for that user.
  // (Admins editing other series should not be redirected.)
  if (completedNow) {
    const userWasParticipant =
      isCurrentUserTournamentPlayer(participants?.[0]) ||
      isCurrentUserTournamentPlayer(participants?.[1]);

    if (userWasParticipant) {
      const nextReady = findFirstReadyMatchForCurrentUser(state);
      if (nextReady?.id && nextReady.id !== matchId) {
        // Uses deps already injected via setVetoDependencies(...)
        openMatchInfoModalUsingDeps(nextReady.id);
      }
    }
  }
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
  const playersById = getPlayersMap();

  for (const match of getAllMatches(snapshot.bracket)) {
    if (!match?.id) continue;
    if (match.status === "complete") continue;

    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    if (!pA || !pB) continue; // not ready yet

    if (
      isCurrentUserTournamentPlayer(pA) ||
      isCurrentUserTournamentPlayer(pB)
    ) {
      out.add(match.id);
    }
  }
  return out;
}

function maybeToastMyMatchReady(prevSnapshot, nextSnapshot) {
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

    showMatchReadyToast({
      matchId,
      message: "Your next match is ready.",
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
            const hostName = escapeHtml(item.createdByName || "Unknown");
            const metaBits = [
              `<span>${escapeHtml(`${tournamentCount} tournaments`)}</span>`,
              `<span>Host: <span translate="no">${hostName}</span></span>`,
            ];
            if (item.finalTournamentSlug) {
              metaBits.unshift(
                `<span>${escapeHtml(`Finals: ${item.finalTournamentSlug}`)}</span>`,
              );
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
                  ${metaBits.join("")}
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
          li.innerHTML = DOMPurify.sanitize(`
            <div class="card-cover${coverUrl ? " has-image" : ""}"${
              coverUrl
                ? ` style="background-image:url('${escapeHtml(coverUrl)}')"`
                : ""
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
                <span>Host: <span translate="no">${escapeHtml(
                  item.createdByName || "Unknown",
                )}</span></span>
              </div>
              <div class="tournament-progress" data-slug="${escapeHtml(
                item.slug,
              )}">
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
    finalsComplete ||
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
  }
  if (checkInSelect) checkInSelect.value = "0";
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
      if (finalImagePreview) finalImagePreview.src = meta.coverImageUrl || "";
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
      await setDoc(
        doc(collection(db, TOURNAMENT_COLLECTION), finalSlug),
        finalPayload,
        { merge: true },
      );
      const imageFile = finalImageInput?.files?.[0] || null;
      const reuseUrl = finalImagePreview?.dataset?.reuseUrl || "";
      if (imageFile) {
        try {
          const uploaded = await uploadTournamentCover(imageFile, finalSlug);
          finalPayload.coverImageUrl = uploaded.coverImageUrl;
          finalPayload.coverImageUrlSmall = uploaded.coverImageUrlSmall;
          await setDoc(
            doc(collection(db, TOURNAMENT_COLLECTION), finalSlug),
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
            doc(collection(db, TOURNAMENT_COLLECTION), finalSlug),
            { coverImageUrl: reuseUrl, coverImageUrlSmall: "" },
            { merge: true },
          );
        } catch (err) {
          console.error("Failed to reuse cover image", err);
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
      const snap = await getDoc(
        doc(collection(db, TOURNAMENT_COLLECTION), route.slug),
      );
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
    const target = circuitSlug
      ? `/tournament/${circuitSlug}/${slug}`
      : `/tournament/${slug}`;
    if (window.location.pathname !== target) {
      window.history.pushState({}, "", target);
    }
  }
  const backLink = document.getElementById("tournamentBackLink");
  if (backLink) {
    const label = backLink.querySelector("[data-back-label]");
    backLink.href = circuitSlug ? `/tournament/${circuitSlug}` : "/tournament";
    if (label)
      label.textContent = circuitSlug ? "Circuit Page" : "Tournament Center";
  }
  // Load local state for this slug
  const local = loadLocalState(
    slug,
    applyRosterSeedingWithMode,
    deserializeBracket,
  );
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
        const label = backLink.querySelector("[data-back-label]");
        backLink.href = metaCircuitSlug
          ? `/tournament/${metaCircuitSlug}`
          : "/tournament";
        if (label)
          label.textContent = metaCircuitSlug
            ? "Circuit Page"
            : "Tournament Center";
      }

      await refreshInviteLinkGate(slug);
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
  await refreshInviteLinksPanel();
  // Hydrate remote state (merge) and render
  await hydrateStateFromRemote(
    slug,
    applyRosterSeedingWithMode,
    deserializeBracket,
    saveState,
    () => {
      renderAll();
      refreshPlayerDetailModalIfOpen(getPlayersMap);
    },
    state?.lastUpdated || 0,
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
  logAnalyticsEvent("tournament_viewed");
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
    checkInStatus.textContent =
      isInviteOnly && !isAdmin
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
      return (
        String(item.coverImageUrl || "").trim() === trimmed ||
        String(item.coverImageUrlSmall || "").trim() === trimmed
      );
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
      return (
        isCoverUrlInSlugFolder(String(item.coverImageUrl || "").trim(), slug) ||
        isCoverUrlInSlugFolder(
          String(item.coverImageUrlSmall || "").trim(),
          slug,
        )
      );
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

async function deleteTournamentSponsorFolder(slug) {
  if (!slug) return;
  try {
    const folderRef = storageRef(storage, `tournamentSponsors/${slug}`);
    const list = await listAll(folderRef);
    await Promise.all(list.items.map((item) => deleteObject(item)));
  } catch (err) {
    console.warn("Failed to delete tournament sponsor folder", err);
  }
}

async function uploadTournamentCover(file, slug) {
  const error = validateTournamentImage(file);
  if (error) throw new Error(error);
  if (!slug) throw new Error("Missing tournament slug.");
  const processedLarge = await prepareImageForUpload(file, {
    targetWidth: COVER_TARGET_WIDTH,
    targetHeight: COVER_TARGET_HEIGHT,
    quality: COVER_QUALITY,
    outputType: "image/webp",
    fallbackType: "image/jpeg",
  });
  const processedSmall = await prepareImageForUpload(file, {
    targetWidth: COVER_CARD_WIDTH,
    targetHeight: COVER_CARD_HEIGHT,
    quality: COVER_QUALITY,
    outputType: "image/webp",
    fallbackType: "image/jpeg",
  });
  const stamp = Date.now();
  const largePath = `tournamentCovers/${slug}/cover-${stamp}-1200.webp`;
  const smallPath = `tournamentCovers/${slug}/cover-${stamp}-320.webp`;
  const largeRef = storageRef(storage, largePath);
  const smallRef = storageRef(storage, smallPath);
  await Promise.all([
    uploadBytes(largeRef, processedLarge.blob, {
      contentType: processedLarge.contentType,
    }),
    uploadBytes(smallRef, processedSmall.blob, {
      contentType: processedSmall.contentType,
    }),
  ]);
  const [coverImageUrl, coverImageUrlSmall] = await Promise.all([
    getDownloadURL(largeRef),
    getDownloadURL(smallRef),
  ]);
  return { coverImageUrl, coverImageUrlSmall };
}

async function uploadSponsorLogo(file, slug) {
  const error = validateTournamentImage(file);
  if (error) throw new Error(error);
  if (!slug) throw new Error("Missing tournament slug.");
  const processed = await prepareImageForUpload(file, {
    targetWidth: SPONSOR_LOGO_SIZE,
    targetHeight: SPONSOR_LOGO_SIZE,
    quality: COVER_QUALITY,
    outputType: "image/webp",
    fallbackType: "image/jpeg",
  });
  const path = `tournamentSponsors/${slug}/logo-${Date.now()}.webp`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, processed.blob, {
    contentType: processed.contentType,
  });
  return getDownloadURL(ref);
}

async function handleSaveSettings(event) {
  event?.preventDefault?.();
  const activeSettingsTab =
    document.querySelector("#settingsTab .settings-panel.active")?.id ||
    "settingsGeneral";
  const isGeneralTab = activeSettingsTab === "settingsGeneral";
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
  const imageInput = document.getElementById("settingsImageInput");
  const imagePreview = document.getElementById("settingsImagePreview");
  const copySponsorsToggle = document.getElementById(
    "settingsCopyCircuitSponsorsToggle",
  );
  const imageFile = isGeneralTab ? imageInput?.files?.[0] || null : null;
  const reuseUrl = isGeneralTab ? imagePreview?.dataset.reuseUrl || "" : "";
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
  const rrSettings = isFormatTab
    ? extractRoundRobinSettingsUI("settings", defaultRoundRobinSettings)
    : normalizeRoundRobinSettings(currentTournamentMeta?.roundRobin || {});
  const hasScores = bracketHasRecordedResults(state.bracket);
  const scoreLocks = getBracketScoreLocks(state.bracket);
  const currentFormat = (currentTournamentMeta?.format || "Tournament").trim();
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
  let coverImageUrl = currentTournamentMeta?.coverImageUrl || "";
  let coverImageUrlSmall = currentTournamentMeta?.coverImageUrlSmall || "";
  if (!imageFile && reuseUrl) {
    coverImageUrl = reuseUrl;
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
    format !== currentFormat &&
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
  const formatSelect = document.getElementById("tournamentFormatSelect");
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
      allowCheckInAfterStart,
      isInviteOnly,
      visibility,
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

if (typeof window !== "undefined") {
  window.addEventListener("pulse-state-changed", (event) => {
    hydratePulseFromState(event.detail);
    if (currentTournamentMeta) {
      renderAll();
    }
  });
  window.addEventListener("user-avatar-updated", (event) => {
    const avatarUrl =
      event?.detail?.avatarUrl || getCurrentUserAvatarUrl?.() || "";
    syncCurrentPlayerAvatar(avatarUrl);
  });
  window.addEventListener("user-profile-updated", () => {
    const avatarUrl = getCurrentUserAvatarUrl?.() || "";
    syncCurrentPlayerAvatar(avatarUrl);
  });
}

onAuthStateChanged?.(auth, (user) => {
  recomputeAdminFromMeta();
  recomputeCircuitAdminFromMeta();
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
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const mapSelector =
      "#mapPoolPicker, #settingsMapPoolPicker, #finalMapPoolPicker, #circuitFinalMapPoolPicker";
    if (target.closest(mapSelector)) {
      ensureMapCatalogLoadedForUi();
    }
  });
  initCoverReuseModal();
  initCasterControls({ saveState });
  initFinalAdminSearch();
  bindTournamentSponsorControls();
  bindTournamentSocialControls();
  bindTournamentPromoSettingsControls(() => currentTournamentMeta);
  initInviteLinksPanel();
  initAdminInviteModal();

  if (typeof window !== "undefined") {
    setInterval(() => {
      if (currentTournamentMeta) {
        updateCheckInUI();
      }
    }, 30000);
  }

  try {
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
  updateFinalAdminAddVisibility();
  updateInviteLinksPanelVisibility();
  if (typeof window !== "undefined") {
    window.__tournamentIsAdmin = isAdmin;
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
  const name = pickBotName(existingNames);
  const createdAt = Date.now();
  const bot = {
    id: `bot-${createdAt.toString(36)}-${Math.random()
      .toString(16)
      .slice(2, 6)}`,
    name,
    race: BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)],
    sc2Link: "",
    mmr: 0,
    points: 0,
    seed: null,
    createdAt,
    isBot: true,
  };
  await updateRosterWithTransaction(
    (roster) => upsertRosterPlayer(roster, bot),
    { needsReseed: true },
  );
  rebuildBracket(true, `${name} added`);
  addActivity(`${name} added.`);
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

  if (!auth.currentUser) {
    setStatus(
      statusEl,
      "Sign in and add your SC2Pulse link in Settings first.",
      true,
    );
    return;
  }

  const existingPlayer = (state.players || []).find(
    (p) => p.uid === auth.currentUser?.uid,
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
    await updateRosterWithTransaction(
      (players) => removeRosterByUid(players, auth.currentUser?.uid),
      { needsReseed: true },
    );
    rebuildBracket(true, "Player removed");
    addActivity(`${existingPlayer.name} unregistered.`);
    showToast?.("You have been unregistered.", "success");
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

    const checkInState = getCheckInWindowState(currentTournamentMeta);
    const autoCheckedInAt = checkInState.isOpen ? Date.now() : null;
    const newPlayer = buildPlayerFromData({
      name,
      race,
      sc2Link: sc2LinkInput,
      mmr: Number.isFinite(mmr) ? mmr : 0,
      points: startingPoints,
      inviteStatus: INVITE_STATUS.accepted,
      ...(autoCheckedInAt ? { checkedInAt: autoCheckedInAt } : {}),
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

    markRegisteredTournament(currentSlug);

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
    showToast?.(`${newPlayer.name} added to the bracket`, "success");

    event.target.reset();
    hydratePulseFromState(pulseProfile);
  } finally {
    setRegisterLoadingState(false);
  }
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
    label.setAttribute("translate", "no");
    label.textContent = entry.username;
    const inviteBtn = document.createElement("button");
    inviteBtn.type = "button";
    inviteBtn.className = "cta small ghost";
    inviteBtn.textContent = "Invite";
    inviteBtn.dataset.adminAddUsername = entry.username;
    inviteBtn.dataset.adminAddMode = "invite";
    if (entry.userId) {
      inviteBtn.dataset.adminUserId = entry.userId;
    }
    const alreadyAdded = (state.players || []).some(
      (player) =>
        (entry.userId && player.uid === entry.userId) ||
        (player.name || "").toLowerCase() === entry.username.toLowerCase(),
    );
    if (alreadyAdded) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = "Added";
    }
    row.append(label, inviteBtn);
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
    addPlayer: async ({ userId, username, userData, options }) => {
      if (bracketHasRecordedResults(state.bracket)) {
        showToast?.("Cannot add players after scores are recorded.", "error");
        return;
      }
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
      const addMode = options?.mode === "super" ? "super" : "invite";
      const inviterName = getCurrentUsername?.() || "Tournament admin";
      const newPlayer = buildPlayerFromData({
        name: displayName,
        race,
        sc2Link,
        mmr,
        points: Number.isFinite(startingPoints) ? startingPoints : 0,
        inviteStatus:
          addMode === "super" ? INVITE_STATUS.accepted : INVITE_STATUS.pending,
        ...(addMode === "super"
          ? {}
          : {
              invitedAt: Date.now(),
              invitedByUid: auth.currentUser?.uid || "",
              invitedByName: inviterName,
            }),
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
      await updateRosterWithTransaction(
        (players) => upsertRosterPlayer(players, newPlayer),
        {},
        { optimistic: true },
      );
      if (addMode === "super") {
        addActivity(`Admin added ${newPlayer.name}.`);
      } else {
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
          showToast?.(
            "Invite created, but notification failed to send.",
            "error",
          );
        }
      }
      renderAll();
      if (addMode === "super") {
        showToast?.(`${newPlayer.name} added to player list.`, "success");
      } else {
        showToast?.(`Invite sent to ${newPlayer.name}.`, "success");
      }
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
    const mode = target.dataset.adminAddMode || "invite";
    search.addByUsername(username, userId, { mode });
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

function resolvePlayerAvatar(player) {
  const userPhoto = document.getElementById("userPhoto")?.src;
  return player?.avatarUrl || userPhoto || DEFAULT_PLAYER_AVATAR;
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
            src?.type === "match" ? positions.get(src.matchId) : null,
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
          "",
        ),
      );

      if (rIdx > 0) {
        const srcs = match.sources
          .map((src) =>
            src?.type === "match" ? positions.get(src.matchId) : null,
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
            }),
          );
          connectors.push(
            makeConnector(srcs[1].x + CARD_WIDTH, midY2, junctionX, midY2, {
              from: parentIds[1],
              to: match.id,
            }),
          );
          connectors.push(
            makeVConnector(junctionX, midY1, childMidY, {
              from: parentIds[0],
              to: match.id,
            }),
          );
          connectors.push(
            makeVConnector(junctionX, midY2, childMidY, {
              from: parentIds[1],
              to: match.id,
            }),
          );
          connectors.push(
            makeConnector(junctionX, childMidY, pos.x, childMidY, {
              from: match.id,
              to: match.id,
              parents: parentIds.join(","),
            }),
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
    x2,
  )}px; top:${y1}px; width:${Math.abs(x2 - x1)}px;"></div>`;
}

function makeVConnector(x, y1, y2, meta = {}) {
  const attr = formatConnectorMeta(meta);
  return `<div class="connector v" ${attr} style="left:${x}px; top:${Math.min(
    y1,
    y2,
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
      (d) => d.key !== Number.MAX_SAFE_INTEGER,
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
function getRoundLabel(
  titlePrefix,
  idx,
  totalRounds,
  { hasGrandFinal = false } = {},
) {
  // idx is 0-based, totalRounds is the number of columns in this section
  const fromEnd = totalRounds - idx; // 1 = last round, 2 = second last, ...

  if (titlePrefix === "Upper") {
    if (fromEnd === 1) return hasGrandFinal ? "Grand Final" : "Final";
    if (fromEnd === 2) return hasGrandFinal ? "Upper Final" : "Semi-final";
    if (fromEnd === 3) return hasGrandFinal ? "Semi-final" : "Quarterfinal";
    if (fromEnd === 4)
      return hasGrandFinal ? "Quarterfinal" : `Upper Round ${idx + 1}`;
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
