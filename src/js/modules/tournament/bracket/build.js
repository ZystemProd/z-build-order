import {
  defaultBestOf,
  defaultRoundRobinSettings,
  currentTournamentMeta,
} from "../state.js";
import {
  playerSource,
  winnerSource,
  loserSource,
  safeWinnerSource,
  safeLoserSource,
} from "./lookup.js";
import { WINNERS_TEMPLATES, LOSERS_TEMPLATES } from "../../bracketTemplates.js";

export function applySeeding(players) {
  const seeded = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.mmr !== a.mmr) return b.mmr - a.mmr;
    return a.name.localeCompare(b.name);
  });
  seeded.forEach((p, idx) => (p.seed = idx + 1));
  return seeded;
}

export function buildBracket(players, tournamentMeta = {}, isRoundRobinFormat) {
  const format = tournamentMeta?.format || "Double Elimination";
  if (isRoundRobinFormat?.(format)) {
    const rr = normalizeRoundRobinSettings(
      tournamentMeta.roundRobin || defaultRoundRobinSettings
    );
    return buildRoundRobinBracket(players, rr);
  }
  const includeLosers = !format.toLowerCase().startsWith("single");
  return buildEliminationBracket(players, { includeLosers });
}

export function buildEliminationBracket(players, { includeLosers = true } = {}) {
  const seedOrder = players.map((p) => p.id);
  const total = players.length;

  if (!total) {
    return { winners: [], losers: [], finals: null, seedOrder };
  }

  const seedMap = new Map(players.map((p) => [p.seed, p]));
  const baseSize = computeBaseSize(total);
  const numPlayIns = Math.max(0, total - baseSize);
  const winnersTemplate = WINNERS_TEMPLATES[total];
  if (winnersTemplate) {
    const winners = buildWinnersFromTemplate(winnersTemplate, seedMap);
    const losers = includeLosers
      ? buildLosersBracket(winners, baseSize, total, numPlayIns)
      : [];
    const finals =
      includeLosers && losers.length
        ? createMatch(
            "finals",
            1,
            1,
            winnerSource(winners[winners.length - 1][0]),
            winnerSource(losers[losers.length - 1][0])
          )
        : null;
    return { winners, losers, finals, seedOrder };
  }

  if (total <= 4) {
    const seedPositions = generateSeedPositions(baseSize);
    const placedPlayers = seedPositions.map(
      (seed) => seedMap.get(seed) || null
    );

    const winners = [];
    let current = placedPlayers.map((p) => playerSource(p));
    let roundNumber = 1;

    while (current.length > 1) {
      const next = [];
      const round = [];
      for (let i = 0; i < current.length; i += 2) {
        const srcA = current[i] || null;
        const srcB = current[i + 1] || null;

        if (!srcA && !srcB) {
          next.push(null);
          continue;
        }
        if (srcA && !srcB) {
          next.push(srcA);
          continue;
        }
        if (!srcA && srcB) {
          next.push(srcB);
          continue;
        }

        const match = createMatch(
          "winners",
          roundNumber,
          round.length + 1,
          srcA,
          srcB
        );
        round.push(match);
        next.push(winnerSource(match));
      }
      if (round.length) winners.push(round);
      current = next;
      roundNumber++;
    }

    const losers = includeLosers
      ? buildLosersBracket(winners, baseSize, total, numPlayIns)
      : [];
    const finals =
      includeLosers && losers.length
        ? createMatch(
            "finals",
            1,
            1,
            winnerSource(winners[winners.length - 1][0]),
            winnerSource(losers[losers.length - 1][0])
          )
        : null;

    return { winners, losers, finals, seedOrder };
  }

  const seedPositions = generateSeedPositions(baseSize);

  const winners = [];
  const seedToSource = new Map();
  let roundNumber = 1;

  if (numPlayIns > 0) {
    const playInRound = [];

    for (let i = 0; i < numPlayIns; i++) {
      const highSeed = baseSize - i;
      const lowSeed = baseSize + 1 + i;

      const playerHigh = seedMap.get(highSeed) || null;
      const playerLow = seedMap.get(lowSeed) || null;

      const srcA = playerSource(playerHigh);
      const srcB = playerSource(playerLow);

      const match = createMatch(
        "winners",
        roundNumber,
        playInRound.length + 1,
        srcA,
        srcB
      );
      playInRound.push(match);

      seedToSource.set(highSeed, winnerSource(match));
    }

    if (playInRound.length) {
      winners.push(playInRound);
    }
    roundNumber++;
  }

  for (let seed = 1; seed <= baseSize; seed++) {
    if (seedToSource.has(seed)) continue;
    const p = seedMap.get(seed) || null;
    seedToSource.set(seed, playerSource(p));
  }

  let current = seedPositions.map((seed) => seedToSource.get(seed) || null);

  while (current.length > 1) {
    const next = [];
    const round = [];
    for (let i = 0; i < current.length; i += 2) {
      const srcA = current[i] || null;
      const srcB = current[i + 1] || null;

      if (!srcA && !srcB) {
        next.push(null);
        continue;
      }
      if (srcA && !srcB) {
        next.push(srcA);
        continue;
      }
      if (!srcA && srcB) {
        next.push(srcB);
        continue;
      }

      const match = createMatch(
        "winners",
        roundNumber,
        round.length + 1,
        srcA,
        srcB
      );
      round.push(match);
      next.push(winnerSource(match));
    }

    if (round.length) {
      winners.push(round);
    }
    current = next;
    roundNumber++;
  }

  const losers = buildLosersBracket(winners, baseSize, total, numPlayIns);

  const finals = createMatch(
    "finals",
    1,
    1,
    winnerSource(winners[winners.length - 1][0]),
    losers.length ? winnerSource(losers[losers.length - 1][0]) : null
  );

  return { winners, losers, finals, seedOrder };
}

