import DOMPurify from "dompurify";
import { showToast } from "../../toastHandler.js";
import { auth } from "../../../../app.js";
import {
  currentTournamentMeta,
  vetoState,
  currentVetoMatchId,
  setCurrentVetoMatchIdState,
  setVetoStateState,
  state,
  defaultBestOf,
  isAdmin,
} from "../state.js";
import { getMatchLookup, resolveParticipants } from "../bracket/lookup.js";
import { escapeHtml, getBestOfForMatch } from "../bracket/renderUtils.js";
import { renderBracketView } from "../bracket/render.js";

export function openVetoModal(matchId, { getPlayersMap, getDefaultMapPoolNames, getMapByName }) {
  setCurrentVetoMatchIdState(matchId);
  const modal = document.getElementById("vetoModal");
  const label = document.getElementById("vetoMatchLabel");
  const bestOfLabel = document.getElementById("vetoBestOfLabel");
  if (modal) modal.dataset.matchId = matchId || "";
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(matchId);
  const bestOfRaw = getBestOfForMatch(match || { bracket: "winners", round: 1 });
  const bestOf = Math.max(1, Number(bestOfRaw) || 1);
  const pool = (
    currentTournamentMeta?.mapPool && currentTournamentMeta.mapPool.length
      ? currentTournamentMeta.mapPool
      : getDefaultMapPoolNames()
  ).map(
    (name) => getMapByName(name) || { name, folder: "", file: "", mode: "1v1" }
  );

  const playersById = getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  const ordered = [pA, pB]
    .filter(Boolean)
    .sort((a, b) => (b.seed || 999) - (a.seed || 999));
  const lower = ordered[0] || null;
  const higher = ordered[1] || ordered[0] || null;

  const saved = state.matchVetoes?.[matchId];
  if (saved) {
    const usedNames = new Set([
      ...(saved.maps || []).map((m) => m.map),
      ...(saved.vetoed || []).map((m) => m.map),
    ]);
    const remaining = pool.filter((m) => !usedNames.has(m.name));
    const savedBestOf = Math.max(
      1,
      Number(saved.bestOf || saved.maps?.length || bestOf) || 1
    );
    const savedPicks = Array.isArray(saved.maps) ? saved.maps : [];
    const savedVetoed = Array.isArray(saved.vetoed) ? saved.vetoed : [];
    const stage =
      savedPicks.length >= savedBestOf
        ? "done"
        : remaining.length <= savedBestOf
        ? "pick"
        : "veto";
    const turn =
      stage === "done"
        ? "done"
        : stage === "veto"
        ? (savedVetoed.length % 2 === 0 ? "low" : "high")
        : (savedPicks.length % 2 === 0 ? "low" : "high");
    setVetoStateState({
      stage,
      turn,
      bestOf: savedBestOf,
      pool: [...pool],
      remaining,
      vetoed: savedVetoed,
      picks: savedPicks,
      lowerName: saved.participants?.lower || lower?.name || "Lower seed",
      higherName: saved.participants?.higher || higher?.name || "Higher seed",
    });
  } else {
    setVetoStateState({
      stage: pool.length <= bestOf ? "pick" : "veto",
      turn: "low",
      bestOf,
      pool: [...pool],
      remaining: [...pool],
      vetoed: [],
      picks: [],
      lowerName: lower?.name || "Lower seed",
      higherName: higher?.name || "Higher seed",
    });
  }

  if (label) {
    const aName = pA?.name || "TBD";
    const bName = pB?.name || "TBD";
    label.textContent = `Match ${matchId || ""} · ${aName} vs ${bName}`;
  }
  if (bestOfLabel) bestOfLabel.textContent = "";

  renderVetoPoolGrid(pool);
  renderVetoSelectionList();
  renderVetoStatus();
  modal.style.display = "flex";
  modal.dataset.bestOf = vetoState.bestOf;
  modal.onclick = (e) => {
    if (e.target === modal) hideVetoModal();
  };
  const poolEl = document.getElementById("vetoMapPool");
  if (poolEl) poolEl.onclick = handleVetoPoolClick;
}

