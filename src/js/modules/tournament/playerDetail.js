import DOMPurify from "dompurify";
import {
  auth,
  db,
  getCurrentUserAvatarUrl,
  getCurrentUsername,
} from "../../../app.js";
import { doc, getDoc } from "firebase/firestore";
import {
  loadTournamentRegistry,
  loadTournamentStateRemote,
} from "./sync/persistence.js";
import { computePlacementsForBracket } from "./bracket/placements.js";
import { playerKey } from "./playerKey.js";
import {
  MAX_SECONDARY_PULSE_LINKS,
  DEFAULT_PLAYER_AVATAR,
  playerDetailModalInitialized,
  setPlayerDetailModalInitializedState,
} from "./state.js";
import { escapeHtml } from "./bracket/renderUtils.js";
import countries from "../../data/countries.json" assert { type: "json" };
import { updateTooltips } from "../tooltip.js";

const countryFlagCache = new Map();
const countryUidCache = new Map();
let activePlayerDetailId = "";
let activePlayerDetailUid = "";
let activePlayerDetailKey = "";
let getPlayersMapRef = null;
let activeAvatarRefreshToken = 0;
const COUNTRY_NAME_BY_CODE = new Map(
  (Array.isArray(countries) ? countries : []).map((entry) => [
    String(entry?.code || "").toUpperCase(),
    String(entry?.name || ""),
  ])
);
const ISO3_TO_ISO2 = {
  "ABW": "AW",
  "AFG": "AF",
  "AGO": "AO",
  "AIA": "AI",
  "ALA": "AX",
  "ALB": "AL",
  "AND": "AD",
  "ARE": "AE",
  "ARG": "AR",
  "ARM": "AM",
  "ASM": "AS",
  "ATA": "AQ",
  "ATF": "TF",
  "ATG": "AG",
  "AUS": "AU",
  "AUT": "AT",
  "AZE": "AZ",
  "BDI": "BI",
  "BEL": "BE",
  "BEN": "BJ",
  "BES": "BQ",
  "BFA": "BF",
  "BGD": "BD",
  "BGR": "BG",
  "BHR": "BH",
  "BHS": "BS",
  "BIH": "BA",
  "BLM": "BL",
  "BLR": "BY",
  "BLZ": "BZ",
  "BMU": "BM",
  "BOL": "BO",
  "BRA": "BR",
  "BRB": "BB",
  "BRN": "BN",
  "BTN": "BT",
  "BVT": "BV",
  "BWA": "BW",
  "CAF": "CF",
  "CAN": "CA",
  "CCK": "CC",
  "CHE": "CH",
  "CHL": "CL",
  "CHN": "CN",
  "CIV": "CI",
  "CMR": "CM",
  "COD": "CD",
  "COG": "CG",
  "COK": "CK",
  "COL": "CO",
  "COM": "KM",
  "CPV": "CV",
  "CRI": "CR",
  "CUB": "CU",
  "CUW": "CW",
  "CXR": "CX",
  "CYM": "KY",
  "CYP": "CY",
  "CZE": "CZ",
  "DEU": "DE",
  "DJI": "DJ",
  "DMA": "DM",
  "DNK": "DK",
  "DOM": "DO",
  "DZA": "DZ",
  "ECU": "EC",
  "EGY": "EG",
  "ERI": "ER",
  "ESH": "EH",
  "ESP": "ES",
  "EST": "EE",
  "ETH": "ET",
  "FIN": "FI",
  "FJI": "FJ",
  "FLK": "FK",
  "FRA": "FR",
  "FRO": "FO",
  "FSM": "FM",
  "GAB": "GA",
  "GBR": "GB",
  "GEO": "GE",
  "GGY": "GG",
  "GHA": "GH",
  "GIB": "GI",
  "GIN": "GN",
  "GLP": "GP",
  "GMB": "GM",
  "GNB": "GW",
  "GNQ": "GQ",
  "GRC": "GR",
  "GRD": "GD",
  "GRL": "GL",
  "GTM": "GT",
  "GUF": "GF",
  "GUM": "GU",
  "GUY": "GY",
  "HKG": "HK",
  "HMD": "HM",
  "HND": "HN",
  "HRV": "HR",
  "HTI": "HT",
  "HUN": "HU",
  "IDN": "ID",
  "IMN": "IM",
  "IND": "IN",
  "IOT": "IO",
  "IRL": "IE",
  "IRN": "IR",
  "IRQ": "IQ",
  "ISL": "IS",
  "ISR": "IL",
  "ITA": "IT",
  "JAM": "JM",
  "JEY": "JE",
  "JOR": "JO",
  "JPN": "JP",
  "KAZ": "KZ",
  "KEN": "KE",
  "KGZ": "KG",
  "KHM": "KH",
  "KIR": "KI",
  "KNA": "KN",
  "KOR": "KR",
  "KWT": "KW",
  "LAO": "LA",
  "LBN": "LB",
  "LBR": "LR",
  "LBY": "LY",
  "LCA": "LC",
  "LIE": "LI",
  "LKA": "LK",
  "LSO": "LS",
  "LTU": "LT",
  "LUX": "LU",
  "LVA": "LV",
  "MAC": "MO",
  "MAF": "MF",
  "MAR": "MA",
  "MCO": "MC",
  "MDA": "MD",
  "MDG": "MG",
  "MDV": "MV",
  "MEX": "MX",
  "MHL": "MH",
  "MKD": "MK",
  "MLI": "ML",
  "MLT": "MT",
  "MMR": "MM",
  "MNE": "ME",
  "MNG": "MN",
  "MNP": "MP",
  "MOZ": "MZ",
  "MRT": "MR",
  "MSR": "MS",
  "MTQ": "MQ",
  "MUS": "MU",
  "MWI": "MW",
  "MYS": "MY",
  "MYT": "YT",
  "NAM": "NA",
  "NCL": "NC",
  "NER": "NE",
  "NFK": "NF",
  "NGA": "NG",
  "NIC": "NI",
  "NIU": "NU",
  "NLD": "NL",
  "NOR": "NO",
  "NPL": "NP",
  "NRU": "NR",
  "NZL": "NZ",
  "OMN": "OM",
  "PAK": "PK",
  "PAN": "PA",
  "PCN": "PN",
  "PER": "PE",
  "PHL": "PH",
  "PLW": "PW",
  "PNG": "PG",
  "POL": "PL",
  "PRI": "PR",
  "PRK": "KP",
  "PRT": "PT",
  "PRY": "PY",
  "PSE": "PS",
  "PYF": "PF",
  "QAT": "QA",
  "REU": "RE",
  "ROU": "RO",
  "RUS": "RU",
  "RWA": "RW",
  "SAU": "SA",
  "SDN": "SD",
  "SEN": "SN",
  "SGP": "SG",
  "SGS": "GS",
  "SHN": "SH",
  "SJM": "SJ",
  "SLB": "SB",
  "SLE": "SL",
  "SLV": "SV",
  "SMR": "SM",
  "SOM": "SO",
  "SPM": "PM",
  "SRB": "RS",
  "SSD": "SS",
  "STP": "ST",
  "SUR": "SR",
  "SVK": "SK",
  "SVN": "SI",
  "SWE": "SE",
  "SWZ": "SZ",
  "SXM": "SX",
  "SYC": "SC",
  "SYR": "SY",
  "TCA": "TC",
  "TCD": "TD",
  "TGO": "TG",
  "THA": "TH",
  "TJK": "TJ",
  "TKL": "TK",
  "TKM": "TM",
  "TLS": "TL",
  "TON": "TO",
  "TTO": "TT",
  "TUN": "TN",
  "TUR": "TR",
  "TUV": "TV",
  "TWN": "TW",
  "TZA": "TZ",
  "UGA": "UG",
  "UKR": "UA",
  "UMI": "UM",
  "URY": "UY",
  "USA": "US",
  "UZB": "UZ",
  "VAT": "VA",
  "VCT": "VC",
  "VEN": "VE",
  "VGB": "VG",
  "VIR": "VI",
  "VNM": "VN",
  "VUT": "VU",
  "WLF": "WF",
  "WSM": "WS",
  "YEM": "YE",
  "ZAF": "ZA",
  "ZMB": "ZM",
  "ZWE": "ZW",
};

