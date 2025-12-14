import { defaultBestOf, currentTournamentMeta, state } from "../state.js";

export function sanitizeUrl(url) {
  if (!url) return "";
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const safe = new URL(normalized);
    if (!["http:", "https:"].includes(safe.protocol))
      throw new Error("Invalid protocol");
    return safe.toString();
  } catch (_) {
    return "";
  }
}

export function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseMatchNumber(id) {
  if (!id) return null;
  const matchPart = id.match(/M(\d+)/i);
  if (matchPart && matchPart[1]) return Number(matchPart[1]);
  const trailingDigits = id.match(/(\d+)/);
  return trailingDigits && trailingDigits[1] ? Number(trailingDigits[1]) : null;
}

export function raceClassName(race) {
  const r = (race || "").toString().toLowerCase();
  if (r.startsWith("z")) return "race-zerg";
  if (r.startsWith("p")) return "race-protoss";
  if (r.startsWith("t")) return "race-terran";
  if (r.startsWith("r")) return "race-random";
  return "race-unknown";
}

export function getSelectValue(match, idx, bestOf = 3) {
  if (!match) return 0;
  const needed = Math.max(1, Math.ceil((bestOf || 1) / 2));
  if (match.walkover === "a") {
    return idx === 0 ? "W" : String(match.scores?.[1] ?? needed);
  }
  if (match.walkover === "b") {
    return idx === 1 ? "W" : String(match.scores?.[0] ?? needed);
  }
  return match.scores?.[idx] ?? 0;
}

export function getBestOfForMatch(match) {
  if (Number.isFinite(match?.bestOf) && match.bestOf > 0) {
    return match.bestOf;
  }
  const bestOf = currentTournamentMeta?.bestOf || defaultBestOf;
  const winnersRounds = state.bracket?.winners?.length || 0;

  if (match.bracket === "winners") {
    if (match.round === winnersRounds)
      return bestOf.final ?? defaultBestOf.final;
    if (match.round === winnersRounds - 1)
      return bestOf.semi ?? defaultBestOf.semi;
    if (match.round === winnersRounds - 2)
      return bestOf.quarter ?? defaultBestOf.quarter;
    return bestOf.upper ?? defaultBestOf.upper;
  }

  if (match.bracket === "losers") {
    const losersRounds = state.bracket?.losers?.length || 0;
    if (match.round === losersRounds)
      return (
        bestOf.lowerFinal ??
        bestOf.lower ??
        defaultBestOf.lowerFinal ??
        defaultBestOf.lower
      );
    if (match.round === losersRounds - 1)
      return (
        bestOf.lowerSemi ??
        bestOf.lower ??
        defaultBestOf.lowerSemi ??
        defaultBestOf.lower
      );
    return bestOf.lower ?? defaultBestOf.lower;
  }

  if (match.bracket === "group") {
    return bestOf.upper ?? defaultBestOf.upper;
  }

  return bestOf.final ?? defaultBestOf.final;
}