export function openMatchInfoModal(
  matchId,
  { getPlayersMap, getDefaultMapPoolNames, getMapByName }
) {
  const modal = document.getElementById("matchInfoModal");
  const title = document.getElementById("matchInfoTitle");
  const bestOfEl = document.getElementById("matchInfoBestOf");
  const leftNameEl = document.getElementById("matchInfoLeftName");
  const rightNameEl = document.getElementById("matchInfoRightName");
  const leftScoreEl = document.getElementById("matchInfoLeftScore");
  const rightScoreEl = document.getElementById("matchInfoRightScore");
  const rowsEl = document.getElementById("matchInfoMapRows");
  const leftVetoesEl = document.getElementById("matchInfoLeftVetoes");
  const rightVetoesEl = document.getElementById("matchInfoRightVetoes");
  const openVetoBtn = document.getElementById("openMapVetoBtn");
  const closeBtn = document.getElementById("closeMatchInfoModal");
  if (!modal) return;
  modal.dataset.matchId = matchId || "";

  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(matchId);
  const bestOfComputed = getBestOfForMatch(match || { bracket: "winners", round: 1 });
  const saved = state.matchVetoes?.[matchId] || null;
  const bestOf = Math.max(1, Number(saved?.bestOf || match?.bestOf || bestOfComputed) || 1);
  const pickedMaps = Array.isArray(saved?.maps) ? saved.maps : [];
  const vetoedMaps = Array.isArray(saved?.vetoed) ? saved.vetoed : [];
  const playersById = getPlayersMap();
  const [pA, pB] = resolveParticipants(match, lookup, playersById);
  const aName = pA?.name || "TBD";
  const bName = pB?.name || "TBD";

  if (title) {
    const bracketLabel =
      match?.bracket === "winners"
        ? "Upper"
        : match?.bracket === "losers"
        ? "Lower"
        : match?.bracket === "finals"
        ? "Finals"
        : match?.bracket === "group"
        ? "Group"
        : "Match";
    const roundLabel =
      match?.bracket === "finals"
        ? "Final"
        : Number.isFinite(match?.round)
        ? `Round ${match.round}`
        : "Round";
    title.textContent = `${bracketLabel} ${roundLabel}`;
  }
  if (bestOfEl) bestOfEl.textContent = `Best of ${bestOf}`;
  if (leftNameEl) leftNameEl.textContent = aName;
  if (rightNameEl) rightNameEl.textContent = bName;
  renderMatchInfoVetoes({ leftVetoesEl, rightVetoesEl, vetoedMaps, aName, bName });

  if (rowsEl) {
    const record = ensureMatchVetoRecord(matchId, bestOf);
    const winners = normalizeMapResults(record.mapResults, bestOf);
    record.mapResults = winners;
    updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners });
    renderMatchInfoRows(rowsEl, {
      bestOf,
      pickedMaps,
      winners,
    });

    rowsEl.onmouseover = (e) => {
      const cell = e.target.closest?.(".match-info-pick-cell");
      if (!cell) return;
      if (cell.classList.contains("is-disabled")) return;
      const row = cell.closest("tr");
      const idx = Number(row?.dataset?.mapIdx || "-1");
      if (!row || !Number.isFinite(idx) || idx < 0 || idx >= bestOf) return;
      if (winners[idx]) return;
      row.dataset.previewWinner = cell.dataset.side || "";
    };

    rowsEl.onmouseout = (e) => {
      const row = e.target.closest?.("tr");
      if (!row) return;
      if (!row.contains(e.relatedTarget)) {
        delete row.dataset.previewWinner;
      }
    };

    rowsEl.onclick = (e) => {
      const cell = e.target.closest?.(".match-info-pick-cell");
      if (!cell) return;
      if (cell.classList.contains("is-disabled")) return;
      const row = cell.closest("tr");
      const idx = Number(row?.dataset?.mapIdx || "-1");
      const side = cell.dataset.side === "B" ? "B" : "A";
      if (!row || !Number.isFinite(idx) || idx < 0 || idx >= bestOf) return;

      winners[idx] = winners[idx] === side ? null : side;
      record.mapResults = winners;

      const winsA = winners.filter((w) => w === "A").length;
      const winsB = winners.filter((w) => w === "B").length;
      if (typeof vetoDeps?.updateMatchScore === "function") {
        vetoDeps.updateMatchScore(matchId, winsA, winsB);
      }
      vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
      updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners });
      renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners });
    };
  }

  if (openVetoBtn) {
    openVetoBtn.onclick = () => {
      hideMatchInfoModal();
      openVetoModal(matchId, { getPlayersMap, getDefaultMapPoolNames, getMapByName });
    };
  }

  if (closeBtn) closeBtn.onclick = () => hideMatchInfoModal();

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) hideMatchInfoModal();
  };
}

function updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners }) {
  const winsA = winners.filter((w) => w === "A").length;
  const winsB = winners.filter((w) => w === "B").length;
  if (leftScoreEl) leftScoreEl.textContent = String(winsA);
  if (rightScoreEl) rightScoreEl.textContent = String(winsB);
}

function renderMatchInfoVetoes({ leftVetoesEl, rightVetoesEl, vetoedMaps, aName, bName }) {
  if (leftVetoesEl) leftVetoesEl.innerHTML = "";
  if (rightVetoesEl) rightVetoesEl.innerHTML = "";
  if (!leftVetoesEl && !rightVetoesEl) return;

  const left = [];
  const right = [];
  for (const entry of vetoedMaps || []) {
    const picker = entry?.picker || "";
    if (picker === aName) left.push(entry);
    else if (picker === bName) right.push(entry);
  }

  if (leftVetoesEl) {
    leftVetoesEl.innerHTML = left.length
      ? DOMPurify.sanitize(left.map((v) => `<li>${escapeHtml(v.map)}</li>`).join(""))
      : `<li class="helper">None</li>`;
  }
  if (rightVetoesEl) {
    rightVetoesEl.innerHTML = right.length
      ? DOMPurify.sanitize(right.map((v) => `<li>${escapeHtml(v.map)}</li>`).join(""))
      : `<li class="helper">None</li>`;
  }
}

function ensureMatchVetoRecord(matchId, bestOf) {
  state.matchVetoes = state.matchVetoes || {};
  const existing = state.matchVetoes[matchId] || {};
  const safeBestOf = Math.max(1, Number(bestOf) || 1);
  if (!existing.bestOf) existing.bestOf = safeBestOf;
  if (!Array.isArray(existing.maps)) existing.maps = [];
  if (!Array.isArray(existing.vetoed)) existing.vetoed = [];
  if (!Array.isArray(existing.mapResults)) existing.mapResults = [];
  state.matchVetoes[matchId] = existing;
  return existing;
}

function normalizeMapResults(mapResults, bestOf) {
  const out = Array.isArray(mapResults) ? [...mapResults] : [];
  const n = Math.max(1, Number(bestOf) || 1);
  if (out.length > n) return out.slice(0, n);
  while (out.length < n) out.push(null);
  return out;
}

function renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners }) {
  rowsEl.innerHTML = "";
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  let winsA = 0;
  let winsB = 0;
  let decidedAt = -1;
  for (let i = 0; i < bestOf; i++) {
    if (decidedAt !== -1) break;
    if (winners[i] === "A") winsA++;
    else if (winners[i] === "B") winsB++;
    if (winsA >= needed || winsB >= needed) decidedAt = i;
  }
  const isDecided = decidedAt !== -1;
  for (let i = 0; i < bestOf; i++) {
    const mapLabel = pickedMaps[i]?.map || `Map ${i + 1}`;
    const winner = winners[i] === "B" ? "B" : winners[i] === "A" ? "A" : null;
    const isAfterDecision = isDecided && i > decidedAt;

    const tr = document.createElement("tr");
    tr.className = "match-info-row";
    tr.dataset.mapIdx = String(i);
    if (isAfterDecision) tr.classList.add("is-after-decision");

    const leftTd = document.createElement("td");
    leftTd.className = "match-info-pick-cell";
    leftTd.dataset.side = "A";

    const mapTd = document.createElement("td");
    mapTd.className = "match-info-map-cell";
    mapTd.textContent = mapLabel;

    const rightTd = document.createElement("td");
    rightTd.className = "match-info-pick-cell";
    rightTd.dataset.side = "B";

    if (winner === "A") {
      leftTd.classList.add("is-winner");
      leftTd.textContent = "W";
      rightTd.classList.add("is-loser");
      rightTd.textContent = "L";
    } else if (winner === "B") {
      leftTd.classList.add("is-loser");
      leftTd.textContent = "L";
      rightTd.classList.add("is-winner");
      rightTd.textContent = "W";
    } else {
      leftTd.textContent = "";
      rightTd.textContent = "";
    }

    if (isAfterDecision) {
      leftTd.classList.add("is-disabled");
      rightTd.classList.add("is-disabled");
      mapTd.classList.add("is-eliminated");
    }

    tr.append(leftTd, mapTd, rightTd);
    rowsEl.appendChild(tr);
  }
}

export function hideMatchInfoModal() {
  const modal = document.getElementById("matchInfoModal");
  if (modal) {
    modal.style.display = "none";
    delete modal.dataset.matchId;
  }
}

export function refreshMatchInfoModalIfOpen() {
  if (!vetoDeps) return;
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return;
  const visible = modal.style.display && modal.style.display !== "none";
  if (!visible) return;
  const matchId = modal.dataset.matchId;
  if (!matchId) return;
  openMatchInfoModal(matchId, vetoDeps);
}

export function handleVetoPoolClick(e) {
  if (!vetoState || vetoState.stage === "done") return;

  if (!isAdmin) {
    const uid = auth?.currentUser?.uid || null;
    if (!uid) {
      showToast?.("Sign in to veto/pick maps.", "warning");
      return;
    }

    const lookup = getMatchLookup(state.bracket || {});
    const match = currentVetoMatchId ? lookup.get(currentVetoMatchId) : null;
    const playersById = new Map((state.players || []).map((p) => [p.id, p]));
    const [pA, pB] = resolveParticipants(match, lookup, playersById);
    const ordered = [pA, pB]
      .filter(Boolean)
      .sort((a, b) => (b.seed || 999) - (a.seed || 999));
    const lower = ordered[0] || null;
    const higher = ordered[1] || ordered[0] || null;
    const expectedUid = vetoState.turn === "low" ? lower?.uid : higher?.uid;
    if (expectedUid && expectedUid !== uid) {
      showToast?.("Not your turn to veto/pick.", "warning");
      return;
    }
  }

  const target =
    e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
  const card = target?.closest?.(".tournament-map-card");
  if (!card) return;
  const name = card.dataset.mapName
    ? decodeURIComponent(card.dataset.mapName)
    : "";
  if (!name) return;
  const bestOf = Math.max(1, Number(vetoState.bestOf) || 1);
  const turnLabel = vetoState.turn;
  const picker =
    turnLabel === "low"
      ? vetoState.lowerName || "Player A"
      : vetoState.higherName || "Player B";

  if (vetoState.stage === "veto") {
    const remainingCount = vetoState.remaining.length;
    if (remainingCount <= bestOf) return;
    const idx = vetoState.remaining.findIndex((m) => m.name === name);
    if (idx === -1) return;
    const [removed] = vetoState.remaining.splice(idx, 1);
    vetoState.vetoed.push({ map: removed.name, picker, action: "veto" });
    const newRemaining = vetoState.remaining.length;
    if (newRemaining <= bestOf) {
      vetoState.stage = "pick";
      vetoState.turn = "low";
    } else {
      vetoState.turn = vetoState.turn === "low" ? "high" : "low";
    }
  } else if (vetoState.stage === "pick") {
    const idx = vetoState.remaining.findIndex((m) => m.name === name);
    if (idx === -1) return;
    const [picked] = vetoState.remaining.splice(idx, 1);
    vetoState.picks.push({ map: picked.name, picker, action: "pick" });
    if (vetoState.picks.length >= bestOf) {
      vetoState.stage = "done";
    } else {
      vetoState.turn = vetoState.turn === "low" ? "high" : "low";
    }
  }

  persistLiveVetoState();
  renderVetoPoolGrid();
  renderVetoSelectionList();
  renderVetoStatus();
}

