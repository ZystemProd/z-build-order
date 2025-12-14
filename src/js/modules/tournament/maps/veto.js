import DOMPurify from "dompurify";
import { showToast } from "../../toastHandler.js";
import {
  currentTournamentMeta,
  vetoState,
  currentVetoMatchId,
  setCurrentVetoMatchIdState,
  setVetoStateState,
  state,
  defaultBestOf,
} from "../state.js";
import { getMatchLookup, resolveParticipants } from "../bracket/lookup.js";
import { getBestOfForMatch } from "../bracket/renderUtils.js";

export function openVetoModal(matchId, { getPlayersMap, getDefaultMapPoolNames, getMapByName }) {
  setCurrentVetoMatchIdState(matchId);
  const modal = document.getElementById("vetoModal");
  const label = document.getElementById("vetoMatchLabel");
  const bestOfLabel = document.getElementById("vetoBestOfLabel");
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(matchId);
  const bestOf = getBestOfForMatch(match || { bracket: "winners", round: 1 });
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
    setVetoStateState({
      stage: "done",
      turn: "done",
      bestOf: saved.bestOf || saved.maps?.length || bestOf,
      remaining,
      vetoed: saved.vetoed || [],
      picks: saved.maps || [],
      lowerName: saved.participants?.lower || lower?.name || "Lower seed",
      higherName: saved.participants?.higher || higher?.name || "Higher seed",
    });
  } else {
    setVetoStateState({
      stage: pool.length <= bestOf ? "pick" : "veto",
      turn: "low",
      bestOf,
      remaining: [...pool],
      vetoed: [],
      picks: [],
      lowerName: lower?.name || "Lower seed",
      higherName: higher?.name || "Higher seed",
    });
  }

  if (label) label.textContent = `Match ${matchId || ""}`;
  if (bestOfLabel) bestOfLabel.textContent = "";

  renderVetoPoolGrid(pool);
  renderVetoSelectionList();
  renderVetoStatus();
  modal.style.display = "flex";
  modal.dataset.bestOf = vetoState.bestOf;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hideVetoModal();
  });
  document
    .getElementById("vetoMapPool")
    ?.addEventListener("click", handleVetoPoolClick);
}

export function handleVetoPoolClick(e) {
  const card = e.target.closest(".tournament-map-card");
  if (!card) return;
  const name = card.dataset.mapName;
  if (!vetoState || vetoState.stage === "done") return;
  const turnLabel = vetoState.turn;
  const picker =
    turnLabel === "low"
      ? vetoState.lowerName || "Player A"
      : vetoState.higherName || "Player B";

  if (vetoState.stage === "veto") {
    const remainingCount = vetoState.remaining.length;
    if (remainingCount <= vetoState.bestOf) return;
    const idx = vetoState.remaining.findIndex((m) => m.name === name);
    if (idx === -1) return;
    const [removed] = vetoState.remaining.splice(idx, 1);
    vetoState.vetoed.push({ map: removed.name, picker, action: "veto" });
    const newRemaining = vetoState.remaining.length;
    if (newRemaining <= vetoState.bestOf) {
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
    if (vetoState.picks.length >= vetoState.bestOf) {
      vetoState.stage = "done";
    } else {
      vetoState.turn = vetoState.turn === "low" ? "high" : "low";
    }
  }

  renderVetoPoolGrid();
  renderVetoSelectionList();
  renderVetoStatus();
}

export function renderVetoSelectionList() {
  const container = document.getElementById("vetoSelections");
  if (!container) return;
  container.innerHTML = "";
}

export function hideVetoModal() {
  const modal = document.getElementById("vetoModal");
  const poolEl = document.getElementById("vetoMapPool");
  if (modal) modal.style.display = "none";
  if (poolEl) poolEl.removeEventListener("click", handleVetoPoolClick);
  setCurrentVetoMatchIdState(null);
  setVetoStateState(null);
}

export function saveVetoSelection() {
  if (!currentVetoMatchId || !vetoState) return;
  if (vetoState.stage !== "done" && vetoState.picks.length < vetoState.bestOf) {
    showToast?.("Finish picks before saving.", "warning");
    return;
  }
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
  };
  const lookup = getMatchLookup(state.bracket || {});
  const match = lookup.get(currentVetoMatchId);
  if (match) match.bestOf = vetoState.bestOf || match.bestOf || defaultBestOf.upper;
  renderVetoStatus();
  renderVetoSelectionList();
  renderVetoPoolGrid();
  hideVetoModal();
}

export function renderVetoPoolGrid(poolOverride = null) {
  const poolEl = document.getElementById("vetoMapPool");
  const pool = poolOverride || vetoState?.remaining || [];
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
        map.name
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
