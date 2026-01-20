// functions/index.js
const { onDocumentWritten, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // node-fetch@2
const cheerio = require("cheerio");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const path = require("path");
const fs = require("fs/promises");

if (!admin.apps.length) admin.initializeApp();
const bucket = admin.storage().bucket();
const firestore = admin.firestore();

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const SITE_URL =
  process.env.SITE_URL || "https://zbuildorder.com/viewBuild.html";
const TOURNAMENT_BASE_URL =
  process.env.TOURNAMENT_BASE_URL || "https://zbuildorder.com";

const BOT_USER_AGENTS = [
  /googlebot/i,
  /bingbot/i,
  /yahoo/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
];

const PRERENDER_TIMEOUT_MS = 60_000;
const MAX_PRERENDER_ATTEMPTS = 3;
const REQUIRED_STATIC_SELECTORS = [
  "#buildTitle",
  "#buildPublisher",
  "#buildOrder",
];

const SPA_INDEX_PATH = path.resolve(__dirname, "../dist/viewBuild.html");
let cachedSpaIndex = null;
let cachedStaticTemplate = null;

const SPA_REMOTE_URL = sanitizeUrl(
  process.env.SPA_FALLBACK_URL || SITE_URL,
  "https://zbuildorder.com/viewBuild.html"
);

const PULSE_ALLOWED_HOSTS = new Set(["sc2pulse.nephest.com"]);
const PULSE_API_BASE = "https://sc2pulse.nephest.com/sc2/api";

const CHROMIUM_ARGS = [
  ...chromium.args,
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
];

function isBot(userAgent = "") {
  return BOT_USER_AGENTS.some((regex) => regex.test(userAgent));
}

function sanitizeText(value, fallback) {
  const base = value == null ? "" : String(value);
  const sanitized = DOMPurify.sanitize(base, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
  return sanitized || fallback;
}

function sanitizeUrl(value, fallback) {
  const sanitized = sanitizeText(value, "");
  if (sanitized) {
    return sanitized;
  }
  return sanitizeText(fallback, fallback);
}

function getStartTimeMs(meta) {
  const raw = meta?.startTime;
  if (!raw) return null;
  if (raw?.toMillis) return raw.toMillis();
  if (typeof raw === "number") return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getCheckInWindowMinutes(meta) {
  const minutes = Number(meta?.checkInWindowMinutes || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function isInviteAccepted(player) {
  const normalized = String(player?.inviteStatus || "").toLowerCase();
  if (normalized === "pending" || normalized === "denied") return false;
  return true;
}

function buildTournamentUrl(meta, slug) {
  if (!slug) return "";
  const circuitSlug = meta?.circuitSlug || "";
  const path = circuitSlug
    ? `/tournament/${circuitSlug}/${slug}`
    : `/tournament/${slug}`;
  return `${TOURNAMENT_BASE_URL}${path}`;
}

function safeTaskId(value) {
  const base = sanitizeText(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return base || "tournament";
}

// Create a simple, stable slug for titles
function slugify(text) {
  const base = sanitizeText(text, "");
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function loadSpaIndex() {
  if (!cachedSpaIndex) {
    try {
      cachedSpaIndex = await fs.readFile(SPA_INDEX_PATH, "utf8");
    } catch (error) {
      console.warn(
        "⚠️ Failed to read SPA index from filesystem:",
        error.message
      );

      try {
        const response = await fetch(SPA_REMOTE_URL, {
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(
            `Unexpected status ${response.status} when fetching SPA fallback.`
          );
        }

        cachedSpaIndex = await response.text();
      } catch (fetchError) {
        console.error("❌ Failed to download SPA index fallback:", fetchError);
        throw fetchError;
      }
    }
  }
  return cachedSpaIndex;
}

async function loadStaticPrerenderTemplate() {
  if (cachedStaticTemplate) {
    return cachedStaticTemplate;
  }

  const baseHtml = await loadSpaIndex();

  try {
    const dom = new JSDOM(baseHtml);
    const { document } = dom.window;

    document.querySelectorAll("script").forEach((node) => node.remove());
    document
      .querySelectorAll('link[rel="modulepreload"], link[rel="preload"]')
      .forEach((node) => node.remove());

    cachedStaticTemplate = dom.serialize();
  } catch (error) {
    console.warn(
      "⚠️ Failed to sanitize SPA template for prerender:",
      error.message
    );
    cachedStaticTemplate = baseHtml;
  }

  return cachedStaticTemplate;
}

async function sendSpaIndex(res, statusCode = 200, canonicalUrl = null) {
  let spaHtml = await loadSpaIndex();
  if (canonicalUrl) {
    try {
      spaHtml = addCanonicalLink(spaHtml, canonicalUrl);
    } catch (_) {
      // best-effort only
    }
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "public, max-age=0, s-maxage=600");
  res.status(statusCode).send(spaHtml);
}

function extractBuildIdFromRequest(req) {
  if (!req) return "";

  const queryId = req.query?.id;
  if (queryId) {
    return decodeURIComponent(String(queryId));
  }

  const pathToInspect = req.path || req.originalUrl || "";
  const prettyMatch = pathToInspect.match(/\/build\/[^/]+\/[^/]+\/([^/?#]+)/i);
  if (prettyMatch?.[1]) {
    return decodeURIComponent(prettyMatch[1]);
  }

  const shortMatch = pathToInspect.match(/\/build\/([^/?#]+)/i);
  if (shortMatch?.[1]) {
    return decodeURIComponent(shortMatch[1]);
  }

  return "";
}

function buildCanonicalUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = sanitizeUrl(forwardedProto, "https");
  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
  const host = sanitizeUrl(forwardedHost, "zbuildorder.com");
  const pathPortion = sanitizeUrl(req.path || "/", "/");

  return `${protocol}://${host}${pathPortion}`;
}

// Preferred path for a build (pretty URL)
function buildPreferredPath(buildId, buildData) {
  const matchup = sanitizeText(buildData?.subcategory || buildData?.matchup, "unknown").toLowerCase();
  const slug = slugify(buildData?.title || "untitled");
  return `/build/${matchup}/${slug}/${buildId}`;
}

function absoluteCanonical(host, path) {
  const cleanHost = sanitizeText(host || "zbuildorder.com", "zbuildorder.com");
  const cleanPath = sanitizeText(path || "/", "/");
  return `https://${cleanHost}${cleanPath}`;
}

function normalizePulseUrl(rawUrl) {
  if (!rawUrl) return "";
  const cleaned = sanitizeText(rawUrl, "").trim();
  const withProtocol = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") return "";
  if (!PULSE_ALLOWED_HOSTS.has(url.hostname)) return "";

    // Keep only whitelisted params
    const allowedParams = new Set(["type", "id", "characterId", "accountId", "m"]);
    const kept = new URLSearchParams();
    for (const [k, v] of url.searchParams.entries()) {
      if (allowedParams.has(k)) kept.append(k, v);
    }

    // Default type if missing
    if (!kept.has("type")) kept.set("type", "character");

    const normalized = new URL(
      `${url.protocol}//${url.host}${url.pathname}`
    );
    normalized.search = kept.toString();
    // strip hash
    return normalized.toString();
  } catch (_) {
    return "";
  }
}

function extractPulseMmr(html) {
  if (!html || typeof html !== "string") return null;

  const patterns = [
    /"last"\s*:\s*([0-9]{3,5})/i,
    /"current"\s*:\s*([0-9]{3,5})/i,
    /mmr[^0-9]{0,10}([0-9]{3,5})/i,
    /rating[^0-9]{0,10}([0-9]{3,5})/i,
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) return Number(match[1]);
  }

  return null;
}

function parsePulseUrlDetails(raw) {
  try {
    const u = new URL(raw);
    const idParam =
      u.searchParams.get("id") ||
      u.searchParams.get("characterId") ||
      u.searchParams.get("accountId");
    const idNum = idParam ? Number(idParam) : null;
    const region = u.searchParams.get("m") || "";
    return {
      cleanUrl: `${u.origin}${u.pathname}${u.search}`,
      id: Number.isFinite(idNum) ? idNum : null,
      region,
    };
  } catch (_) {
    return { cleanUrl: raw || "", id: null, region: "" };
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key]);
  }
  return [];
}

function normalizeRounds(rounds) {
  return toArray(rounds).map((round) => toArray(round));
}

function collectMatchesFromBracket(bracket) {
  if (!bracket || typeof bracket !== "object") return [];
  const winners = normalizeRounds(bracket.winners);
  const losers = normalizeRounds(bracket.losers);
  const groups = toArray(bracket.groups);
  const matches = [];
  winners.forEach((round) => matches.push(...round));
  losers.forEach((round) => matches.push(...round));
  groups.forEach((group) => {
    matches.push(...toArray(group?.matches));
  });
  if (bracket.finals) matches.push(bracket.finals);
  return matches.filter(Boolean);
}

function isMatchComplete(match) {
  if (!match || typeof match !== "object") return false;
  if (match.status === "complete") return true;
  return Boolean(match.winnerId || match.walkover);
}

function isTournamentComplete(bracket) {
  if (!bracket || typeof bracket !== "object") return false;

  if (bracket.finals && isMatchComplete(bracket.finals)) {
    return true;
  }

  const winners = normalizeRounds(bracket.winners);
  if (winners.length) {
    const lastRound = winners[winners.length - 1] || [];
    const finalMatch = lastRound[0];
    if (finalMatch && isMatchComplete(finalMatch)) {
      return true;
    }
  }

  const losers = normalizeRounds(bracket.losers);
  const groups = toArray(bracket.groups);
  const hasPlayoffs =
    winners.flat().length || losers.flat().length || bracket.finals;
  if (groups.length && !hasPlayoffs) {
    const groupMatches = groups.flatMap((group) =>
      toArray(group?.matches)
    );
    if (groupMatches.length && groupMatches.every(isMatchComplete)) {
      return true;
    }
  }

  const allMatches = collectMatchesFromBracket(bracket);
  if (!allMatches.length) return false;
  return allMatches.every(isMatchComplete);
}

const DEFAULT_BEST_OF = {
  upper: 3,
  quarter: 3,
  semi: 3,
  upperFinal: 3,
  final: 5,
  lower: 1,
  lowerSemi: 1,
  lowerFinal: 3,
};

function normalizeAdminList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        return { uid: entry, name: "" };
      }
      return {
        uid: entry.uid || entry.userId || "",
        name: entry.name || entry.username || "",
      };
    })
    .filter((entry) => entry && (entry.uid || entry.name));
}

function isAdminForMeta(meta, uid) {
  if (!uid || !meta) return false;
  if (meta.createdBy && meta.createdBy === uid) return true;
  const admins = normalizeAdminList(meta.admins);
  return admins.some((entry) => entry.uid === uid);
}

function deserializeBracketState(bracket) {
  if (!bracket || typeof bracket !== "object") return bracket || null;
  const toArr = (obj) =>
    Array.isArray(obj)
      ? obj
      : obj && typeof obj === "object"
      ? Object.keys(obj)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => obj[key])
      : [];
  const normalizeRoundList = (rounds) =>
    toArr(rounds)
      .map((round) => toArr(round))
      .filter((round) => round.length);
  const clampRounds = (rounds, count) => {
    if (!Number.isFinite(count)) return rounds;
    return rounds.slice(0, Math.max(0, count));
  };
  const winners = clampRounds(
    normalizeRoundList(bracket.winners),
    bracket.winnersRoundCount
  );
  const losers = clampRounds(
    normalizeRoundList(bracket.losers),
    bracket.losersRoundCount
  );
  return {
    ...bracket,
    winners,
    losers,
    groups: toArr(bracket.groups),
  };
}

function serializeBracketState(bracket) {
  if (!bracket || typeof bracket !== "object") return bracket;
  const toArr = (obj) =>
    Array.isArray(obj)
      ? obj
      : obj && typeof obj === "object"
      ? Object.keys(obj)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => obj[key])
      : [];
  const normalizeRoundList = (rounds) =>
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
  const winnersRounds = normalizeRoundList(bracket.winners);
  const losersRounds = normalizeRoundList(bracket.losers);
  return {
    ...bracket,
    winners: toObj(winnersRounds),
    losers: toObj(losersRounds),
    groups: toArr(bracket.groups),
    winnersRoundCount: winnersRounds.length,
    losersRoundCount: losersRounds.length,
  };
}

function getMatchLookup(bracket) {
  const map = new Map();
  collectMatchesFromBracket(bracket).forEach((match) => {
    if (match?.id) {
      map.set(match.id, match);
    }
  });
  return map;
}

function resolveParticipants(match, lookup, playersById) {
  const sources = Array.isArray(match?.sources) ? match.sources : [];
  return sources.map((src) => {
    if (!src) return null;
    if (src.type === "player") {
      return playersById.get(src.playerId) || null;
    }
    if (src.type === "match") {
      const sourceMatch = lookup.get(src.matchId);
      if (!sourceMatch) return null;
      if (src.outcome === "winner" && sourceMatch.winnerId) {
        return playersById.get(sourceMatch.winnerId) || null;
      }
      if (src.outcome === "loser" && sourceMatch.loserId) {
        return playersById.get(sourceMatch.loserId) || null;
      }
    }
    return null;
  });
}

function getParticipantIdFromSource(source, lookup) {
  if (!source) return null;
  if (source.type === "player") return source.playerId || null;
  if (source.type === "match") {
    const sourceMatch = lookup.get(source.matchId);
    if (!sourceMatch) return null;
    if (source.outcome === "loser") {
      return sourceMatch.loserId || null;
    }
    return sourceMatch.winnerId || null;
  }
  return null;
}

function isForfeitPlayer(id, playersById) {
  if (!id) return false;
  return Boolean(playersById.get(id)?.forfeit);
}

function getSeedRank(id, playersById, players) {
  if (!id) return Number.POSITIVE_INFINITY;
  const player = playersById.get(id);
  if (!player) return Number.POSITIVE_INFINITY;
  if (Number.isFinite(player.seed)) return player.seed;
  const idx = (players || []).findIndex((entry) => entry?.id === id);
  return idx >= 0 ? idx + 1 : Number.POSITIVE_INFINITY;
}

function hasManualResult(match) {
  if (!match) return false;
  const scores = Array.isArray(match.scores) ? match.scores : [];
  const hasScore = (scores[0] || 0) + (scores[1] || 0) > 0;
  const hasManualWalkover = Boolean(match.walkover) && !match.forfeitApplied;
  const hasManualWinner = Boolean(match.winnerId) && !match.forfeitApplied;
  const isCompleteManual =
    match.status === "complete" &&
    !match.forfeitApplied &&
    !hasScore &&
    !hasManualWalkover;
  return hasScore || hasManualWalkover || hasManualWinner || isCompleteManual;
}

function normalizeBestOf(meta) {
  const raw =
    meta?.bestOf && typeof meta.bestOf === "object" ? meta.bestOf : {};
  const out = { ...DEFAULT_BEST_OF };
  for (const key of Object.keys(out)) {
    const num = Number(raw[key]);
    if (Number.isFinite(num) && num > 0) out[key] = num;
  }
  return out;
}

function getBestOfForMatch(match, meta, bracket) {
  if (!match || typeof match !== "object") return 1;
  if (match.bracket === "group") {
    const groupBestOf = Number(meta?.roundRobin?.bestOf);
    if (Number.isFinite(groupBestOf) && groupBestOf > 0) {
      return groupBestOf;
    }
  }
  if (Number.isFinite(match?.bestOf) && match.bestOf > 0) {
    return match.bestOf;
  }
  const bestOf = normalizeBestOf(meta);
  const winnersRounds = toArray(bracket?.winners).length || 0;
  const losersRounds = toArray(bracket?.losers).length || 0;

  if (match.bracket === "winners") {
    if (match.round === winnersRounds) {
      if (bracket?.finals) {
        return bestOf.upperFinal || bestOf.final || DEFAULT_BEST_OF.upperFinal;
      }
      return bestOf.final || DEFAULT_BEST_OF.final;
    }
    if (match.round === winnersRounds - 1) {
      return bestOf.semi || DEFAULT_BEST_OF.semi;
    }
    if (match.round === winnersRounds - 2) {
      return bestOf.quarter || DEFAULT_BEST_OF.quarter;
    }
    return bestOf.upper || DEFAULT_BEST_OF.upper;
  }

  if (match.bracket === "losers") {
    if (match.round === losersRounds) {
      return (
        bestOf.lowerFinal ||
        bestOf.lower ||
        DEFAULT_BEST_OF.lowerFinal ||
        DEFAULT_BEST_OF.lower
      );
    }
    if (match.round === losersRounds - 1) {
      return (
        bestOf.lowerSemi ||
        bestOf.lower ||
        DEFAULT_BEST_OF.lowerSemi ||
        DEFAULT_BEST_OF.lower
      );
    }
    return bestOf.lower || DEFAULT_BEST_OF.lower;
  }

  if (match.bracket === "group") {
    return bestOf.upper || DEFAULT_BEST_OF.upper;
  }

  return bestOf.final || DEFAULT_BEST_OF.final;
}

function recomputeMatchOutcome(match, lookup, ctx) {
  const bestOf = getBestOfForMatch(match, ctx.meta, ctx.bracket) || 1;
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const srcA = match.sources?.[0] || null;
  const srcB = match.sources?.[1] || null;
  const idA = getParticipantIdFromSource(srcA, lookup);
  const idB = getParticipantIdFromSource(srcB, lookup);
  const forfeitA = isForfeitPlayer(idA, ctx.playersById);
  const forfeitB = isForfeitPlayer(idB, ctx.playersById);
  const manualResult = hasManualResult(match);

  if (idA && idB && !manualResult && (forfeitA || forfeitB)) {
    if (forfeitA && !forfeitB) {
      match.walkover = "a";
      match.scores = [0, needed];
    } else if (forfeitB && !forfeitA) {
      match.walkover = "b";
      match.scores = [needed, 0];
    } else {
      const seedA = getSeedRank(idA, ctx.playersById, ctx.players);
      const seedB = getSeedRank(idB, ctx.playersById, ctx.players);
      const aIsHigher = seedA <= seedB;
      match.walkover = aIsHigher ? "b" : "a";
      match.scores = aIsHigher ? [needed, 0] : [0, needed];
    }
    match.forfeitApplied = true;
  } else if (match.forfeitApplied && !manualResult) {
    match.walkover = null;
    match.scores = [0, 0];
    match.forfeitApplied = false;
  }

  let winnerId = null;
  let loserId = null;
  if (match.walkover === "a") {
    winnerId = idB;
    loserId = idA;
  } else if (match.walkover === "b") {
    winnerId = idA;
    loserId = idB;
  } else {
    const a = Number(match.scores?.[0]);
    const b = Number(match.scores?.[1]);
    const valA = Number.isFinite(a) ? a : 0;
    const valB = Number.isFinite(b) ? b : 0;
    if (valA !== valB && Math.max(valA, valB) >= needed) {
      if (valA > valB) {
        winnerId = idA;
        loserId = idB;
      } else {
        winnerId = idB;
        loserId = idA;
      }
    }
  }

  const nextStatus = winnerId || match.walkover ? "complete" : "pending";
  const changed =
    match.winnerId !== winnerId ||
    match.loserId !== loserId ||
    match.status !== nextStatus;
  match.winnerId = winnerId || null;
  match.loserId = loserId || null;
  match.status = nextStatus;
  return changed;
}

function buildDependencyMap(lookup) {
  const dependencies = new Map();
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

function cascadeMatchOutcomeUpdates(startMatchId, lookup, ctx) {
  const dependencies = buildDependencyMap(lookup);
  const queue = [startMatchId];
  while (queue.length) {
    const sourceId = queue.shift();
    const dependents = dependencies.get(sourceId);
    if (!dependents) continue;
    for (const depId of dependents) {
      const match = lookup.get(depId);
      if (!match) continue;
      const changed = recomputeMatchOutcome(match, lookup, ctx);
      if (changed) queue.push(depId);
    }
  }
}

function updateMatchScoreInBracket({
  bracket,
  players,
  meta,
  matchId,
  scoreA,
  scoreB,
  finalize = true,
}) {
  if (!bracket || !matchId) return { updated: false };
  const lookup = getMatchLookup(bracket);
  const match = lookup.get(matchId);
  if (!match) return { updated: false };

  const bestOf = getBestOfForMatch(match, meta, bracket) || 1;
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const isWalkoverA = String(scoreA).toUpperCase() === "W";
  const isWalkoverB = String(scoreB).toUpperCase() === "W";
  const srcA = match.sources?.[0] || null;
  const srcB = match.sources?.[1] || null;
  const playersById = new Map(
    (players || []).filter(Boolean).map((player) => [player.id, player])
  );
  const idA = getParticipantIdFromSource(srcA, lookup);
  const idB = getParticipantIdFromSource(srcB, lookup);
  const forfeitA = isForfeitPlayer(idA, playersById);
  const forfeitB = isForfeitPlayer(idB, playersById);
  const manualResult = hasManualResult(match);

  let walkover = null;
  let valA = 0;
  let valB = 0;
  let winnerId = null;
  let loserId = null;

  if (idA && idB && !manualResult && (forfeitA || forfeitB)) {
    if (forfeitA && !forfeitB) {
      walkover = "a";
      valA = 0;
      valB = needed;
      winnerId = idB;
      loserId = idA;
    } else if (forfeitB && !forfeitA) {
      walkover = "b";
      valA = needed;
      valB = 0;
      winnerId = idA;
      loserId = idB;
    } else {
      const seedA = getSeedRank(idA, playersById, players);
      const seedB = getSeedRank(idB, playersById, players);
      const aIsHigher = seedA <= seedB;
      walkover = aIsHigher ? "b" : "a";
      valA = aIsHigher ? needed : 0;
      valB = aIsHigher ? 0 : needed;
      winnerId = aIsHigher ? idA : idB;
      loserId = aIsHigher ? idB : idA;
    }
    match.forfeitApplied = true;
  } else if (isWalkoverA && !isWalkoverB) {
    walkover = "a";
    valA = 0;
    valB = needed;
    winnerId = idB;
    loserId = idA;
  } else if (isWalkoverB && !isWalkoverA) {
    walkover = "b";
    valA = needed;
    valB = 0;
    winnerId = idA;
    loserId = idB;
  } else {
    if (match.forfeitApplied) match.forfeitApplied = false;
    const a = Number(scoreA);
    const b = Number(scoreB);
    valA = Number.isFinite(a) ? a : 0;
    valB = Number.isFinite(b) ? b : 0;
    if (valA !== valB && Math.max(valA, valB) >= needed) {
      if (valA > valB) {
        winnerId = idA;
        loserId = idB;
      } else {
        winnerId = idB;
        loserId = idA;
      }
    }
  }

  match.scores = [valA, valB];
  match.walkover = walkover;
  if (finalize) {
    match.winnerId = winnerId || null;
    match.loserId = loserId || null;
    match.status = winnerId || walkover ? "complete" : "pending";
  } else {
    match.winnerId = null;
    match.loserId = null;
    match.status = "pending";
  }

  if (finalize) {
    cascadeMatchOutcomeUpdates(matchId, lookup, {
      bracket,
      players,
      playersById,
      meta,
    });
  }

  const shouldClearCast = finalize && match.status === "complete";
  return { updated: true, shouldClearCast, lookup, playersById };
}

const MMR_MIN = 500;
const MMR_MAX = 6000;

function mmrInRange(n) {
  return Number.isFinite(n) && n >= MMR_MIN && n <= MMR_MAX;
}

function collectRatings(obj, bucket = []) {
  if (obj === null || obj === undefined) return bucket;
  if (typeof obj === "number") {
    if (Number.isFinite(obj) && obj >= MMR_MIN && obj <= MMR_MAX) {
      bucket.push(obj);
    }
    return bucket;
  }
  if (typeof obj === "string") {
    const m = obj.match(/(\d{3,5})/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= MMR_MIN && n <= MMR_MAX) {
        bucket.push(n);
      }
    }
    return bucket;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectRatings(item, bucket));
    return bucket;
  }
  if (typeof obj === "object") {
    for (const [, val] of Object.entries(obj)) {
      collectRatings(val, bucket);
    }
  }
  return bucket;
}

const RACE_MAP = {
  zerg: "zerg",
  z: "zerg",
  protoss: "protoss",
  p: "protoss",
  terran: "terran",
  t: "terran",
  random: "random",
  r: "random",
};

function normalizeRace(value) {
  if (typeof value === "string") {
    const k = value.trim().toLowerCase();
    return RACE_MAP[k] || null;
  }
  if (typeof value === "number") {
    // Best-guess mapping if SC2Pulse uses numeric races
    const numericMap = {
      0: "terran",
      1: "zerg",
      2: "protoss",
      3: "random",
    };
    return numericMap[value] || null;
  }
  return null;
}

function toMillis(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    if (val > 1e12) return val; // already ms
    if (val > 1e9) return val * 1000; // seconds
    return null;
  }
  if (typeof val === "string") {
    const n = Number(val);
    if (Number.isFinite(n)) return toMillis(n);
    const d = Date.parse(val);
    return Number.isNaN(d) ? null : d;
  }
  return null;
}

function raceFromLegacyUid(legacyUid) {
  if (!legacyUid || typeof legacyUid !== "string") return null;
  const parts = legacyUid.split(".");
  const last = parts[parts.length - 1];
  if (!last) return null;
  const num = Number(last);
  if (!Number.isFinite(num)) return null;
  const map = { 1: "terran", 2: "protoss", 3: "zerg", 4: "random" };
  return map[num] || null;
}

function raceFromRaceGames(raceGames) {
  if (!raceGames || typeof raceGames !== "object") return null;
  const entries = Object.entries(raceGames).filter(
    ([, v]) => Number(v) > 0 || v === 0
  );
  if (!entries.length) return null;
  // Prefer the key with the largest games value
  entries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
  const key = entries[0][0];
  return normalizeRace(key);
}

function normalizeTeamRace(team) {
  const fromLegacy =
    raceFromLegacyUid(team?.legacyUid) || raceFromLegacyUid(team?.legacyId);
  if (fromLegacy) return fromLegacy;

  const members = Array.isArray(team?.members) ? team.members : [];
  for (const m of members) {
    const rg = m?.raceGames || team?.raceGames;
    const race = raceFromRaceGames(rg);
    if (race) return race;
  }

  const teamRace = raceFromRaceGames(team?.raceGames);
  if (teamRace) return teamRace;

  return null;
}

function extractRaceRatingsFromTeams(teams = []) {
  const byRaceDetailed = {};

  teams.forEach((team) => {
    const rating = Number(team?.rating);
    if (!mmrInRange(rating)) return;

    const race = normalizeTeamRace(team);
    if (!race) return;

    const time =
      toMillis(team?.lastPlayed) ||
      toMillis(team?.primaryDataUpdated) ||
      toMillis(team?.joined) ||
      (Number.isFinite(Number(team?.season))
        ? Number(team.season) * 1_000_000
        : null);

    const existing = byRaceDetailed[race];
    if (
      !existing ||
      (time && (!existing.time || time > existing.time)) ||
      (!existing.time && !time)
    ) {
      byRaceDetailed[race] = { rating, time };
    }
  });

  const byRace = {};
  Object.entries(byRaceDetailed).forEach(([race, data]) => {
    byRace[race] = data.rating;
  });

  return { byRaceDetailed, byRace };
}

function mergeRaceDetails(target, incoming) {
  const result = { ...target };
  Object.entries(incoming || {}).forEach(([race, data]) => {
    const existing = result[race];
    if (
      !existing ||
      (data.time && (!existing.time || data.time > existing.time)) ||
      (!existing.time && !data.time)
    ) {
      result[race] = data;
    }
  });
  return result;
}

function collapseRaceDetails(details) {
  const byRace = {};
  Object.entries(details || {}).forEach(([race, data]) => {
    if (data && mmrInRange(data.rating)) {
      byRace[race] = data.rating;
    }
  });
  return byRace;
}

function collectRaceRatings(obj, acc = []) {
  if (obj === null || obj === undefined) return acc;

  if (Array.isArray(obj)) {
    obj.forEach((item) => collectRaceRatings(item, acc));
    return acc;
  }

  if (typeof obj === "object") {
    const raceValue =
      normalizeRace(obj.race) ||
      normalizeRace(obj.raceId) ||
      normalizeRace(obj.faction);

    let timeValue =
      toMillis(obj.lastPlayed || obj.lastMatchTime || obj.timestamp || obj.time);

    const ratings = [];
    for (const [key, val] of Object.entries(obj)) {
      const k = key.toLowerCase();
      const isRatingKey = k.includes("rating") || k.includes("mmr");
      const isSummaryKey =
        k.includes("avg") || k.includes("average") || k.includes("max") || k.includes("best") || k.includes("peak");
      const priority =
        k.includes("last") || k.includes("current") ? 2 : isRatingKey ? 1 : 0;

      // Ignore summary/peak/avg keys to avoid picking inflated historical values
      if (isRatingKey && !isSummaryKey) {
        let n = null;
        if (typeof val === "number") {
          n = val;
        } else if (typeof val === "string") {
          const m = val.match(/(\d{3,5})/);
          n = m ? Number(m[1]) : null;
        }
        if (Number.isFinite(n) && n >= MMR_MIN && n <= MMR_MAX) {
          ratings.push({ rating: n, priority });
        }
      }

      // capture additional time hints
      if (
        !timeValue &&
        (k.includes("time") || k.includes("date") || k.includes("updated"))
      ) {
        timeValue = timeValue || toMillis(val);
      }
    }

    if (raceValue && ratings.length) {
      ratings.forEach((r) =>
        acc.push({
          race: raceValue,
          rating: r.rating,
          time: timeValue || null,
          priority: r.priority,
        })
      );
    }

    // Recurse into child objects
    for (const val of Object.values(obj)) {
      collectRaceRatings(val, acc);
    }
  }

  return acc;
}

function extractPulseNameFromTeamEntry(entry) {
  if (!entry) return "";

  const membersArray = Array.isArray(entry.members)
    ? entry.members
    : Array.isArray(entry.members?.members)
    ? entry.members.members
    : null;

  const firstMember =
    membersArray && membersArray.length ? membersArray[0] : null;

  const candidateNames = [
    firstMember?.character?.tag,
    firstMember?.character?.name,
    firstMember?.account?.tag,
    firstMember?.account?.battleTag,
    entry?.members?.character?.tag,
    entry?.members?.character?.name,
    entry?.members?.account?.tag,
    entry?.members?.account?.battleTag,
  ]
    .filter(Boolean)
    .map((name) => name.toString().trim());

  const cleaned = candidateNames
    .map((name) => name.split("#")[0] || name)
    .find(Boolean);

  return cleaned || "";
}

function extractPulseNameFromCharacterEntry(entry) {
  if (!entry) return "";
  const candidateNames = [
    entry?.members?.character?.tag,
    entry?.members?.character?.name,
    entry?.members?.account?.tag,
    entry?.members?.account?.battleTag,
  ]
    .filter(Boolean)
    .map((name) => name.toString().trim());

  const cleaned = candidateNames
    .map((name) => name.split("#")[0] || name)
    .find(Boolean);

  return cleaned || "";
}

function cleanPulseName(name) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split("#")[0] || trimmed;
}