export function renderVetoSelectionList() {
  const container = document.getElementById("vetoSelections");
  if (!container) return;
  const picks = vetoState?.picks || [];
  const vetoed = vetoState?.vetoed || [];
  const bestOf = Math.max(1, Number(vetoState?.bestOf) || 1);

  const pickHtml = picks.length
    ? picks
        .slice(0, bestOf)
        .map(
          (m, idx) =>
            `<span class="pill">Pick ${idx + 1}: ${escapeHtml(m.map)} (${escapeHtml(
              m.picker || "Player"
            )})</span>`
        )
        .join("")
    : "";

  const vetoHtml = vetoed.length
    ? vetoed
        .map(
          (m) =>
            `<span class="pill muted">Veto: ${escapeHtml(m.map)} (${escapeHtml(
              m.picker || "Player"
            )})</span>`
        )
        .join("")
    : "";

  container.innerHTML =
    DOMPurify.sanitize(pickHtml + vetoHtml) ||
    `<span class="helper">No picks yet.</span>`;
}

export function hideVetoModal() {
  const modal = document.getElementById("vetoModal");
  const poolEl = document.getElementById("vetoMapPool");
  if (modal) modal.style.display = "none";
  if (modal) delete modal.dataset.matchId;
  if (poolEl) poolEl.onclick = null;
  setCurrentVetoMatchIdState(null);
  setVetoStateState(null);
}

function persistLiveVetoState() {
  if (!currentVetoMatchId || !vetoState) return;
  state.matchVetoes = state.matchVetoes || {};
  const existing = state.matchVetoes[currentVetoMatchId] || {};
  state.matchVetoes[currentVetoMatchId] = {
    ...existing,
    maps: vetoState.picks || [],
    vetoed: vetoState.vetoed || [],
    bestOf: vetoState.bestOf,
    participants: {
      lower: vetoState.lowerName,
      higher: vetoState.higherName,
    },
    mapResults: existing.mapResults || [],
  };
  vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
}

export function saveVetoSelection() {
  if (!currentVetoMatchId || !vetoState) return;
  if (vetoState.stage !== "done" && vetoState.picks.length < vetoState.bestOf) {
    showToast?.("Finish picks before saving.", "warning");
    return;
  }
  const matchId = currentVetoMatchId;
  const existingMapResults = state.matchVetoes?.[matchId]?.mapResults || [];
  const trimmed = vetoState.picks.slice(0, vetoState.bestOf);
  state.matchVetoes = state.matchVetoes || {};
  state.matchVetoes[currentVetoMatchId] = {
    maps: trimmed,
    vetoed: vetoState.vetoed || [],
    bestOf: vetoState.bestOf,
    participants: {
      lower: vetoState.lowerName,
      higher: vetoState.higherName,
    },
    mapResults: existingMapResults,
  };
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(currentVetoMatchId);
  if (match) match.bestOf = vetoState.bestOf || match.bestOf || defaultBestOf.upper;
  vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes, bracket: state.bracket });
  renderVetoStatus();
  renderVetoSelectionList();
  renderVetoPoolGrid();
  hideVetoModal();
  openMatchInfoModal(matchId, vetoDeps);
}

