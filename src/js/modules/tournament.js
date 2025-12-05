const STORAGE_KEY = "zboTournamentStateV1";
const BROADCAST_NAME = "zboTournamentLive";

const defaultState = {
  players: [],
  pointsLedger: {},
  bracket: null,
  needsReseed: false,
  activity: [],
  lastUpdated: Date.now(),
};

let state = loadState();
const broadcast =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(BROADCAST_NAME)
    : null;

document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  if (!state.bracket && state.players.length) {
    rebuildBracket(true, "Loaded saved players");
  } else {
    renderAll();
  }
});

if (broadcast) {
  broadcast.addEventListener("message", (event) => {
    syncFromRemote(event.data);
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      const incoming = JSON.parse(event.newValue);
      syncFromRemote(incoming);
    } catch (_) {
      // ignore invalid payloads
    }
  }
});

function bindUI() {
  const registrationForm = document.getElementById("registrationForm");
  const fetchMmrBtn = document.getElementById("fetchMmrBtn");
  const rebuildBtn = document.getElementById("rebuildBracketBtn");
  const resetBtn = document.getElementById("resetTournamentBtn");
  const jumpToRegistration = document.getElementById("jumpToRegistration");
  const jumpToBracket = document.getElementById("jumpToBracket");
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");
  const autoFillBtn = document.getElementById("autoFillBtn");

  registrationForm?.addEventListener("submit", handleRegistration);
  fetchMmrBtn?.addEventListener("click", tryFetchMmrForForm);
  rebuildBtn?.addEventListener("click", () => rebuildBracket(true, "Manual reseed"));
  resetBtn?.addEventListener("click", resetTournament);
  autoFillBtn?.addEventListener("click", autoFillPlayers);

  jumpToRegistration?.addEventListener("click", () => {
    switchTab("registrationTab");
    document.getElementById("registrationCard")?.scrollIntoView({ behavior: "smooth" });
  });
  jumpToBracket?.addEventListener("click", () => {
    switchTab("bracketTab");
    document.getElementById("bracketGrid")?.scrollIntoView({ behavior: "smooth" });
  });

  playersTable?.addEventListener("input", (e) => {
    if (e.target.matches(".points-input")) {
      const id = e.target.dataset.playerId;
      const value = Math.max(0, Number(e.target.value) || 0);
      updatePlayerPoints(id, value);
    }
  });

  playersTable?.addEventListener("click", (e) => {
    if (e.target.matches(".remove-player")) {
      const id = e.target.dataset.playerId;
      removePlayer(id);
    }
  });

  bracketGrid?.addEventListener("change", (e) => {
    if (e.target.matches(".score-select")) {
      const matchId = e.target.dataset.matchId;
      if (!matchId) return;
      const selects = document.querySelectorAll(`.score-select[data-match-id="${matchId}"]`);
      const vals = Array.from(selects).map((s) => Number(s.value) || 0);
      updateMatchScore(matchId, vals[0] ?? 0, vals[1] ?? 0);
    }
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(targetId) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === targetId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetId);
  });
}

function autoFillPlayers() {
  const names = [
    "Zephyr",
    "Astra",
    "Nexus",
    "Starlance",
    "Vortex",
    "Nightfall",
    "IonBlade",
    "WarpDrive",
    "Pulsefire",
    "Skyforge",
    "NovaWing",
    "CryoCore",
    "Flux",
    "Helix",
    "Frostbyte",
    "Titanfall",
  ];
  const races = ["Zerg", "Protoss", "Terran", "Random"];

  const picks = [];
  while (picks.length < 12) {
    const base = names[Math.floor(Math.random() * names.length)];
    const suffix = Math.floor(Math.random() * 900 + 100);
    const name = `${base}_${suffix}`;
    const race = races[Math.floor(Math.random() * races.length)];
    const mmr = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;
    picks.push({ name, race, mmr, points: 0 });
  }

  picks.forEach((p) => {
    createOrUpdatePlayer({
      name: p.name,
      race: p.race,
      sc2Link: "",
      mmr: p.mmr,
      points: p.points,
    });
  });

  const seededPlayers = applySeeding(state.players);
  saveState({ players: seededPlayers, needsReseed: false });
  rebuildBracket(true, "Dev auto-fill");
  addActivity("Auto-filled 12 players for testing.");
}