async function fetchRaceRatingsFromTeamsApi(details) {
  const raceDetails = {};
  let lastStatus = null;
  let pulseName = "";

  const ids = [];
  if (details?.id) {
    ids.push({ key: "characterId", value: details.id });
    ids.push({ key: "accountId", value: details.id });
  }

  const tried = new Set();

  for (const { key, value } of ids) {
    const url = `${PULSE_API_BASE}/character-teams?${key}=${value}&queue=LOTV_1V1`;
    if (tried.has(url)) continue;
    tried.add(url);

    try {
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      lastStatus = resp.status;
      if (!resp.ok) continue;
      const json = await resp.json();
      if (!pulseName) {
        const first = Array.isArray(json) ? json[0] : null;
        pulseName = extractPulseNameFromTeamEntry(first);
      }
      const { byRaceDetailed } = extractRaceRatingsFromTeams(json);
      Object.assign(
        raceDetails,
        mergeRaceDetails(raceDetails, byRaceDetailed)
      );
    } catch (e) {
      functions.logger.warn(`Failed to fetch character-teams from ${url}`, e);
    }
  }

  const byRace = collapseRaceDetails(raceDetails);
  const mmr = Object.values(byRace).filter(mmrInRange).reduce((a, b) => Math.max(a, b), 0) || null;

  return { byRace, mmr, lastStatus, pulseName };
}