export function buildRoundRobinBracket(players, rrSettings) {
  const settings = normalizeRoundRobinSettings(rrSettings);
  const playerCount = players.length;
  const groupCount = Math.min(
    Math.max(1, settings.groups),
    Math.max(1, playerCount)
  );
  const bestOfGroup = settings.bestOf ?? defaultRoundRobinSettings.bestOf ?? 1;

  const groups = createRoundRobinGroups(players, groupCount).map(
    (group, idx) => {
      const labelChar = String.fromCharCode(65 + (idx % 26));
      const name =
        groupCount > 26 ? `Group ${idx + 1}` : `Group ${labelChar}`;
      const matches = createRoundRobinMatches(
        { ...group, id: `G${idx + 1}`, name },
        bestOfGroup
      );
      return {
        id: `G${idx + 1}`,
        name,
        playerIds: group.playerIds,
        matches,
      };
    }
  );

  return {
    groups,
    roundRobin: settings,
    playoffs: { mode: settings.playoffs },
    winners: [],
    losers: [],
    finals: null,
    seedOrder: players.map((p) => p.id),
  };
}

export function createRoundRobinGroups(players, groupCount) {
  const total = players.length;
  const groups = Array.from({ length: groupCount }, () => ({
    playerIds: [],
  }));
  if (!total) return groups;

  const base = Math.floor(total / groupCount);
  let remainder = total % groupCount;
  const targetSizes = groups.map(() => {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    return base + extra;
  });

  let idx = 0;
  players.forEach((player) => {
    let attempts = 0;
    while (attempts < groupCount) {
      if (targetSizes[idx] > groups[idx].playerIds.length) {
        groups[idx].playerIds.push(player.id);
        idx = (idx + 1) % groupCount;
        break;
      }
      idx = (idx + 1) % groupCount;
      attempts++;
    }
  });

  return groups;
}

export function createRoundRobinMatches(group, bestOf) {
  const matches = [];
  const ids = group.playerIds || [];
  let counter = 1;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const match = createMatch(
        "group",
        1,
        counter++,
        { type: "player", playerId: ids[i] },
        { type: "player", playerId: ids[j] },
        bestOf
      );
      match.id = `${group.id}-M${counter - 1}`;
      match.groupId = group.id;
      matches.push(match);
    }
  }
  return matches;
}

