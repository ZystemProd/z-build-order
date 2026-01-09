import { getBestOfForMatch } from "./renderUtils.js";
import { resolveParticipants } from "./lookup.js";

// Pure helper to compute round-robin group standings
export function computeGroupStandings(bracket, group, playersById, lookup) {
  const stats = new Map();
  const ensure = (pid) => {
    if (!pid) return null;
    if (!stats.has(pid)) {
      stats.set(pid, {
        playerId: pid,
        wins: 0,
        losses: 0,
        mapFor: 0,
        mapAgainst: 0,
      });
    }
    return stats.get(pid);
  };

  const matches = group?.matches || [];
  matches.forEach((gm) => {
    const match = lookup?.get(gm.id) || gm;
    const [pAObj, pBObj] = resolveParticipants(match, lookup, playersById);
    const pA = pAObj?.id || null;
    const pB = pBObj?.id || null;
    if (!pA || !pB) return;

    const a = Number(match?.scores?.[0]);
    const b = Number(match?.scores?.[1]);
    const validA = Number.isFinite(a) ? a : 0;
    const validB = Number.isFinite(b) ? b : 0;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return;

    const sa = ensure(pA);
    const sb = ensure(pB);
    if (!sa || !sb) return;

    sa.mapFor += validA;
    sa.mapAgainst += validB;
    sb.mapFor += validB;
    sb.mapAgainst += validA;

    if (validA === validB) return;
    const bestOf = getBestOfForMatch(match) || 1;
    const needed = Math.max(1, Math.ceil(bestOf / 2));
    if (Math.max(validA, validB) < needed) return;

    const winnerId = match?.winnerId
      ? match.winnerId
      : validA > validB
      ? pA
      : pB;
    const loserId = winnerId === pA ? pB : pA;
    const winStat = winnerId === pA ? sa : sb;
    const lossStat = loserId === pA ? sa : sb;
    winStat.wins += 1;
    lossStat.losses += 1;
  });

  // Ensure every player in the group appears, even with no matches yet
  (group?.playerIds || []).forEach((pid) => ensure(pid));

  const rows = Array.from(stats.values()).map((r) => ({
    ...r,
    mapDiff: (r.mapFor || 0) - (r.mapAgainst || 0),
  }));

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (b.mapDiff !== a.mapDiff) return b.mapDiff - a.mapDiff;
    if (b.mapFor !== a.mapFor) return b.mapFor - a.mapFor;
    const nameA = playersById.get(a.playerId)?.name || "";
    const nameB = playersById.get(b.playerId)?.name || "";
    return nameA.localeCompare(nameB);
  });

  return rows;
}
