import { state } from "../state.js";
import { getMatchLookup } from "./lookup.js";
import { getBestOfForMatch } from "./renderUtils.js";

function isForfeitPlayer(id) {
  if (!id) return false;
  return Boolean((state.players || []).find((p) => p && p.id === id)?.forfeit);
}

function getSeedRank(id) {
  if (!id) return Number.POSITIVE_INFINITY;
  const players = state.players || [];
  const player = players.find((p) => p && p.id === id);
  if (!player) return Number.POSITIVE_INFINITY;
  if (Number.isFinite(player.seed)) return player.seed;
  const idx = players.findIndex((p) => p && p.id === id);
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
  const forfeitA = isForfeitPlayer(idA);
  const forfeitB = isForfeitPlayer(idB);
  const manualResult = hasManualResult(match);

  if (idA && idB && !manualResult && (forfeitA || forfeitB)) {
    if (forfeitA && !forfeitB) {
      match.walkover = "a";
      match.scores = [0, needed];
    } else if (forfeitB && !forfeitA) {
      match.walkover = "b";
      match.scores = [needed, 0];
    } else {
      const seedA = getSeedRank(idA);
      const seedB = getSeedRank(idB);
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
  const forfeitA = isForfeitPlayer(idA);
  const forfeitB = isForfeitPlayer(idB);
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
      const seedA = getSeedRank(idA);
      const seedB = getSeedRank(idB);
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

export function applyForfeitWalkovers({ saveState, renderAll } = {}) {
  if (!state?.bracket) return;
  const lookup = getMatchLookup(state.bracket);
  const changedMatches = [];
  for (const match of lookup.values()) {
    if (!match) continue;
    const prevWalkover = match.walkover || null;
    const prevWinnerId = match.winnerId || null;
    const prevStatus = match.status || null;
    const changed = recomputeMatchOutcome(match, lookup);
    const walkoverChanged = prevWalkover !== (match.walkover || null);
    const winnerChanged = prevWinnerId !== match.winnerId;
    const statusChanged = prevStatus !== match.status;
    if (changed || walkoverChanged || winnerChanged || statusChanged) {
      changedMatches.push(match.id);
    }
  }

  changedMatches.forEach((id) => {
    cascadeMatchOutcomeUpdates(id, lookup);
  });

  if (changedMatches.length) {
    saveState?.({ bracket: state.bracket });
    renderAll?.();
  }
}