function extractRaceRatingsFromCharactersPayload(json) {
  const raceDetails = {};
  const arr = Array.isArray(json) ? json : [];

  arr.forEach((item) => {
    const rating =
      Number(item?.currentStats?.rating) ||
      Number(item?.rating) ||
      null;
    if (!mmrInRange(rating)) return;

    const race =
      raceFromRaceGames(item?.members?.raceGames) ||
      raceFromRaceGames(item?.raceGames) ||
      null;
    const time =
      toMillis(item?.currentStats?.updated) ||
      toMillis(item?.primaryDataUpdated) ||
      null;

    if (!race) return;
    const existing = raceDetails[race];
    if (
      !existing ||
      (time && (!existing.time || time > existing.time)) ||
      (!existing.time && !time)
    ) {
      raceDetails[race] = { rating, time };
    }
  });

  return {
    byRace: collapseRaceDetails(raceDetails),
    byRaceDetailed: raceDetails,
  };
}

async function fetchRaceRatingsFromCharacters(details) {
  let lastStatus = null;
  const raceDetails = {};
  const urls = [];
  let pulseName = "";

  // Try the direct character endpoint to get a reliable display name
  if (details?.id) {
    const profileUrl = `${PULSE_API_BASE}/characters/${details.id}`;
    try {
      const resp = await fetch(profileUrl, {
        headers: { Accept: "application/json" },
      });
      lastStatus = resp.status;
      if (resp.ok) {
        const json = await resp.json();
        const candidate = json?.name || json?.battleTag || json?.tag;
        pulseName = cleanPulseName(candidate);
      }
    } catch (e) {
      functions.logger.warn(
        `Failed to fetch character profile from ${profileUrl}`,
        e
      );
    }
  }

  if (details?.id) {
    urls.push(`${PULSE_API_BASE}/characters?characterId=${details.id}`);
    urls.push(`${PULSE_API_BASE}/characters?accountId=${details.id}`);
  }

  const tried = new Set();

  for (const url of urls) {
    if (tried.has(url)) continue;
    tried.add(url);
    try {
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      lastStatus = resp.status;
      if (!resp.ok) continue;
      const json = await resp.json();
      if (!pulseName) {
        const first = Array.isArray(json) ? json[0] : null;
        pulseName = extractPulseNameFromCharacterEntry(first);
      }
      const { byRaceDetailed } = extractRaceRatingsFromCharactersPayload(json);
      Object.assign(
        raceDetails,
        mergeRaceDetails(raceDetails, byRaceDetailed)
      );
    } catch (e) {
      functions.logger.warn(`Failed to fetch characters from ${url}`, e);
    }
  }

  const byRace = collapseRaceDetails(raceDetails);
  const mmr = Object.values(byRace).filter(mmrInRange).reduce((a, b) => Math.max(a, b), 0) || null;

  return { byRace, mmr, lastStatus, pulseName };
}

