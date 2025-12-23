import DOMPurify from "dompurify";
import { showToast } from "../../toastHandler.js";
import { auth, db, getCurrentUsername } from "../../../../app.js";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  currentTournamentMeta,
  vetoState,
  currentVetoMatchId,
  setCurrentVetoMatchIdState,
  setVetoStateState,
  state,
  defaultBestOf,
  isAdmin,
  currentSlug,
  TOURNAMENT_STATE_COLLECTION,
  pulseProfile,
} from "../state.js";
import { getMatchLookup, resolveParticipants } from "../bracket/lookup.js";
import { escapeHtml, getBestOfForMatch } from "../bracket/renderUtils.js";
import { renderBracketView } from "../bracket/render.js";

const PRESENCE_COLLECTION = "tournamentPresence";
const PRESENCE_TTL_MS = 45_000;
const PRESENCE_HEARTBEAT_MS = 20_000;
let presenceUnsub = null;
let presenceHeartbeat = null;
let presenceUiTimer = null;
let presenceLatest = new Map(); // uid -> { matchId, updatedAtMs, playerId }
let presenceContext = { matchId: null, leftPlayerId: null, rightPlayerId: null };
let presenceSlug = null;
let presenceWriteDenied = false;

export function openVetoModal(matchId, { getPlayersMap, getDefaultMapPoolNames, getMapByName }) {
  setCurrentVetoMatchIdState(matchId);
  const modal = document.getElementById("vetoModal");
  const label = document.getElementById("vetoMatchLabel");
  const bestOfLabel = document.getElementById("vetoBestOfLabel");
  const resetBtn = document.getElementById("resetVetoBtn");
  const doneBtn = document.getElementById("saveVetoBtn");
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

  if (!isAdmin) {
    const uid = auth?.currentUser?.uid || null;
    if (!uid) {
      showToast?.("Sign in to veto/pick maps.", "warning");
      return;
    }
    const me = resolveCurrentPlayerForPresence();
    const isParticipant =
      (me?.id && (me.id === pA?.id || me.id === pB?.id)) ||
      (uid && (uid === pA?.uid || uid === pB?.uid));
    if (!isParticipant) {
      showToast?.("Only match players can veto/pick maps.", "warning");
      return;
    }
  }

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

  if (doneBtn) doneBtn.style.display = vetoState?.stage === "done" ? "" : "none";
  renderVetoPoolGrid(pool);
  renderVetoStatus();
  modal.style.display = "flex";
  modal.dataset.bestOf = vetoState.bestOf;
  modal.onclick = (e) => {
    if (e.target === modal) hideVetoModal();
  };
  if (resetBtn) resetBtn.onclick = () => showResetVetoModal();
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
  const leftPresenceEl = document.getElementById("matchInfoLeftPresence");
  const rightPresenceEl = document.getElementById("matchInfoRightPresence");
  const openVetoBtn = document.getElementById("openMapVetoBtn");
  const confirmScoreBtn = document.getElementById("confirmMatchScoreBtn");
  const walkoverSelect = document.getElementById("matchInfoWalkoverSelect");
  const closeBtn = document.getElementById("closeMatchInfoModal");
  const helpBtn = document.getElementById("matchInfoHelpBtn");
  const helpPopover = document.getElementById("matchInfoHelpPopover");
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
  const leftPlayerId = pA?.id || null;
  const rightPlayerId = pB?.id || null;
  const uid = auth?.currentUser?.uid || null;
  const me = resolveCurrentPlayerForPresence();
  const isParticipant =
    (me?.id && (me.id === leftPlayerId || me.id === rightPlayerId)) ||
    (uid && (uid === pA?.uid || uid === pB?.uid));
  const canEditResults =
    (isAdmin || isParticipant) && match?.status !== "complete";

  modal.dataset.canEditResults = canEditResults ? "true" : "false";

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
  setPresenceContext({ matchId, leftPlayerId, rightPlayerId });

  let winners = [];
  const setWalkoverSelection = () => {
    if (!walkoverSelect) return;
    if (walkoverSelect.options.length >= 3) {
      walkoverSelect.options[1].textContent = `${aName} forfeits`;
      walkoverSelect.options[2].textContent = `${bName} forfeits`;
    }
    if (match?.walkover === "a") walkoverSelect.value = "A";
    else if (match?.walkover === "b") walkoverSelect.value = "B";
    else walkoverSelect.value = "";
    walkoverSelect.disabled = !canEditResults;
  };
  const updateConfirmScoreButton = () => {
    if (!confirmScoreBtn) return;
    if (!canEditResults) {
      confirmScoreBtn.style.display = "none";
      confirmScoreBtn.onclick = null;
      return;
    }
    const walkoverValue = walkoverSelect?.value || "";
    const winsA = winners.filter((w) => w === "A").length;
    const winsB = winners.filter((w) => w === "B").length;
    const needed = Math.max(1, Math.ceil(bestOf / 2));
    const canConfirm =
      walkoverValue !== "" || (winsA !== winsB && Math.max(winsA, winsB) >= needed);
    confirmScoreBtn.style.display = "";
    confirmScoreBtn.disabled = !canConfirm;
    confirmScoreBtn.textContent = "Confirm score";
    confirmScoreBtn.onclick = canConfirm
      ? () => {
          if (walkoverValue === "A") {
            vetoDeps?.updateMatchScore?.(matchId, "W", 0, { finalize: true });
          } else if (walkoverValue === "B") {
            vetoDeps?.updateMatchScore?.(matchId, 0, "W", { finalize: true });
          } else {
            vetoDeps?.updateMatchScore?.(matchId, winsA, winsB, { finalize: true });
          }
          refreshMatchInfoModalIfOpen();
        }
      : null;
  };

  if (rowsEl) {
    const record = ensureMatchVetoRecord(matchId, bestOf);
    winners = normalizeMapResults(record.mapResults, bestOf);
    record.mapResults = winners;
    updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners, match });
    renderMatchInfoRows(rowsEl, {
      bestOf,
      pickedMaps,
      winners,
    });

    if (!canEditResults) {
      rowsEl.querySelectorAll(".match-info-pick-cell").forEach((cell) => {
        cell.classList.add("is-disabled");
      });
      rowsEl.querySelectorAll(".match-info-row").forEach((row) => {
        delete row.dataset.previewWinner;
      });
      rowsEl.onmouseover = null;
      rowsEl.onmouseout = null;
      rowsEl.onclick = null;
    } else {
      rowsEl.onmouseover = (e) => {
        const cell = e.target.closest?.(".match-info-pick-cell");
        if (!cell) return;
        if (cell.classList.contains("is-disabled")) return;
        if (walkoverSelect?.value) return;
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
        if (walkoverSelect?.value) return;
        const row = cell.closest("tr");
        const idx = Number(row?.dataset?.mapIdx || "-1");
        const side = cell.dataset.side === "B" ? "B" : "A";
        if (!row || !Number.isFinite(idx) || idx < 0 || idx >= bestOf) return;

        winners[idx] = winners[idx] === side ? null : side;
        record.mapResults = winners;

        const winsA = winners.filter((w) => w === "A").length;
        const winsB = winners.filter((w) => w === "B").length;
        if (typeof vetoDeps?.updateMatchScore === "function") {
          vetoDeps.updateMatchScore(matchId, winsA, winsB, { finalize: false });
        }
        vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
        updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners, match });
        renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners });
        updateConfirmScoreButton();
      };
    }
  }
  setWalkoverSelection();
  if (walkoverSelect) {
    walkoverSelect.onchange = () => {
      const value = walkoverSelect.value;
      if (value) {
        winners = normalizeMapResults([], bestOf);
        const record = ensureMatchVetoRecord(matchId, bestOf);
        record.mapResults = winners;
        vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
      }
      if (value === "A") {
        vetoDeps?.updateMatchScore?.(matchId, "W", 0, { finalize: false });
      } else if (value === "B") {
        vetoDeps?.updateMatchScore?.(matchId, 0, "W", { finalize: false });
      } else {
        const winsA = winners.filter((w) => w === "A").length;
        const winsB = winners.filter((w) => w === "B").length;
        vetoDeps?.updateMatchScore?.(matchId, winsA, winsB, { finalize: false });
      }
      updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners, match });
      renderMatchInfoRows(rowsEl, { bestOf, pickedMaps, winners });
      updateConfirmScoreButton();
    };
  }
  updateConfirmScoreButton();

  if (openVetoBtn) {
    const canOpenVeto = isAdmin || isParticipant;
    openVetoBtn.style.display = canOpenVeto ? "" : "none";
    openVetoBtn.onclick = canOpenVeto
      ? () => {
          hideMatchInfoModal();
          openVetoModal(matchId, {
            getPlayersMap,
            getDefaultMapPoolNames,
            getMapByName,
          });
        }
      : null;
  }

  if (closeBtn) closeBtn.onclick = () => hideMatchInfoModal();

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) hideMatchInfoModal();
  };

  if (!modal.dataset.helpBound && helpBtn && helpPopover) {
    modal.dataset.helpBound = "true";

    helpBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      helpPopover.classList.toggle("is-open");
    });

    modal.addEventListener(
      "click",
      (e) => {
        if (!helpPopover.classList.contains("is-open")) return;
        if (e.target.closest("#matchInfoHelpPopover")) return;
        if (e.target.closest("#matchInfoHelpBtn")) return;
        helpPopover.classList.remove("is-open");
      },
      true
    );
  }

  startPresenceTracking(matchId, { leftPlayerId, rightPlayerId, aName, bName });
  applyPresenceIndicators({ leftPresenceEl, rightPresenceEl });
  if (!presenceUiTimer) {
    presenceUiTimer = setInterval(() => applyPresenceIndicators(), 5_000);
  }
}

