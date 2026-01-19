import { buildBracket } from "../src/js/modules/tournament/bracket/build.js";
import {
  getAllMatches,
  getMatchLookup,
  resolveParticipants,
} from "../src/js/modules/tournament/bracket/lookup.js";
import { getBestOfForMatch } from "../src/js/modules/tournament/bracket/renderUtils.js";
import { updateMatchScore } from "../src/js/modules/tournament/bracket/update.js";
import { broadcast, state } from "../src/js/modules/tournament/state.js";

function parseArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function makePlayers(count) {
  return Array.from({ length: count }, (_, idx) => ({
    id: `P${idx + 1}`,
    name: `Player ${idx + 1}`,
    points: 0,
    mmr: 1000,
    seed: idx + 1,
  }));
}

function isBracketFinished(bracket) {
  if (!bracket) return false;
  const matches = getAllMatches(bracket);
  if (!matches.length) return false;
  return matches.every(
    (match) => match?.status === "complete" || match?.winnerId || match?.walkover
  );
}

function getChampionId(bracket) {
  if (!bracket) return null;
  if (bracket.finals?.winnerId) return bracket.finals.winnerId;
  const lastWinnersRound = bracket.winners?.[bracket.winners.length - 1] || [];
  const finalMatch = lastWinnersRound[lastWinnersRound.length - 1] || null;
  return finalMatch?.winnerId || null;
}

function simulateBracket(players, bracket) {
  state.players = players;
  state.bracket = bracket;
  const playersById = new Map(players.map((p) => [p.id, p]));
  const maxLoops = Math.max(10, getAllMatches(bracket).length * 4);

  for (let loop = 0; loop < maxLoops; loop += 1) {
    let progressed = false;
    const lookup = getMatchLookup(bracket);
    for (const match of getAllMatches(bracket)) {
      if (!match || match.winnerId || match.walkover || match.status === "complete") {
        continue;
      }
      const participants = resolveParticipants(match, lookup, playersById);
      const bestOf = getBestOfForMatch(match) || 1;
      const needed = Math.max(1, Math.ceil(bestOf / 2));
      if (participants[0] && participants[1]) {
        updateMatchScore(match.id, needed, 0, {
          saveState: () => {},
          renderAll: () => {},
        });
        progressed = true;
        continue;
      }
      if (participants[0] && !participants[1]) {
        updateMatchScore(match.id, needed, "W", {
          saveState: () => {},
          renderAll: () => {},
        });
        progressed = true;
      } else if (!participants[0] && participants[1]) {
        updateMatchScore(match.id, "W", needed, {
          saveState: () => {},
          renderAll: () => {},
        });
        progressed = true;
      }
    }
    if (isBracketFinished(bracket)) return;
    if (!progressed) break;
  }
}

function runSimulation({ minPlayers, maxPlayers, formats }) {
  const failures = [];
  formats.forEach((format) => {
    for (let count = minPlayers; count <= maxPlayers; count += 1) {
      const players = makePlayers(count);
      const bracket = buildBracket(players, { format });
      simulateBracket(players, bracket);
      if (!isBracketFinished(bracket)) {
        failures.push({ format, count, reason: "Bracket not finished" });
        continue;
      }
      const championId = getChampionId(bracket);
      if (!championId) {
        failures.push({ format, count, reason: "No champion found" });
      }
    }
  });
  return failures;
}

const minPlayers = Math.max(2, parseArg("--min", 2));
const maxPlayers = Math.max(minPlayers, parseArg("--max", 64));
const formats = ["Single Elimination", "Double Elimination"];

const failures = runSimulation({ minPlayers, maxPlayers, formats });
if (failures.length) {
  console.error("Bracket simulation failures:");
  failures.forEach((f) => {
    console.error(`- ${f.format} ${f.count} players: ${f.reason}`);
  });
  if (broadcast?.close) broadcast.close();
  process.exit(1);
}

console.log(
  `Bracket simulation passed for ${minPlayers}-${maxPlayers} players (${formats.join(
    ", "
  )}).`
);
if (broadcast?.close) broadcast.close();