const DEFAULT_PROFILE_AVATAR = "img/default-avatar.webp";

const ACHIEVEMENT_SORT_RECENT = "recent";
const ACHIEVEMENT_SORT_BEST = "best";
const ACHIEVEMENT_BATCH_SIZE = 10;
const achievementCache = new Map();
const achievementPromiseCache = new Map();
let achievementSortMode = ACHIEVEMENT_SORT_RECENT;
let activeAchievementEntries = [];
let activeAchievementSorted = [];
let achievementRenderCount = 0;
let activeAchievementRequestId = 0;

function normalizeCountryName(name) {
  return String(name || "").toUpperCase().replace(/[^A-Z]/g, "");
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
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints.join("-")}.svg`;
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
  const normalized = String(code || "").trim().toUpperCase();
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
    )}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${name}</a></div>`;
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
    const key = race.toLowerCase();
    const value = Number.isFinite(mmrByRace?.[key]) ? Math.round(mmrByRace[key]) : null;
    const display = value !== null ? `${value}` : "No MMR";
    return `<li><span class="pill">${race}</span><strong>${display}</strong></li>`;
  });
  list.innerHTML = DOMPurify.sanitize(rows.join(""));
}

function isPlaceholderAvatar(url = "") {
  const normalized = String(url || "").trim();
  if (!normalized) return true;
  const cleaned = normalized.split("?")[0].split("#")[0];
  const lower = cleaned.toLowerCase();
  const filename = lower.slice(lower.lastIndexOf("/") + 1);
  return (
    lower === DEFAULT_PLAYER_AVATAR.toLowerCase() ||
    lower === DEFAULT_PROFILE_AVATAR.toLowerCase() ||
    filename === "marine_avatar_1.webp" ||
    filename === "default-avatar.webp"
  );
}