async function handleRegistration(event) {
  event.preventDefault();
  const name = document.getElementById("playerNameInput")?.value.trim();
  const race = document.getElementById("raceSelect")?.value || "";
  const sc2Link = document.getElementById("sc2PulseInput")?.value.trim();
  const mmrInput = document.getElementById("mmrInput");
  const pointsField = document.getElementById("pointsInput");
  const statusEl = document.getElementById("mmrStatus");

  if (!name) {
    setStatus(statusEl, "Player name is required.", true);
    return;
  }

  let mmr = Number(mmrInput?.value || "");
  const rawPoints = pointsField?.value ?? "";
  const requestedPoints =
    rawPoints === "" || rawPoints === null || rawPoints === undefined
      ? null
      : Number(rawPoints);
  const startingPoints =
    requestedPoints === null
      ? null
      : Number.isFinite(requestedPoints)
      ? Math.max(0, requestedPoints)
      : null;

  if (!mmr && sc2Link) {
    setStatus(statusEl, "Fetching MMR from SC2Pulse…", false);
    mmr = await fetchMmrFromPulse(sc2Link, statusEl);
  }

  mmr = Number.isFinite(mmr) ? Math.max(0, mmr) : 0;
  setStatus(statusEl, mmr ? `Using MMR ${mmr}` : "MMR missing — you can fill it manually.", !mmr);

  const newPlayer = createOrUpdatePlayer({
    name,
    race,
    sc2Link,
    mmr,
    points: startingPoints,
  });

  const hasCompletedMatches = bracketHasResults();
  const seededPlayers = applySeeding(state.players);
  const nextState = {
    players: seededPlayers,
    needsReseed: hasCompletedMatches,
  };

  saveState(nextState);
  addActivity(`${newPlayer.name} saved (${newPlayer.mmr || "MMR?"} MMR, ${newPlayer.points} pts)`);

  const shouldAutoRebuild = !hasCompletedMatches;
  if (shouldAutoRebuild) {
    rebuildBracket(true, "Roster updated");
  } else {
    setSeedingNotice(true);
    if (!state.bracket || !state.bracket.winners?.length) {
      rebuildBracket(true, "Initial bracket");
    } else {
      renderAll();
    }
  }

  event.target.reset();
}

async function tryFetchMmrForForm() {
  const link = document.getElementById("sc2PulseInput")?.value.trim();
  const statusEl = document.getElementById("mmrStatus");
  if (!link) {
    setStatus(statusEl, "Add a SC2Pulse link first.", true);
    return;
  }
  setStatus(statusEl, "Fetching MMR…", false);
  const mmr = await fetchMmrFromPulse(link, statusEl);
  if (mmr) {
    const mmrInput = document.getElementById("mmrInput");
    if (mmrInput) mmrInput.value = mmr;
    setStatus(statusEl, `Found ${mmr} MMR`, false);
  }
}

function createOrUpdatePlayer(payload) {
  const ledgerKey = playerKey(payload.name, payload.sc2Link);
  const savedPoints = state.pointsLedger[ledgerKey] ?? 0;
  const existingIndex = state.players.findIndex(
    (p) => playerKey(p.name, p.sc2Link) === ledgerKey
  );

  const resolvedPoints =
    payload.points === null || payload.points === undefined
      ? savedPoints
      : payload.points;

  const base = {
    id: crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
    seed: 0,
    points: resolvedPoints,
    ...payload,
  };

  let updatedPlayer = base;

  if (existingIndex !== -1) {
    updatedPlayer = {
      ...state.players[existingIndex],
      ...payload,
      points:
        payload.points === null || payload.points === undefined
          ? state.players[existingIndex].points ?? savedPoints
          : payload.points,
    };
    state.players[existingIndex] = updatedPlayer;
  } else {
    state.pointsLedger[ledgerKey] = resolvedPoints ?? 0;
    state.players.push(updatedPlayer);
  }

  state.pointsLedger[ledgerKey] = updatedPlayer.points ?? savedPoints;
  return updatedPlayer;
}

function updatePlayerPoints(playerId, points) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  player.points = points;
  const ledgerKey = playerKey(player.name, player.sc2Link);
  state.pointsLedger[ledgerKey] = points;
  const seeded = applySeeding(state.players);
  saveState({ players: seeded, needsReseed: true });
  setSeedingNotice(true);
  renderAll();
}

function removePlayer(playerId) {
  state.players = state.players.filter((p) => p.id !== playerId);
  addActivity("Removed a player from the roster.");
  const seeded = applySeeding(state.players);
  const hadResults = bracketHasResults();
  saveState({ players: seeded, needsReseed: hadResults });
  if (!hadResults) {
    rebuildBracket(true, "Roster updated");
  } else {
    setSeedingNotice(true);
    renderAll();
  }
}

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#ff8b8b" : "var(--muted)";
}

