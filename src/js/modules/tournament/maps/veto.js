import DOMPurify from "dompurify";
import { showToast } from "../../toastHandler.js";
import { auth, db, getCurrentUsername } from "../../../../app.js";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getPreferredServerLabel } from "../../../data/countryRegions.js";
import countries from "../../../data/countries.json" assert { type: "json" };
import { updateTooltips } from "../../tooltip.js";
import {
  currentTournamentMeta,
  vetoState,
  currentVetoMatchId,
  setCurrentVetoMatchIdState,
  setVetoStateState,
  state,
  defaultBestOf,
  isAdmin,
  currentSlug,
  TOURNAMENT_STATE_COLLECTION,
  pulseProfile,
} from "../state.js";
import { getCasterEntryByUid } from "../caster.js";
import { getMatchLookup, resolveParticipants } from "../bracket/lookup.js";
import { escapeHtml, getBestOfForMatch } from "../bracket/renderUtils.js";
import { renderBracketView } from "../bracket/render.js";
import { setupMatchChatUi, teardownMatchChatUi } from "../chat/matchChat.js";

const PRESENCE_COLLECTION = "tournamentPresence";
const PRESENCE_TTL_MS = 45_000;
const PRESENCE_HEARTBEAT_MS = 60_000;
const PRESENCE_MIN_WRITE_MS = 45_000;
const PRESENCE_IDLE_AFTER_MS = 90_000;
const PRESENCE_OFFLINE_AFTER_MS = 20 * 60_000;
let presenceUnsub = null;
let presenceHeartbeat = null;
let presenceUiTimer = null;
let presenceLatest = new Map(); // uid -> { matchId, updatedAtMs, playerId }
let presenceContext = {
  matchId: null,
  leftPlayerId: null,
  rightPlayerId: null,
};
let presenceSlug = null;
let presenceWriteDenied = false;
let presenceActiveKey = "";
let presenceLastWriteAt = 0;
let presenceLastMatchId = null;
let presenceLastPlayerId = null;
let presenceUiStatus = "active";
let presenceLastActivityAt = 0;
let presenceActivityTimer = null;
let presenceActivityHandler = null;
let presenceVisibilityHandler = null;
const countryFlagCache = new Map();
const countryUidCache = new Map();
const COUNTRY_NAME_BY_CODE = new Map(
  (Array.isArray(countries) ? countries : []).map((entry) => [
    String(entry?.code || "").toUpperCase(),
    String(entry?.name || ""),
  ])
);
const ISO3_TO_ISO2 = {
  ABW: "AW",
  AFG: "AF",
  AGO: "AO",
  AIA: "AI",
  ALA: "AX",
  ALB: "AL",
  AND: "AD",
  ARE: "AE",
  ARG: "AR",
  ARM: "AM",
  ASM: "AS",
  ATA: "AQ",
  ATF: "TF",
  ATG: "AG",
  AUS: "AU",
  AUT: "AT",
  AZE: "AZ",
  BDI: "BI",
  BEL: "BE",
  BEN: "BJ",
  BES: "BQ",
  BFA: "BF",
  BGD: "BD",
  BGR: "BG",
  BHR: "BH",
  BHS: "BS",
  BIH: "BA",
  BLM: "BL",
  BLR: "BY",
  BLZ: "BZ",
  BMU: "BM",
  BOL: "BO",
  BRA: "BR",
  BRB: "BB",
  BRN: "BN",
  BTN: "BT",
  BVT: "BV",
  BWA: "BW",
  CAF: "CF",
  CAN: "CA",
  CCK: "CC",
  CHE: "CH",
  CHL: "CL",
  CHN: "CN",
  CIV: "CI",
  CMR: "CM",
  COD: "CD",
  COG: "CG",
  COK: "CK",
  COL: "CO",
  COM: "KM",
  CPV: "CV",
  CRI: "CR",
  CUB: "CU",
  CUW: "CW",
  CXR: "CX",
  CYM: "KY",
  CYP: "CY",
  CZE: "CZ",
  DEU: "DE",
  DJI: "DJ",
  DMA: "DM",
  DNK: "DK",
  DOM: "DO",
  DZA: "DZ",
  ECU: "EC",
  EGY: "EG",
  ERI: "ER",
  ESH: "EH",
  ESP: "ES",
  EST: "EE",
  ETH: "ET",
  FIN: "FI",
  FJI: "FJ",
  FLK: "FK",
  FRA: "FR",
  FRO: "FO",
  FSM: "FM",
  GAB: "GA",
  GBR: "GB",
  GEO: "GE",
  GGY: "GG",
  GHA: "GH",
  GIB: "GI",
  GIN: "GN",
  GLP: "GP",
  GMB: "GM",
  GNB: "GW",
  GNQ: "GQ",
  GRC: "GR",
  GRD: "GD",
  GRL: "GL",
  GTM: "GT",
  GUF: "GF",
  GUM: "GU",
  GUY: "GY",
  HKG: "HK",
  HMD: "HM",
  HND: "HN",
  HRV: "HR",
  HTI: "HT",
  HUN: "HU",
  IDN: "ID",
  IMN: "IM",
  IND: "IN",
  IOT: "IO",
  IRL: "IE",
  IRN: "IR",
  IRQ: "IQ",
  ISL: "IS",
  ISR: "IL",
  ITA: "IT",
  JAM: "JM",
  JEY: "JE",
  JOR: "JO",
  JPN: "JP",
  KAZ: "KZ",
  KEN: "KE",
  KGZ: "KG",
  KHM: "KH",
  KIR: "KI",
  KNA: "KN",
  KOR: "KR",
  KWT: "KW",
  LAO: "LA",
  LBN: "LB",
  LBR: "LR",
  LBY: "LY",
  LCA: "LC",
  LIE: "LI",
  LKA: "LK",
  LSO: "LS",
  LTU: "LT",
  LUX: "LU",
  LVA: "LV",
  MAC: "MO",
  MAF: "MF",
  MAR: "MA",
  MCO: "MC",
  MDA: "MD",
  MDG: "MG",
  MDV: "MV",
  MEX: "MX",
  MHL: "MH",
  MKD: "MK",
  MLI: "ML",
  MLT: "MT",
  MMR: "MM",
  MNE: "ME",
  MNG: "MN",
  MNP: "MP",
  MOZ: "MZ",
  MRT: "MR",
  MSR: "MS",
  MTQ: "MQ",
  MUS: "MU",
  MWI: "MW",
  MYS: "MY",
  MYT: "YT",
  NAM: "NA",
  NCL: "NC",
  NER: "NE",
  NFK: "NF",
  NGA: "NG",
  NIC: "NI",
  NIU: "NU",
  NLD: "NL",
  NOR: "NO",
  NPL: "NP",
  NRU: "NR",
  NZL: "NZ",
  OMN: "OM",
  PAK: "PK",
  PAN: "PA",
  PCN: "PN",
  PER: "PE",
  PHL: "PH",
  PLW: "PW",
  PNG: "PG",
  POL: "PL",
  PRI: "PR",
  PRK: "KP",
  PRT: "PT",
  PRY: "PY",
  PSE: "PS",
  PYF: "PF",
  QAT: "QA",
  REU: "RE",
  ROU: "RO",
  RUS: "RU",
  RWA: "RW",
  SAU: "SA",
  SDN: "SD",
  SEN: "SN",
  SGP: "SG",
  SGS: "GS",
  SHN: "SH",
  SJM: "SJ",
  SLB: "SB",
  SLE: "SL",
  SLV: "SV",
  SMR: "SM",
  SOM: "SO",
  SPM: "PM",
  SRB: "RS",
  SSD: "SS",
  STP: "ST",
  SUR: "SR",
  SVK: "SK",
  SVN: "SI",
  SWE: "SE",
  SWZ: "SZ",
  SXM: "SX",
  SYC: "SC",
  SYR: "SY",
  TCA: "TC",
  TCD: "TD",
  TGO: "TG",
  THA: "TH",
  TJK: "TJ",
  TKL: "TK",
  TKM: "TM",
  TLS: "TL",
  TON: "TO",
  TTO: "TT",
  TUN: "TN",
  TUR: "TR",
  TUV: "TV",
  TWN: "TW",
  TZA: "TZ",
  UGA: "UG",
  UKR: "UA",
  UMI: "UM",
  URY: "UY",
  USA: "US",
  UZB: "UZ",
  VAT: "VA",
  VCT: "VC",
  VEN: "VE",
  VGB: "VG",
  VIR: "VI",
  VNM: "VN",
  VUT: "VU",
  WLF: "WF",
  WSM: "WS",
  YEM: "YE",
  ZAF: "ZA",
  ZMB: "ZM",
  ZWE: "ZW",
};

function normalizeCountryName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

const COUNTRY_CODE_BY_NAME = new Map(
  (Array.isArray(countries) ? countries : [])
    .map((entry) => [
      normalizeCountryName(entry?.name || ""),
      String(entry?.code || "").toUpperCase(),
    ])
    .filter(([key, code]) => key && code)
);

