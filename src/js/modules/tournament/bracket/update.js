import { state } from "../state.js";
import { getMatchLookup } from "./lookup.js";
import { getBestOfForMatch } from "./renderUtils.js";

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

/**
 * Update a match score, determine winner/loser, and persist via the provided callbacks.
 * @param {string} matchId
 * @param {number|string} scoreA
 * @param {number|string} scoreB
 * @param {{ saveState: Function, renderAll: Function }} deps
 */
export function updateMatchScore(matchId, scoreA, scoreB, { saveState, renderAll }) {
  if (!state?.bracket || !matchId) return;
  const lookup = getMatchLookup(state.bracket);
  const match = lookup.get(matchId);
  if (!match) return;

  const a = Number(scoreA);
  const b = Number(scoreB);
  const valA = Number.isFinite(a) ? a : 0;
  const valB = Number.isFinite(b) ? b : 0;
  const bestOf = getBestOfForMatch(match) || 1;
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const srcA = match.sources?.[0] || null;
  const srcB = match.sources?.[1] || null;
  const idA = getParticipantIdFromSource(srcA, lookup);
  const idB = getParticipantIdFromSource(srcB, lookup);

  let winnerId = null;
  let loserId = null;
  if (valA !== valB && Math.max(valA, valB) >= needed) {
    if (valA > valB) {
      winnerId = idA;
      loserId = idB;
    } else {
      winnerId = idB;
      loserId = idA;
    }
  }

  match.scores = [valA, valB];
  match.walkover = null;
  match.winnerId = winnerId || null;
  match.loserId = loserId || null;
  match.status = winnerId ? "complete" : "pending";

  saveState?.({ bracket: state.bracket });
  renderAll?.();
}