function isCurrentUserPlayer(player) {
  const currentUid = auth?.currentUser?.uid || "";
  if (currentUid && player?.uid && player.uid === currentUid) return true;
  const currentName = (getCurrentUsername?.() || auth?.currentUser?.displayName || "")
    .trim()
    .toLowerCase();
  if (!currentName) return false;
  const candidates = getUsernameCandidates(player?.name || player?.pulseName || "");
  return candidates.some((name) => name.toLowerCase() === currentName);
}

function normalizeBracketForPlacements(bracket) {
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

function getAchievementIdentity(player) {
  const uid = String(player?.uid || "").trim();
  const name = player?.name || player?.pulseName || "";
  const sc2Link = player?.sc2Link || "";
  const key = name || sc2Link ? playerKey(name, sc2Link) : "";
  return { uid, key };
}

function getAchievementCacheKey(identity) {
  if (identity.uid) return `uid:${identity.uid}`;
  if (identity.key) return `key:${identity.key}`;
  return "";
}

function findMatchingPlayerId(players, identity) {
  if (!Array.isArray(players)) return "";
  if (identity.uid) {
    const match = players.find(
      (entry) => String(entry?.uid || "").trim() === identity.uid
    );
    if (match?.id) return match.id;
  }
  if (identity.key) {
    const match = players.find((entry) => {
      const key = playerKey(entry?.name || "", entry?.sc2Link || "");
      return key && key === identity.key;
    });
    if (match?.id) return match.id;
  }
  return "";
}

function formatPlacementLabel(place) {
  const value = Number(place);
  if (!Number.isFinite(value) || value <= 0) return "TBD";
  const mod100 = value % 100;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    const mod10 = value % 10;
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${value}${suffix}`;
}

function formatTournamentDate(startTime) {
  if (!Number.isFinite(startTime) || startTime <= 0) return "";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function sortAchievementEntries(entries, mode) {
  const sorted = [...entries];
  if (mode === ACHIEVEMENT_SORT_BEST) {
    sorted.sort((a, b) => {
      const aPlace = Number.isFinite(a.placement) ? a.placement : Infinity;
      const bPlace = Number.isFinite(b.placement) ? b.placement : Infinity;
      if (aPlace !== bPlace) return aPlace - bPlace;
      const aTime = Number.isFinite(a.startTime) ? a.startTime : 0;
      const bTime = Number.isFinite(b.startTime) ? b.startTime : 0;
      return bTime - aTime;
    });
  } else {
    sorted.sort((a, b) => {
      const aTime = Number.isFinite(a.startTime) ? a.startTime : 0;
      const bTime = Number.isFinite(b.startTime) ? b.startTime : 0;
      if (aTime !== bTime) return bTime - aTime;
      const aPlace = Number.isFinite(a.placement) ? a.placement : Infinity;
      const bPlace = Number.isFinite(b.placement) ? b.placement : Infinity;
      return aPlace - bPlace;
    });
  }
  return sorted;
}

function getAchievementElements() {
  return {
    listEl: document.getElementById("playerDetailAchievements"),
    emptyEl: document.getElementById("playerDetailAchievementsEmpty"),
    sortBtn: document.getElementById("playerDetailAchievementSort"),
  };
}

function updateAchievementSortButton(sortBtn) {
  if (!sortBtn) return;
  const isBest = achievementSortMode === ACHIEVEMENT_SORT_BEST;
  sortBtn.textContent = isBest ? "Sort: Best" : "Sort: Recent";
  sortBtn.dataset.sort = achievementSortMode;
  sortBtn.setAttribute("aria-pressed", isBest ? "true" : "false");
}

function buildAchievementItem(entry) {
  const li = document.createElement("li");
  li.className = "achievement-item";

  const meta = document.createElement("div");
  meta.className = "achievement-meta";

  const title = document.createElement("span");
  title.className = "achievement-title";
  title.textContent = entry.name;

  const dateText = document.createElement("span");
  dateText.className = "achievement-date";
  if (entry.dateText) {
    dateText.textContent = entry.dateText;
  }

  meta.append(title);
  if (entry.dateText) meta.append(dateText);

  const placement = document.createElement("span");
  placement.className = "pill achievement-place";

  const trophy = document.createElement("img");
  trophy.className = "achievement-trophy";
  trophy.src = "img/SVG/trophy.svg";
  trophy.alt = "";
  trophy.setAttribute("aria-hidden", "true");

  placement.append(trophy, document.createTextNode(entry.placementLabel));

  li.append(meta, placement);
  return li;
}

function renderNextAchievementBatch() {
  const { listEl, emptyEl } = getAchievementElements();
  if (!listEl || !emptyEl) return;
  if (!activeAchievementSorted.length) {
    emptyEl.textContent = "No podium placements yet.";
    emptyEl.style.display = "block";
    return;
  }
  if (achievementRenderCount >= activeAchievementSorted.length) return;
  emptyEl.textContent = "";
  emptyEl.style.display = "none";
  const start = achievementRenderCount;
  const next = activeAchievementSorted.slice(
    start,
    start + ACHIEVEMENT_BATCH_SIZE
  );
  if (!next.length) return;
  const fragment = document.createDocumentFragment();
  next.forEach((entry) => {
    fragment.append(buildAchievementItem(entry));
  });
  listEl.appendChild(fragment);
  achievementRenderCount += next.length;
  if (
    listEl.clientHeight > 0 &&
    listEl.scrollHeight <= listEl.clientHeight &&
    achievementRenderCount < activeAchievementSorted.length
  ) {
    renderNextAchievementBatch();
  }
}

function resetAchievementList() {
  const { listEl, emptyEl } = getAchievementElements();
  if (!listEl || !emptyEl) return;
  listEl.replaceChildren();
  listEl.scrollTop = 0;
  activeAchievementSorted = sortAchievementEntries(
    activeAchievementEntries,
    achievementSortMode
  );
  achievementRenderCount = 0;
  renderNextAchievementBatch();
}

async function loadPlayerAchievements(player) {
  const identity = getAchievementIdentity(player);
  const cacheKey = getAchievementCacheKey(identity);
  if (!cacheKey) return [];
  if (achievementCache.has(cacheKey)) {
    return achievementCache.get(cacheKey);
  }
  if (achievementPromiseCache.has(cacheKey)) {
    return achievementPromiseCache.get(cacheKey);
  }
  const promise = (async () => {
    const registry = await loadTournamentRegistry();
    if (!Array.isArray(registry) || !registry.length) return [];
    const entries = await Promise.all(
      registry.map(async (meta) => {
        const slug = meta?.slug || meta?.id || "";
        if (!slug) return null;
        const snapshot = await loadTournamentStateRemote(slug);
        if (!snapshot) return null;
        const players = Array.isArray(snapshot.players) ? snapshot.players : [];
        const playerId = findMatchingPlayerId(players, identity);
        if (!playerId) return null;
        const bracket = normalizeBracketForPlacements(snapshot.bracket);
        const placements = computePlacementsForBracket(bracket, players.length || 0);
        if (!placements) return null;
        const placement = placements.get(playerId);
        if (!Number.isFinite(placement)) return null;
        const rawStartTime = Number(meta?.startTime || snapshot?.lastUpdated || 0);
        const startTime =
          Number.isFinite(rawStartTime) && rawStartTime > 0 ? rawStartTime : 0;
        return {
          slug,
          name: meta?.name || slug,
          placement,
          placementLabel: formatPlacementLabel(placement),
          startTime,
          dateText: formatTournamentDate(startTime),
        };
      })
    );
    const filtered = entries
      .filter(Boolean)
      .filter((entry) => Number(entry?.placement) <= 3);
    achievementCache.set(cacheKey, filtered);
    return filtered;
  })();
  achievementPromiseCache.set(cacheKey, promise);
  const results = await promise;
  achievementPromiseCache.delete(cacheKey);
  return results;
}

async function updateAchievementsForPlayer(player) {
  const { listEl, emptyEl, sortBtn } = getAchievementElements();
  if (!listEl || !emptyEl) return;
  const requestId = ++activeAchievementRequestId;
  activeAchievementEntries = [];
  activeAchievementSorted = [];
  achievementRenderCount = 0;
  listEl.replaceChildren();
  emptyEl.textContent = "Loading placements...";
  emptyEl.style.display = "block";
  if (sortBtn) {
    sortBtn.disabled = true;
    updateAchievementSortButton(sortBtn);
  }
  const entries = await loadPlayerAchievements(player);
  if (requestId !== activeAchievementRequestId) return;
  activeAchievementEntries = entries;
  resetAchievementList();
  if (sortBtn) {
    sortBtn.disabled = entries.length < 2;
    updateAchievementSortButton(sortBtn);
  }
}

function resolvePlayerAvatar(player, { isCurrentUser = false } = {}) {
  const candidate = player?.avatarUrl || "";
  if (candidate && !isPlaceholderAvatar(candidate)) return candidate;
  if (isCurrentUser) {
    const userPhoto = document.getElementById("userPhoto")?.src;
    if (userPhoto) return userPhoto;
  }
  return DEFAULT_PLAYER_AVATAR;
}

export function setupPlayerDetailModal() {
  if (playerDetailModalInitialized) return;
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const closeBtn = document.getElementById("closePlayerDetailModal");
  const { sortBtn, listEl } = getAchievementElements();

  const hide = () => {
    modal.style.display = "none";
    activePlayerDetailId = "";
    activePlayerDetailUid = "";
    activePlayerDetailKey = "";
  };
  const show = () => {
    modal.style.display = "block";
  };

  closeBtn?.addEventListener("click", hide);
  if (sortBtn && sortBtn.dataset.bound !== "true") {
    sortBtn.dataset.bound = "true";
    sortBtn.addEventListener("click", () => {
      achievementSortMode =
        achievementSortMode === ACHIEVEMENT_SORT_RECENT
          ? ACHIEVEMENT_SORT_BEST
          : ACHIEVEMENT_SORT_RECENT;
      updateAchievementSortButton(sortBtn);
      resetAchievementList();
    });
    updateAchievementSortButton(sortBtn);
  }
  if (listEl && listEl.dataset.bound !== "true") {
    listEl.dataset.bound = "true";
    listEl.addEventListener("scroll", () => {
      const threshold = 40;
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - threshold) {
        renderNextAchievementBatch();
      }
    });
  }
  window.addEventListener("mousedown", (e) => {
    if (e.target === modal) hide();
  });

  modal.dataset.ready = "true";
  modal.showModal = show;
  setPlayerDetailModalInitializedState(true);
}

export function attachPlayerDetailHandlers({ getPlayersMap }) {
  if (typeof getPlayersMap === "function") {
    getPlayersMapRef = getPlayersMap;
  }
  setupPlayerDetailModal();
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const registeredPlayersList = document.getElementById("registeredPlayersList");

  const handler = (e) => {
    const inRoundRobinGroupStage = Boolean(e.target.closest(".group-stage"));
    if (e.target.closest(".forfeit-player")) return;
    if (inRoundRobinGroupStage) {
      const nameTarget = e.target.closest(".name-text");
      if (!nameTarget) return;
      const trigger =
        nameTarget.closest("[data-player-id]") ||
        nameTarget.closest(".row[data-player-id]");
      const pid = trigger?.dataset?.playerId;
      if (!pid) return;
      const player = getPlayersMap().get(pid);
      if (player) openPlayerDetailModal(player);
      return;
    }

    const isPlayersTable = Boolean(playersTable && playersTable.contains(e.target));
    if (isPlayersTable) {
      const nameTarget = e.target.closest(".player-name");
      if (!nameTarget) return;
    } else if (
      e.target.closest("select") ||
      e.target.closest(".remove-player") ||
      e.target.closest(".points-input") ||
      e.target.closest(".checkin-editor") ||
      e.target.closest(".checkin-select")
    ) {
      return;
    }
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
  registeredPlayersList?.addEventListener("click", handler);
}

export async function openPlayerDetailModal(player) {
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const avatar = document.getElementById("playerDetailAvatar");
  const nameEl = document.getElementById("playerDetailName");
  const nameTextEl = document.getElementById("playerDetailNameText");
  const flagEl = document.getElementById("playerDetailCountryFlag");
  const clanEl = document.getElementById("playerDetailClan");
  const raceEl = document.getElementById("playerDetailRace");
  const pointsEl = document.getElementById("playerDetailPoints");
  const mainPulseEl = document.getElementById("playerDetailMainPulse");
  const secondaryEl = document.getElementById("playerDetailSecondary");
  const twitchEl = document.getElementById("playerDetailTwitch");

  activePlayerDetailId = String(player?.id || "");
  activePlayerDetailUid = String(player?.uid || "");
  activePlayerDetailKey = playerKey(
    player?.name || player?.pulseName || "",
    player?.sc2Link || ""
  );

  const isCurrentUser = isCurrentUserPlayer(player);
  const currentAvatar = getCurrentUserAvatarUrl?.() || "";
  const useCurrentAvatar =
    isCurrentUser && currentAvatar && !isPlaceholderAvatar(currentAvatar);
  const avatarUrl = resolvePlayerAvatar(player, { isCurrentUser });
  if (avatar) {
    if (useCurrentAvatar) {
      avatar.src = currentAvatar;
      player.avatarUrl = currentAvatar;
    } else {
      avatar.src = avatarUrl;
    }
  }
  let shouldHydrateProfile = false;
  if (nameEl) {
    const abbr = player?.clanAbbreviation;
    const displayName = player?.pulseName || player?.name;
    const safeName = displayName || "Player";
    const composedName = abbr ? `[${abbr}] ${safeName}` : safeName;
    if (nameTextEl) {
      nameTextEl.textContent = composedName;
    } else {
      nameEl.textContent = composedName;
    }
    if (flagEl) {
      const flag = countryCodeToFlag(player?.country || "");
      setFlagIcon(flagEl, flag);
      flagEl.style.display = flag ? "inline-flex" : "none";
      setFlagTitle(flagEl, player?.country || "");
      updateTooltips();
      const needsAvatarHydration = isPlaceholderAvatar(player?.avatarUrl);
      shouldHydrateProfile = !flag || needsAvatarHydration;
    }
  }
  if (shouldHydrateProfile && flagEl) {
    await hydratePlayerProfile(player, flagEl, avatar);
    const refreshedAvatar = resolvePlayerAvatar(player, { isCurrentUser });
    if (avatar && refreshedAvatar && avatar.src !== refreshedAvatar) {
      avatar.src = refreshedAvatar;
    }
  }
  if (avatar && isPlaceholderAvatar(avatar.src)) {
    scheduleAvatarRefresh(avatar, isCurrentUser);
  }
  if (clanEl) {
    const clan = player?.clan || "";
    clanEl.textContent = clan || "No clan";
    clanEl.style.display = clan ? "inline-flex" : "none";
  }
  if (raceEl) raceEl.textContent = player?.race || "";
  if (pointsEl)
    pointsEl.textContent = `${player?.points || 0} pts  ${player?.mmr || 0} MMR`;

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

  void updateAchievementsForPlayer(player);

  formatMmrByRace(player);
  modal.dataset.ready = "true";
  modal.showModal?.();
}

function findPlayerInMap(playersMap, identity) {
  if (!playersMap || !identity) return null;
  if (identity.id && playersMap.has(identity.id)) {
    return playersMap.get(identity.id);
  }
  if (identity.uid) {
    for (const entry of playersMap.values()) {
      if (String(entry?.uid || "") === identity.uid) {
        return entry;
      }
    }
  }
  if (identity.key) {
    for (const entry of playersMap.values()) {
      const key = playerKey(entry?.name || "", entry?.sc2Link || "");
      if (key && key === identity.key) {
        return entry;
      }
    }
  }
  return null;
}

function scheduleAvatarRefresh(avatarEl, isCurrentUser) {
  if (!getPlayersMapRef || !avatarEl) return;
  const token = ++activeAvatarRefreshToken;
  const startedAt = Date.now();
  const maxMs = 1500;
  const tick = () => {
    if (token !== activeAvatarRefreshToken) return;
    const playersMap = getPlayersMapRef?.();
    const player = findPlayerInMap(playersMap, {
      id: activePlayerDetailId,
      uid: activePlayerDetailUid,
      key: activePlayerDetailKey,
    });
    const nextAvatar = resolvePlayerAvatar(player || {}, { isCurrentUser });
    if (nextAvatar && !isPlaceholderAvatar(nextAvatar) && avatarEl.src !== nextAvatar) {
      avatarEl.src = nextAvatar;
      return;
    }
    if (Date.now() - startedAt < maxMs) {
      setTimeout(tick, 150);
    }
  };
  setTimeout(tick, 150);
}

export function refreshPlayerDetailModalIfOpen(getPlayersMap) {
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const isDialogOpen =
    modal.open === true ||
    modal.getAttribute("open") !== null ||
    modal.style.display === "block";
  if (!isDialogOpen) return;
  if (!activePlayerDetailId && !activePlayerDetailUid && !activePlayerDetailKey) {
    return;
  }
  const playersMap =
    typeof getPlayersMap === "function" ? getPlayersMap() : new Map();
  const player = findPlayerInMap(playersMap, {
    id: activePlayerDetailId,
    uid: activePlayerDetailUid,
    key: activePlayerDetailKey,
  });
  if (player) {
    openPlayerDetailModal(player);
  }
}

async function hydratePlayerProfile(player, flagEl, avatarEl) {
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
    if (avatarEl && player?.avatarUrl && !isPlaceholderAvatar(player.avatarUrl)) {
      avatarEl.src = player.avatarUrl;
      updateTooltips();
      return;
    }
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
    const profileAvatar = snap.exists()
      ? snap.data()?.profile?.avatarUrl || snap.data()?.avatarUrl || ""
      : "";
    if (flag) {
      setFlagIcon(flagEl, flag);
      flagEl.style.display = "inline-flex";
      player.country = code.toUpperCase();
      setFlagTitle(flagEl, player.country);
    } else {
      setFlagTitle(flagEl, "");
    }
    if (profileAvatar && isPlaceholderAvatar(player?.avatarUrl)) {
      player.avatarUrl = profileAvatar;
      if (avatarEl) avatarEl.src = profileAvatar;
    }
    updateTooltips();
  } catch (_) {
    countryFlagCache.set(uid, "");
  }
}

function countryCodeToFlag(raw) {
  const code = String(raw || "").trim().toUpperCase();
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
