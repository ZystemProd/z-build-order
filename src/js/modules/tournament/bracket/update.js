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

function recomputeMatchOutcome(match, lookup) {
  const bestOf = getBestOfForMatch(match) || 1;
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const srcA = match.sources?.[0] || null;
  const srcB = match.sources?.[1] || null;
  const idA = getParticipantIdFromSource(srcA, lookup);
  const idB = getParticipantIdFromSource(srcB, lookup);

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

function cascadeMatchOutcomeUpdates(startMatchId, lookup) {
  const dependencies = buildDependencyMap(lookup);
  const queue = [startMatchId];
  while (queue.length) {
    const sourceId = queue.shift();
    const dependents = dependencies.get(sourceId);
    if (!dependents) continue;
    for (const depId of dependents) {
      const match = lookup.get(depId);
      if (!match) continue;
      const changed = recomputeMatchOutcome(match, lookup);
      if (changed) queue.push(depId);
    }
  }
}

/**
 * Update a match score, determine winner/loser, and persist via the provided callbacks.
 * @param {string} matchId
 * @param {number|string} scoreA
 * @param {number|string} scoreB
 * @param {{ saveState: Function, renderAll: Function, finalize?: boolean }} deps
 */
export function updateMatchScore(
  matchId,
  scoreA,
  scoreB,
  { saveState, renderAll, finalize = true } = {}
) {
  if (!state?.bracket || !matchId) return;
  const lookup = getMatchLookup(state.bracket);
  const match = lookup.get(matchId);
  if (!match) return;

  const bestOf = getBestOfForMatch(match) || 1;
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const isWalkoverA = String(scoreA).toUpperCase() === "W";
  const isWalkoverB = String(scoreB).toUpperCase() === "W";
  const srcA = match.sources?.[0] || null;
  const srcB = match.sources?.[1] || null;
  const idA = getParticipantIdFromSource(srcA, lookup);
  const idB = getParticipantIdFromSource(srcB, lookup);

  let walkover = null;
  let valA = 0;
  let valB = 0;
  let winnerId = null;
  let loserId = null;

  if (isWalkoverA && !isWalkoverB) {
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
    cascadeMatchOutcomeUpdates(matchId, lookup);
  }

  const shouldClearCast = finalize && match.status === "complete";
  if (shouldClearCast && state.matchCasts?.[matchId]) {
    const nextMatchCasts = { ...(state.matchCasts || {}) };
    delete nextMatchCasts[matchId];
    saveState?.({ bracket: state.bracket, matchCasts: nextMatchCasts });
  } else {
    saveState?.({ bracket: state.bracket });
  }
  renderAll?.();
}