function emojiToTwemojiUrl(emoji) {
  if (!emoji) return "";
  const codepoints = [];
  for (const symbol of emoji) {
    const code = symbol.codePointAt(0);
    if (code) codepoints.push(code.toString(16));
  }
  if (!codepoints.length) return "";
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints.join(
    "-"
  )}.svg`;
}

function setFlagIcon(flagEl, emoji) {
  if (!flagEl) return;
  while (flagEl.firstChild) flagEl.removeChild(flagEl.firstChild);
  if (!emoji) return;
  const img = document.createElement("img");
  img.src = emojiToTwemojiUrl(emoji);
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  flagEl.appendChild(img);
}

function getUsernameCandidates(rawName) {
  const cleaned = String(rawName || "").trim();
  if (!cleaned) return [];
  const candidates = new Set([cleaned]);
  const bracketStripped = cleaned.replace(/^[\[(].+?[\]\)]\s*/, "").trim();
  if (bracketStripped) candidates.add(bracketStripped);
  if (bracketStripped.includes("|")) {
    const tail = bracketStripped.split("|").pop()?.trim();
    if (tail) candidates.add(tail);
  }
  const parts = bracketStripped.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && parts[0].length <= 4 && parts[1].length >= 3) {
    candidates.add(parts[1]);
  }
  return Array.from(candidates);
}

function setFlagTitle(flagEl, code) {
  if (!flagEl) return;
  const normalized = String(code || "")
    .trim()
    .toUpperCase();
  const name = COUNTRY_NAME_BY_CODE.get(normalized) || "";
  if (name) {
    flagEl.setAttribute("aria-label", name);
    flagEl.setAttribute("data-tooltip", name);
    flagEl.removeAttribute("title");
  } else {
    flagEl.removeAttribute("aria-label");
    flagEl.removeAttribute("data-tooltip");
    flagEl.removeAttribute("title");
  }
}

function applyRemoteBusyIfAny(matchId) {
  const uid = auth?.currentUser?.uid || "";
  const busy = state.matchVetoes?.[matchId]?.busy || null;
  const until = Number(busy?.until) || 0;
  const busyUid = String(busy?.uid || "");

  const isRemoteBusy = until > Date.now() && busyUid && busyUid !== uid;

  if (isRemoteBusy) {
    // Show overlay for remote user's in-flight window
    setVetoUiBusy(true);

    // Ensure we auto-unlock when the window expires (no Firestore event will happen)
    scheduleRemoteBusyClear(matchId);

    return true;
  }

  // Not remote busy: do not force unlock if local persist is running,
  // but do cancel any pending remote timer.
  clearRemoteBusyTimer();
  return false;
}

// ---- Veto persist serialization + UI lock (prevents fast-click desync) ----
let vetoUiBusy = false;
let vetoLocalBusy = false;
let vetoUiReady = false;

// Promise chain to serialize ALL veto persists (prevents out-of-order writes)
let vetoPersistChain = Promise.resolve();

function setVetoUiBusy(isBusy) {
  vetoUiBusy = isBusy;

  const poolEl = document.getElementById("vetoMapPool");
  const modal = document.getElementById("vetoModal");

  // Disable clicking on the pool while we persist
  if (poolEl) {
    poolEl.style.pointerEvents = isBusy ? "none" : "auto";
    poolEl.style.opacity = isBusy ? "0.6" : "1";
  }

  // Optional: also disable any inputs/buttons inside the modal
  if (modal) {
    const btns = modal.querySelectorAll("button, input, select");
    btns.forEach((b) => {
      if ("disabled" in b) b.disabled = isBusy;
    });
  }
}

let vetoRemoteBusyTimer = null;

function clearRemoteBusyTimer() {
  if (vetoRemoteBusyTimer) {
    clearTimeout(vetoRemoteBusyTimer);
    vetoRemoteBusyTimer = null;
  }
}

function scheduleRemoteBusyClear(matchId) {
  clearRemoteBusyTimer();

  const busy = state.matchVetoes?.[matchId]?.busy || null;
  const until = Number(busy?.until) || 0;
  if (!until) return;

  const delay = Math.max(0, until - Date.now());

  vetoRemoteBusyTimer = setTimeout(() => {
    vetoRemoteBusyTimer = null;

    // If the modal isn't open, don't touch UI.
    const modal = document.getElementById("vetoModal");
    const visible = modal && getComputedStyle(modal).display !== "none";
    if (!visible) return;

    // Only block auto-unlock if we are locally persisting.
    // Do NOT use vetoUiBusy here, because vetoUiBusy can be true due to remote busy itself.
    if (vetoLocalBusy) return;

    // Re-evaluate remote busy; if no longer busy, unlock.
    const stillRemoteBusy = applyRemoteBusyIfAny(matchId);
    if (!stillRemoteBusy) {
      setVetoUiBusy(false);
      try {
        renderVetoPoolGrid?.();
        renderVetoStatus?.();
      } catch (_) {
        // ignore
      }
    }
  }, delay + 25); // small buffer
}

function persistLiveVetoStateQueued() {
  vetoPersistChain = vetoPersistChain
    .then(async () => {
      vetoLocalBusy = true;
      setVetoUiBusy(true);

      await persistLiveVetoState();

      try {
        refreshVetoModalIfOpen?.();
        refreshMatchInfoModalIfOpen?.();
      } catch (_) {
        // ignore UI refresh errors
      }
    })
    .catch((err) => {
      console.warn("[veto] persistLiveVetoStateQueued failed", err);
    })
    .finally(() => {
      vetoLocalBusy = false;

      const matchId =
        currentVetoMatchId ||
        document.getElementById("vetoModal")?.dataset?.matchId ||
        "";

      if (!matchId) {
        setVetoUiBusy(false);
        return;
      }

      // If remote busy is active, keep locked and schedule auto-unlock.
      const stillRemoteBusy = applyRemoteBusyIfAny(matchId);
      if (!stillRemoteBusy) {
        setVetoUiBusy(false);
      }
    });

  return vetoPersistChain;
}

export function openVetoModal(
  matchId,
  { getPlayersMap, getDefaultMapPoolNames, getMapByName }
) {
  vetoUiReady = false;
  setVetoUiBusy(true);

  setCurrentVetoMatchIdState(matchId);
  if (!state.isLive && !isAdmin) {
    showToast?.("Tournament is not live. Bracket is read-only.", "warning");
    return;
  }
  const modal = document.getElementById("vetoModal");
  const label = document.getElementById("vetoMatchLabel");
  const bestOfLabel = document.getElementById("vetoBestOfLabel");
  const resetBtn = document.getElementById("resetVetoBtn");
  const doneBtn = document.getElementById("saveVetoBtn");
  const closeBtn = document.getElementById("closeVetoModal");
  if (modal) modal.dataset.matchId = matchId || "";
  if (modal) modal.dataset.forceOpen = "true";
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(matchId);
  const bestOfRaw = getBestOfForMatch(
    match || { bracket: "winners", round: 1 }
  );
  const bestOf = Math.max(1, Number(bestOfRaw) || 1);
  const pool = (
    currentTournamentMeta?.mapPool && currentTournamentMeta.mapPool.length
      ? currentTournamentMeta.mapPool
      : getDefaultMapPoolNames()
  ).map(
    (name) => getMapByName(name) || { name, folder: "", file: "", mode: "1v1" }
  );

  const playersById = getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);

  if (!isAdmin) {
    const uid = auth?.currentUser?.uid || null;
    if (!uid) {
      showToast?.("Sign in to veto/pick maps.", "warning");
      return;
    }
    const me = resolveCurrentPlayerForPresence();
    const isParticipant =
      (me?.id && (me.id === pA?.id || me.id === pB?.id)) ||
      (uid && (uid === pA?.uid || uid === pB?.uid));
    if (!isParticipant) {
      showToast?.("Only match players can veto/pick maps.", "warning");
      return;
    }
  }

  const ordered = [pA, pB]
    .filter(Boolean)
    .sort((a, b) => (b.seed || 999) - (a.seed || 999));
  const lower = ordered[0] || null;
  const higher = ordered[1] || ordered[0] || null;

  const saved = state.matchVetoes?.[matchId];
  console.debug("[veto] openVetoModal", {
    matchId,
    hasSaved: Boolean(saved),
    savedPicks: saved?.maps?.length || 0,
    savedVetoes: saved?.vetoed?.length || 0,
  });
  if (saved) {
    const savedUpdatedAt = Number(saved.updatedAt) || 0;
    const usedNames = new Set([
      ...(saved.maps || []).map((m) => m.map),
      ...(saved.vetoed || []).map((m) => m.map),
    ]);
    const remaining = pool.filter((m) => !usedNames.has(m.name));
    const savedBestOf = Math.max(
      1,
      Number(saved.bestOf || saved.maps?.length || bestOf) || 1
    );
    const savedPicks = Array.isArray(saved.maps) ? saved.maps : [];
    const savedVetoed = Array.isArray(saved.vetoed) ? saved.vetoed : [];
    const stage =
      savedPicks.length >= savedBestOf
        ? "done"
        : remaining.length <= savedBestOf
        ? "pick"
        : "veto";
    const turn =
      stage === "done"
        ? "done"
        : stage === "veto"
        ? savedVetoed.length % 2 === 0
          ? "low"
          : "high"
        : savedPicks.length % 2 === 0
        ? "low"
        : "high";
    setVetoStateState({
      stage,
      turn,
      bestOf: savedBestOf,
      pool: [...pool],
      remaining,
      vetoed: savedVetoed,
      picks: savedPicks,
      updatedAt: savedUpdatedAt,
      lowerName: saved.participants?.lower || lower?.name || "Lower seed",
      higherName: saved.participants?.higher || higher?.name || "Higher seed",
    });
  } else {
    setVetoStateState({
      stage: pool.length <= bestOf ? "pick" : "veto",
      turn: "low",
      bestOf,
      pool: [...pool],
      remaining: [...pool],
      vetoed: [],
      picks: [],
      updatedAt: 0,
      lowerName: lower?.name || "Lower seed",
      higherName: higher?.name || "Higher seed",
    });
  }
  if (modal) {
    modal.dataset.vetoUpdatedAt = String(vetoState?.updatedAt || 0);
  }

  if (label) {
    const aName = pA?.name || "TBD";
    const bName = pB?.name || "TBD";
    label.textContent = `Match ${matchId || ""} · ${aName} vs ${bName}`;
  }
  if (bestOfLabel) bestOfLabel.textContent = "";

  if (doneBtn)
    doneBtn.style.display = vetoState?.stage === "done" ? "" : "none";
  renderVetoPoolGrid(pool);
  renderVetoStatus();
  modal.style.display = "flex";

  vetoUiReady = true;

  // Default unlock, then apply remote busy if the other user just acted
  setVetoUiBusy(false);
  applyRemoteBusyIfAny(matchId);

  modal.dataset.bestOf = vetoState.bestOf;
  modal.onclick = (e) => {
    if (e.target === modal) hideVetoModal({ reopenMatchInfo: true });
  };

  if (closeBtn) {
    closeBtn.onclick = () => hideVetoModal({ reopenMatchInfo: true });
  }

  if (resetBtn) resetBtn.onclick = () => showResetVetoModal();

  const poolEl = document.getElementById("vetoMapPool");
  if (poolEl) poolEl.onclick = handleVetoPoolClick;
}

export function openMatchInfoModal(
  matchId,
  { getPlayersMap, getDefaultMapPoolNames, getMapByName }
) {
  const modal = document.getElementById("matchInfoModal");
  const title = document.getElementById("matchInfoTitle");
  const boInlineEl = document.getElementById("matchInfoBoInline");
  const leftNameEl = document.getElementById("matchInfoLeftName");
  const rightNameEl = document.getElementById("matchInfoRightName");
  const leftFlagEl = document.getElementById("matchInfoLeftFlag");
  const rightFlagEl = document.getElementById("matchInfoRightFlag");
  const leftScoreEl = document.getElementById("matchInfoLeftScore");
  const rightScoreEl = document.getElementById("matchInfoRightScore");
  const rowsEl = document.getElementById("matchInfoMapRows");
  const leftVetoesEl = document.getElementById("matchInfoLeftVetoes");
  const rightVetoesEl = document.getElementById("matchInfoRightVetoes");
  const leftPresenceEl = document.getElementById("matchInfoLeftPresence");
  const rightPresenceEl = document.getElementById("matchInfoRightPresence");
  const serverEl = document.getElementById("matchInfoServer");
  const openVetoBtn = document.getElementById("openMapVetoBtn");
  const confirmScoreBtn = document.getElementById("confirmMatchScoreBtn");
  const castBtn = document.getElementById("castMatchBtn");
  const reportBtn = document.getElementById("matchInfoReportBtn");
  const reportSection = document.getElementById("matchInfoReportSection");
  const reportStatus = document.getElementById("matchInfoReportStatus");
  const reportControls = document.getElementById("matchInfoReportControls");
  const reportScoreLine = document.getElementById("matchInfoReportScoreline");
  const reportMaps = document.getElementById("matchInfoReportMaps");
  const reportSubmitBtn = document.getElementById("matchInfoReportSubmitBtn");
  const reportCancelBtn = document.getElementById("matchInfoReportCancelBtn");
  const reportSummary = document.getElementById("matchInfoReportSummary");
  const reportSummaryText = document.getElementById(
    "matchInfoReportSummaryText"
  );
  const reportMapSummary = document.getElementById("matchInfoReportMapSummary");
  const reportSummaryBy = document.getElementById("matchInfoReportSummaryBy");
  const reportAdminActions = document.getElementById(
    "matchInfoReportAdminActions"
  );
  const reportApproveBtn = document.getElementById("matchInfoReportApproveBtn");
  const reportRejectBtn = document.getElementById("matchInfoReportRejectBtn");
  const walkoverSelect = document.getElementById("matchInfoWalkoverSelect");
  const editScoreBtn = document.getElementById("matchInfoEditScoreBtn");
  const closeBtn = document.getElementById("closeMatchInfoModal");

  if (!modal) return;
  modal.dataset.matchId = matchId || "";

  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(matchId);
  const bestOfComputed = getBestOfForMatch(
    match || { bracket: "winners", round: 1 }
  );
  const saved = state.matchVetoes?.[matchId] || null;
  const bestOf = Math.max(
    1,
    Number(saved?.bestOf || match?.bestOf || bestOfComputed) || 1
  );
  const pickedMaps = Array.isArray(saved?.maps) ? saved.maps : [];
  const vetoedMaps = Array.isArray(saved?.vetoed) ? saved.vetoed : [];
  const playersById = getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  const aName = pA?.name || "TBD";
  const bName = pB?.name || "TBD";
  const leftPlayerId = pA?.id || null;
  const rightPlayerId = pB?.id || null;
  const uid = auth?.currentUser?.uid || null;
  const me = resolveCurrentPlayerForPresence();
  const casterEntry = getCasterEntryByUid(uid);
  const isCaster = Boolean(casterEntry || isAdmin);
  const isParticipant =
    (me?.id && (me.id === leftPlayerId || me.id === rightPlayerId)) ||
    (uid && (uid === pA?.uid || uid === pB?.uid));
  const allowScoreEditToggle = Boolean(isAdmin && match?.status === "complete");
  if (allowScoreEditToggle) {
    if (modal.dataset.scoreEdit !== "true") {
      modal.dataset.scoreEdit = "false";
    }
  } else {
    modal.dataset.scoreEdit = "false";
  }
  let scoreEditEnabled =
    allowScoreEditToggle && modal.dataset.scoreEdit === "true";
  const computeCanEditResults = () =>
    isAdmin
      ? match?.status !== "complete" || scoreEditEnabled
      : state.isLive && isParticipant && match?.status !== "complete";
  let canEditResults = computeCanEditResults();

  modal.dataset.canEditResults = canEditResults ? "true" : "false";
  setupMatchChatUi({
    matchId,
    leftPlayer: pA,
    rightPlayer: pB,
    isParticipant,
    uid,
  });

  if (title) {
    const bracketLabel =
      match?.bracket === "winners"
        ? "Upper"
        : match?.bracket === "losers"
        ? "Lower"
        : match?.bracket === "finals"
        ? "Finals"
        : match?.bracket === "group"
        ? "Group"
        : "Match";
    const roundLabel =
      match?.bracket === "finals"
        ? "Final"
        : Number.isFinite(match?.round)
        ? `Round ${match.round}`
        : "Round";
    title.textContent = `${bracketLabel} ${roundLabel}`;
  }
  if (boInlineEl) {
    boInlineEl.textContent = `bo${bestOf}`;
  }

  if (leftNameEl) leftNameEl.textContent = aName;
  if (rightNameEl) rightNameEl.textContent = bName;
  if (castBtn) {
    const currentCast = state.matchCasts?.[matchId] || null;
    const isCasting = Boolean(currentCast?.uid && currentCast.uid === uid);
    const isTaken = Boolean(currentCast?.uid && currentCast.uid !== uid);
    let castTooltip = "";
    if (!isCaster) {
      castBtn.style.display = "none";
      castBtn.onclick = null;
    } else {
      castBtn.style.display = "inline-flex";
      castBtn.textContent = isCasting ? "Stop Casting" : "Cast";
      castBtn.disabled = isTaken;
      if (isCasting) {
        castTooltip = "You are casting this match.";
      } else if (currentCast?.uid) {
        castTooltip = `Casting: ${currentCast.name || "Caster"}.`;
      } else {
        castTooltip = "Mark this match as casting to show the stream icon.";
      }
      castBtn.onclick = () => {
        if (!uid) {
          showToast?.("Sign in to cast a match.", "error");
          return;
        }
        const nextMatchCasts = { ...(state.matchCasts || {}) };
        if (isCasting) {
          delete nextMatchCasts[matchId];
        } else if (isTaken) {
          showToast?.("This match already has a caster.", "error");
          return;
        } else {
          nextMatchCasts[matchId] = {
            uid,
            name: casterEntry?.name || getCurrentUsername?.() || "Caster",
            twitchUrl: casterEntry?.twitchUrl || "",
            startedAt: Date.now(),
          };
        }
        vetoDeps?.saveState?.({ matchCasts: nextMatchCasts });
        vetoDeps?.renderAll?.();
        openMatchInfoModal(matchId, vetoDeps);
      };
    }
    if (castTooltip) {
      castBtn.setAttribute("data-tooltip", castTooltip);
    } else {
      castBtn.removeAttribute("data-tooltip");
    }
  }
  if (leftFlagEl) {
    const flag = countryCodeToFlag(pA?.country || "");
    setFlagIcon(leftFlagEl, flag);
    leftFlagEl.style.display = flag ? "inline-flex" : "none";
    setFlagTitle(leftFlagEl, pA?.country || "");
    if (!flag) {
      void hydrateCountryFlag(pA, leftFlagEl);
    }
  }
  if (rightFlagEl) {
    const flag = countryCodeToFlag(pB?.country || "");
    setFlagIcon(rightFlagEl, flag);
    rightFlagEl.style.display = flag ? "inline-flex" : "none";
    setFlagTitle(rightFlagEl, pB?.country || "");
    if (!flag) {
      void hydrateCountryFlag(pB, rightFlagEl);
    }
  }
  updateTooltips();
  if (serverEl) {
    const { label, note } = getPreferredServerLabel([pA?.country, pB?.country]);
    if (label) {
      serverEl.textContent = `Preferred server: ${label}${
        note ? ` (${note})` : ""
      }`;
    } else {
      serverEl.textContent = "Preferred server: N/A";
    }
  }
  renderMatchInfoVetoes({
    leftVetoesEl,
    rightVetoesEl,
    vetoedMaps,
    aName,
    bName,
  });
  setPresenceContext({ matchId, leftPlayerId, rightPlayerId });

  const saveMatchVetoesLocal = () => {
    vetoDeps?.saveState?.(
      { matchVetoes: state.matchVetoes, lastUpdated: state.lastUpdated },
      { skipRemote: true, keepTimestamp: true }
    );
  };

  let winners = [];
  const setWalkoverSelection = () => {
    if (!walkoverSelect) return;
    if (walkoverSelect.options.length >= 3) {
      walkoverSelect.options[1].textContent = `${aName} forfeits`;
      walkoverSelect.options[2].textContent = `${bName} forfeits`;
    }
    if (match?.walkover === "a") walkoverSelect.value = "A";
    else if (match?.walkover === "b") walkoverSelect.value = "B";
    else walkoverSelect.value = "";
    walkoverSelect.disabled = !computeCanEditResults();
  };
  const updateConfirmScoreButton = () => {
    if (!confirmScoreBtn) return;
    canEditResults = computeCanEditResults();
    if (!canEditResults) {
      confirmScoreBtn.style.display = "none";
      confirmScoreBtn.onclick = null;
      return;
    }
    const walkoverValue = walkoverSelect?.value || "";
    const winsA = winners.filter((w) => w === "A").length;
    const winsB = winners.filter((w) => w === "B").length;
    const needed = Math.max(1, Math.ceil(bestOf / 2));
    const canConfirm =
      walkoverValue !== "" ||
      (winsA !== winsB && Math.max(winsA, winsB) >= needed);
    confirmScoreBtn.style.display = "";
    confirmScoreBtn.disabled = !canConfirm;
    confirmScoreBtn.textContent = "Confirm score";
    confirmScoreBtn.onclick = canConfirm
      ? () => {
          if (allowScoreEditToggle && scoreEditEnabled) {
            scoreEditEnabled = false;
            modal.dataset.scoreEdit = "false";
          }
          const clearMatchCast = () => {
            if (!state.matchCasts?.[matchId]) return;
            const nextMatchCasts = { ...(state.matchCasts || {}) };
            delete nextMatchCasts[matchId];
            vetoDeps?.saveState?.({ matchCasts: nextMatchCasts });
          };
          vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
          if (walkoverValue === "A") {
            vetoDeps?.updateMatchScore?.(matchId, "W", 0, { finalize: true });
          } else if (walkoverValue === "B") {
            vetoDeps?.updateMatchScore?.(matchId, 0, "W", { finalize: true });
          } else {
            vetoDeps?.updateMatchScore?.(matchId, winsA, winsB, {
              finalize: true,
            });
          }
          clearMatchCast();
          hideMatchInfoModal();
        }
      : null;
  };

  let bindRowInteractivity = () => {};
  if (rowsEl) {
    const record = ensureMatchVetoRecord(matchId, bestOf);
    const participantIds = [pA?.id || null, pB?.id || null];
    const recordIds = Array.isArray(record.playerIds) ? record.playerIds : [];
    const hasRecordedIds = recordIds.length === 2 && recordIds.some((id) => id);
    const idsChanged =
      hasRecordedIds &&
      (recordIds[0] !== participantIds[0] ||
        recordIds[1] !== participantIds[1]);
    if (idsChanged) {
      record.maps = [];
      record.vetoed = [];
      record.mapResults = [];
      record.playerIds = participantIds;
      saveMatchVetoesLocal();
    } else if (!hasRecordedIds) {
      record.playerIds = participantIds;
      saveMatchVetoesLocal();
    }
    winners = normalizeMapResults(record.mapResults, bestOf);
    record.mapResults = winners;
    updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners, match });
    renderMatchInfoRows(rowsEl, {
      bestOf,
      pickedMaps,
      winners,
    });

    bindRowInteractivity = () => {
      const canEdit = computeCanEditResults();
      if (!canEdit) {
        rowsEl.querySelectorAll(".match-info-pick-cell").forEach((cell) => {
          cell.classList.add("is-disabled");
        });
        rowsEl.querySelectorAll(".match-info-row").forEach((row) => {
          delete row.dataset.previewWinner;
        });
        rowsEl.onmouseover = null;
        rowsEl.onmouseout = null;
        rowsEl.onclick = null;
        return;
      }
      rowsEl.onmouseover = (e) => {
        const cell = e.target.closest?.(".match-info-pick-cell");
        if (!cell) return;
        if (cell.classList.contains("is-disabled")) return;
        if (walkoverSelect?.value) return;
        const row = cell.closest("tr");
        const idx = Number(row?.dataset?.mapIdx || "-1");
        if (!row || !Number.isFinite(idx) || idx < 0 || idx >= bestOf) return;
        if (idx > getNextOpenMapIndex(winners, bestOf)) return;
        if (winners[idx]) return;
        row.dataset.previewWinner = cell.dataset.side || "";
      };

      rowsEl.onmouseout = (e) => {
        const row = e.target.closest?.("tr");
        if (!row) return;
        if (!row.contains(e.relatedTarget)) {
          delete row.dataset.previewWinner;
        }
      };

      rowsEl.onclick = (e) => {
        const cell = e.target.closest?.(".match-info-pick-cell");
        if (!cell) return;
        if (cell.classList.contains("is-disabled")) return;
        if (walkoverSelect?.value) return;
        const row = cell.closest("tr");
        const idx = Number(row?.dataset?.mapIdx || "-1");
        const side = cell.dataset.side === "B" ? "B" : "A";
        if (!row || !Number.isFinite(idx) || idx < 0 || idx >= bestOf) return;
        if (idx > getNextOpenMapIndex(winners, bestOf)) return;

        winners[idx] = winners[idx] === side ? null : side;
        if (!winners[idx]) {
          for (let i = idx + 1; i < bestOf; i++) {
            winners[i] = null;
          }
        }
        clearMapsAfterDecision(winners, bestOf);
        record.mapResults = winners;

        saveMatchVetoesLocal();
        updateMatchInfoHeaderScores({
          leftScoreEl,
          rightScoreEl,
          winners,
          match,
        });
        renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners });
        updateConfirmScoreButton();
      };
    };

    bindRowInteractivity();
  }
  setWalkoverSelection();
  if (editScoreBtn) {
    if (allowScoreEditToggle) {
      editScoreBtn.style.display = "inline-flex";
      editScoreBtn.disabled = scoreEditEnabled;
      editScoreBtn.textContent = scoreEditEnabled ? "Editing" : "Edit score";
      editScoreBtn.onclick = () => {
        scoreEditEnabled = true;
        modal.dataset.scoreEdit = "true";
        modal.dataset.canEditResults = "true";
        editScoreBtn.disabled = true;
        editScoreBtn.textContent = "Editing";
        setWalkoverSelection();
        updateConfirmScoreButton();
        if (rowsEl) {
          renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners });
        }
        bindRowInteractivity();
      };
    } else {
      editScoreBtn.style.display = "none";
      editScoreBtn.onclick = null;
    }
  }
  if (walkoverSelect) {
    walkoverSelect.onchange = () => {
      const value = walkoverSelect.value;
      if (value) {
        winners = normalizeMapResults([], bestOf);
        const record = ensureMatchVetoRecord(matchId, bestOf);
        record.mapResults = winners;
        saveMatchVetoesLocal();
      }
      updateMatchInfoHeaderScores({
        leftScoreEl,
        rightScoreEl,
        winners,
        match,
      });
      renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners });
      updateConfirmScoreButton();
    };
  }
  updateConfirmScoreButton();

  const scoreReports = state.scoreReports || {};
  const existingReport = scoreReports[matchId] || null;
  const canReport = Boolean(
    uid && isParticipant && leftPlayerId && rightPlayerId
  );
  const shouldShowReport = Boolean(existingReport);
  if (reportSection) {
    reportSection.style.display = shouldShowReport ? "grid" : "none";
  }
  if (reportStatus) {
    if (existingReport) {
      reportStatus.textContent = isAdmin
        ? "Pending admin review."
        : "Report submitted.";
    } else if (canReport) {
      reportStatus.textContent = "Report a corrected score for admin review.";
    } else {
      reportStatus.textContent = "";
    }
  }
  const maxWins = Math.max(1, Math.ceil(bestOf / 2));
  const clampScore = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(num, maxWins));
  };
  const mapNames = Array.from({ length: bestOf }).map(
    (_, idx) => pickedMaps?.[idx]?.map || `Map ${idx + 1}`
  );
  const normalizeReportResults = (results) => {
    const normalized = normalizeMapResults(results, bestOf);
    return normalized.map((entry) =>
      entry === "A" || entry === "B" ? entry : null
    );
  };
  const deriveResultsFromScores = (scoreA, scoreB) => {
    const winsA = clampScore(scoreA);
    const winsB = clampScore(scoreB);
    const next = [];
    for (let i = 0; i < bestOf; i += 1) {
      if (i < winsA) next.push("A");
      else if (i < winsA + winsB) next.push("B");
      else next.push(null);
    }
    return next;
  };
  let reportResults = [];
  if (existingReport?.mapResults?.length) {
    reportResults = normalizeReportResults(existingReport.mapResults);
  } else if (
    Number.isFinite(existingReport?.scoreA) ||
    Number.isFinite(existingReport?.scoreB)
  ) {
    reportResults = deriveResultsFromScores(
      existingReport?.scoreA || 0,
      existingReport?.scoreB || 0
    );
  } else {
    reportResults = normalizeReportResults(winners);
  }
  const getReportWins = (results) => {
    const winsA = results.filter((w) => w === "A").length;
    const winsB = results.filter((w) => w === "B").length;
    return { winsA, winsB };
  };
  const updateReportScoreLine = () => {
    if (!reportScoreLine) return;
    const { winsA, winsB } = getReportWins(reportResults);
    reportScoreLine.textContent = `Proposed: ${aName} ${winsA}-${winsB} ${bName}`;
  };
  const renderReportMaps = () => {
    if (!reportMaps) return;
    const rows = reportResults
      .map((winner, idx) => {
        const mapLabel = escapeHtml(mapNames[idx] || `Map ${idx + 1}`);
        const options = [
          `<option value="">-</option>`,
          `<option value="A" ${winner === "A" ? "selected" : ""}>${escapeHtml(
            aName
          )}</option>`,
          `<option value="B" ${winner === "B" ? "selected" : ""}>${escapeHtml(
            bName
          )}</option>`,
        ].join("");
        return `<div class="match-info-report-map-row">
          <div class="match-info-report-map-name">${mapLabel}</div>
          <select class="match-info-report-select" data-map-idx="${idx}" name="match-info-report-${idx}">
            ${options}
          </select>
        </div>`;
      })
      .join("");
    reportMaps.innerHTML = DOMPurify.sanitize(rows);
  };
  const renderReportSummaryList = () => {
    if (!reportMapSummary) return;
    const rows = reportResults
      .map((winner, idx) => {
        const mapLabel = escapeHtml(mapNames[idx] || `Map ${idx + 1}`);
        const winnerLabel =
          winner === "A" ? aName : winner === "B" ? bName : "Unreported";
        return `<div class="match-info-report-summary-row">
          <span>${mapLabel}</span>
          <span>${escapeHtml(winnerLabel)}</span>
        </div>`;
      })
      .join("");
    reportMapSummary.innerHTML = DOMPurify.sanitize(rows);
  };
  const validateReportScores = () => {
    const { winsA, winsB } = getReportWins(reportResults);
    if (winsA === winsB) return false;
    return Math.max(winsA, winsB) >= maxWins;
  };
  const updateReportSubmitState = () => {
    if (!reportSubmitBtn) return;
    reportSubmitBtn.disabled = !validateReportScores();
  };
  const showReportControls = (visible) => {
    if (reportControls)
      reportControls.style.display = visible ? "grid" : "none";
  };
  const showReportSummary = (visible) => {
    if (reportSummary) reportSummary.style.display = visible ? "grid" : "none";
  };

  if (reportBtn) {
    reportBtn.style.display =
      canReport && !existingReport ? "inline-flex" : "none";
    reportBtn.onclick =
      canReport && !existingReport
        ? () => {
            if (reportSection) reportSection.style.display = "grid";
            renderReportMaps();
            updateReportScoreLine();
            updateReportSubmitState();
            showReportControls(true);
            reportBtn.style.display = "none";
          }
        : null;
  }

  if (reportCancelBtn) {
    reportCancelBtn.onclick = () => {
      showReportControls(false);
      if (!existingReport && reportSection) {
        reportSection.style.display = "none";
      }
      if (reportBtn && canReport && !existingReport) {
        reportBtn.style.display = "inline-flex";
      }
    };
  }

  if (reportMaps) {
    reportMaps.onchange = (e) => {
      const select = e.target.closest?.(".match-info-report-select");
      if (!select) return;
      const idx = Number(select.dataset.mapIdx || "-1");
      if (!Number.isFinite(idx) || idx < 0 || idx >= bestOf) return;
      const value = select.value;
      reportResults[idx] = value === "A" || value === "B" ? value : null;
      updateReportScoreLine();
      updateReportSubmitState();
    };
  }

  if (reportSubmitBtn) {
    reportSubmitBtn.onclick = () => {
      if (!canReport) return;
      if (!validateReportScores()) {
        showToast?.("Pick a valid score for the report.", "error");
        return;
      }
      const { winsA, winsB } = getReportWins(reportResults);
      const reportEntry = {
        scoreA: winsA,
        scoreB: winsB,
        mapResults: reportResults,
        createdAt: Date.now(),
        createdByUid: uid,
        createdByName: getCurrentUsername?.() || "Player",
        status: "pending",
      };
      const next = { ...(state.scoreReports || {}) };
      next[matchId] = reportEntry;
      state.scoreReports = next;
      vetoDeps?.saveState?.({ scoreReports: next });
      vetoDeps?.renderAll?.();
      if (reportSummaryText) {
        reportSummaryText.textContent = `${aName} ${winsA}-${winsB} ${bName}`;
      }
      renderReportSummaryList();
      if (reportSummaryBy) {
        reportSummaryBy.textContent = `Reported by ${reportEntry.createdByName}.`;
      }
      if (reportStatus) reportStatus.textContent = "Report submitted.";
      showReportControls(false);
      showReportSummary(true);
    };
  }

  if (existingReport) {
    const { winsA, winsB } = getReportWins(reportResults);
    if (reportSummaryText) {
      reportSummaryText.textContent = `${aName} ${winsA}-${winsB} ${bName}`;
    }
    renderReportSummaryList();
    if (reportSummaryBy) {
      const reporter = existingReport.createdByName || "Player";
      reportSummaryBy.textContent = `Reported by ${reporter}.`;
    }
    showReportControls(false);
    showReportSummary(true);
  } else {
    showReportSummary(false);
    if (reportMapSummary) reportMapSummary.innerHTML = "";
    if (reportControls && !canReport) reportControls.style.display = "none";
  }

  if (reportAdminActions) {
    reportAdminActions.style.display =
      isAdmin && existingReport ? "flex" : "none";
  }
  if (reportApproveBtn) {
    reportApproveBtn.onclick =
      isAdmin && existingReport
        ? () => {
            const { winsA, winsB } = getReportWins(reportResults);
            if (winsA === winsB || Math.max(winsA, winsB) < maxWins) {
              showToast?.("Report score is not complete.", "error");
              return;
            }
            const record = ensureMatchVetoRecord(matchId, bestOf);
            record.mapResults = normalizeReportResults(reportResults);
            vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
            vetoDeps?.updateMatchScore?.(matchId, winsA, winsB, {
              finalize: true,
            });
            const next = { ...(state.scoreReports || {}) };
            delete next[matchId];
            state.scoreReports = next;
            vetoDeps?.saveState?.({ scoreReports: next });
            void clearScoreReportRemote(matchId);
            vetoDeps?.renderAll?.();
            openMatchInfoModal(matchId, vetoDeps);
          }
        : null;
  }
  if (reportRejectBtn) {
    reportRejectBtn.onclick =
      isAdmin && existingReport
        ? () => {
            const next = { ...(state.scoreReports || {}) };
            delete next[matchId];
            state.scoreReports = next;
            vetoDeps?.saveState?.({ scoreReports: next });
            void clearScoreReportRemote(matchId);
            vetoDeps?.renderAll?.();
            openMatchInfoModal(matchId, vetoDeps);
          }
        : null;
  }

  if (openVetoBtn) {
    const canOpenVeto = isAdmin || isParticipant;
    openVetoBtn.style.display = canOpenVeto ? "" : "none";
    openVetoBtn.onclick = canOpenVeto
      ? () => {
          hideMatchInfoModal();
          openVetoModal(matchId, {
            getPlayersMap,
            getDefaultMapPoolNames,
            getMapByName,
          });
        }
      : null;
  }

  if (closeBtn) closeBtn.onclick = () => hideMatchInfoModal();

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) hideMatchInfoModal();
  };

  startPresenceTracking(matchId, { leftPlayerId, rightPlayerId, aName, bName });
  applyPresenceIndicators({ leftPresenceEl, rightPresenceEl });
  if (!presenceUiTimer) {
    presenceUiTimer = setInterval(() => applyPresenceIndicators(), 5_000);
  }
}

function updateMatchInfoHeaderScores({
  leftScoreEl,
  rightScoreEl,
  winners,
  match,
}) {
  const hasWalkover = Boolean(match?.walkover);
  const winsA = hasWalkover
    ? Number(match?.scores?.[0] ?? 0)
    : winners.filter((w) => w === "A").length;
  const winsB = hasWalkover
    ? Number(match?.scores?.[1] ?? 0)
    : winners.filter((w) => w === "B").length;
  if (leftScoreEl) leftScoreEl.textContent = String(winsA);
  if (rightScoreEl) rightScoreEl.textContent = String(winsB);
}

function renderMatchInfoVetoes({
  leftVetoesEl,
  rightVetoesEl,
  vetoedMaps,
  aName,
  bName,
}) {
  if (leftVetoesEl) leftVetoesEl.innerHTML = "";
  if (rightVetoesEl) rightVetoesEl.innerHTML = "";
  if (!leftVetoesEl && !rightVetoesEl) return;

  const left = [];
  const right = [];
  for (const entry of vetoedMaps || []) {
    const picker = entry?.picker || "";
    if (picker === aName) left.push(entry);
    else if (picker === bName) right.push(entry);
  }

  if (leftVetoesEl) {
    leftVetoesEl.innerHTML = left.length
      ? DOMPurify.sanitize(
          left.map((v) => `<li>${escapeHtml(v.map)}</li>`).join("")
        )
      : `<li class="helper">None</li>`;
  }
  if (rightVetoesEl) {
    rightVetoesEl.innerHTML = right.length
      ? DOMPurify.sanitize(
          right.map((v) => `<li>${escapeHtml(v.map)}</li>`).join("")
        )
      : `<li class="helper">None</li>`;
  }
}

function ensureMatchVetoRecord(matchId, bestOf) {
  state.matchVetoes = state.matchVetoes || {};
  const existing = state.matchVetoes[matchId] || {};
  const safeBestOf = Math.max(1, Number(bestOf) || 1);
  if (!existing.bestOf) existing.bestOf = safeBestOf;
  if (!Array.isArray(existing.maps)) existing.maps = [];
  if (!Array.isArray(existing.vetoed)) existing.vetoed = [];
  if (!Array.isArray(existing.mapResults)) existing.mapResults = [];
  state.matchVetoes[matchId] = existing;
  return existing;
}

function normalizeMapResults(mapResults, bestOf) {
  const out = Array.isArray(mapResults) ? [...mapResults] : [];
  const n = Math.max(1, Number(bestOf) || 1);
  if (out.length > n) return out.slice(0, n);
  while (out.length < n) out.push(null);
  return out;
}

async function hydrateCountryFlag(player, flagEl) {
  let uid = String(player?.uid || "").trim();
  if (!flagEl) return;
  if (uid && countryFlagCache.has(uid)) {
    const cached = countryFlagCache.get(uid) || "";
    setFlagIcon(flagEl, cached);
    flagEl.style.display = cached ? "inline-flex" : "none";
    if (cached && player?.country) {
      setFlagTitle(flagEl, player.country);
    } else {
      setFlagTitle(flagEl, "");
    }
    updateTooltips();
    return;
  }
  try {
    if (!uid) {
      const rawName = String(player?.name || "").trim();
      const nameKey = rawName.toLowerCase();
      if (nameKey && countryUidCache.has(nameKey)) {
        uid = countryUidCache.get(nameKey) || "";
      } else if (rawName) {
        const candidates = getUsernameCandidates(rawName);
        for (const candidate of candidates) {
          if (!candidate) continue;
          let usernameSnap = await getDoc(doc(db, "usernames", candidate));
          if (!usernameSnap.exists() && candidate.toLowerCase() !== candidate) {
            usernameSnap = await getDoc(
              doc(db, "usernames", candidate.toLowerCase())
            );
          }
          if (!usernameSnap.exists()) continue;
          const resolved = String(
            usernameSnap.data()?.userId || usernameSnap.data()?.uid || ""
          ).trim();
          if (resolved) {
            uid = resolved;
            countryUidCache.set(nameKey, resolved);
            player.uid = resolved;
            break;
          }
        }
      }
    }
    if (!uid) {
      return;
    }
    const snap = await getDoc(doc(db, "users", uid));
    const code = snap.exists() ? String(snap.data()?.country || "") : "";
    const flag = countryCodeToFlag(code);
    countryFlagCache.set(uid, flag);
    if (flag) {
      setFlagIcon(flagEl, flag);
      flagEl.style.display = "inline-flex";
      player.country = code.toUpperCase();
      setFlagTitle(flagEl, player.country);
      vetoDeps?.saveState?.({ players: state.players });
    } else {
      setFlagTitle(flagEl, "");
    }
    updateTooltips();
  } catch (_) {
    countryFlagCache.set(uid, "");
  }
}

function countryCodeToFlag(raw) {
  const code = String(raw || "")
    .trim()
    .toUpperCase();
  if (code === "ENG") {
    return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  }
  if (code === "SCT") {
    return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  }
  if (code === "WLS") {
    return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";
  }
  let resolved = code;
  if (resolved.length === 3) {
    resolved = ISO3_TO_ISO2[resolved] || resolved;
  }
  if (resolved.length !== 2) {
    const nameKey = normalizeCountryName(resolved);
    resolved = COUNTRY_CODE_BY_NAME.get(nameKey) || "";
  }
  if (resolved.length !== 2) return "";
  const A = 0x1f1e6;
  const first = resolved.charCodeAt(0) - 65;
  const second = resolved.charCodeAt(1) - 65;
  if (first < 0 || first > 25 || second < 0 || second > 25) return "";
  return String.fromCodePoint(A + first, A + second);
}

function getNextOpenMapIndex(winners, bestOf) {
  const idx = winners.findIndex((winner) => !winner);
  return idx === -1 ? bestOf : idx;
}

function clearMapsAfterDecision(winners, bestOf) {
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  let winsA = 0;
  let winsB = 0;
  let decidedAt = -1;
  for (let i = 0; i < bestOf; i++) {
    if (winners[i] === "A") winsA++;
    else if (winners[i] === "B") winsB++;
    if (winsA >= needed || winsB >= needed) {
      decidedAt = i;
      break;
    }
  }
  if (decidedAt !== -1) {
    for (let i = decidedAt + 1; i < bestOf; i++) {
      winners[i] = null;
    }
  }
  return winners;
}

function renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners }) {
  rowsEl.innerHTML = "";
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const nextOpenIdx = getNextOpenMapIndex(winners, bestOf);
  let winsA = 0;
  let winsB = 0;
  let decidedAt = -1;
  for (let i = 0; i < bestOf; i++) {
    if (decidedAt !== -1) break;
    if (winners[i] === "A") winsA++;
    else if (winners[i] === "B") winsB++;
    if (winsA >= needed || winsB >= needed) decidedAt = i;
  }
  const isDecided = decidedAt !== -1;
  for (let i = 0; i < bestOf; i++) {
    const mapLabel = pickedMaps[i]?.map || `Map ${i + 1}`;
    const winner = winners[i] === "B" ? "B" : winners[i] === "A" ? "A" : null;
    const isAfterDecision = isDecided && i > decidedAt;
    const isLockedByOrder = i > nextOpenIdx;

    const tr = document.createElement("tr");
    tr.className = "match-info-row";
    tr.dataset.mapIdx = String(i);
    if (isAfterDecision) tr.classList.add("is-after-decision");

    const leftTd = document.createElement("td");
    leftTd.className = "match-info-pick-cell";
    leftTd.dataset.side = "A";

    const mapTd = document.createElement("td");
    mapTd.className = "match-info-map-cell";
    mapTd.textContent = mapLabel;

    const rightTd = document.createElement("td");
    rightTd.className = "match-info-pick-cell";
    rightTd.dataset.side = "B";

    if (winner === "A") {
      leftTd.classList.add("is-winner");
      leftTd.textContent = "Win";
      rightTd.classList.add("is-loser");
      rightTd.textContent = "Loss";
    } else if (winner === "B") {
      leftTd.classList.add("is-loser");
      leftTd.textContent = "Loss";
      rightTd.classList.add("is-winner");
      rightTd.textContent = "Win";
    } else {
      leftTd.textContent = "";
      rightTd.textContent = "";
    }

    if (isAfterDecision || isLockedByOrder) {
      leftTd.classList.add("is-disabled");
      rightTd.classList.add("is-disabled");
      if (isAfterDecision) mapTd.classList.add("is-eliminated");
    }

    tr.append(leftTd, mapTd, rightTd);
    rowsEl.appendChild(tr);
  }
}

export function hideMatchInfoModal() {
  const modal = document.getElementById("matchInfoModal");
  if (modal) {
    modal.style.display = "none";
    delete modal.dataset.matchId;
  }
  teardownMatchChatUi();
  stopPresenceTracking();
  if (presenceUiTimer) clearInterval(presenceUiTimer);
  presenceUiTimer = null;
}

export function refreshMatchInfoModalIfOpen() {
  if (!vetoDeps) return;
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return;
  const cs = window.getComputedStyle(modal);
  const visible = cs.display !== "none" && cs.visibility !== "hidden";
  if (!visible) return;

  const matchId = modal.dataset.matchId;
  if (!matchId) return;
  openMatchInfoModal(matchId, vetoDeps);
}

export function refreshMatchInfoPresenceIfOpen() {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return;
  const cs = window.getComputedStyle(modal);
  const visible = cs.display !== "none" && cs.visibility !== "hidden";
  if (!visible) return;
  applyPresenceIndicators();
}

function presenceDocRef(uid) {
  if (!uid || !currentSlug) return null;
  return doc(db, PRESENCE_COLLECTION, currentSlug, "matchInfo", uid);
}

function tournamentStateDocRef() {
  if (!currentSlug) return null;
  return doc(collection(db, TOURNAMENT_STATE_COLLECTION), currentSlug);
}

async function clearScoreReportRemote(matchId) {
  const ref = tournamentStateDocRef();
  if (!ref || !matchId) return;
  try {
    await updateDoc(ref, { [`scoreReports.${matchId}`]: deleteField() });
  } catch (err) {
    console.warn("Failed to clear score report remotely", err);
  }
}

function startPresenceTracking(matchId, hint = null) {
  if (presenceSlug && presenceSlug !== currentSlug) {
    try {
      presenceUnsub?.();
    } catch (_) {
      // ignore
    }
    presenceUnsub = null;
    presenceLatest = new Map();
    presenceSlug = null;
  }

  if (!presenceUnsub && currentSlug) {
    const colRef = collection(
      db,
      PRESENCE_COLLECTION,
      currentSlug,
      "matchInfo"
    );
    presenceUnsub = onSnapshot(
      colRef,
      (snap) => {
        const next = new Map();
        for (const d of snap.docs) {
          const data = d.data() || {};
          const updatedAtMs = data.updatedAt?.toMillis
            ? data.updatedAt.toMillis()
            : Number(data.clientUpdatedAt) || Number(data.updatedAt) || 0;
          next.set(d.id, {
            matchId: data.matchId || null,
            updatedAtMs,
            playerId: data.playerId || null,
          });
        }
        presenceLatest = next;
        applyPresenceIndicators();
      },
      () => {}
    );
    presenceSlug = currentSlug;
  }

  const uid = auth?.currentUser?.uid || null;
  const ref = presenceDocRef(uid);
  if (!ref) return;

  const player = resolveCurrentPlayerForPresence();
  let playerId = player?.id || null;

  if (!playerId) {
    const username = (getCurrentUsername?.() || "").trim();
    if (username && hint?.aName && username === hint.aName)
      playerId = hint.leftPlayerId || null;
    if (username && hint?.bName && username === hint.bName)
      playerId = hint.rightPlayerId || null;
  }

  if (playerId && uid && !player?.uid) {
    tryBackfillPlayerUid(playerId, uid);
  }

  const nextPresenceKey = `${currentSlug || ""}:${matchId || ""}:${uid || ""}:${
    playerId || ""
  }`;
  if (presenceHeartbeat && presenceActiveKey === nextPresenceKey) {
    return;
  }
  presenceActiveKey = nextPresenceKey;

  const write = async () => {
    if (!isMatchInfoModalVisible()) return;
    const now = Date.now();
    const samePayload =
      presenceLastMatchId === (matchId || null) &&
      presenceLastPlayerId === (playerId || null);
    if (samePayload && now - presenceLastWriteAt < PRESENCE_MIN_WRITE_MS) {
      return;
    }

    const status = presenceUiStatus || "active";
    if (presenceWriteDenied) return;
    try {
      await setDoc(
        ref,
        {
          matchId: matchId || null,
          playerId: playerId || null,
          updatedAt: serverTimestamp(),
          clientUpdatedAt: now,
          status,
        },
        { merge: true }
      );
      presenceLastWriteAt = now;
      presenceLastMatchId = matchId || null;
      presenceLastPlayerId = playerId || null;
    } catch (err) {
      if (err?.code === "permission-denied") {
        presenceWriteDenied = true;
        return;
      }
      console.warn("Presence write failed", err);
    }
  };

  const scheduleIdleCheck = () => {
    if (presenceActivityTimer) clearTimeout(presenceActivityTimer);
    const now = Date.now();
    const sinceActivity = Math.max(0, now - (presenceLastActivityAt || 0));
    const remaining = Math.max(5_000, PRESENCE_IDLE_AFTER_MS - sinceActivity);
    presenceActivityTimer = setTimeout(() => {
      if (!isMatchInfoModalVisible()) return;
      const idleNow =
        Date.now() - (presenceLastActivityAt || 0) >= PRESENCE_IDLE_AFTER_MS;
      if (idleNow && presenceUiStatus !== "idle") {
        presenceUiStatus = "idle";
        void write();
      }
      scheduleIdleCheck();
    }, remaining);
  };

  const markActive = () => {
    presenceLastActivityAt = Date.now();
    if (presenceUiStatus !== "active") {
      presenceUiStatus = "active";
      void write();
    }
    scheduleIdleCheck();
  };

  if (presenceLastActivityAt === 0) {
    presenceLastActivityAt = Date.now();
  }
  presenceUiStatus = "active";
  scheduleIdleCheck();

  write();
  if (presenceHeartbeat) clearInterval(presenceHeartbeat);
  presenceHeartbeat = null;

  const modalEl = document.getElementById("matchInfoModal");
  if (modalEl) {
    modalEl.onmousemove = markActive;
    modalEl.onkeydown = markActive;
    modalEl.onfocusin = markActive;
  }
  if (!presenceActivityHandler) {
    presenceActivityHandler = () => {
      if (!isMatchInfoModalVisible()) return;
      markActive();
    };
    window.addEventListener("mousemove", presenceActivityHandler, {
      passive: true,
    });
    window.addEventListener("keydown", presenceActivityHandler);
    window.addEventListener("focus", presenceActivityHandler);
  }
  if (!presenceVisibilityHandler) {
    presenceVisibilityHandler = () => {
      if (!isMatchInfoModalVisible()) return;
      if (document.visibilityState === "visible") {
        markActive();
      }
    };
    document.addEventListener("visibilitychange", presenceVisibilityHandler);
  }
}

function stopPresenceTracking() {
  const uid = auth?.currentUser?.uid || null;
  const ref = presenceDocRef(uid);
  if (presenceHeartbeat) clearInterval(presenceHeartbeat);
  presenceHeartbeat = null;
  presenceActiveKey = "";
  presenceLastWriteAt = 0;
  presenceLastMatchId = null;
  presenceLastPlayerId = null;
  presenceUiStatus = "active";
  presenceLastActivityAt = 0;
  if (presenceActivityTimer) clearTimeout(presenceActivityTimer);
  presenceActivityTimer = null;
  if (presenceActivityHandler) {
    window.removeEventListener("mousemove", presenceActivityHandler);
    window.removeEventListener("keydown", presenceActivityHandler);
    window.removeEventListener("focus", presenceActivityHandler);
    presenceActivityHandler = null;
  }
  if (presenceVisibilityHandler) {
    document.removeEventListener("visibilitychange", presenceVisibilityHandler);
    presenceVisibilityHandler = null;
  }
  if (ref) {
    deleteDoc(ref).catch(() => {});
  }
}

function isMatchInfoModalVisible() {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return false;
  return modal.style.display && modal.style.display !== "none";
}

function setPresenceContext({ matchId, leftPlayerId, rightPlayerId }) {
  presenceContext = {
    matchId: matchId || null,
    leftPlayerId: leftPlayerId || null,
    rightPlayerId: rightPlayerId || null,
  };
}

function isPlayerOnlineForMatch(playerId, matchId) {
  if (!playerId || !matchId) return false;
  for (const entry of presenceLatest.values()) {
    if (!entry) continue;
    if (entry.playerId !== playerId) continue;
    if (entry.matchId !== matchId) continue;
    if (Date.now() - (entry.updatedAtMs || 0) <= PRESENCE_OFFLINE_AFTER_MS)
      return true;
  }

  return false;
}

function getPresenceStatusForMatch(playerId, matchId) {
  if (!playerId || !matchId) return "offline";
  const now = Date.now();
  let status = "offline";
  for (const entry of presenceLatest.values()) {
    if (!entry) continue;
    if (entry.playerId !== playerId) continue;
    if (entry.matchId !== matchId) continue;
    const age = now - (entry.updatedAtMs || 0);
    if (age <= PRESENCE_IDLE_AFTER_MS) return entry.status || "active";
    if (age <= PRESENCE_OFFLINE_AFTER_MS) status = entry.status || "idle";
  }
  return status;
}

function applyPresenceIndicators(override = null) {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return;
  const visible = modal.style.display && modal.style.display !== "none";
  if (!visible) return;

  const leftPresenceEl =
    override?.leftPresenceEl ||
    document.getElementById("matchInfoLeftPresence");
  const rightPresenceEl =
    override?.rightPresenceEl ||
    document.getElementById("matchInfoRightPresence");

  const matchId = modal.dataset.matchId || presenceContext.matchId;
  const leftStatus = getPresenceStatusForMatch(
    presenceContext.leftPlayerId,
    matchId
  );
  const rightStatus = getPresenceStatusForMatch(
    presenceContext.rightPlayerId,
    matchId
  );

  if (leftPresenceEl) {
    leftPresenceEl.classList.toggle("online", leftStatus === "active");
    leftPresenceEl.classList.toggle("idle", leftStatus === "idle");
    leftPresenceEl.classList.toggle("offline", leftStatus === "offline");
    leftPresenceEl.setAttribute(
      "aria-label",
      leftStatus === "active"
        ? "Player online"
        : leftStatus === "idle"
        ? "Player idle"
        : "Player offline"
    );
    leftPresenceEl.setAttribute(
      "title",
      leftStatus === "active"
        ? "Online"
        : leftStatus === "idle"
        ? "Idle"
        : "Offline"
    );
  }
  if (rightPresenceEl) {
    rightPresenceEl.classList.toggle("online", rightStatus === "active");
    rightPresenceEl.classList.toggle("idle", rightStatus === "idle");
    rightPresenceEl.classList.toggle("offline", rightStatus === "offline");
    rightPresenceEl.setAttribute(
      "aria-label",
      rightStatus === "active"
        ? "Player online"
        : rightStatus === "idle"
        ? "Player idle"
        : "Player offline"
    );
    rightPresenceEl.setAttribute(
      "title",
      rightStatus === "active"
        ? "Online"
        : rightStatus === "idle"
        ? "Idle"
        : "Offline"
    );
  }
}

function resolveCurrentPlayerForPresence() {
  const uid = auth?.currentUser?.uid || null;
  const username = (getCurrentUsername?.() || "").trim();
  const pulseUrl = pulseProfile?.url || "";
  const normalizedPulseUrl = pulseUrl ? pulseUrl.toString().trim() : "";

  const players = state.players || [];
  if (uid) {
    const byUid = players.find((p) => p && p.uid === uid);
    if (byUid) return byUid;
  }
  if (normalizedPulseUrl) {
    const byLink = players.find((p) => p && p.sc2Link === normalizedPulseUrl);
    if (byLink) return byLink;
  }
  if (username) {
    const byName = players.find((p) => p && p.name === username);
    if (byName) return byName;
  }
  return null;
}

function tryBackfillPlayerUid(playerId, uid) {
  if (!playerId || !uid) return;
  const players = Array.isArray(state.players) ? state.players : [];
  const idx = players.findIndex((p) => p && p.id === playerId);
  if (idx === -1) return;
  const existing = players[idx];
  if (existing?.uid) return;
  const nextPlayers = players.map((p, i) => (i === idx ? { ...p, uid } : p));
  state.players = nextPlayers;
  vetoDeps?.saveState?.({ players: nextPlayers });
}

export async function handleVetoPoolClick(e) {
  // Do not allow any interaction until initial state has been loaded at least once
  if (!vetoUiReady) return;

  // Prevent fast multi-clicking (lock is released after persist completes)
  if (vetoUiBusy) return;

  if (!vetoState || vetoState.stage === "done") return;

  // ----- Turn validation (unchanged) -----
  if (!isAdmin) {
    const uid = auth?.currentUser?.uid || null;
    if (!uid) {
      showToast?.("Sign in to veto/pick maps.", "warning");
      return;
    }

    const lookup = getMatchLookup(state.bracket || {});
    const match = currentVetoMatchId ? lookup.get(currentVetoMatchId) : null;
    const playersById = new Map((state.players || []).map((p) => [p.id, p]));
    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    const ordered = [pA, pB]
      .filter(Boolean)
      .sort((a, b) => (b.seed || 999) - (a.seed || 999));
    const lower = ordered[0] || null;
    const higher = ordered[1] || ordered[0] || null;
    const expectedUid = vetoState.turn === "low" ? lower?.uid : higher?.uid;
    if (expectedUid && expectedUid !== uid) {
      showToast?.("Not your turn to veto/pick.", "warning");
      return;
    }
  }

  // Resolve which map was clicked
  const target =
    e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
  const card = target?.closest?.(".tournament-map-card");
  if (!card) return;

  const name = card.dataset.mapName
    ? decodeURIComponent(card.dataset.mapName)
    : "";
  if (!name) return;

  // IMMEDIATE LOCK: prevents “quick enough” clicking before persist starts
  setVetoUiBusy(true);

  try {
    const bestOf = Math.max(1, Number(vetoState.bestOf) || 1);
    const turnLabel = vetoState.turn;
    const picker =
      turnLabel === "low"
        ? vetoState.lowerName || "Player A"
        : vetoState.higherName || "Player B";

    if (vetoState.stage === "veto") {
      const remainingCount = vetoState.remaining.length;
      if (remainingCount <= bestOf) return;

      const idx = vetoState.remaining.findIndex((m) => m.name === name);
      if (idx === -1) return;

      const [removed] = vetoState.remaining.splice(idx, 1);
      vetoState.vetoed.push({ map: removed.name, picker, action: "veto" });

      const newRemaining = vetoState.remaining.length;
      if (newRemaining <= bestOf) {
        vetoState.stage = "pick";
        vetoState.turn = "low";
      } else {
        vetoState.turn = vetoState.turn === "low" ? "high" : "low";
      }
    } else if (vetoState.stage === "pick") {
      const idx = vetoState.remaining.findIndex((m) => m.name === name);
      if (idx === -1) return;

      const [picked] = vetoState.remaining.splice(idx, 1);
      vetoState.picks.push({ map: picked.name, picker, action: "pick" });

      if (vetoState.picks.length >= bestOf) {
        vetoState.stage = "done";
      } else {
        vetoState.turn = vetoState.turn === "low" ? "high" : "low";
      }
    }

    autoPickLastMapIfNeeded();

    // Persist MUST complete before allowing another click
    await persistLiveVetoStateQueued();

    // Re-render after persist
    renderVetoPoolGrid();
    renderVetoStatus();
  } finally {
    // Only unlock if modal is still “ready” (don’t unlock mid-load)
    if (vetoUiReady) setVetoUiBusy(false);
  }
}

function autoPickLastMapIfNeeded() {
  if (!vetoState || vetoState.stage !== "pick") return;
  const bestOf = Math.max(1, Number(vetoState.bestOf) || 1);
  const picksNeeded = bestOf - vetoState.picks.length;
  if (vetoState.remaining.length !== 1 || picksNeeded !== 1) return;
  const [picked] = vetoState.remaining.splice(0, 1);
  if (!picked) return;
  const picker =
    vetoState.turn === "low"
      ? vetoState.lowerName || "Player A"
      : vetoState.higherName || "Player B";
  vetoState.picks.push({ map: picked.name, picker, action: "pick" });
  vetoState.stage = "done";
}

export function hideVetoModal({ reopenMatchInfo = true } = {}) {
  clearRemoteBusyTimer(); // stop remote busy auto-unlock timer

  const modal = document.getElementById("vetoModal");
  const poolEl = document.getElementById("vetoMapPool");

  // Capture matchId BEFORE we clear state/datasets
  const matchId = currentVetoMatchId || modal?.dataset?.matchId || "";

  // If we have local state, persist (non-blocking)
  if (currentVetoMatchId && vetoState) {
    persistLiveVetoStateQueued();
  }

  // Close veto modal
  if (modal) modal.style.display = "none";
  if (modal) delete modal.dataset.matchId;
  if (modal) delete modal.dataset.forceOpen;
  if (poolEl) poolEl.onclick = null;

  setCurrentVetoMatchIdState(null);
  setVetoStateState(null);

  // NEW: return to match info modal instead of dropping to bracket
  // (only if requested and we have deps/matchId)
  if (reopenMatchInfo && matchId && vetoDeps) {
    openMatchInfoModal(matchId, vetoDeps);
  }
}

function showResetVetoModal() {
  const modal = document.getElementById("confirmResetVetoModal");
  if (!modal) return;
  if (!modal.dataset.bound) {
    modal.dataset.bound = "true";
    const confirmBtn = document.getElementById("confirmResetVetoBtn");
    const cancelBtn = document.getElementById("cancelResetVetoBtn");
    if (confirmBtn) confirmBtn.onclick = () => resetVetoSelection();
    if (cancelBtn) cancelBtn.onclick = () => hideResetVetoModal();
    modal.onclick = (e) => {
      if (e.target === modal) hideResetVetoModal();
    };
  }
  modal.style.display = "flex";
}

function hideResetVetoModal() {
  const modal = document.getElementById("confirmResetVetoModal");
  if (modal) modal.style.display = "none";
}

function resetVetoSelection() {
  if (!currentVetoMatchId || !vetoState) {
    hideResetVetoModal();
    return;
  }
  const bestOf = Math.max(1, Number(vetoState.bestOf) || 1);
  const pool = vetoState.pool || vetoState.remaining || [];
  vetoState.picks = [];
  vetoState.vetoed = [];
  vetoState.remaining = [...pool];
  vetoState.stage = pool.length <= bestOf ? "pick" : "veto";
  vetoState.turn = "low";

  state.matchVetoes = state.matchVetoes || {};
  const existing = state.matchVetoes[currentVetoMatchId] || {};
  state.matchVetoes[currentVetoMatchId] = {
    ...existing,
    maps: [],
    vetoed: [],
    mapResults: [],
    bestOf,
    updatedAt: Date.now(),
  };
  vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
  renderVetoPoolGrid();
  renderVetoStatus();
  hideResetVetoModal();
}

async function persistLiveVetoState() {
  const modal = document.getElementById("vetoModal");
  const fallbackMatchId = modal?.dataset?.matchId || "";
  const matchId = currentVetoMatchId || fallbackMatchId || "";
  if (!matchId || !vetoState) return;

  state.matchVetoes = state.matchVetoes || {};
  const existing = state.matchVetoes[matchId] || {};

  // Single authoritative timestamp for this persist
  const nextUpdatedAt = Date.now();

  const uid = auth?.currentUser?.uid || null;

  // Short-lived “busy” window so the other client disables UI during sync.
  // Keep it short; this is UX-only.
  const busyUntil = nextUpdatedAt + 1200;

  state.matchVetoes[matchId] = {
    ...existing,
    maps: vetoState.picks || [],
    vetoed: vetoState.vetoed || [],
    bestOf: vetoState.bestOf,
    updatedAt: nextUpdatedAt,
    participants: {
      lower: vetoState.lowerName,
      higher: vetoState.higherName,
    },
    mapResults: existing.mapResults || [],
    busy: {
      uid: uid || "",
      until: busyUntil,
    },
  };

  vetoState.updatedAt = nextUpdatedAt;

  // IMPORTANT: also advance local lastUpdated so other logic sees the change
  state.lastUpdated = nextUpdatedAt;

  console.debug("[veto] persistLiveVetoState", {
    matchId,
    picks: vetoState.picks?.length || 0,
    vetoed: vetoState.vetoed?.length || 0,
    stage: vetoState.stage,
    updatedAt: nextUpdatedAt,
  });

  // Keep local state in sync, but do not broadcast again from here
  vetoDeps?.saveState?.(
    { matchVetoes: state.matchVetoes, lastUpdated: state.lastUpdated },
    { skipRemote: true, keepTimestamp: true }
  );

  const stateRef = tournamentStateDocRef();
  if (!stateRef) return;

  const record = state.matchVetoes[matchId] || {};

  try {
    await updateDoc(stateRef, {
      [`matchVetoes.${matchId}`]: record,
      lastUpdated: nextUpdatedAt,
    });
  } catch (err) {
    console.warn("Failed to sync live veto state", err);
    try {
      await setDoc(
        stateRef,
        {
          matchVetoes: {
            [matchId]: record,
          },
          lastUpdated: nextUpdatedAt,
        },
        { merge: true }
      );
    } catch (fallbackErr) {
      console.warn("Failed to sync live veto state (fallback)", fallbackErr);
    }
  }
}

export function saveVetoSelection() {
  if (!currentVetoMatchId || !vetoState) return;
  if (vetoState.stage !== "done" && vetoState.picks.length < vetoState.bestOf) {
    showToast?.("Finish picks before saving.", "warning");
    return;
  }
  const matchId = currentVetoMatchId;
  const existingMapResults = state.matchVetoes?.[matchId]?.mapResults || [];
  const trimmed = vetoState.picks.slice(0, vetoState.bestOf);
  state.matchVetoes = state.matchVetoes || {};
  const nextUpdatedAt = Date.now();
  state.matchVetoes[currentVetoMatchId] = {
    maps: trimmed,
    vetoed: vetoState.vetoed || [],
    bestOf: vetoState.bestOf,
    updatedAt: nextUpdatedAt,
    participants: {
      lower: vetoState.lowerName,
      higher: vetoState.higherName,
    },
    mapResults: existingMapResults,
  };
  vetoState.updatedAt = nextUpdatedAt;
  console.debug("[veto] saveVetoSelection", {
    matchId,
    picks: trimmed.length,
    vetoed: (vetoState.vetoed || []).length,
    bestOf: vetoState.bestOf,
  });
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(currentVetoMatchId);
  if (match)
    match.bestOf = vetoState.bestOf || match.bestOf || defaultBestOf.upper;
  vetoDeps?.saveState?.({
    matchVetoes: state.matchVetoes,
    bracket: state.bracket,
  });
  renderVetoStatus();
  renderVetoPoolGrid();
  showToast?.("Map veto saved.", "success");
  hideVetoModal({ reopenMatchInfo: false });
  openMatchInfoModal(matchId, vetoDeps);
}

export function renderVetoPoolGrid(poolOverride = null) {
  const poolEl = document.getElementById("vetoMapPool");
  const pool = poolOverride || vetoState?.pool || vetoState?.remaining || [];
  if (!poolEl) return;
  const modal = document.getElementById("vetoModal");
  if (modal && vetoState?.updatedAt) {
    modal.dataset.vetoUpdatedAt = String(vetoState.updatedAt);
  }
  const remainingNames = vetoState?.remaining?.map((m) => m.name) || [];
  const html = pool
    .map((map) => {
      const pickEntry =
        vetoState?.picks?.find((m) => m.map === map.name) || null;
      const vetoEntry =
        vetoState?.vetoed?.find((m) => m.map === map.name) || null;
      const pickedIdx = pickEntry
        ? vetoState?.picks?.findIndex((m) => m.map === map.name) ?? -1
        : -1;
      const vetoIdx = vetoEntry
        ? vetoState?.vetoed?.findIndex((m) => m.map === map.name) ?? -1
        : -1;
      const imgPath = map.folder ? `img/maps/${map.folder}/${map.file}` : "";
      const stateClass =
        pickedIdx !== -1 ? "selected" : vetoIdx !== -1 ? "vetoed" : "";
      const helper =
        pickedIdx !== -1
          ? `Pick ${pickedIdx + 1} · ${escapeHtml(
              pickEntry?.picker || "Player"
            )}`
          : vetoIdx !== -1
          ? `Veto · ${escapeHtml(vetoEntry?.picker || "Player")}`
          : remainingNames.includes(map.name)
          ? ""
          : "Unavailable";
      return `<div class="tournament-map-card ${stateClass}" data-map-name="${escapeHtml(
        encodeURIComponent(map.name)
      )}">
        <div class="map-thumb"${
          imgPath ? ` style="background-image:url('${imgPath}')"` : ""
        }></div>
        <div class="map-meta">
          <div class="map-name">${escapeHtml(map.name)}</div>
        </div>
        <div class="helper">${helper}</div>
      </div>`;
    })
    .join("");
  poolEl.innerHTML = DOMPurify.sanitize(html);
  renderVetoStatus();
}

export function showVetoInfo(matchId) {
  const data = state.matchVetoes?.[matchId];
  if (!data || !data.maps?.length) {
    showToast?.("No veto data for this match yet.", "info");
    return;
  }
  const lines = data.maps.map(
    (m, idx) => `${idx + 1}. ${m.map} (${m.picker || "Player"})`
  );
  alert(
    `Picked maps (Bo${data.bestOf || data.maps.length}):\n${lines.join("\n")}`
  );
}

export function renderVetoStatus() {
  const status = document.getElementById("vetoBestOfLabel");
  const turnLabel = document.getElementById("vetoMatchLabel");
  const doneBtn = document.getElementById("saveVetoBtn");

  if (!vetoState) {
    if (status) status.textContent = "";
    if (turnLabel) turnLabel.textContent = "";
    if (doneBtn) doneBtn.style.display = "none";
    return;
  }

  const stage = vetoState.stage || "veto";
  const turn = vetoState.turn || "low";
  const bestOf = Math.max(1, Number(vetoState.bestOf) || 1);

  const remaining = Array.isArray(vetoState.remaining)
    ? vetoState.remaining
    : [];
  const pool = Array.isArray(vetoState.pool) ? vetoState.pool : remaining;

  const lowerName = vetoState.lowerName || "Lower seed";
  const higherName = vetoState.higherName || "Higher seed";
  const turnName = turn === "low" ? lowerName : higherName;

  const vetoedCount = Array.isArray(vetoState.vetoed)
    ? vetoState.vetoed.length
    : 0;
  const pickedCount = Array.isArray(vetoState.picks)
    ? vetoState.picks.length
    : 0;

  // total veto actions needed before pick begins: remaining <= bestOf
  const vetoTotal = Math.max(0, (pool?.length || 0) - bestOf);
  const pickTotal = Math.max(1, bestOf);
  const totalSteps = Math.max(1, vetoTotal + pickTotal);

  // Determine current step index in the combined timeline
  let currentIndex = 0;
  if (stage === "done") currentIndex = totalSteps;
  else if (stage === "veto")
    currentIndex = Math.min(vetoedCount, totalSteps - 1);
  else currentIndex = Math.min(vetoTotal + pickedCount, totalSteps - 1);

  if (doneBtn) doneBtn.style.display = stage === "done" ? "" : "none";

  // Right-side label: ONLY Best-of
  if (status) status.textContent = `Bo${bestOf}`;

  // Center label
  if (!turnLabel) return;

  if (stage === "done") {
    turnLabel.textContent = "Map veto complete.";
    return;
  }

  const isPick = stage === "pick";
  const phaseText = isPick ? "Pick" : "Veto";
  const phaseClass = isPick ? "is-pick" : "is-veto";

  // Build compact horizontal timeline segments
  // Completed: index < currentIndex
  // Current: index === currentIndex
  // Upcoming: index > currentIndex
  let segmentsHtml = "";

  for (let i = 0; i < totalSteps; i++) {
    const type = i < vetoTotal ? "veto" : "pick";
    const isDone = i < currentIndex;
    const isCurrent = i === currentIndex;

    segmentsHtml += `
      <span class="veto-step is-${type}${isDone ? " is-done" : ""}${
      isCurrent ? " is-current" : ""
    }"
            aria-hidden="true"></span>
    `;
  }

  const html = `
    <div class="veto-header">
      <div class="veto-turnline">
        <span class="veto-phase ${phaseClass}">${escapeHtml(
    phaseText
  )} turn:</span>
        <span class="veto-turnname">${escapeHtml(turnName)}</span>
      </div>

      <div class="veto-stepbar" role="group" aria-label="Veto and pick progress">
        ${segmentsHtml}
      </div>
    </div>
  `;

  turnLabel.innerHTML = DOMPurify.sanitize(html);
}

// Dependencies for veto module that need to be set from index.js
let vetoDeps = null;
export function attachMatchActionHandlers() {
  if (!vetoDeps) return;
  document.querySelectorAll(".veto-btn").forEach((btn) => {
    btn.onclick = () => openVetoModal(btn.dataset.matchId, vetoDeps);
  });
  document.querySelectorAll(".info-btn").forEach((btn) => {
    btn.onclick = () => openMatchInfoModal(btn.dataset.matchId, vetoDeps);
  });
}

let vetoRemoteStateUnsub = null;
let vetoRemoteStateSlug = null;

function ensureTournamentStateSubscription() {
  if (!currentSlug) return;

  // Avoid duplicate subscriptions if deps is called multiple times
  if (vetoRemoteStateUnsub && vetoRemoteStateSlug === currentSlug) return;

  // Reset if slug changed
  try {
    vetoRemoteStateUnsub?.();
  } catch (_) {
    // ignore
  }
  vetoRemoteStateUnsub = null;
  vetoRemoteStateSlug = currentSlug;

  const ref = tournamentStateDocRef();
  if (!ref) return;

  vetoRemoteStateUnsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};

      // Merge remote matchVetoes into local state
      const incomingVetoes = data.matchVetoes || {};
      if (incomingVetoes && typeof incomingVetoes === "object") {
        state.matchVetoes = state.matchVetoes || {};
        let changed = false;

        for (const [matchId, incomingEntry] of Object.entries(incomingVetoes)) {
          const localEntry = state.matchVetoes[matchId] || null;
          const incomingUpdated = Number(incomingEntry?.updatedAt) || 0;
          const localUpdated = Number(localEntry?.updatedAt) || 0;

          // Only apply if remote is newer
          if (!localEntry || incomingUpdated > localUpdated) {
            state.matchVetoes[matchId] = incomingEntry;
            changed = true;
          }
        }

        if (changed) {
          // Keep a consistent lastUpdated if present
          const remoteLastUpdated = data.lastUpdated?.toMillis
            ? data.lastUpdated.toMillis()
            : data.lastUpdated;

          if (typeof remoteLastUpdated === "number") {
            state.lastUpdated = remoteLastUpdated;
          }

          // If modals are open, refresh immediately
          refreshMatchInfoModalIfOpen();
          refreshVetoModalIfOpen();
        }
      }
    },
    (err) => {
      console.warn("[veto] tournament state onSnapshot failed", err);
    }
  );
}

export function setVetoDependencies(deps) {
  vetoDeps = deps;
  attachMatchActionHandlers();

  // Fix 2: Keep veto UI in sync without requiring modal reopen
  ensureTournamentStateSubscription();
}

export function teardownVetoSubscriptions() {
  try {
    vetoRemoteStateUnsub?.();
  } catch (_) {
    // ignore
  }
  vetoRemoteStateUnsub = null;
  vetoRemoteStateSlug = null;
}

export function refreshVetoModalIfOpen() {
  if (!vetoDeps) return;
  const modal = document.getElementById("vetoModal");
  if (!modal) return;
  const matchId = modal.dataset.matchId;
  if (!matchId) return;
  const visible =
    modal.dataset.forceOpen === "true" ||
    (() => {
      const cs = window.getComputedStyle(modal);
      return cs.display !== "none" && cs.visibility !== "hidden";
    })();

  if (!visible) return;

  const savedUpdatedAt = Number(state.matchVetoes?.[matchId]?.updatedAt) || 0;
  const localUpdatedAt = Number(vetoState?.updatedAt) || 0;
  const appliedUpdatedAt = Number(modal.dataset.vetoUpdatedAt || "0");
  if (savedUpdatedAt <= Math.max(localUpdatedAt, appliedUpdatedAt)) {
    return;
  }
  const saved = state.matchVetoes?.[matchId];
  if (!saved) return;
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(matchId);
  const bestOfRaw = getBestOfForMatch(
    match || { bracket: "winners", round: 1 }
  );
  const bestOf = Math.max(1, Number(bestOfRaw) || 1);
  const pool = (
    currentTournamentMeta?.mapPool && currentTournamentMeta.mapPool.length
      ? currentTournamentMeta.mapPool
      : vetoDeps.getDefaultMapPoolNames()
  ).map(
    (name) =>
      vetoDeps.getMapByName(name) || { name, folder: "", file: "", mode: "1v1" }
  );
  const playersById = vetoDeps.getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  const ordered = [pA, pB]
    .filter(Boolean)
    .sort((a, b) => (b.seed || 999) - (a.seed || 999));
  const lower = ordered[0] || null;
  const higher = ordered[1] || ordered[0] || null;
  const usedNames = new Set([
    ...(saved.maps || []).map((m) => m.map),
    ...(saved.vetoed || []).map((m) => m.map),
  ]);
  const remaining = pool.filter((m) => !usedNames.has(m.name));
  const savedBestOf = Math.max(
    1,
    Number(saved.bestOf || saved.maps?.length || bestOf) || 1
  );
  const savedPicks = Array.isArray(saved.maps) ? saved.maps : [];
  const savedVetoed = Array.isArray(saved.vetoed) ? saved.vetoed : [];
  const stage =
    savedPicks.length >= savedBestOf
      ? "done"
      : remaining.length <= savedBestOf
      ? "pick"
      : "veto";
  const turn =
    stage === "done"
      ? "done"
      : stage === "veto"
      ? savedVetoed.length % 2 === 0
        ? "low"
        : "high"
      : savedPicks.length % 2 === 0
      ? "low"
      : "high";
  setVetoStateState({
    stage,
    turn,
    bestOf: savedBestOf,
    pool: [...pool],
    remaining,
    vetoed: savedVetoed,
    picks: savedPicks,
    updatedAt: savedUpdatedAt,
    lowerName: saved.participants?.lower || lower?.name || "Lower seed",
    higherName: saved.participants?.higher || higher?.name || "Higher seed",
  });
  modal.dataset.vetoUpdatedAt = String(savedUpdatedAt);
  modal.dataset.bestOf = String(savedBestOf);

  renderVetoPoolGrid(pool);
  renderVetoStatus();

  vetoUiReady = true;

  // Apply remote “busy” lock (so the other user sees the grey overlay too)
  applyRemoteBusyIfAny(matchId);
}
