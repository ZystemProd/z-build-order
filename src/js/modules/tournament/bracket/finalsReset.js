import { getMatchLookup } from "./lookup.js";

function hasRecordedScore(match) {
  if (!match) return false;
  if (match.status === "complete") return true;
  if (match.winnerId || match.walkover) return true;
  const scores = Array.isArray(match.scores) ? match.scores : [];
  return (scores[0] || 0) + (scores[1] || 0) > 0;
}

export function isFinalResetMatchId(bracket, matchId) {
  if (!bracket?.finalsReset?.id || !matchId) return false;
  return bracket.finalsReset.id === matchId;
}

export function isFinalWinnerFromLower(bracket, lookup = null) {
  const finals = bracket?.finals;
  if (!finals?.winnerId) return false;
  const localLookup = lookup || getMatchLookup(bracket || {});
  const pickFinalMatch = (bracketName) => {
    let pick = null;
    for (const match of localLookup.values()) {
      if (!match || match.bracket !== bracketName) continue;
      const round = Number(match.round) || 0;
      const index = Number(match.index) || 0;
      if (
        !pick ||
        round > (Number(pick.round) || 0) ||
        (round === (Number(pick.round) || 0) &&
          index > (Number(pick.index) || 0))
      ) {
        pick = match;
      }
    }
    return pick;
  };
  const upperFinal = pickFinalMatch("winners");
  const lowerFinal = pickFinalMatch("losers");
  if (lowerFinal?.winnerId && finals.winnerId === lowerFinal.winnerId) {
    return true;
  }
  if (upperFinal?.winnerId && finals.winnerId === upperFinal.winnerId) {
    return false;
  }
  const sources = Array.isArray(finals.sources) ? finals.sources : [];
  for (const src of sources) {
    if (!src || src.type !== "match" || src.outcome !== "winner") continue;
    const sourceMatch = localLookup.get(src.matchId);
    if (!sourceMatch) continue;
    if (sourceMatch.winnerId === finals.winnerId) {
      return sourceMatch.bracket === "losers";
    }
    // Fallback: if the finalist is resolved from the lower bracket by other means.
    if (
      sourceMatch.bracket === "losers" &&
      (sourceMatch.loserId === finals.winnerId ||
        sourceMatch.winnerId === finals.winnerId)
    ) {
      return true;
    }
  }
  return false;
}

export function isFinalResetActive(bracket, lookup = null) {
  if (!bracket?.finalsReset || !bracket?.finals) return false;
  if (!bracket.finals.winnerId) return false;
  if (finalResetHasRecordedScore(bracket)) return true;
  return isFinalWinnerFromLower(bracket, lookup);
}

export function isFinalResetClosed(bracket, lookup = null) {
  if (!bracket?.finalsReset || !bracket?.finals) return false;
  if (!bracket.finals.winnerId) return false;
  return !isFinalWinnerFromLower(bracket, lookup);
}

export function shouldCountFinalReset(bracket, lookup = null) {
  const reset = bracket?.finalsReset;
  if (!reset) return false;
  if (hasRecordedScore(reset)) return true;
  return isFinalResetActive(bracket, lookup);
}

export function finalResetHasRecordedScore(bracket) {
  return hasRecordedScore(bracket?.finalsReset);
}