export function buildLosersBracket(
  winners,
  baseSize,
  totalPlayers = baseSize,
  numPlayInsHint = null
) {
  if (!winners.length) return [];

  const firstRoundMatches = winners[0]?.length || 0;
  let numPlayIns =
    numPlayInsHint !== null && Number.isFinite(numPlayInsHint)
      ? Math.max(0, numPlayInsHint)
      : 0;

  if (baseSize && firstRoundMatches && numPlayIns === 0) {
    if (baseSize === firstRoundMatches * 2) {
      numPlayIns = 0;
    } else {
      const coreMatches = baseSize / 2;
      numPlayIns = Math.max(0, firstRoundMatches - coreMatches);
    }
  }

  const normalizedTotal = Number.isFinite(totalPlayers)
    ? Math.max(0, totalPlayers)
    : baseSize;
  const numByes = Math.max(0, baseSize - normalizedTotal);
  if (numPlayIns === 0 && normalizedTotal > baseSize) {
    numPlayIns = normalizedTotal - baseSize;
  }

  let template =
    numByes > 0 ? LOSERS_TEMPLATES[baseSize]?.byes?.[numByes] : null;

  if (!template) {
    template = LOSERS_TEMPLATES[baseSize]?.[numPlayIns];
  }

  if (!template && normalizedTotal < baseSize) {
    const byeCount = baseSize - normalizedTotal;
    template = LOSERS_TEMPLATES[baseSize]?.byes?.[byeCount] || null;
  }

  if (template) {
    return buildLosersFromTemplate(winners, template);
  }

  return buildGenericLosers(winners);
}

function buildLosersFromTemplate(winners, template) {
  const losers = [];
  const lbMatches = [];

  const resolveRef = (ref) => {
    if (!ref) return null;
    const { from, r, m, res } = ref;
    let match;
    if (from === "W") {
      match = winners[r]?.[m];
    } else {
      match = lbMatches[r]?.[m];
    }
    if (!match) return null;
    return res === "L" ? safeLoserSource(match) : safeWinnerSource(match);
  };

  template.forEach((roundTpl, rIndex) => {
    const round = [];
    lbMatches[rIndex] = lbMatches[rIndex] || [];
    roundTpl.forEach((mtpl, mIndex) => {
      const srcA = resolveRef(mtpl.a);
      const srcB = resolveRef(mtpl.b);
      const match = createMatch("losers", rIndex + 1, mIndex + 1, srcA, srcB);
      // Ensure lower bracket matches are tightly packed vertically.
      // Use explicit template slot when provided; otherwise default to dense ordering by index.
      if (Number.isFinite(mtpl.slot)) {
        match.displaySlot = mtpl.slot;
      } else {
        match.displaySlot = mIndex;
      }
      round.push(match);
      lbMatches[rIndex][mIndex] = match;
    });
    if (round.length) losers.push(round);
  });

  return losers;
}

function buildGenericLosers(winners) {
  if (!winners.length) return [];
  const losers = [];

  const collectLosers = (round) =>
    (round || []).map((m) => safeLoserSource(m)).filter(Boolean);

  const pairAll = (sources, roundNum) => {
    const next = [];
    const round = [];
    for (let i = 0; i < sources.length; i += 2) {
      const a = sources[i] || null;
      const b = sources[i + 1] || null;
      if (!a && !b) continue;
      if (a && !b) {
        next.push(a);
        continue;
      }
      if (!a && b) {
        next.push(b);
        continue;
      }
      const match = createMatch("losers", roundNum, round.length + 1, a, b);
      round.push(match);
      next.push(winnerSource(match));
    }
    if (round.length) losers.push(round);
    return next;
  };

  let roundNum = 1;
  let carry = collectLosers(winners[0]);
  if (carry.length) {
    carry = pairAll(carry, roundNum++);
  }

  for (let w = 1; w < winners.length; w++) {
    const dropIns = collectLosers(winners[w]);
    const minorEntrants = [...carry, ...dropIns];
    if (minorEntrants.length) {
      carry = pairAll(minorEntrants, roundNum++);
    }
    if (carry.length > 2) {
      carry = pairAll(carry, roundNum++);
    }
  }

  while (carry.length > 1) {
    carry = pairAll(carry, roundNum++);
  }

  return losers;
}

