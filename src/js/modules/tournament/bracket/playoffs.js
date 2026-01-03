import { buildEliminationBracket, normalizeRoundRobinSettings } from "./build.js";
import { defaultRoundRobinSettings, currentTournamentMeta, state } from "../state.js";
import { computeGroupStandings } from "./standings.js";

export function ensureRoundRobinPlayoffs(bracket, playersById, lookup) {
  if (!bracket || !Array.isArray(bracket.groups)) return false;
  const rrSettings = normalizeRoundRobinSettings(
    currentTournamentMeta?.roundRobin || defaultRoundRobinSettings
  );
  const advance = Math.max(0, rrSettings.advancePerGroup || 0);
  if (!advance) return false;

  const groups = bracket.groups || [];
  const standingsByGroup = groups.map((g) =>
    computeGroupStandings(bracket, g, playersById, lookup)
  );
  const allComplete = groups.every((g) =>
    (g.matches || []).every((m) => (lookup?.get(m.id) || m)?.winnerId)
  );
  if (!allComplete) return false;

  const advancingIds = [];
  standingsByGroup.forEach((rows) => {
    rows.slice(0, advance).forEach((r) => advancingIds.push(r.playerId));
  });
  if (!advancingIds.length) return false;

  const existingSeeds = Array.isArray(bracket.playoffs?.seededIds)
    ? bracket.playoffs.seededIds
    : null;
  const sameSeeds =
    existingSeeds &&
    existingSeeds.length === advancingIds.length &&
    existingSeeds.every((id, idx) => id === advancingIds[idx]);
  const hasPlayoffs =
    (bracket.winners && bracket.winners.length) ||
    (bracket.losers && bracket.losers.length) ||
    bracket.finals;
  const nextMode = rrSettings.playoffs || "None";
  if (sameSeeds && hasPlayoffs && (bracket.playoffs?.mode || "") === nextMode) {
    return false;
  }

  const advancingPlayers = (state.players || []).filter((p) =>
    advancingIds.includes(p.id)
  );
  advancingPlayers.forEach((p, idx) => {
    p.seed = idx + 1;
  });

  const includeLosers =
    (rrSettings.playoffs || "").toLowerCase().includes("double");
  const playoffs = buildEliminationBracket(advancingPlayers, { includeLosers });
  bracket.playoffs = {
    ...(bracket.playoffs || {}),
    mode: nextMode,
    seededIds: advancingIds,
  };
  bracket.winners = playoffs.winners;
  bracket.losers = playoffs.losers;
  bracket.finals = playoffs.finals;
  if (state.matchVetoes) {
    const resetIds = new Set();
    playoffs.winners?.flat().forEach((m) => m?.id && resetIds.add(m.id));
    playoffs.losers?.flat().forEach((m) => m?.id && resetIds.add(m.id));
    if (playoffs.finals?.id) resetIds.add(playoffs.finals.id);
    resetIds.forEach((id) => {
      delete state.matchVetoes[id];
    });
  }
  return true;
}