async function fetchPulseMmrViaBrowser(url) {
  let browser;
  let page;
  try {
    browser = await puppeteer.launch({
      args: CHROMIUM_ARGS,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless !== false,
    });

    page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 15_000,
    });

    // Wait a moment for client-side rendering
    await page.waitForTimeout(1_000);

    const mmr = await page.evaluate(() => {
      const candidates = [];
      const walk = (root) => {
        if (!root || candidates.length > 50) return;
        const text = (root.textContent || "").trim();
        if (text) candidates.push(text);
        for (const child of root.children || []) walk(child);
      };
      walk(document.body || document);
      const combined = candidates.join(" ");
      const patterns = [
        /MMR[^0-9]{0,8}([0-9]{3,5})/i,
        /rating[^0-9]{0,8}([0-9]{3,5})/i,
      ];
      for (const r of patterns) {
        const m = combined.match(r);
        if (m?.[1]) return Number(m[1]);
      }
      return null;
    });

    return mmr;
  } catch (error) {
    console.warn("? Puppeteer MMR fetch failed:", error?.message || error);
    return null;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (_) {}
    }
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

function addCanonicalLink(html, canonicalUrl) {
  if (!html || !canonicalUrl) {
    return html;
  }

  try {
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const head = document.head || document.createElement("head");

    const sanitizedCanonical = sanitizeUrl(canonicalUrl, canonicalUrl);

    const existing = head.querySelector('link[rel="canonical"]');
    if (existing) {
      existing.setAttribute("href", sanitizedCanonical);
    } else {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", sanitizedCanonical);
      head.appendChild(link);
    }

    return dom.serialize();
  } catch (error) {
    console.warn("⚠️ Failed to inject canonical link:", error.message);
    return html;
  }
}