function updateMatchInfoHeaderScores({ leftScoreEl, rightScoreEl, winners, match }) {
  const hasWalkover = Boolean(match?.walkover);
  const winsA = hasWalkover
    ? Number(match?.scores?.[0] ?? 0)
    : winners.filter((w) => w === "A").length;
  const winsB = hasWalkover
    ? Number(match?.scores?.[1] ?? 0)
    : winners.filter((w) => w === "B").length;
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
  stopPresenceTracking();
  if (presenceUiTimer) clearInterval(presenceUiTimer);
  presenceUiTimer = null;
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

export function refreshMatchInfoPresenceIfOpen() {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return;
  const visible = modal.style.display && modal.style.display !== "none";
  if (!visible) return;
  applyPresenceIndicators();
}

function presenceDocRef(uid) {
  if (!uid || !currentSlug) return null;
  return doc(db, PRESENCE_COLLECTION, currentSlug, "matchInfo", uid);
}

function tournamentStateDocRef() {
  if (!currentSlug) return null;
  return doc(collection(db, TOURNAMENT_STATE_COLLECTION), currentSlug);
}

function startPresenceTracking(matchId, hint = null) {
  if (presenceSlug && presenceSlug !== currentSlug) {
    try {
      presenceUnsub?.();
    } catch (_) {
      // ignore
    }
    presenceUnsub = null;
    presenceLatest = new Map();
    presenceSlug = null;
  }

  if (!presenceUnsub && currentSlug) {
    const colRef = collection(db, PRESENCE_COLLECTION, currentSlug, "matchInfo");
    presenceUnsub = onSnapshot(
      colRef,
      (snap) => {
        const next = new Map();
        for (const d of snap.docs) {
          const data = d.data() || {};
          const updatedAtMs = data.updatedAt?.toMillis
            ? data.updatedAt.toMillis()
            : Number(data.clientUpdatedAt) || Number(data.updatedAt) || 0;
          next.set(d.id, {
            matchId: data.matchId || null,
            updatedAtMs,
            playerId: data.playerId || null,
          });
        }
        presenceLatest = next;
        applyPresenceIndicators();
      },
      () => {}
    );
    presenceSlug = currentSlug;
  }

  const uid = auth?.currentUser?.uid || null;
  const ref = presenceDocRef(uid);
  if (!ref) return;

  const player = resolveCurrentPlayerForPresence();
  let playerId = player?.id || null;

  if (!playerId) {
    const username = (getCurrentUsername?.() || "").trim();
    if (username && hint?.aName && username === hint.aName) playerId = hint.leftPlayerId || null;
    if (username && hint?.bName && username === hint.bName) playerId = hint.rightPlayerId || null;
  }

  if (playerId && uid && !player?.uid) {
    tryBackfillPlayerUid(playerId, uid);
  }

  const write = async () => {
    const now = Date.now();

    const stateRef = tournamentStateDocRef();
    if (stateRef && playerId) {
      try {
        await setDoc(
          stateRef,
          {
            presence: {
              matchInfo: {
                [playerId]: {
                  matchId: matchId || null,
                  clientUpdatedAt: now,
                },
              },
            },
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Presence (state doc) write failed", err);
      }
    }

    if (presenceWriteDenied) return;
    try {
      await setDoc(
        ref,
        {
          matchId: matchId || null,
          playerId: playerId || null,
          updatedAt: serverTimestamp(),
          clientUpdatedAt: now,
        },
        { merge: true }
      );
    } catch (err) {
      if (err?.code === "permission-denied") {
        presenceWriteDenied = true;
        return;
      }
      console.warn("Presence write failed", err);
    }
  };

  write();
  if (presenceHeartbeat) clearInterval(presenceHeartbeat);
  presenceHeartbeat = setInterval(write, PRESENCE_HEARTBEAT_MS);
}

function stopPresenceTracking() {
  const uid = auth?.currentUser?.uid || null;
  const ref = presenceDocRef(uid);
  if (presenceHeartbeat) clearInterval(presenceHeartbeat);
  presenceHeartbeat = null;
  if (ref) {
    deleteDoc(ref).catch(() => {});
  }

  const player = resolveCurrentPlayerForPresence();
  const playerId = player?.id || null;
  const stateRef = tournamentStateDocRef();
  if (stateRef && playerId) {
    setDoc(
      stateRef,
      {
        presence: {
          matchInfo: {
            [playerId]: {
              matchId: null,
              clientUpdatedAt: Date.now(),
            },
          },
        },
      },
      { merge: true }
    ).catch(() => {});
  }
}

function setPresenceContext({ matchId, leftPlayerId, rightPlayerId }) {
  presenceContext = {
    matchId: matchId || null,
    leftPlayerId: leftPlayerId || null,
    rightPlayerId: rightPlayerId || null,
  };
}

function isPlayerOnlineForMatch(playerId, matchId) {
  if (!playerId || !matchId) return false;
  for (const entry of presenceLatest.values()) {
    if (!entry) continue;
    if (entry.playerId !== playerId) continue;
    if (entry.matchId !== matchId) continue;
    if (Date.now() - (entry.updatedAtMs || 0) <= PRESENCE_TTL_MS) return true;
  }

  const stateEntry = state?.presence?.matchInfo?.[playerId] || null;
  if (stateEntry && stateEntry.matchId === matchId) {
    const ts = Number(stateEntry.clientUpdatedAt) || 0;
    if (Date.now() - ts <= PRESENCE_TTL_MS) return true;
  }
  return false;
}

function applyPresenceIndicators(override = null) {
  const modal = document.getElementById("matchInfoModal");
  if (!modal) return;
  const visible = modal.style.display && modal.style.display !== "none";
  if (!visible) return;

  const leftPresenceEl =
    override?.leftPresenceEl || document.getElementById("matchInfoLeftPresence");
  const rightPresenceEl =
    override?.rightPresenceEl || document.getElementById("matchInfoRightPresence");

  const matchId = modal.dataset.matchId || presenceContext.matchId;
  const leftOnline = isPlayerOnlineForMatch(presenceContext.leftPlayerId, matchId);
  const rightOnline = isPlayerOnlineForMatch(presenceContext.rightPlayerId, matchId);

  if (leftPresenceEl) {
    leftPresenceEl.classList.toggle("online", leftOnline);
    leftPresenceEl.classList.toggle("offline", !leftOnline);
    leftPresenceEl.setAttribute("aria-label", leftOnline ? "Player online" : "Player offline");
  }
  if (rightPresenceEl) {
    rightPresenceEl.classList.toggle("online", rightOnline);
    rightPresenceEl.classList.toggle("offline", !rightOnline);
    rightPresenceEl.setAttribute("aria-label", rightOnline ? "Player online" : "Player offline");
  }
}

function resolveCurrentPlayerForPresence() {
  const uid = auth?.currentUser?.uid || null;
  const username = (getCurrentUsername?.() || "").trim();
  const pulseUrl = pulseProfile?.url || "";
  const normalizedPulseUrl = pulseUrl ? pulseUrl.toString().trim() : "";

  const players = state.players || [];
  if (uid) {
    const byUid = players.find((p) => p && p.uid === uid);
    if (byUid) return byUid;
  }
  if (normalizedPulseUrl) {
    const byLink = players.find((p) => p && p.sc2Link === normalizedPulseUrl);
    if (byLink) return byLink;
  }
  if (username) {
    const byName = players.find((p) => p && p.name === username);
    if (byName) return byName;
  }
  return null;
}

function tryBackfillPlayerUid(playerId, uid) {
  if (!playerId || !uid) return;
  const players = Array.isArray(state.players) ? state.players : [];
  const idx = players.findIndex((p) => p && p.id === playerId);
  if (idx === -1) return;
  const existing = players[idx];
  if (existing?.uid) return;
  const nextPlayers = players.map((p, i) => (i === idx ? { ...p, uid } : p));
  state.players = nextPlayers;
  vetoDeps?.saveState?.({ players: nextPlayers });
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
  renderVetoStatus();
}

export function hideVetoModal() {
  const modal = document.getElementById("vetoModal");
  const poolEl = document.getElementById("vetoMapPool");
  if (modal) modal.style.display = "none";
  if (modal) delete modal.dataset.matchId;
  if (poolEl) poolEl.onclick = null;
  // keep global presence subscription alive for match info; veto modal itself doesn't affect presence
  setCurrentVetoMatchIdState(null);
  setVetoStateState(null);
}

function showResetVetoModal() {
  const modal = document.getElementById("confirmResetVetoModal");
  if (!modal) return;
  if (!modal.dataset.bound) {
    modal.dataset.bound = "true";
    const confirmBtn = document.getElementById("confirmResetVetoBtn");
    const cancelBtn = document.getElementById("cancelResetVetoBtn");
    if (confirmBtn) confirmBtn.onclick = () => resetVetoSelection();
    if (cancelBtn) cancelBtn.onclick = () => hideResetVetoModal();
    modal.onclick = (e) => {
      if (e.target === modal) hideResetVetoModal();
    };
  }
  modal.style.display = "flex";
}

function hideResetVetoModal() {
  const modal = document.getElementById("confirmResetVetoModal");
  if (modal) modal.style.display = "none";
}

function resetVetoSelection() {
  if (!currentVetoMatchId || !vetoState) {
    hideResetVetoModal();
    return;
  }
  const bestOf = Math.max(1, Number(vetoState.bestOf) || 1);
  const pool = vetoState.pool || vetoState.remaining || [];
  vetoState.picks = [];
  vetoState.vetoed = [];
  vetoState.remaining = [...pool];
  vetoState.stage = pool.length <= bestOf ? "pick" : "veto";
  vetoState.turn = "low";

  state.matchVetoes = state.matchVetoes || {};
  const existing = state.matchVetoes[currentVetoMatchId] || {};
  state.matchVetoes[currentVetoMatchId] = {
    ...existing,
    maps: [],
    vetoed: [],
    mapResults: [],
    bestOf,
  };
  vetoDeps?.saveState?.({ matchVetoes: state.matchVetoes });
  renderVetoPoolGrid();
  renderVetoStatus();
  hideResetVetoModal();
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
      const pickEntry = vetoState?.picks?.find((m) => m.map === map.name) || null;
      const vetoEntry = vetoState?.vetoed?.find((m) => m.map === map.name) || null;
      const pickedIdx = pickEntry
        ? vetoState?.picks?.findIndex((m) => m.map === map.name) ?? -1
        : -1;
      const vetoIdx = vetoEntry
        ? vetoState?.vetoed?.findIndex((m) => m.map === map.name) ?? -1
        : -1;
      const imgPath = map.folder ? `img/maps/${map.folder}/${map.file}` : "";
      const stateClass =
        pickedIdx !== -1 ? "selected" : vetoIdx !== -1 ? "vetoed" : "";
      const helper =
        pickedIdx !== -1
          ? `Pick ${pickedIdx + 1} · ${escapeHtml(pickEntry?.picker || "Player")}`
          : vetoIdx !== -1
          ? `Veto · ${escapeHtml(vetoEntry?.picker || "Player")}`
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
  const doneBtn = document.getElementById("saveVetoBtn");
  if (!vetoState) {
    if (status) status.textContent = "";
    if (turnLabel) turnLabel.textContent = "";
    if (doneBtn) doneBtn.style.display = "none";
    return;
  }
  const { stage, turn, bestOf, lowerName, higherName, remaining } = vetoState;
  const turnName =
    turn === "low" ? lowerName || "Lower seed" : higherName || "Higher seed";
  if (doneBtn) doneBtn.style.display = stage === "done" ? "" : "none";
  if (status) {
    const remainingLabel =
      stage === "done"
        ? "Complete"
        : `${remaining.length} left · ${stage === "pick" ? "Picking" : "Vetoing"}`;
    status.textContent = `Best of ${bestOf} · ${remainingLabel}`;
  }
  if (turnLabel) {
    if (stage === "done") {
      turnLabel.textContent = "Map veto complete.";
    } else {
      const actionLabel = stage === "pick" ? "Pick" : "Veto";
      turnLabel.textContent = `${actionLabel} turn: ${turnName}`;
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
  attachMatchActionHandlers();
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