async function fetchMmrFromPulse(link, statusEl) {
  try {
    const url = sanitizeUrl(link);
    if (!url) {
      setStatus(statusEl, "Invalid SC2Pulse link. Please double-check the URL.", true);
      return 0;
    }
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const text = await response.text();
    // Try to get "last" or "current" MMR from the stats section
    const mmrMatch =
      text.match(/"last":\s*([0-9]{3,5})/i) ||
      text.match(/"current":\s*([0-9]{3,5})/i) ||
      text.match(/mmr[^0-9]*([0-9]{3,5})/i) ||
      text.match(/rating[^0-9]*([0-9]{3,5})/i);
    if (mmrMatch && mmrMatch[1]) {
      return Number(mmrMatch[1]);
    }
    setStatus(statusEl, "Could not find MMR in the page. Enter it manually.", true);
    return 0;
  } catch (err) {
    setStatus(
      statusEl,
      "Could not fetch MMR (CORS or offline). Please fill it manually.",
      true
    );
    return 0;
  }
}

function applySeeding(players) {
  const seeded = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.mmr !== a.mmr) return b.mmr - a.mmr;
    return a.name.localeCompare(b.name);
  });
  seeded.forEach((p, idx) => (p.seed = idx + 1));
  return seeded;
}

function rebuildBracket(force = false, reason = "") {
  if (!force && state.needsReseed === false && state.bracket) {
    return;
  }
  const seededPlayers = applySeeding(state.players);
  const bracket = buildBracket(seededPlayers);
  autoResolveByes(bracket);
  saveState({
    players: seededPlayers,
    bracket,
    needsReseed: false,
  });
  setSeedingNotice(false);
  if (reason) addActivity(`Bracket regenerated (${reason}).`);
  renderAll();
}

function buildBracket(players) {
  const seedOrder = players.map((p) => p.id);
  if (!players.length) {
    return { winners: [], losers: [], finals: null, seedOrder };
  }
  const bracketSize = Math.max(4, pow2(players.length));

  // Generate standard top/bottom seed placement (1 at top, 2 at bottom, etc.)
  const seedPositions = generateSeedPositions(bracketSize);
  const seedMap = new Map(players.map((p) => [p.seed, p]));
  const placedPlayers = seedPositions.map((seed) => seedMap.get(seed) || null);

  const pairings = [];
  for (let i = 0; i < bracketSize; i += 2) {
    pairings.push([placedPlayers[i], placedPlayers[i + 1]]);
  }

  const winners = [];
  const round1 = pairings.map((pair, idx) =>
    createMatch(
      "winners",
      1,
      idx + 1,
      playerSource(pair[0]),
      playerSource(pair[1])
    )
  );
  winners.push(round1);

  let previousRound = round1;
  let roundNumber = 2;
  while (previousRound.length > 1) {
    const next = [];
    for (let i = 0; i < previousRound.length / 2; i++) {
      next.push(
        createMatch(
          "winners",
          roundNumber,
          i + 1,
          winnerSource(previousRound[2 * i]),
          winnerSource(previousRound[2 * i + 1])
        )
      );
    }
    winners.push(next);
    previousRound = next;
    roundNumber++;
  }

  const losers = buildLosersBracket(winners);
  const finals = createMatch(
    "finals",
    1,
    1,
    winnerSource(winners[winners.length - 1][0]),
    losers.length ? winnerSource(losers[losers.length - 1][0]) : null
  );

  return { winners, losers, finals, seedOrder };
}

function generateSeedPositions(size) {
  if (size <= 1) return [1];
  let positions = [1, 2];
  while (positions.length < size) {
    const nextSize = positions.length * 2;
    const next = [];
    positions.forEach((seed) => {
      next.push(seed);
      next.push(nextSize + 1 - seed);
    });
    positions = next;
  }
  return positions.slice(0, size);
}

function buildLosersBracket(winners) {
  const losers = [];
  if (!winners.length) return losers;

  // Round 1: losers from winners round 1 face each other
  const w1 = winners[0];
  const l1 = [];
  for (let i = 0; i < w1.length; i += 2) {
    l1.push(
      createMatch(
        "losers",
        1,
        l1.length + 1,
        loserSource(w1[i]),
        loserSource(w1[i + 1])
      )
    );
  }
  if (l1.length) losers.push(l1);

  const totalLbRounds = Math.max(0, 2 * (winners.length - 1));
  for (let lbRoundNum = 2; lbRoundNum <= totalLbRounds; lbRoundNum++) {
    const previous = losers[losers.length - 1];
    if (lbRoundNum % 2 === 0) {
      // even: winners from previous LB round face losers from current WB round
      const wbRound = winners[lbRoundNum / 2] || [];
      const matches = [];
      const count = Math.max(previous?.length || 0, wbRound.length);
      for (let i = 0; i < count; i++) {
        matches.push(
          createMatch(
            "losers",
            lbRoundNum,
            i + 1,
            previous?.[i] ? winnerSource(previous[i]) : null,
            wbRound[i] ? loserSource(wbRound[i]) : null
          )
        );
      }
      if (matches.length) losers.push(matches);
    } else {
      // odd: winners from previous LB round face each other
      const matches = [];
      for (let i = 0; i < previous.length; i += 2) {
        matches.push(
          createMatch(
            "losers",
            lbRoundNum,
            i / 2 + 1,
            winnerSource(previous[i]),
            winnerSource(previous[i + 1])
          )
        );
      }
      if (matches.length) losers.push(matches);
    }
  }
  return losers;
}

