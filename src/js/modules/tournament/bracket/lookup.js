export function playerSource(player) {
  if (!player) return null;
  return { type: "player", playerId: player.id };
}

export function winnerSource(match) {
  if (!match) return null;
  return { type: "match", matchId: match.id, outcome: "winner" };
}

export function loserSource(match) {
  if (!match) return null;
  return { type: "match", matchId: match.id, outcome: "loser" };
}

export function safeWinnerSource(match) {
  if (!match) return null;
  return winnerSource(match);
}

export function safeLoserSource(match) {
  if (!match) return null;
  const sources = Array.isArray(match.sources) ? match.sources : [];
  const nonNullSources = sources.filter(Boolean).length;
  const hasRealLoser = nonNullSources >= 2 || !!match.loserId;
  if (!hasRealLoser) return null;
  return loserSource(match);
}

export function getAllMatches(bracket) {
  if (!bracket) return [];
  const { winners = [], losers = [], finals, groups = [] } = bracket || {};
  const flattened = [
    ...groups.flatMap((g) => g.matches || []),
    ...winners.flat(),
    ...losers.flat(),
  ];
  if (finals) flattened.push(finals);
  return flattened;
}

export function getMatchLookup(bracket) {
  const map = new Map();
  getAllMatches(bracket).forEach((m) => map.set(m.id, m));
  return map;
}

export function getMatchById(bracket, matchId) {
  if (!matchId) return null;
  return getMatchLookup(bracket).get(matchId) || null;
}

export function resolveParticipants(match, lookup, playersById) {
  return match.sources.map((src) => {
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
