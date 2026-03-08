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

export function getSelectValue(match, idx, bestOf = 3, participants = null) {
  if (!match) return 0;
  const needed = Math.max(1, Math.ceil((bestOf || 1) / 2));
  if (match.walkover === "a") {
    return idx === 0 ? "W" : String(match.scores?.[1] ?? needed);
  }
  if (match.walkover === "b") {
    return idx === 1 ? "W" : String(match.scores?.[0] ?? needed);
  }
  if (participants) {
    const [pA, pB] = participants;
    if (pA?.forfeit && !pB) {
      return idx === 0 ? "W" : "0";
    }
    if (pB?.forfeit && !pA) {
      return idx === 1 ? "W" : "0";
    }
  }
  return match.scores?.[idx] ?? 0;
}

function resolveRoundPosition(match) {
  if (!match || !state?.bracket) return null;
  const rounds =
    match.bracket === "winners"
      ? state.bracket?.winners
      : match.bracket === "losers"
        ? state.bracket?.losers
        : null;
  if (!Array.isArray(rounds)) return null;
  const matchId = match?.id || null;
  for (let i = 0; i < rounds.length; i += 1) {
    const round = Array.isArray(rounds[i]) ? rounds[i] : [];
    const found = round.some(
      (entry) => entry === match || (matchId && entry?.id === matchId),
    );
    if (found) {
      return { round: i + 1, total: rounds.length };
    }
  }
  return null;
}

export function getBestOfForMatch(match) {
  if (!match) return defaultBestOf.final ?? 1;
  if (match?.bracket === "group") {
    const groupBestOf = Number(currentTournamentMeta?.roundRobin?.bestOf);
    if (Number.isFinite(groupBestOf) && groupBestOf > 0) {
      return groupBestOf;
    }
    if (Number.isFinite(match?.bestOf) && match.bestOf > 0) {
      return match.bestOf;
    }
  }
  const isFinalReset =
    match?.isReset || state?.bracket?.finalsReset?.id === match?.id;
  const bestOf = currentTournamentMeta?.bestOf || defaultBestOf;

  if (match.bracket === "winners") {
    const resolvedRound = resolveRoundPosition(match);
    const winnersRounds = resolvedRound?.total || state.bracket?.winners?.length || 0;
    const roundNumber = resolvedRound?.round ?? match.round;
    if (roundNumber === winnersRounds) {
      if (state.bracket?.finals) {
        return (
          bestOf.upperFinal ??
          bestOf.final ??
          defaultBestOf.upperFinal ??
          defaultBestOf.final
        );
      }
      return bestOf.final ?? defaultBestOf.final;
    }
    if (roundNumber === winnersRounds - 1)
      return bestOf.semi ?? defaultBestOf.semi;
    if (roundNumber === winnersRounds - 2)
      return bestOf.quarter ?? defaultBestOf.quarter;
    return bestOf.upper ?? defaultBestOf.upper;
  }

  if (match.bracket === "losers") {
    const resolvedRound = resolveRoundPosition(match);
    const losersRounds = resolvedRound?.total || state.bracket?.losers?.length || 0;
    const roundNumber = resolvedRound?.round ?? match.round;
    if (roundNumber === losersRounds)
      return (
        bestOf.lowerFinal ??
        bestOf.lower ??
        defaultBestOf.lowerFinal ??
        defaultBestOf.lower
      );
    if (roundNumber === losersRounds - 1)
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

  if (isFinalReset) {
    return (
      bestOf.finalReset ??
      bestOf.final ??
      defaultBestOf.finalReset ??
      defaultBestOf.final
    );
  }
  return bestOf.final ?? defaultBestOf.final;
}