function createMatch(bracket, round, index, sourceA, sourceB) {
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
  };
}

function playerSource(player) {
  if (!player) return null;
  return { type: "player", playerId: player.id };
}

function winnerSource(match) {
  if (!match) return null;
  return { type: "match", matchId: match.id, outcome: "winner" };
}

function loserSource(match) {
  if (!match) return null;
  return { type: "match", matchId: match.id, outcome: "loser" };
}

function autoResolveByes(bracket) {
  const matches = getAllMatches(bracket);
  const lookup = getMatchLookup(bracket);
  const playersById = getPlayersMap();

  matches.forEach((match) => {
    if (match.status === "complete") return;
    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    if (pA && !pB) {
      finalizeMatchResult(match, { winnerId: pA.id, loserId: null, scores: [1, 0], walkover: "b" });
    } else if (!pA && pB) {
      finalizeMatchResult(match, { winnerId: pB.id, loserId: null, scores: [0, 1], walkover: "a" });
    }
  });
}

function resolveParticipants(match, lookup, playersById) {
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

function applyMatchInputs(card) {
  const matchId = card.dataset.matchId;
  const selects = card.querySelectorAll(".result-select");
  const valA = selects[0]?.value || "0";
  const valB = selects[1]?.value || "0";
  updateMatchScore(matchId, valA, valB);
}

function parseResult(value) {
  if (value === "W") return { type: "walkover" };
  const num = Number(value);
  return { type: "score", value: Number.isFinite(num) ? Math.max(0, num) : 0 };
}

function updateMatchScore(matchId, valA, valB) {
  if (!state.bracket) return;
  const lookup = getMatchLookup(state.bracket);
  const match = lookup.get(matchId);
  if (!match) return;

  const playersById = getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  const prevWinner = match.winnerId;
  const resA = parseResult(valA);
  const resB = parseResult(valB);

  if (!pA || !pB) {
    finalizeMatchResult(match, {
      winnerId: null,
      loserId: null,
      scores: [resA.value || 0, resB.value || 0],
      walkover: null,
      status: "pending",
    });
    saveState({ bracket: state.bracket });
    renderBracket();
    return;
  }

  let winnerId = null;
  let loserId = null;
  let status = "pending";
  let finalScores = [resA.value || 0, resB.value || 0];
  let walkoverValue = null;

  if (resA.type === "walkover" && resB.type !== "walkover") {
    winnerId = pA.id;
    loserId = pB.id;
    status = "complete";
    finalScores = [1, 0];
    walkoverValue = "b";
  } else if (resB.type === "walkover" && resA.type !== "walkover") {
    winnerId = pB.id;
    loserId = pA.id;
    status = "complete";
    finalScores = [0, 1];
    walkoverValue = "a";
  } else if (resA.type === "score" && resB.type === "score" && resA.value !== resB.value) {
    winnerId = resA.value > resB.value ? pA.id : pB.id;
    loserId = resA.value > resB.value ? pB.id : pA.id;
    status = "complete";
  }

  if (prevWinner && prevWinner !== winnerId) {
    clearDownstream(matchId);
  }

  finalizeMatchResult(match, {
    winnerId,
    loserId,
    scores: finalScores,
    walkover: walkoverValue,
    status,
  });

  if (match.status === "complete") {
    addActivity(
      `${pA.name} ${finalScores[0]} - ${finalScores[1]} ${pB.name}${
        walkoverValue ? ` (walkover: ${walkoverValue.toUpperCase()})` : ""
      }`
    );
  }

  saveState({ bracket: state.bracket });
  renderBracket();
}

function clearDownstream(matchId) {
  if (!state.bracket) return;
  const matches = getAllMatches(state.bracket);
  const dependents = matches.filter((m) =>
    m.sources.some((src) => src?.type === "match" && src.matchId === matchId)
  );
  dependents.forEach((dep) => {
    dep.winnerId = null;
    dep.loserId = null;
    dep.scores = [0, 0];
    dep.walkover = null;
    dep.status = "pending";
    dep.updatedAt = Date.now();
    clearDownstream(dep.id);
  });
}

function finalizeMatchResult(match, { winnerId, loserId, scores, walkover, status }) {
  match.winnerId = winnerId ?? null;
  match.loserId = loserId ?? null;
  match.scores = scores ?? match.scores;
  match.walkover = walkover ?? null;
  match.status = status || (winnerId ? "complete" : "pending");
  match.updatedAt = Date.now();
}

function renderAll() {
  setSeedingNotice(state.needsReseed);
  renderPlayersTable();
  renderBracket();
  renderActivity();
  updateStats();
}

function renderPlayersTable() {
  const tbody = document.getElementById("playersTableBody");
  if (!tbody) return;
  const rows = state.players.map((p) => {
    const profileUrl = sanitizeUrl(p.sc2Link);
    const link = profileUrl
      ? `<a href="${profileUrl}" target="_blank" rel="noopener">Profile</a>`
      : `<span class="placeholder-tag">-</span>`;
    return `
      <tr>
        <td>#${p.seed || "?"}</td>
        <td><strong>${escapeHtml(p.name)}</strong> <span class="helper">${p.race || ""}</span></td>
        <td><input class="points-input" type="number" min="0" data-player-id="${p.id}" value="${p.points || 0}"/></td>
        <td>${p.mmr || 0}</td>
        <td>${link}</td>
        <td><button class="cta small ghost remove-player" data-player-id="${p.id}">Remove</button></td>
      </tr>`;
  });
  tbody.innerHTML = rows.join("") || `<tr><td colspan="6" class="helper">No players yet.</td></tr>`;
}

function renderBracket() {
  const grid = document.getElementById("bracketGrid");
  if (!grid) return;
  if (!state.bracket || !state.players.length) {
    grid.innerHTML = `<div class="placeholder">Add players to generate the bracket.</div>`;
    return;
  }

  const lookup = getMatchLookup(state.bracket);
  const playersById = getPlayersMap();
  const upperRounds = [...(state.bracket.winners || [])];
  if (state.bracket.finals) {
    upperRounds.push([{ ...state.bracket.finals, name: "Finals" }]);
  }

  const upper = layoutBracketSection(upperRounds, "Upper", lookup, playersById, 0, 0);

  const lowerRounds = state.bracket.losers || [];
  const lower = lowerRounds.length
    ? layoutBracketSection(lowerRounds, "Lower", lookup, playersById, 0, upper.height + 10)
    : { html: "", height: 0 };

  grid.innerHTML = `<div class="tree-wrapper">
    ${upper.html}
    ${lower.html}
  </div>`;

  attachMatchHoverHandlers();
}

function renderMatchCard(match, lookup, playersById) {
  const participants = resolveParticipants(match, lookup, playersById);
  const [pA, pB] = participants;
  const statusTag =
    match.walkover === "a"
      ? "Walkover (Player A)"
      : match.walkover === "b"
      ? "Walkover (Player B)"
      : match.status === "complete"
      ? "Completed"
      : "Pending";

  const cls = ["match-card"];
  if (match.status === "complete") cls.push("complete");
  if (match.walkover) cls.push("walkover");

  const valA = displayValueFor(match, 0);
  const valB = displayValueFor(match, 1);

  return `<div class="${cls.join(" ")}" data-match-id="${match.id}">
    <div class="match-meta">
      <span>${match.id}</span>
      <span>${statusTag}</span>
    </div>
    ${renderPlayerRow(pA, valA, "A")}
    ${renderPlayerRow(pB, valB, "B")}
  </div>`;
}

function displayValueFor(match, idx) {
  if (match.walkover === "a") {
    return idx === 1 ? "W" : 0;
  }
  if (match.walkover === "b") {
    return idx === 0 ? "W" : 0;
  }
  return match.scores?.[idx] ?? 0;
}

function renderPlayerRow(player, score, label) {
  if (!player) {
    return `<div class="player-row">
      <div class="player-name placeholder-tag">TBD</div>
      <select class="result-select" disabled>
        <option value="0">0</option>
      </select>
    </div>`;
  }
  return `<div class="player-row">
    <div class="player-name">
      <span class="seed-chip">#${player.seed || "?"}</span>
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <div class="helper">${player.points || 0} pts • ${player.mmr || 0} MMR</div>
      </div>
    </div>
    <select class="result-select" data-player="${label}">
      ${renderScoreOptions(score)}
    </select>
  </div>`;
}

function renderScoreOptions(current) {
  const isWalkover = String(current) === "W";
  const options = [0, 1, 2, 3, 4, 5].map(
    (val) =>
      `<option value="${val}" ${Number(current) === val ? "selected" : ""}>${val}</option>`
  );
  options.push(`<option value="W" ${isWalkover ? "selected" : ""}>Walkover</option>`);
  return options.join("");
}

function renderActivity() {
  const list = document.getElementById("activityList");
  if (!list) return;
  const items = state.activity
    .slice(-20)
    .reverse()
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.message)}</strong><span class="helper">${formatTime(
          entry.timestamp
        )}</span></li>`
    );
  list.innerHTML = items.join("") || `<li class="helper">No updates yet.</li>`;
}

function addActivity(message) {
  const entry = { message, timestamp: Date.now() };
  state.activity.push(entry);
  if (state.activity.length > 40) state.activity.shift();
  saveState({ activity: state.activity });
  renderActivity();
}

function updateStats() {
  const playersEl = document.getElementById("statPlayers");
  const bracketEl = document.getElementById("statBracket");
  const liveEl = document.getElementById("statLive");
  if (playersEl) playersEl.textContent = String(state.players.length);
  if (bracketEl) {
    const size = state.bracket?.winners?.[0]?.length
      ? state.bracket.winners[0].length * 2
      : 0;
    bracketEl.textContent = size ? `${size} slot` : "0";
  }
  if (liveEl) liveEl.textContent = "Live";
}

function resetTournament() {
  if (!confirm("Reset all players, points, and bracket?")) return;
  state = { ...defaultState, lastUpdated: Date.now() };
  saveState(state);
  setSeedingNotice(false);
  renderAll();
}

function setSeedingNotice(show) {
  const el = document.getElementById("seedingNotice");
  if (!el) return;
  el.style.display = show ? "inline-flex" : "none";
}

function bracketHasResults() {
  const matches = getAllMatches(state.bracket);
  return matches.some((m) => m.status === "complete");
}

function getAllMatches(bracket) {
  if (!bracket) return [];
  const { winners = [], losers = [], finals } = bracket;
  const flattened = [...winners.flat(), ...losers.flat()];
  if (finals) flattened.push(finals);
  return flattened;
}

function getMatchLookup(bracket) {
  const map = new Map();
  getAllMatches(bracket).forEach((m) => map.set(m.id, m));
  return map;
}

function getPlayersMap() {
  const map = new Map();
  state.players.forEach((p) => map.set(p.id, p));
  return map;
}

function syncFromRemote(incoming) {
  if (!incoming || typeof incoming !== "object") return;
  if (incoming.lastUpdated && incoming.lastUpdated <= state.lastUpdated) return;
  state = {
    ...defaultState,
    ...incoming,
    players: applySeeding(incoming.players || []),
    pointsLedger: incoming.pointsLedger || {},
    activity: incoming.activity || [],
  };
  renderAll();
}

function saveState(next) {
  state = { ...state, ...next, lastUpdated: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // storage may be unavailable
  }
  broadcast?.postMessage(state);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      players: applySeeding(parsed.players || []),
      activity: parsed.activity || [],
    };
  } catch (_) {
    return { ...defaultState };
  }
}

function pow2(n) {
  return 1 << Math.ceil(Math.log2(Math.max(2, n)));
}

function sanitizeUrl(url) {
  if (!url) return "";
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const safe = new URL(normalized);
    if (!["http:", "https:"].includes(safe.protocol)) throw new Error("Invalid protocol");
    return safe.toString();
  } catch (_) {
    return "";
  }
}

function playerKey(name, link) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (link) {
    return `${base}-${link.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  return base;
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function layoutUpperBracket(bracket, lookup, playersById) {
  const winners = bracket.winners || [];
  if (!winners.length) {
    return `<div class="placeholder">Add players to generate the bracket.</div>`;
  }

  const CARD_HEIGHT = 96;
  const CARD_WIDTH = 240;
  const V_GAP = 28;
  const H_GAP = 140;

  const positions = new Map(); // matchId -> {x,y}

  winners.forEach((round, rIdx) => {
    round.forEach((match, mIdx) => {
      const x = rIdx * (CARD_WIDTH + H_GAP);
      if (rIdx === 0) {
        const y = mIdx * (CARD_HEIGHT + V_GAP);
        positions.set(match.id, { x, y });
      } else {
        const parents = match.sources
          .map((src) => (src?.type === "match" ? positions.get(src.matchId) : null))
          .filter(Boolean);
        const parentYs = parents.map((p) => p.y + CARD_HEIGHT / 2);
        const yCenter =
          parentYs.length === 2
            ? (parentYs[0] + parentYs[1]) / 2
            : parentYs[0] || mIdx * (CARD_HEIGHT + V_GAP);
        const y = yCenter - CARD_HEIGHT / 2;
        positions.set(match.id, { x, y, parents });
      }
    });
  });

  const connectors = [];
  const matchCards = [];
  const renderedMatches = new Set();
  let maxY = 0;

  winners.forEach((round, rIdx) => {
    round.forEach((match) => {
      const pos = positions.get(match.id);
      if (!pos) return;
      maxY = Math.max(maxY, pos.y + CARD_HEIGHT);
      const participants = resolveParticipants(match, lookup, playersById);
      const [pA, pB] = participants;
      matchCards.push(renderSimpleMatch(match, pA, pB, pos.x, pos.y, CARD_HEIGHT, CARD_WIDTH));

      if (rIdx > 0) {
        const srcs = match.sources
          .map((src) => (src?.type === "match" ? positions.get(src.matchId) : null))
          .filter(Boolean);
        if (srcs.length === 2 && matchCards.some((m) => m.includes(`data-match-id="${match.id}"`))) {
          const midY1 = srcs[0].y + CARD_HEIGHT / 2;
          const midY2 = srcs[1].y + CARD_HEIGHT / 2;
          const childMidY = pos.y + CARD_HEIGHT / 2;
          const junctionX = pos.x - 30;
          connectors.push(makeConnector(srcs[0].x + CARD_WIDTH, midY1, junctionX, midY1));
          connectors.push(makeConnector(srcs[1].x + CARD_WIDTH, midY2, junctionX, midY2));
          connectors.push(makeVConnector(junctionX, midY1, midY2));
          connectors.push(makeConnector(junctionX, childMidY, pos.x, childMidY));
        }
      }
    });
  });

  const titles = winners
    .map(
      (round, idx) =>
        `<div class="round-title row-title" style="left:${idx * (CARD_WIDTH + H_GAP)}px;">${
          round.name || `Round ${idx + 1}`
        }</div>`
    )
    .join("");

  return `<div class="tree-bracket" style="height:${maxY + CARD_HEIGHT}px">
    ${titles}
    ${matchCards.join("")}
    ${connectors.join("")}
  </div>`;
}

function makeConnector(x1, y1, x2, y2) {
  return `<div class="connector h" style="left:${Math.min(x1, x2)}px; top:${y1}px; width:${Math.abs(
    x2 - x1
  )}px;"></div>`;
}

function makeVConnector(x, y1, y2) {
  return `<div class="connector v" style="left:${x}px; top:${Math.min(y1, y2)}px; height:${Math.abs(
    y2 - y1
  )}px;"></div>`;
}

function layoutBracketSection(rounds, titlePrefix, lookup, playersById, offsetX, offsetY) {
  if (!rounds?.length) {
    return { html: "", height: 0 };
  }

  const CARD_HEIGHT = 96;
  const CARD_WIDTH = 240;
  const V_GAP = 28;
  const H_GAP = 140;

  const positions = new Map();
  let maxY = 0;
  let maxX = 0;
  const connectors = [];
  const matchCards = [];
  const renderedMatches = new Set();

  rounds.forEach((round, rIdx) => {
    round.forEach((match, mIdx) => {
      const x = offsetX + rIdx * (CARD_WIDTH + H_GAP);
      if (rIdx === 0) {
        const y = offsetY + mIdx * (CARD_HEIGHT + V_GAP);
        positions.set(match.id, { x, y });
        maxY = Math.max(maxY, y + CARD_HEIGHT);
        maxX = Math.max(maxX, x + CARD_WIDTH);
      } else {
        const parents = match.sources
          .map((src) => (src?.type === "match" ? positions.get(src.matchId) : null))
          .filter(Boolean);
        const parentYs = parents.map((p) => p.y + CARD_HEIGHT / 2);
        const yCenter =
          parentYs.length === 2
            ? (parentYs[0] + parentYs[1]) / 2
            : parentYs[0] || offsetY + mIdx * (CARD_HEIGHT + V_GAP);
        const y = yCenter - CARD_HEIGHT / 2;
        positions.set(match.id, { x, y, parents });
        maxY = Math.max(maxY, y + CARD_HEIGHT);
        maxX = Math.max(maxX, x + CARD_WIDTH);
      }
    });
  });

  rounds.forEach((round, rIdx) => {
    round.forEach((match) => {
      const pos = positions.get(match.id);
      if (!pos) return;
      const participants = resolveParticipants(match, lookup, playersById);
      const [pA, pB] = participants;

      // If one side is still TBD, keep it pending with zeroed scores
      if (!pA || !pB) {
        match.winnerId = null;
        match.loserId = null;
        match.status = "pending";
        match.walkover = null;
        match.scores = [0, 0];
      }

      // Auto-advance byes only in the first round
      const hasOne = (pA && !pB) || (!pA && pB);
      if (rIdx === 0 && hasOne) {
        const winner = pA || pB;
        if (winner) {
          match.winnerId = winner.id;
          match.loserId = null;
          match.status = "complete";
          match.scores = [0, 0];
          match.walkover = "bye";
        }
      } else {
        matchCards.push(
          renderSimpleMatch(match, pA, pB, pos.x, pos.y, CARD_HEIGHT, CARD_WIDTH, titlePrefix)
        );
        renderedMatches.add(match.id);
      }

      if (rIdx > 0) {
        const sources = Array.isArray(match.sources) ? match.sources : [];
        const parentInfos = sources
          .map((src) => {
            if (src?.type !== "match") return null;
            const p = positions.get(src.matchId);
            if (!p) return null;
            return { pos: p, rendered: renderedMatches.has(src.matchId) };
          })
          .filter(Boolean);
        const renderedParents = parentInfos.filter((p) => p.rendered);

        if (renderedMatches.has(match.id)) {
          if (renderedParents.length === 2) {
            const midY1 = renderedParents[0].pos.y + CARD_HEIGHT / 2;
            const midY2 = renderedParents[1].pos.y + CARD_HEIGHT / 2;
            const childMidY = pos.y + CARD_HEIGHT / 2;
            const junctionX = pos.x - 30;
            connectors.push(
              makeConnector(renderedParents[0].pos.x + CARD_WIDTH, midY1, junctionX, midY1)
            );
            connectors.push(
              makeConnector(renderedParents[1].pos.x + CARD_WIDTH, midY2, junctionX, midY2)
            );
            connectors.push(makeVConnector(junctionX, midY1, midY2));
            connectors.push(makeConnector(junctionX, childMidY, pos.x, childMidY));
          } else if (renderedParents.length === 1) {
            const midY = renderedParents[0].pos.y + CARD_HEIGHT / 2;
            const childMidY = pos.y + CARD_HEIGHT / 2;
            const junctionX = pos.x - 30;
            const parentEndX = renderedParents[0].pos.x + CARD_WIDTH;
            connectors.push(makeConnector(parentEndX, midY, junctionX, midY));
            connectors.push(makeVConnector(junctionX, midY, childMidY));
            connectors.push(makeConnector(junctionX, childMidY, pos.x, childMidY));
          }
        }
      }
    });
  });

  const titles = rounds
    .map(
      (round, idx) =>
        `<div class="round-title row-title" style="left:${
          offsetX + idx * (CARD_WIDTH + H_GAP)
        }px;">${round.name || `${titlePrefix} Round ${idx + 1}`}</div>`
    )
    .join("");

  const html = `<div class="tree-bracket" style="height:${maxY + 40}px; margin-top:${
    titlePrefix === "Lower" ? 40 : 0
  }px;">
    ${titles}
    ${matchCards.join("")}
    ${connectors.join("")}
  </div>`;

  return { html, height: maxY };
}

function renderSimpleMatch(match, pA, pB, x, y, h, w, prefix = "") {
  const aName = pA ? pA.name : "TBD";
  const bName = pB ? pB.name : "TBD";
  const raceClassA = raceClassName(pA?.race);
  const raceClassB = raceClassName(pB?.race);
  const showScores = !!(pA && pB);
  const scoreOptions = Array.from({ length: 6 }).map(
    (_, v) => `<option value="${v}" ${match.scores?.[0] === v ? "selected" : ""}>${v}</option>`
  );
  const scoreOptionsB = Array.from({ length: 6 }).map(
    (_, v) => `<option value="${v}" ${match.scores?.[1] === v ? "selected" : ""}>${v}</option>`
  );
  return `<div class="match-card tree" data-match-id="${match.id}" style="top:${y}px; left:${x}px; width:${w}px; height:${h}px;">
    <div class="row" data-player-id="${pA?.id || ""}">
      <span class="name"><span class="race-strip ${raceClassA}"></span><span class="name-text">${escapeHtml(aName)}</span></span>
      <select class="score-select" data-match-id="${match.id}" data-player-idx="0" ${
    showScores ? "" : 'style="display:none;"'
  }>
        ${scoreOptions.join("")}
      </select>
    </div>
    <div class="row" data-player-id="${pB?.id || ""}">
      <span class="name"><span class="race-strip ${raceClassB}"></span><span class="name-text">${escapeHtml(bName)}</span></span>
      <select class="score-select" data-match-id="${match.id}" data-player-idx="1" ${
    showScores ? "" : 'style="display:none;"'
  }>
        ${scoreOptionsB.join("")}
      </select>
    </div>
  </div>`;
}

function raceClassName(race) {
  const r = (race || "").toString().toLowerCase();
  if (r.startsWith("z")) return "race-zerg";
  if (r.startsWith("p")) return "race-protoss";
  if (r.startsWith("t")) return "race-terran";
  if (r.startsWith("r")) return "race-random";
  return "race-unknown";
}

function attachMatchHoverHandlers() {
  const grid = document.getElementById("bracketGrid");
  if (!grid) return;

  grid.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".row[data-player-id]");
    if (!target) return;
    const pid = target.dataset.playerId;
    if (!pid) return;
    document.querySelectorAll(`.row[data-player-id]`).forEach((row) => {
      if (row.dataset.playerId === pid) row.classList.add("highlight-player");
    });
  });

  grid.addEventListener("mouseout", (e) => {
    if (e.target.closest(".row[data-player-id]")) {
      document
        .querySelectorAll(".row[data-player-id].highlight-player")
        .forEach((row) => row.classList.remove("highlight-player"));
    }
  });
}

function getMatchLookupForTesting() {
  return getMatchLookup(state.bracket);
}

export {
  getMatchLookupForTesting,
  rebuildBracket,
};
