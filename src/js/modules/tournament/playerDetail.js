import DOMPurify from "dompurify";
import { db } from "../../../app.js";
import { doc, getDoc } from "firebase/firestore";
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

function resolvePlayerAvatar(player) {
  const userPhoto = document.getElementById("userPhoto")?.src;
  return player?.avatarUrl || userPhoto || DEFAULT_PLAYER_AVATAR;
}

export function setupPlayerDetailModal() {
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

export function attachPlayerDetailHandlers({ getPlayersMap }) {
  setupPlayerDetailModal();
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const registeredPlayersList = document.getElementById("registeredPlayersList");

  const handler = (e) => {
    const inRoundRobinGroupStage = Boolean(e.target.closest(".group-stage"));
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

    if (
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

export function openPlayerDetailModal(player) {
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
  const achievementsEl = document.getElementById("playerDetailAchievements");

  const avatarUrl = resolvePlayerAvatar(player);
  if (avatar) avatar.src = avatarUrl;
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
      if (!flag || !player?.avatarUrl) {
        void hydratePlayerProfile(player, flagEl, avatar);
      }
    }
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

  if (achievementsEl) {
    achievementsEl.textContent = "Coming soon: tournament wins and milestones.";
  }

  formatMmrByRace(player);
  modal.dataset.ready = "true";
  modal.showModal?.();
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
    if (avatarEl && player?.avatarUrl) {
      avatarEl.src = player.avatarUrl;
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
    if (profileAvatar && !player?.avatarUrl) {
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