export function renderVetoPoolGrid(poolOverride = null) {
  const poolEl = document.getElementById("vetoMapPool");
  const pool = poolOverride || vetoState?.pool || vetoState?.remaining || [];
  if (!poolEl) return;
  const remainingNames = vetoState?.remaining?.map((m) => m.name) || [];
  const html = pool
    .map((map) => {
      const pickedIdx =
        vetoState?.picks?.findIndex((m) => m.map === map.name) ?? -1;
      const vetoIdx =
        vetoState?.vetoed?.findIndex((m) => m.map === map.name) ?? -1;
      const imgPath = map.folder ? `img/maps/${map.folder}/${map.file}` : "";
      const stateClass =
        pickedIdx !== -1 ? "selected" : vetoIdx !== -1 ? "vetoed" : "";
      const helper =
        pickedIdx !== -1
          ? `Pick ${pickedIdx + 1}`
          : vetoIdx !== -1
          ? `Veto`
          : remainingNames.includes(map.name)
          ? ""
          : "Unavailable";
      return `<div class="tournament-map-card ${stateClass}" data-map-name="${escapeHtml(
        encodeURIComponent(map.name)
      )}">
        <div class="map-thumb"${
          imgPath ? ` style="background-image:url('${imgPath}')"` : ""
        }></div>
        <div class="map-meta">
          <div class="map-name">${escapeHtml(map.name)}</div>
          <span class="map-mode">${escapeHtml(map.mode || "1v1")}</span>
        </div>
        <div class="helper">${helper}</div>
      </div>`;
    })
    .join("");
  poolEl.innerHTML = DOMPurify.sanitize(html);
  renderVetoSelectionList();
  renderVetoStatus();
}

export function showVetoInfo(matchId) {
  const data = state.matchVetoes?.[matchId];
  if (!data || !data.maps?.length) {
    showToast?.("No veto data for this match yet.", "info");
    return;
  }
  const lines = data.maps.map(
    (m, idx) => `${idx + 1}. ${m.map} (${m.picker || "Player"})`
  );
  alert(
    `Picked maps (Bo${data.bestOf || data.maps.length}):\n${lines.join("\n")}`
  );
}

export function renderVetoStatus() {
  const status = document.getElementById("vetoBestOfLabel");
  const turnLabel = document.getElementById("vetoMatchLabel");
  if (!vetoState) {
    if (status) status.textContent = "";
    if (turnLabel) turnLabel.textContent = "";
    return;
  }
  const { stage, turn, bestOf, lowerName, higherName, remaining } = vetoState;
  const turnName =
    turn === "low" ? lowerName || "Lower seed" : higherName || "Higher seed";
  if (status)
    status.textContent = `Best of ${bestOf}. ${remaining.length} maps remaining. Stage: ${stage}.`;
  if (turnLabel) {
    if (stage === "done") {
      turnLabel.textContent = `Map order locked.`;
    } else if (stage === "pick") {
      turnLabel.textContent = `Pick phase - ${turnName} to pick`;
    } else {
      turnLabel.textContent = `Veto phase - ${turnName} to veto`;
    }
  }
}

// Dependencies for veto module that need to be set from index.js
let vetoDeps = null;
export function attachMatchActionHandlers() {
  if (!vetoDeps) return;
  document.querySelectorAll(".veto-btn").forEach((btn) => {
    btn.onclick = () => openVetoModal(btn.dataset.matchId, vetoDeps);
  });
  document.querySelectorAll(".info-btn").forEach((btn) => {
    btn.onclick = () => openMatchInfoModal(btn.dataset.matchId, vetoDeps);
  });
}

export function setVetoDependencies(deps) {
  vetoDeps = deps;
}

export function refreshVetoModalIfOpen() {
  if (!vetoDeps) return;
  const modal = document.getElementById("vetoModal");
  if (!modal) return;
  const visible = modal.style.display && modal.style.display !== "none";
  if (!visible) return;
  const matchId = modal.dataset.matchId;
  if (!matchId) return;
  openVetoModal(matchId, vetoDeps);
}