function formatMatchupText(subcategory) {
  const sanitized = sanitizeText(subcategory, "");
  if (!sanitized) {
    return "Unknown matchup";
  }

  if (sanitized.length === 3) {
    return (
      sanitized.charAt(0).toUpperCase() +
      sanitized.charAt(1) +
      sanitized.charAt(2).toUpperCase()
    );
  }

  return sanitized;
}

function formatPublishedDate(dateValue) {
  let raw = dateValue;
  if (raw?.toMillis) {
    raw = raw.toMillis();
  }

  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      raw = parsed;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}-${year}`;
}

function createBuildOrderHtml(buildOrder) {
  if (!Array.isArray(buildOrder) || buildOrder.length === 0) {
    return "<p>No build order available.</p>";
  }

  const rows = [];

  for (const step of buildOrder) {
    if (typeof step === "string") {
      const action = sanitizeText(step, "");
      if (action) {
        rows.push(`<p>${action}</p>`);
      }
      continue;
    }

    if (step && typeof step === "object") {
      const action = sanitizeText(step.action, "");
      if (!action) {
        continue;
      }

      const prefix = sanitizeText(step.workersOrTimestamp, "");
      const prefixHtml = prefix ? `<strong>${prefix}</strong> ` : "";
      rows.push(`<p>${prefixHtml}${action}</p>`);
    }
  }

  if (rows.length === 0) {
    return "<p>No build order available.</p>";
  }

  return rows.join("");
}

function buildMetaStrings(buildData) {
  const sanitizedTitle = sanitizeText(buildData.title, "Untitled build");
  const sanitizedPublisher = sanitizeText(
    buildData.publisher || buildData.username,
    "Anonymous"
  );
  const sanitizedSubcategory = sanitizeText(buildData.subcategory, "Unknown");
  const sanitizedDescription = sanitizeText(buildData.description, "");
  const formattedMatchup = formatMatchupText(sanitizedSubcategory);

  const defaultDescription = sanitizeText(
    `StarCraft 2 build order by ${sanitizedPublisher}, matchup: ${formattedMatchup}`,
    "StarCraft 2 build order"
  );
  const defaultOgDescription = sanitizeText(
    `Build order for ${formattedMatchup} by ${sanitizedPublisher}.`,
    "StarCraft 2 build order"
  );
  const description = sanitizedDescription || defaultDescription;
  const ogDescription = sanitizedDescription || defaultOgDescription;

  return {
    pageTitle: sanitizeText(
      `${sanitizedTitle} – Z-Build Order`,
      "Z-Build Order"
    ),
    description,
    ogTitle: sanitizeText(`${sanitizedTitle} – Z-Build Order`, "Z-Build Order"),
    ogDescription,
    ogSiteName: sanitizedPublisher,
  };
}

function buildPrerenderPayload(buildData, buildId) {
  const title = sanitizeText(buildData.title, "Untitled Build");
  const publisher = sanitizeText(
    buildData.username || buildData.publisher || buildData.publisherName,
    "Anonymous"
  );
  const category = sanitizeText(buildData.category, "Unknown");
  const matchup = formatMatchupText(buildData.subcategory);
  const description = sanitizeText(buildData.description, "");
  const descriptionHtml = description ? description.replace(/\n/g, "<br>") : "";

  // Canonical for this build
  const matchupRaw = sanitizeText(buildData.subcategory, "unknown").toLowerCase();
  const titleSlug = slugify(title);
  const canonicalPath = `/build/${matchupRaw}/${titleSlug}/${buildId}`;
  const canonicalUrl = `https://zbuildorder.com${canonicalPath}`;

  const buildOrderHtml = createBuildOrderHtml(buildData.buildOrder);
  const buildOrderStepCount = Array.isArray(buildData.buildOrder)
    ? buildData.buildOrder.length
    : 0;

  const datePublished = formatPublishedDate(
    buildData.datePublished ||
      buildData.timestamp ||
      buildData.updatedAt ||
      buildData.createdAt
  );

  const replayUrl = sanitizeUrl(buildData.replayUrl || "", "");
  const videoUrl = sanitizeUrl(
    buildData.videoLink || buildData.youtube || "",
    ""
  );

  const meta = buildMetaStrings({
    title,
    publisher,
    username: publisher,
    subcategory: matchup,
    description,
  });

  return {
    title,
    publisher,
    category,
    matchup,
    description,
    descriptionHtml,
    hasDescription: Boolean(description),
    datePublished,
    buildOrderHtml,
    buildOrderStepCount,
    replayUrl,
    videoUrl,
    canonicalPath,
    canonicalUrl,
    meta,
  };
}

