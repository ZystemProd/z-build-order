export function computePlacementsForBracket(bracket, totalPlayers) {
  const playoffTotal = Array.isArray(bracket?.playoffs?.seededIds)
    ? bracket.playoffs.seededIds.length
    : 0;
  const seedTotal = Array.isArray(bracket?.seedOrder) ? bracket.seedOrder.length : 0;
  const resolvedTotal =
    playoffTotal > 0
      ? playoffTotal
      : seedTotal > 0
      ? seedTotal
      : Number.isFinite(totalPlayers)
      ? totalPlayers
      : 0;
  if (!bracket || !Number.isFinite(resolvedTotal) || resolvedTotal <= 0) {
    return null;
  }
  const hasLosers = Array.isArray(bracket.losers) && bracket.losers.length > 0;
  if (!hasLosers) {
    const winners = bracket.winners || [];
    const totalRounds = winners.length;
    const finalsMatch = winners.slice(-1)[0]?.[0] || null;
    if (!finalsMatch?.winnerId || !finalsMatch?.loserId) {
      return null;
    }
    const placements = new Map();
    placements.set(finalsMatch.winnerId, 1);
    placements.set(finalsMatch.loserId, 2);
    winners.forEach((round, idx) => {
      const fromEnd = totalRounds - idx;
      if (fromEnd <= 1) return;
      const placement = 2 ** (fromEnd - 1) + 1;
      (round || []).forEach((match) => {
        if (match?.loserId && !placements.has(match.loserId)) {
          placements.set(match.loserId, placement);
        }
      });
    });
    return placements;
  }

  const eliminationRounds = bracket.losers || [];
  const finalsMatch = bracket.finals;
  if (!finalsMatch?.winnerId || !finalsMatch?.loserId) {
    return null;
  }
  const placements = new Map();
  placements.set(finalsMatch.winnerId, 1);
  placements.set(finalsMatch.loserId, 2);
  let placement = resolvedTotal;
  eliminationRounds.forEach((round) => {
    const losers = new Set();
    (round || []).forEach((match) => {
      if (match?.loserId && !placements.has(match.loserId)) {
        losers.add(match.loserId);
      }
    });
    if (!losers.size) return;
    const start = Math.max(1, placement - losers.size + 1);
    losers.forEach((pid) => placements.set(pid, start));
    placement = start - 1;
  });
  return placements;
}

export function computeEliminationPlacements({ bracket, totalPlayers, format } = {}) {
  if (!bracket || !totalPlayers) {
    return { error: "Bracket or players are missing." };
  }
  const normalized = (format || "").toLowerCase();
  if (normalized.includes("round robin")) {
    return { error: "Round robin placements are not supported yet." };
  }
  const placements = computePlacementsForBracket(bracket, totalPlayers);
  if (!placements) {
    return { error: "Final match is not complete yet." };
  }
  return { placements };
}