export function normalizePlayoffMode(raw) {
  const val = (raw || "").toLowerCase();
  if (val.startsWith("double")) return "Double Elimination";
  if (val.startsWith("single")) return "Single Elimination";
  if (val.startsWith("none")) return "None";
  return defaultRoundRobinSettings.playoffs;
}

export function normalizeRoundRobinSettings(raw = {}) {
  const groups = Math.max(
    1,
    Number(raw.groups || raw.numGroups || defaultRoundRobinSettings.groups) || 1
  );
  const advancePerGroup = Math.max(
    0,
    Number(
      raw.advancePerGroup ||
        raw.advancing ||
        defaultRoundRobinSettings.advancePerGroup
    ) || 0
  );
  const playoffs = normalizePlayoffMode(
    raw.playoffs || raw.playoffMode || defaultRoundRobinSettings.playoffs
  );
  const bestOf =
    Number(raw.bestOf || raw.groupBestOf || defaultRoundRobinSettings.bestOf) || 1;
  return { groups, advancePerGroup, playoffs, bestOf };
}

export function generateSeedPositions(size) {
  if (!Number.isFinite(size) || size < 1) return [];
  if (size === 1) return [1];
  if (size === 2) return [1, 2];

  function buildSeeds(n) {
    if (n === 1) return [1];
    if (n === 2) return [1, 2];
    const half = buildSeeds(n / 2);
    const result = [];
    half.forEach((seed) => {
      result.push(seed);
      result.push(n + 1 - seed);
    });
    return result;
  }

  if ((size & (size - 1)) !== 0) {
    // Fallback: fill up to next power of two and then slice
    const nextPow = pow2(size);
    const seeds = buildSeeds(nextPow);
    return seeds.slice(0, size);
  }

  return buildSeeds(size);
}

export function pow2(n) {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

export function computeBaseSize(total) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (total <= 4) {
    return Math.max(2, pow2(total));
  }
  // start.gg-style: 31 entrants uses a 32-slot core (single bye), not 16-slot core with 15 play-ins.
  if (total === 31) {
    return 32;
  }
  // For 17-31 entrants we use a 16-slot core with play-ins (start.gg-style),
  // not a 32-slot core with many byes.
  if (total > 16 && total < 32) {
    return 16;
  }
  const lowerPow = 1 << Math.floor(Math.log2(total));
  const upperPow = lowerPow * 2;
  const lowerGap = total - lowerPow;
  const upperGap = upperPow - total;
  if ([12, 13, 14, 15].includes(total)) {
    return lowerPow;
  }
  // When exactly between two powers of two, prefer the smaller base size
  // so brackets like 24 players use a 16-slot core with play-ins instead of 32 with many byes.
  return lowerGap <= upperGap ? lowerPow : upperPow;
}

export function buildWinnersFromTemplate(template, seedMap) {
  const rounds = [];
  template.forEach((roundTpl, rIdx) => {
    const matches = [];
    roundTpl.forEach((mtpl, mIdx) => {
      const srcA = resolveTemplateSource(mtpl.a, rounds, seedMap);
      const srcB = resolveTemplateSource(mtpl.b, rounds, seedMap);
      const match = createMatch(
        "winners",
        rIdx + 1,
        matches.length + 1,
        srcA,
        srcB
      );
      if (Number.isFinite(mtpl.slot)) {
        match.displaySlot = mtpl.slot;
      }
      matches.push(match);
    });
    rounds.push(matches);
  });
  return rounds;
}

function resolveTemplateSource(source, rounds, seedMap) {
  if (!source) return null;
  if (source.type === "player") {
    const player = seedMap.get(source.seed);
    return playerSource(player);
  }
  if (source.type === "match") {
    const match = rounds[source.round]?.[source.match];
    if (!match) return null;
    return source.outcome === "loser"
      ? loserSource(match)
      : winnerSource(match);
  }
  return null;
}

export function createMatch(bracket, round, index, sourceA, sourceB, bestOf = null) {
  return {
    id: `${bracket[0].toUpperCase()}${round}-M${index}`,
    bracket,
    round,
    index,
    sources: [sourceA, sourceB],
    scores: [0, 0],
    status: "pending",
    walkover: null,
    winnerId: null,
    loserId: null,
    updatedAt: null,
    bestOf: bestOf || null,
  };
}