async function launchBrowser() {
  return puppeteer.launch({
    args: CHROMIUM_ARGS,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
}

async function fetchBuildData(buildId) {
  const snapshot = await firestore
    .collection("publishedBuilds")
    .doc(buildId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data();
}

function analyzeHtmlForPlaceholders(html, buildId = "unknown") {
  if (!html) {
    return {
      ready: false,
      fields: {
        title: "",
        publisher: "",
        matchup: "",
        buildOrder: "",
      },
      missing: ["html"],
    };
  }

  try {
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const textContent = (selector) =>
      document.querySelector(selector)?.textContent?.trim() || "";

    const normalize = (value) =>
      (value || "")
        .replace(/\u2026/g, "...")
        .replace(/\s+/g, " ")
        .trim();

    const isPlaceholder = (value) => {
      const normalized = normalize(value);
      if (!normalized) return true;
      const lower = normalized.toLowerCase();
      if (
        lower === "loading" ||
        lower === "loading..." ||
        lower === "loading.."
      ) {
        return true;
      }
      return lower.startsWith("loading") && normalized.length <= 30;
    };

    const buildOrderContainer = document.querySelector("#buildOrder");
    const buildOrderText = normalize(buildOrderContainer?.textContent || "");

    const fields = {
      title: normalize(textContent("#buildTitle")),
      publisher: normalize(textContent("#buildPublisher")),
      matchup: normalize(textContent("#buildMatchup")),
      buildOrder: buildOrderText,
    };

    const buildOrderHasContent =
      !!buildOrderContainer &&
      !isPlaceholder(buildOrderText) &&
      buildOrderText.length > 0;

    const ready =
      !isPlaceholder(fields.title) &&
      !isPlaceholder(fields.publisher) &&
      !isPlaceholder(fields.matchup) &&
      buildOrderHasContent;

    const missing = [];
    if (isPlaceholder(fields.title)) missing.push("title");
    if (isPlaceholder(fields.publisher)) missing.push("publisher");
    if (isPlaceholder(fields.matchup)) missing.push("matchup");
    if (!buildOrderHasContent) missing.push("build order");

    if (!ready) {
      console.warn(
        `⚠️ Cached HTML for build ${buildId} is missing data:`,
        missing,
        fields
      );
    }

    return { ready, fields, missing };
  } catch (error) {
    console.warn(
      `⚠️ Failed to analyze prerendered HTML for build ${buildId}:`,
      error
    );
    return {
      ready: false,
      fields: {
        title: "",
        publisher: "",
        matchup: "",
        buildOrder: "",
      },
      missing: ["parse"],
    };
  }
}

async function captureBuildHtml(buildId, buildDataFromEvent) {
  const buildData = buildDataFromEvent || (await fetchBuildData(buildId));
  if (!buildData) {
    throw new Error(`No build data found for ${buildId}`);
  }

  const payload = buildPrerenderPayload(buildData, buildId);
  const staticTemplate = await loadStaticPrerenderTemplate();
  console.log(`📦 Loaded Firestore data for build ${buildId}.`, {
    title: payload.title,
    publisher: payload.publisher,
    matchup: payload.matchup,
    category: payload.category,
    steps: payload.buildOrderStepCount,
    hasDescription: payload.hasDescription,
  });
  const browser = await launchBrowser();
  let page;

  try {
    page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setDefaultNavigationTimeout(PRERENDER_TIMEOUT_MS);
    await page.setDefaultTimeout(PRERENDER_TIMEOUT_MS / 4);

    // Intercept requests to reduce bandwidth usage
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      try {
        const resourceType = request.resourceType();
        if (["image", "media", "font", "script"].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      } catch (err) {
        console.warn(
          `⚠️ Request interception failed for ${
            request.url?.() || "unknown URL"
          }:`,
          err.message
        );
      }
    });

    await page.setContent(staticTemplate, {
      waitUntil: "domcontentloaded",
    });

    const missingSelectors = await page.evaluate(
      (selectors) =>
        selectors.filter((selector) => !document.querySelector(selector)),
      REQUIRED_STATIC_SELECTORS
    );

    if (missingSelectors.length > 0) {
      throw new Error(
        `Static template missing required selectors: ${missingSelectors.join(
          ", "
        )}`
      );
    }

    console.log(`🧩 Injecting Firestore data into DOM for build ${buildId}.`, {
      title: payload.title,
      publisher: payload.publisher,
      matchup: payload.matchup,
      category: payload.category,
      steps: payload.buildOrderStepCount,
      hasDescription: payload.hasDescription,
    });

    await page.evaluate(
      ({ data }) => {
        const doc = document;
        const head = doc.head || doc.querySelector("head");

        const setTextContent = (selector, value) => {
          const element = doc.querySelector(selector);
          if (element && typeof value === "string") {
            element.textContent = value;
          }
        };

        const setInnerHtml = (selector, value) => {
          const element = doc.querySelector(selector);
          if (element && typeof value === "string") {
            element.innerHTML = value;
          }
        };

        const toggleDisplay = (selector, shouldShow) => {
          const element = doc.querySelector(selector);
          if (element) {
            element.style.display = shouldShow ? "block" : "none";
          }
        };

        setTextContent("#buildTitle", data.title);
        setTextContent("#buildPublisher", data.publisher);
        setTextContent("#buildPublisherMobile", data.publisher);
        setTextContent("#buildMatchup", data.matchup);
        setTextContent("#buildMatchupMobile", data.matchup);
        setTextContent("#buildDate", data.datePublished);
        setTextContent("#buildDateMobile", data.datePublished);

        setInnerHtml("#buildOrder", data.buildOrderHtml);

        const ensureDescriptionElements = () => {
          let desc =
            doc.querySelector("#buildDescription") ||
            doc.querySelector("#buildComment") ||
            null;
          let header =
            doc.querySelector("#descriptionHeader") ||
            doc.querySelector("#commentHeader") ||
            null;

          if (desc && desc.id === "buildComment") {
            desc.id = "buildDescription";
            desc.classList.remove("comment-display");
            desc.classList.add("description-display");
          }

          if (header && header.id === "commentHeader") {
            header.id = "descriptionHeader";
            header.textContent = "Description";
            header.classList.add("toggle-title");
          }

          const container =
            desc?.closest(".build-description-container") ||
            desc?.parentElement;

          if (
            container &&
            !container.classList.contains("build-description-container")
          ) {
            container.classList.add("build-description-container");
          }

          if (container) {
            container.style.display = "block";
          }

          if (header) {
            header.style.display = "block";
          }

          if (desc) {
            desc.style.display = "block";
          }

          return { desc };
        };

        const { desc } = ensureDescriptionElements();

        if (desc) {
          const html = data.descriptionHtml || data.description;
          desc.innerHTML = html || "No description provided.";
        }

        const replayWrapper = doc.querySelector("#replayViewWrapper");
        const replayHeader = doc.querySelector("#replayHeader");
        const replayBtn = doc.querySelector("#replayDownloadBtn");
        if (replayWrapper && replayHeader && replayBtn) {
          if (data.replayUrl) {
            replayBtn.href = data.replayUrl;
            replayWrapper.style.display = "block";
            replayHeader.style.display = "block";
          } else {
            replayBtn.removeAttribute("href");
            replayWrapper.style.display = "none";
            replayHeader.style.display = "none";
          }
        }

        if (head && data.meta) {
          const removeIfExists = (selector) => {
            const existing = head.querySelector(selector);
            if (existing) existing.remove();
          };

          doc.title = data.meta.pageTitle;

          removeIfExists('meta[name="description"]');
          const metaDesc = doc.createElement("meta");
          metaDesc.name = "description";
          metaDesc.content = data.meta.description;
          head.appendChild(metaDesc);

          removeIfExists('meta[property="og:title"]');
          const ogTitleTag = doc.createElement("meta");
          ogTitleTag.setAttribute("property", "og:title");
          ogTitleTag.content = data.meta.ogTitle;
          head.appendChild(ogTitleTag);

          removeIfExists('meta[property="og:description"]');
          const ogDescTag = doc.createElement("meta");
          ogDescTag.setAttribute("property", "og:description");
          ogDescTag.content = data.meta.ogDescription;
          head.appendChild(ogDescTag);

          removeIfExists('meta[property="og:site_name"]');
          const ogSiteTag = doc.createElement("meta");
          ogSiteTag.setAttribute("property", "og:site_name");
          ogSiteTag.content = data.meta.ogSiteName;
          head.appendChild(ogSiteTag);

          removeIfExists('meta[property="og:image"]');
          const ogImageTag = doc.createElement("meta");
          ogImageTag.setAttribute("property", "og:image");
          ogImageTag.content = "https://zbuildorder.com/img/og-image.webp";
          head.appendChild(ogImageTag);

          removeIfExists('meta[property="og:type"]');
          const ogTypeTag = doc.createElement("meta");
          ogTypeTag.setAttribute("property", "og:type");
          ogTypeTag.content = "article";
          head.appendChild(ogTypeTag);

          removeIfExists('meta[property="og:url"]');
          const ogUrlTag = doc.createElement("meta");
          ogUrlTag.setAttribute("property", "og:url");
          ogUrlTag.content = data.canonicalUrl;
          head.appendChild(ogUrlTag);

          removeIfExists('link[rel="canonical"]');
          const canonical = doc.createElement("link");
          canonical.setAttribute("rel", "canonical");
          canonical.setAttribute("href", data.canonicalUrl);
          head.appendChild(canonical);

          removeIfExists('meta[name="robots"]');
          const robotsTag = doc.createElement("meta");
          robotsTag.setAttribute("name", "robots");
          robotsTag.content = "index,follow";
          head.appendChild(robotsTag);

          if (data.datePublished) {
            const isoDate = new Date(data.datePublished).toISOString();
            removeIfExists('meta[property="article:published_time"]');
            const publishedTag = doc.createElement("meta");
            publishedTag.setAttribute("property", "article:published_time");
            publishedTag.content = isoDate;
            head.appendChild(publishedTag);
          }

          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: data.title,
            author: data.publisher,
            datePublished: data.datePublished
              ? new Date(data.datePublished).toISOString()
              : undefined,
            description: data.meta.description,
            url: data.canonicalUrl,
            publisher: {
              "@type": "Organization",
              name: "Z-Build Order",
              logo: {
                "@type": "ImageObject",
                url: "https://zbuildorder.com/img/og-image.webp",
              },
            },
          };

          const script = doc.createElement("script");
          script.type = "application/ld+json";
          script.textContent = JSON.stringify(jsonLd);
          head.appendChild(script);
        }
      },
      { data: payload }
    );

    console.log(`✅ DOM updated using Firestore data for build ${buildId}.`);

    const metaSummary = await page.evaluate(() => {
      const textContent = (selector) =>
        document.querySelector(selector)?.textContent?.trim() || "";
      const getMetaContent = (selector) =>
        document.querySelector(selector)?.getAttribute("content") || "";

      return {
        title: document.title,
        publisher: textContent("#buildPublisher"),
        matchup: textContent("#buildMatchup"),
        description: getMetaContent('meta[name="description"]'),
        ogTitle: getMetaContent('meta[property="og:title"]'),
        ogDescription: getMetaContent('meta[property="og:description"]'),
      };
    });

    console.log(`✅ Final metadata for build ${buildId}:`, metaSummary);

    // ✅ Return final prerendered HTML
    const html = await page.content();
    return html;
  } catch (error) {
    console.error(`❌ Error during prerender for build ${buildId}:`, error);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await browser.close().catch(() => {});

    // Cleanup Chrome temp files to avoid EFAULT
    try {
      //await fs.rm("/tmp", { recursive: true, force: true });
    } catch (err) {
      console.warn("⚠️ Failed to clean /tmp:", err.message);
    }
  }
}

async function saveHtmlToStorage(buildId, html) {
  const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
  await file.save(html, {
    gzip: true,
    contentType: "text/html; charset=utf-8",
    metadata: {
      cacheControl: "public, max-age=86400, immutable",
      contentDisposition: `inline; filename="${buildId}.html"`,
    },
  });
  return file;
}

async function renderAndStoreBuild(buildId, buildDataFromEvent, attempt = 1) {
  const html = await captureBuildHtml(buildId, buildDataFromEvent);
  const analysis = analyzeHtmlForPlaceholders(html, buildId);

  if (!analysis.ready) {
    if (attempt < MAX_PRERENDER_ATTEMPTS) {
      console.warn(
        `⚠️ Attempt ${attempt} for build ${buildId} returned incomplete data. Retrying...`
      );
      return renderAndStoreBuild(buildId, buildDataFromEvent, attempt + 1);
    }

    throw new Error(
      `Failed to capture complete content for build ${buildId} after ${attempt} attempts.`
    );
  }

  await saveHtmlToStorage(buildId, html);
  return html;
}

async function getPrerenderedHtml(buildId) {
  const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
  const [exists] = await file.exists();

  if (exists) {
    const [contents] = await file.download();
    const html = contents.toString("utf-8");
    const analysis = analyzeHtmlForPlaceholders(html, buildId);

    if (analysis.ready) {
      return html;
    }

    console.warn(
      `⚠️ Re-rendering build ${buildId} because cached HTML is incomplete. Missing: ${analysis.missing.join(
        ", "
      )}`
    );

    try {
      await file.delete({ ignoreNotFound: true });
      console.log(`🧹 Removed stale prerendered HTML for build ${buildId}.`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to delete stale prerendered HTML for build ${buildId}:`,
        error.message
      );
    }
  }

  return renderAndStoreBuild(buildId);
}

// Gen 2 HTTPS function for SC2Pulse MMR fetch via Firestore-stored URL
exports.fetchPulseMmr = onRequest({ region: "us-central1" }, async (req, res) => {
  // CORS handling
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "https://zbuildorder.com",
    "https://www.zbuildorder.com",
    "https://z-build-order--dev-1osorzic.web.app",
    "http://localhost:5173",
  ];

  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { uid, url: overrideUrl } = req.body || {};
    if (!uid) {
      return res.status(400).json({ error: "Missing uid in request body." });
    }

    const userRef = admin.firestore().collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User document not found." });
    }

    const data = userSnap.data();
    const sc2PulseUrl = overrideUrl || data.sc2PulseUrl;

    if (!sc2PulseUrl) {
      return res.status(400).json({ error: "User has no sc2PulseUrl set." });
    }

    const normalized = normalizePulseUrl(sc2PulseUrl);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid SC2Pulse URL." });
    }
    const details = parsePulseUrlDetails(normalized);

    functions.logger.info(`Fetching SC2Pulse MMR for uid=${uid}`, {
      pulseId: details.id,
    });

    let byRace = {};
    let mmr = null;
    let lastStatus = null;
    let pulseName = "";

    const teamResult = await fetchRaceRatingsFromTeamsApi(details);
    byRace = { ...byRace, ...teamResult.byRace };
    mmr = teamResult.mmr;
    lastStatus = teamResult.lastStatus;
    pulseName = teamResult.pulseName || pulseName;

    if (!mmr || !pulseName) {
      const charResult = await fetchRaceRatingsFromCharacters(details);
      if (!Object.keys(byRace).length) {
        byRace = { ...byRace, ...charResult.byRace };
      }
      mmr = mmr || charResult.mmr;
      pulseName = charResult.pulseName || pulseName;
      if (!mmr && Object.values(byRace).length) {
        const valid = Object.values(byRace).filter(mmrInRange);
        if (valid.length) {
          mmr = Math.max(...valid);
        }
      }
      lastStatus = charResult.lastStatus ?? lastStatus;
    }

    if (!mmrInRange(mmr)) {
      let statusCode = 500;
      let message = "Could not parse MMR from SC2Pulse API.";
      if (lastStatus === 404) {
        statusCode = 404;
        message = "Profile not found on SC2Pulse.";
      } else if (lastStatus && lastStatus >= 500) {
        statusCode = 502;
        message = "SC2Pulse is unavailable. Please try again later.";
      }
      return res.status(statusCode).json({ error: message });
    }

    await userRef.set(
      {
        sc2PulseUrl: normalized,
        lastKnownMMRByRace: byRace,
        lastMmrUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    functions.logger.info(`MMR for uid=${uid} updated to ${mmr}`, { byRace });

    return res.status(200).json({ mmr, byRace, pulseName: pulseName || null });
  } catch (err) {
    functions.logger.error("fetchPulseMmr crashed:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

exports.submitMatchScore = onCall(
  { region: "us-central1", enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to submit match scores.");
    }

    const payload = request.data || {};
    const slug = String(payload.slug || "").trim();
    const matchId = String(payload.matchId || "").trim();
    const finalize = payload.finalize !== false;
    if (!slug || !matchId) {
      throw new HttpsError("invalid-argument", "Missing slug or matchId.");
    }

    const scoreA = payload.scoreA;
    const scoreB = payload.scoreB;
    const stateRef = firestore.collection("tournamentStates").doc(slug);
    const metaRef = firestore.collection("tournaments").doc(slug);
    let result = { updated: false };

    await firestore.runTransaction(async (tx) => {
      const stateSnap = await tx.get(stateRef);
      if (!stateSnap.exists) {
        throw new HttpsError("not-found", "Tournament state not found.");
      }
      const stateData = stateSnap.data() || {};
      if (!stateData.bracket) {
        throw new HttpsError(
          "failed-precondition",
          "Tournament bracket is not ready."
        );
      }

      const metaSnap = await tx.get(metaRef);
      const meta = metaSnap.exists ? metaSnap.data() || {} : {};
      const admin = isAdminForMeta(meta, uid);
      if (!stateData.isLive && !admin) {
        throw new HttpsError(
          "failed-precondition",
          "Tournament is not live."
        );
      }

      const bracket = deserializeBracketState(stateData.bracket);
      const lookup = getMatchLookup(bracket);
      const match = lookup.get(matchId);
      if (!match) {
        throw new HttpsError("not-found", "Match not found.");
      }

      const players = Array.isArray(stateData.players) ? stateData.players : [];
      const playersById = new Map(
        players.filter(Boolean).map((player) => [player.id, player])
      );
      const participants = resolveParticipants(match, lookup, playersById);
      const participantUids = participants
        .map((player) => player?.uid)
        .filter(Boolean);
      if (!admin && !participantUids.includes(uid)) {
        throw new HttpsError(
          "permission-denied",
          "You cannot submit scores for this match."
        );
      }

      const prevScores = Array.isArray(match.scores)
        ? [...match.scores]
        : null;
      const prevWalkover = match.walkover || null;
      const prevStatus = match.status || null;
      const prevWinnerId = match.winnerId || null;

      const updateResult = updateMatchScoreInBracket({
        bracket,
        players,
        meta,
        matchId,
        scoreA,
        scoreB,
        finalize,
      });
      if (!updateResult.updated) {
        result = { updated: false };
        return;
      }

      const matchAfter = lookup.get(matchId);
      if (!matchAfter) {
        throw new HttpsError("not-found", "Match update failed.");
      }
      const nextScores = Array.isArray(matchAfter.scores)
        ? matchAfter.scores
        : [];
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
      const shouldLog =
        finalize && (changed || completedNow || winnerChanged) && hasScore;

      const nextPayload = {
        bracket: serializeBracketState(bracket),
        lastUpdated: Date.now(),
      };

      if (shouldLog) {
        const updatedParticipants = resolveParticipants(
          matchAfter,
          lookup,
          playersById
        );
        const nameA = updatedParticipants[0]?.name || "TBD";
        const nameB = updatedParticipants[1]?.name || "TBD";
        const scoreAOut = Number.isFinite(nextScores[0]) ? nextScores[0] : 0;
        const scoreBOut = Number.isFinite(nextScores[1]) ? nextScores[1] : 0;
        const entry = {
          message: `Score submitted: ${nameA} ${scoreAOut}-${scoreBOut} ${nameB}`,
          time: Date.now(),
          type: "score",
        };
        const prevActivity = Array.isArray(stateData.activity)
          ? stateData.activity
          : [];
        nextPayload.activity = [entry, ...prevActivity].slice(0, 50);
      }

      if (updateResult.shouldClearCast && stateData.matchCasts?.[matchId]) {
        const nextMatchCasts = { ...(stateData.matchCasts || {}) };
        delete nextMatchCasts[matchId];
        nextPayload.matchCasts = nextMatchCasts;
      }

      if (!changed && !completedNow && !winnerChanged && !nextPayload.matchCasts) {
        result = { updated: false };
        return;
      }

      tx.set(stateRef, nextPayload, { merge: true });
      result = { updated: true, lastUpdated: nextPayload.lastUpdated };
    });

    return result;
  }
);

exports.ensureMatchPresenceAccess = onCall(
  { region: "us-central1", enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to view presence.");
    }

    const payload = request.data || {};
    const slug = String(payload.slug || "").trim();
    const matchId = String(payload.matchId || "").trim();
    if (!slug || !matchId) {
      throw new HttpsError("invalid-argument", "Missing slug or matchId.");
    }

    const stateRef = firestore.collection("tournamentStates").doc(slug);
    const metaRef = firestore.collection("tournaments").doc(slug);

    const [stateSnap, metaSnap] = await Promise.all([
      stateRef.get(),
      metaRef.get(),
    ]);

    if (!stateSnap.exists) {
      throw new HttpsError("not-found", "Tournament state not found.");
    }

    const stateData = stateSnap.data() || {};
    if (!stateData.bracket) {
      throw new HttpsError(
        "failed-precondition",
        "Tournament bracket is not ready."
      );
    }

    const meta = metaSnap.exists ? metaSnap.data() || {} : {};
    const bracket = deserializeBracketState(stateData.bracket);
    const lookup = getMatchLookup(bracket);
    const match = lookup.get(matchId);
    if (!match) {
      throw new HttpsError("not-found", "Match not found.");
    }

    const players = Array.isArray(stateData.players) ? stateData.players : [];
    const playersById = new Map(
      players.filter(Boolean).map((player) => [player.id, player])
    );
    const participants = resolveParticipants(match, lookup, playersById);
    const participantUids = participants
      .map((player) => player?.uid)
      .filter(Boolean);

    if (!participantUids.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "You cannot view presence for this match."
      );
    }

    const allowRef = admin
      .database()
      .ref(`tournamentPresence/${slug}/matchInfo/_allow/${matchId}/${uid}`);

    await allowRef.set(true);

    return { ok: true };
  }
);

exports.sendCasterInvite = onCall(
  { region: "us-central1", enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to invite casters.");
    }

    const payload = request.data || {};
    const targetUid = String(payload.userId || "").trim();
    const slug = String(payload.tournamentSlug || payload.slug || "").trim();
    if (!targetUid || !slug) {
      throw new HttpsError("invalid-argument", "Missing userId or slug.");
    }

    const metaSnap = await firestore.collection("tournaments").doc(slug).get();
    if (!metaSnap.exists) {
      throw new HttpsError("not-found", "Tournament not found.");
    }
    const meta = metaSnap.data() || {};
    if (!isAdminForMeta(meta, uid)) {
      throw new HttpsError(
        "permission-denied",
        "Only tournament admins can invite casters."
      );
    }

    const senderNameRaw = sanitizeText(payload.senderName || "", "");
    const senderName = senderNameRaw || "Tournament admin";
    const tournamentName = sanitizeText(meta.name || slug, "Tournament");
    const tournamentUrl = buildTournamentUrl(meta, slug);
    const username = sanitizeText(payload.username || "", "");

    const notification = {
      userId: targetUid,
      type: "caster-invite",
      tournamentSlug: slug,
      circuitSlug: meta.circuitSlug || "",
      tournamentName,
      tournamentUrl,
      senderUid: uid,
      senderName,
      senderUsername: senderNameRaw,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      title: `Caster invite: ${tournamentName}`,
      preview: `${senderName} invited you to cast ${tournamentName}.`,
      body: `${senderName} invited you to register as a caster for ${tournamentName}. Open the tournament page and request caster access.`,
      typeLabel: "Caster invite",
      username,
    };

    await firestore
      .collection("users")
      .doc(targetUid)
      .collection("notifications")
      .add(notification);

    return { ok: true };
  }
);

exports.cleanupTournamentChatOnComplete = onDocumentWritten(
  {
    document: "tournamentStates/{slug}",
    region: "us-central1",
  },
  async (event) => {
    const slug = event.params.slug;
    const afterSnap = event.data.after;
    const beforeSnap = event.data.before;
    if (!afterSnap || !afterSnap.exists) return null;
    const data = afterSnap.data() || {};
    const bracket = data.bracket;
    if (!bracket) return null;
    const completed = isTournamentComplete(bracket);
    if (!completed) return null;
    if (data.chatCleanedUpAt) return null;

    if (!data.completedAt) {
      try {
        await afterSnap.ref.set(
          { completedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to set completedAt", err);
      }
    }

    try {
      const matchesRef = firestore
        .collection("tournamentChats")
        .doc(slug)
        .collection("matches");
      await firestore.recursiveDelete(matchesRef);
      await afterSnap.ref.set(
        { chatCleanedUpAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to delete tournament chat", err);
    }

    return null;
  }
);

async function deleteTournamentChatTree(slug) {
  if (!slug) return;
  try {
    const chatDoc = firestore.collection("tournamentChats").doc(slug);
    await firestore.recursiveDelete(chatDoc);
  } catch (err) {
    console.error("Failed to delete tournament chat tree", err);
  }
}

async function deleteTournamentPresenceTree(slug) {
  if (!slug) return;
  try {
    const presenceDoc = firestore.collection("tournamentPresence").doc(slug);
    await firestore.recursiveDelete(presenceDoc);
  } catch (err) {
    console.error("Failed to delete tournament presence tree", err);
  }
}

async function deleteTournamentStateDoc(slug) {
  if (!slug) return;
  try {
    await firestore.collection("tournamentStates").doc(slug).delete();
  } catch (err) {
    console.error("Failed to delete tournament state doc", err);
  }
}

exports.cleanupTournamentOnDelete = onDocumentDeleted(
  {
    document: "tournaments/{slug}",
    region: "us-central1",
  },
  async (event) => {
    const slug = event.params.slug;
    await Promise.all([
      deleteTournamentChatTree(slug),
      deleteTournamentPresenceTree(slug),
      deleteTournamentStateDoc(slug),
    ]);
    return null;
  }
);

exports.renderNewBuild = onDocumentWritten(
  {
    document: "publishedBuilds/{buildId}",
    region: "us-central1",
    memory: "2GiB", // ⬅️ Increase from 1GiB
    timeoutSeconds: 180,
    concurrency: 1, // Optional safeguard
  },
  async (event) => {
    const buildId = event.params.buildId;
    const buildData = event.data.after?.data();

    if (!buildData) {
      console.warn(
        `❌ No build data available (deleted?), skipping prerender for ${buildId}`
      );
      return null;
    }

    console.log("🚀 Pre-rendering build:", buildId);

    try {
      await renderAndStoreBuild(buildId, buildData);
      console.log("✅ Pre-rendered HTML saved for build:", buildId);
    } catch (error) {
      console.error(`❌ Failed to pre-render build ${buildId}:`, error);
    }

    return null;
  }
);

exports.servePreRenderedBuild = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    const buildId = extractBuildIdFromRequest(req);

    if (!buildId) {
      res.status(400).send("Build ID missing.");
      return;
    }

    res.set("Vary", "User-Agent");

    const userAgent = req.headers["user-agent"] || "";

    // Compute a preferred canonical URL using Firestore data
    let preferredUrl = null;
    try {
      const data = await fetchBuildData(buildId);
      if (data) {
        const preferredPath = buildPreferredPath(buildId, data);
        const host = req.headers["x-forwarded-host"] || req.headers.host || "zbuildorder.com";
        preferredUrl = absoluteCanonical(host, preferredPath);

        // Redirect any non-canonical path to the preferred one
        if (req.path !== preferredPath) {
          res.set("Location", preferredUrl);
          res.status(301).send("Moved Permanently");
          return;
        }
      }
    } catch (e) {
      // If we cannot compute preferred, fall back to request URL
      preferredUrl = buildCanonicalUrl(req);
    }
    if (!preferredUrl) preferredUrl = buildCanonicalUrl(req);

    if (!isBot(userAgent)) {
      try {
        await sendSpaIndex(res, 200, preferredUrl);
      } catch (error) {
        console.error("❌ Failed to serve SPA fallback:", error);
        res.status(500).send("Application unavailable.");
      }
      return;
    }

    try {
      let html = await getPrerenderedHtml(buildId);
      html = addCanonicalLink(html, preferredUrl);

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300, s-maxage=600");
      res.set("Link", `<${preferredUrl}>; rel=\"canonical\"`);

      res.status(200).send(html);
    } catch (error) {
      console.error("❌ Error serving pre-rendered build:", error);
      try {
        await sendSpaIndex(res, 200, preferredUrl);
      } catch (spaError) {
        console.error("❌ Failed to fallback to SPA index:", spaError);
        res.status(500).send("Application unavailable.");
      }
    }
  }
);

// Expose sitemap HTTP function so Hosting rewrite to /sitemap.xml works
try {
  const { sitemap } = require("./sitemap");
  exports.sitemap = sitemap;
} catch (e) {
  console.warn("sitemap function not exported:", e?.message || e);
}
