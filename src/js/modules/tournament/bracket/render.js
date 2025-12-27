import DOMPurify from "dompurify";
import { state, currentTournamentMeta, defaultBestOf } from "../state.js";
import { getAllMatches, getMatchLookup, resolveParticipants } from "./lookup.js";
import { generateSeedPositions } from "./build.js";
import {
  escapeHtml,
  sanitizeUrl,
  getBestOfForMatch,
  getSelectValue,
  parseMatchNumber,
  raceClassName,
} from "./renderUtils.js";

const INFO_ICON_SVG = `<svg class="info-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>
  <path d="M12 10.5v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
  <circle cx="12" cy="7.5" r="1.25" fill="currentColor"></circle>
</svg>`;

const CAST_ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
  <path d="M6.5 7.5a8 8 0 0 1 11 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
  <path d="M4 5a12 12 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
</svg>`;

let currentUsernameHint = "";

function setCurrentUsernameHint(username) {
  currentUsernameHint = (username || "").trim().toLowerCase();
}

function isCurrentUserPlayer(player) {
  if (!currentUsernameHint) return false;
  const name = (player?.name || "").trim().toLowerCase();
  const pulseName = (player?.pulseName || "").trim().toLowerCase();
  return Boolean(currentUsernameHint && (name === currentUsernameHint || pulseName === currentUsernameHint));
}

function displayValueFor(match, idx) {
  if (match.walkover === "a") {
    return idx === 0 ? "w/o" : match.scores?.[1] ?? 0;
  }
  if (match.walkover === "b") {
    return idx === 1 ? "w/o" : match.scores?.[0] ?? 0;
  }
  return match.scores?.[idx] ?? 0;
}

let matchLetterMap = new Map();

function indexToLetters(idx) {
  const alphabet = 26;
  let n = idx;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % alphabet)) + out;
    n = Math.floor(n / alphabet) - 1;
  } while (n >= 0);
  return out;
}

function buildMatchLetters(bracket) {
  matchLetterMap = new Map();
  if (!bracket) return;
  const priority = { winners: 0, losers: 1, finals: 2, group: 3 };
  const all = getAllMatches(bracket) || [];
  all
    .slice()
    .sort((a, b) => {
      const pa = priority[a.bracket] ?? 99;
      const pb = priority[b.bracket] ?? 99;
      if (pa !== pb) return pa - pb;
      const ra = a.round || 0;
      const rb = b.round || 0;
      if (ra !== rb) return ra - rb;
      const ia = a.index || 0;
      const ib = b.index || 0;
      return ia - ib;
    })
    .forEach((m, idx) => matchLetterMap.set(m.id, indexToLetters(idx)));
}

function getMatchLabel(match) {
  return matchLetterMap.get(match.id) || match.id;
}

function displayPlaceholderForSource(match, participantIdx, lookup) {
  const src = match?.sources?.[participantIdx];
  if (!src) return "Awaiting player";

  if (src.type === "match" && src.matchId) {
    const sourceMatch = lookup?.get(src.matchId);
    const fromLabel = sourceMatch ? getMatchLabel(sourceMatch) : src.matchId;
    const prefix = src.outcome === "loser" ? "loser of" : "winner of";
    return `(${prefix} ${fromLabel})`;
  }

  return "Awaiting player";
}

function renderCastIndicator(match) {
  const cast = state.matchCasts?.[match.id] || null;
  if (!cast) return "";
  const casterName = escapeHtml(cast.name || "Caster");
  return `<button class="cast-indicator cast-indicator-btn" type="button" data-match-id="${escapeHtml(
    match.id || ""
  )}" title="Casting: ${casterName}" aria-label="Casting">
    ${CAST_ICON_SVG}
  </button>`;
}

export function renderMatchCard(match, lookup, playersById) {
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
  const isReady = Boolean(pA && pB && match.status !== "complete");
  const isUserMatch = Boolean(isCurrentUserPlayer(pA) || isCurrentUserPlayer(pB));
  if (isReady && isUserMatch) cls.push("ready");

  const valA = displayValueFor(match, 0);
  const valB = displayValueFor(match, 1);
  const canVeto = Boolean(pA && pB && match.status !== "complete");
  const bestOf = getBestOfForMatch(match);
  const selectValA = getSelectValue(match, 0, bestOf);
  const selectValB = getSelectValue(match, 1, bestOf);
  const hasPlayers = Boolean(pA && pB);

  const html = `<div class="${cls.join(" ")}" data-match-id="${match.id}">
    <div class="match-meta">
      <span>${getMatchLabel(match)}</span>
      <span>${statusTag}</span>
      <div class="match-actions">
        <span class="badge muted">Bo${bestOf}</span>
      </div>
    </div>
    ${renderPlayerRow(pA, selectValA, "A", bestOf, match, 0, lookup)}
    ${renderPlayerRow(pB, selectValB, "B", bestOf, match, 1, lookup)}
    <div class="match-footer">
      ${
        canVeto
          ? `<button class="cta small ghost veto-btn" data-match-id="${match.id}">Veto / pick maps</button>`
          : match.status === "complete"
          ? `<span class="helper">Match complete</span>`
          : hasPlayers
          ? `<span class="helper">In progress</span>`
          : `<span class="helper">Waiting for players</span>`
      }
    </div>
    <button class="hover-info-container info-btn" data-match-id="${
      match.id
    }" aria-label="Open map veto">${INFO_ICON_SVG}</button>
  </div>`;

  return DOMPurify.sanitize(html);
}

export function renderPlayerRow(player, score, label, bestOf, match, participantIdx, lookup) {
  if (!player) {
    const placeholderText = displayPlaceholderForSource(match, participantIdx, lookup);
    return `<div class="player-row">
      <div class="player-name placeholder-tag">${escapeHtml(placeholderText)}</div>
      <select class="result-select" disabled>
        <option value="0">0</option>
      </select>
    </div>`;
  }
  return `<div class="player-row">
    <div class="player-name player-detail-trigger" data-player-id="${player.id || ""}">
      <span class="seed-chip">#${player.seed || "?"}</span>
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <div class="helper">${player.points || 0} pts  ${
    player.mmr || 0
  } MMR</div>
      </div>
    </div>
    <select class="result-select" name="score-${label}" data-player="${label}">
      ${renderScoreOptions(score, bestOf)}
    </select>
  </div>`;
}

export function renderScoreOptions(current, bestOf = 3) {
  const isWalkover = String(current).toUpperCase() === "W";
  const maxWins = Math.max(1, Math.ceil((bestOf || 1) / 2));
  const options = Array.from({ length: maxWins + 1 }).map(
    (_, val) =>
      `<option value="${val}" ${
        Number(current) === val ? "selected" : ""
      }>${val}</option>`
  );
  options.push(
    `<option value="W" ${isWalkover ? "selected" : ""}>w/o</option>`
  );
  return options.join("");
}

export function clampScoreSelectOptions() {
  if (!state?.bracket) return;
  const lookup = getMatchLookup(state.bracket);
  document.querySelectorAll("select.score-select").forEach((sel) => {
    const matchId = sel.dataset.matchId;
    const match = lookup.get(matchId);
    const bestOf = getBestOfForMatch(match || { bracket: "winners", round: 1 });
    const maxWins = Math.max(1, Math.ceil((bestOf || 1) / 2));
    const prev = sel.value;
    sel.innerHTML = Array.from({ length: maxWins + 1 })
      .map((_, val) => `<option value="${val}">${val}</option>`)
      .join("")
      .concat(`<option value="W">w/o</option>`);
    const forIdx = Number(sel.dataset.playerIdx || "0");
    const needed = maxWins;
    if (match?.walkover === "a") {
      sel.value = forIdx === 0 ? "W" : String(needed);
    } else if (match?.walkover === "b") {
      sel.value = forIdx === 1 ? "W" : String(needed);
    } else if ([...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
    } else {
      sel.value = "0";
    }
  });
}

export function renderSimpleMatch(
  match,
  pA,
  pB,
  x,
  y,
  h,
  w,
  prefix = "",
  extraStyle = "",
  layout = "tree",
  lookup = null
) {
  const isTreeLayout = layout === "tree";
  const isReady = Boolean(pA && pB && match?.status !== "complete");
  const isUserMatch = Boolean(isCurrentUserPlayer(pA) || isCurrentUserPlayer(pB));
  const shouldHighlightReady = isReady && isUserMatch;
  const cardClass = isTreeLayout
    ? `match-card tree${shouldHighlightReady ? " ready" : ""}`
    : `match-card group${shouldHighlightReady ? " ready" : ""}`;
  const aIsPlaceholder = !pA;
  const bIsPlaceholder = !pB;
  const aName = pA ? pA.name : displayPlaceholderForSource(match, 0, lookup);
  const bName = pB ? pB.name : displayPlaceholderForSource(match, 1, lookup);
  const raceClassA = raceClassName(pA?.race);
  const raceClassB = raceClassName(pB?.race);
  const clanLogoA = pA?.clanLogoUrl ? sanitizeUrl(pA.clanLogoUrl) : "";
  const clanLogoB = pB?.clanLogoUrl ? sanitizeUrl(pB.clanLogoUrl) : "";
  const clanNameA = (pA?.clan || "").trim();
  const clanNameB = (pB?.clan || "").trim();
  const showScores = !!(pA && pB);
  const bestOf = getBestOfForMatch(match);
  const selectValA = getSelectValue(match, 0, bestOf);
  const selectValB = getSelectValue(match, 1, bestOf);
  const scoreLabelA =
    String(selectValA).toUpperCase() === "W" ? "w/o" : String(selectValA ?? 0);
  const scoreLabelB =
    String(selectValB).toUpperCase() === "W" ? "w/o" : String(selectValB ?? 0);
  const canVeto = Boolean(pA && pB && match.status !== "complete");
  const baseStyle = isTreeLayout
    ? `top:${y}px; left:${x}px; width:${w}px; height:${h}px; ${extraStyle}`
    : extraStyle;
  const castIndicator = renderCastIndicator(match);

  const parsedGroupNumber =
    layout === "group" ? parseMatchNumber(match?.id || "") : null;
  const matchNumberLabel =
    layout === "group" && parsedGroupNumber
      ? `M${parsedGroupNumber}`
      : escapeHtml(getMatchLabel(match));

  const html = `<div class="${cardClass}" data-match-id="${
    match.id
  }" style="${baseStyle}">
    ${castIndicator}
    <span class="match-number">${matchNumberLabel}</span>
    <div class="row ${
      match.winnerId === pA?.id ? "winner" : ""
    }" data-player-id="${pA?.id || ""}">
      <span class="name"><span class="seed-chip ${
        pA ? "" : "is-placeholder"
      }">${pA ? `#${pA.seed || "?"}` : ""}</span><span class="race-strip ${raceClassA}"></span>${
        clanLogoA
          ? `<img class="clan-logo-inline" src="${escapeHtml(clanLogoA)}" alt="Clan logo" ${
              clanNameA ? `data-tooltip="${escapeHtml(clanNameA)}"` : ""
            } />`
          : `<img class="clan-logo-inline is-placeholder" src="img/clan/logo.webp" alt="No clan logo" />`
      }<span class="name-text ${
    aIsPlaceholder ? "is-placeholder" : ""
  }">${escapeHtml(
     aName
   )}</span></span>
      <div class="row-actions">
        <div class="score-select score-display ${
          match.winnerId === pA?.id ? "winner" : ""
        }" data-match-id="${match.id}" data-player-idx="0" ${
    showScores ? "" : 'style="display:none;"'
  }>${escapeHtml(scoreLabelA)}</div>
      </div>
    </div>
    <div class="row ${
      match.winnerId === pB?.id ? "winner" : ""
    }" data-player-id="${pB?.id || ""}">
      <span class="name"><span class="seed-chip ${
        pB ? "" : "is-placeholder"
      }">${pB ? `#${pB.seed || "?"}` : ""}</span><span class="race-strip ${raceClassB}"></span>${
        clanLogoB
          ? `<img class="clan-logo-inline" src="${escapeHtml(clanLogoB)}" alt="Clan logo" ${
              clanNameB ? `data-tooltip="${escapeHtml(clanNameB)}"` : ""
            } />`
          : `<img class="clan-logo-inline is-placeholder" src="img/clan/logo.webp" alt="No clan logo" />`
      }<span class="name-text ${
    bIsPlaceholder ? "is-placeholder" : ""
  }">${escapeHtml(
     bName
   )}</span></span>
      <div class="row-actions">
        <div class="score-select score-display ${
          match.winnerId === pB?.id ? "winner" : ""
        }" data-match-id="${match.id}" data-player-idx="1" ${
    showScores ? "" : 'style="display:none;"'
  }>${escapeHtml(scoreLabelB)}</div>
      </div>
    </div>
    <button class="hover-info-container info-btn" data-match-id="${
      match.id
    }" aria-label="Open map veto">${INFO_ICON_SVG}</button>
  </div>`;

  return DOMPurify.sanitize(html);
}

export function renderMatchCards(round, lookup, playersById) {
  return round
    .map((match) => renderMatchCard(match, lookup, playersById))
    .join("");
}

export function layoutBracketSection(
  rounds,
  titlePrefix,
  lookup,
  playersById,
  offsetX,
  matchLayerOffset = 0,
  roundLabelOptions = {}
) {
  if (!rounds?.length) {
    return { html: "", height: 0 };
  }

  const CARD_HEIGHT = 70;
  const CARD_WIDTH = 240;
  const V_GAP = 8;
  const H_GAP = 50;

  const clonedRounds = rounds.map((round) => round.slice());

  const parentChildren = new Map();
  clonedRounds.forEach((round, rIdx) => {
    round.forEach((match, mIdx) => {
      (match.sources || []).forEach((src) => {
        if (src && src.type === "match" && src.matchId) {
          if (!parentChildren.has(src.matchId)) {
            parentChildren.set(src.matchId, []);
          }
          parentChildren.get(src.matchId).push({
            roundIndex: rIdx,
            matchIndex: mIdx,
          });
        }
      });
    });
  });

  const orderedRounds = clonedRounds.map((round, rIdx) => {
    const groups = new Map();

    round.forEach((match, mIdx) => {
      const children = parentChildren.get(match.id) || [];

      let groupKey;
      if (!children.length) {
        groupKey = `z-${String(rIdx).padStart(2, "0")}-${String(mIdx).padStart(
          2,
          "0"
        )}`;
      } else {
        let best = children[0];
        for (let i = 1; i < children.length; i++) {
          const c = children[i];
          if (
            c.roundIndex < best.roundIndex ||
            (c.roundIndex === best.roundIndex && c.matchIndex < best.matchIndex)
          ) {
            best = c;
          }
        }
        groupKey = `${String(best.roundIndex).padStart(2, "0")}-${String(
          best.matchIndex
        ).padStart(2, "0")}`;
      }

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(match);
    });

    const sortedKeys = Array.from(groups.keys()).sort();
    const newRound = [];
    sortedKeys.forEach((key) => {
      groups.get(key).forEach((m) => newRound.push(m));
    });
    return newRound;
  });

  const positions = new Map();
  let maxY = 0;
  let maxX = 0;
  const matchCenters = new Map();

  const baseStep = CARD_HEIGHT + V_GAP;

  const matchById = new Map();
  orderedRounds.forEach((round) => round.forEach((m) => matchById.set(m.id, m)));

  const maxMatches = orderedRounds.reduce(
    (acc, round) => Math.max(acc, round.length || 0),
    0
  );
  const baseSize = Math.max(2, maxMatches * 2);
  const seedOrder = generateSeedPositions(baseSize);
  const seedToLeafIdx = new Map();
  seedOrder.forEach((seed, idx) => seedToLeafIdx.set(seed, idx));

  const spanMemo = new Map();
  let fallbackLeaf = baseSize;

  const spanForSource = (src) => {
    if (!src) return null;
    if (src.type === "match" && src.matchId) {
      return spanForMatch(src.matchId);
    }
    if (src.type === "player") {
      const player = playersById.get(src.playerId || "");
      const seed = player?.seed;
      const leaf = Number.isFinite(seed) && seedToLeafIdx.has(seed)
        ? seedToLeafIdx.get(seed)
        : fallbackLeaf++;
      return { min: leaf, max: leaf };
    }
    return null;
  };

  const spanForMatch = (matchId) => {
    if (spanMemo.has(matchId)) return spanMemo.get(matchId);
    const match = matchById.get(matchId);
    if (!match) {
      const leaf = fallbackLeaf++;
      const span = { min: leaf, max: leaf };
      spanMemo.set(matchId, span);
      return span;
    }
    if (Number.isFinite(match.displaySlot)) {
      const slot = match.displaySlot;
      const span = { min: slot, max: slot };
      spanMemo.set(matchId, span);
      return span;
    }
    const spans = (match.sources || [])
      .map((src) => spanForSource(src))
      .filter(Boolean);
    const span =
      spans.length === 0
        ? (() => {
            const leaf = fallbackLeaf++;
            return { min: leaf, max: leaf };
          })()
        : {
            min: Math.min(...spans.map((s) => s.min)),
            max: Math.max(...spans.map((s) => s.max)),
          };
    spanMemo.set(matchId, span);
    return span;
  };

  const slotMap = new Map();
  orderedRounds.forEach((round) => {
    round.forEach((match) => {
      const span = spanForMatch(match.id) || { min: 0, max: 0 };
      const slot = (span.min + span.max) / 2;
      slotMap.set(match.id, slot);
    });
  });

  // For lower bracket layouts, remap slots densely to remove large vertical gaps.
  if (titlePrefix === "Lower" && slotMap.size) {
    const uniqueSlots = Array.from(new Set(slotMap.values())).sort((a, b) => a - b);
    const remap = new Map(uniqueSlots.map((s, idx) => [s, idx]));
    slotMap.forEach((slot, id) => {
      slotMap.set(id, remap.get(slot) ?? slot);
    });
  }

  const allSlots = Array.from(slotMap.values());
  const minSlot =
    allSlots.length && Number.isFinite(Math.min(...allSlots))
      ? Math.min(...allSlots)
      : 0;

  orderedRounds.forEach((round, rIdx) => {
    const x = offsetX + rIdx * (CARD_WIDTH + H_GAP);
    const sorted = [...round].sort((a, b) => {
      const sa = slotMap.get(a.id) ?? 0;
      const sb = slotMap.get(b.id) ?? 0;
      if (sa !== sb) return sa - sb;
      return a.index - b.index;
    });

    const perRoundUsed = new Map();

    sorted.forEach((match) => {
      // Finals: lock to the first parent’s vertical position for a straight connector
      if (match.bracket === "finals") {
        const parentId =
          (match.sources || [])
            .find((src) => src && src.type === "match" && src.matchId)?.matchId ||
          null;
        const parentPos = parentId ? positions.get(parentId) : null;
        const y = parentPos ? parentPos.y : 0;
        positions.set(match.id, { x, y });
        matchCenters.set(match.id, y + CARD_HEIGHT / 2);
        maxY = Math.max(maxY, y + CARD_HEIGHT);
        maxX = Math.max(maxX, x + CARD_WIDTH);
        return;
      }

      const parentSlots = (match.sources || [])
        .filter((src) => src && src.type === "match" && src.matchId)
        .map((src) => slotMap.get(src.matchId))
        .filter((v) => Number.isFinite(v));
      const origSlot = slotMap.get(match.id) ?? 0;
      let baseSlot = origSlot;
      if (parentSlots.length === 1) {
        baseSlot = parentSlots[0];
        slotMap.set(match.id, baseSlot);
      }
      if (parentSlots.length === 2) {
        const avg = (parentSlots[0] + parentSlots[1]) / 2;
        baseSlot = avg;
        slotMap.set(match.id, baseSlot);
      }

      const usedCount = perRoundUsed.get(baseSlot) || 0;
      perRoundUsed.set(baseSlot, usedCount + 1);
      const slot = baseSlot + usedCount * 0.5;
      slotMap.set(match.id, slot);
      const y = (slot - minSlot) * baseStep;
      positions.set(match.id, { x, y });
      matchCenters.set(match.id, y + CARD_HEIGHT / 2);
      maxY = Math.max(maxY, y + CARD_HEIGHT);
      maxX = Math.max(maxX, x + CARD_WIDTH);
    });
  });

  const matchCards = [];
  orderedRounds.forEach((round) => {
    round.forEach((match) => {
      const pos = positions.get(match.id);
      if (!pos) return;
      const [pA, pB] = resolveParticipants(match, lookup, playersById);
      matchCards.push(
        renderSimpleMatch(
          match,
          pA,
          pB,
          pos.x,
          pos.y,
          CARD_HEIGHT,
          CARD_WIDTH,
          "",
          "",
          "tree",
          lookup
        )
      );
    });
  });

  const connectors = [];

  orderedRounds.forEach((round, rIdx) => {
    if (rIdx === 0) return;

    round.forEach((match) => {
      const pos = positions.get(match.id);
      if (!pos) return;

      const parentIds = (match.sources || [])
        .filter((src) => src && src.type === "match" && src.matchId)
        .map((src) => src.matchId);

      const renderedParents = parentIds
        .map((id) => {
          const pPos = positions.get(id);
          return pPos ? { id, pos: pPos } : null;
        })
        .filter(Boolean);

      if (!renderedParents.length) return;

      if (renderedParents.length === 2) {
        const midY1 = renderedParents[0].pos.y + CARD_HEIGHT / 2;
        const midY2 = renderedParents[1].pos.y + CARD_HEIGHT / 2;
        const childMidY = pos.y + CARD_HEIGHT / 2;
        const junctionX = pos.x - 30;

        connectors.push(
          makeConnector(
            renderedParents[0].pos.x + CARD_WIDTH,
            midY1,
            junctionX,
            midY1,
            {
              from: parentIds[0],
              to: match.id,
            }
          )
        );
        connectors.push(
          makeConnector(
            renderedParents[1].pos.x + CARD_WIDTH,
            midY2,
            junctionX,
            midY2,
            {
              from: parentIds[1],
              to: match.id,
            }
          )
        );
        connectors.push(
          makeVConnector(junctionX, midY1, childMidY, {
            from: parentIds[0],
            to: match.id,
          })
        );
        connectors.push(
          makeVConnector(junctionX, midY2, childMidY, {
            from: parentIds[1],
            to: match.id,
          })
        );
        connectors.push(
          makeConnector(junctionX, childMidY, pos.x, childMidY, {
            from: match.id,
            to: match.id,
            parents: parentIds.join(","),
          })
        );
      } else if (renderedParents.length === 1) {
        const parent = renderedParents[0];
        const midY = parent.pos.y + CARD_HEIGHT / 2;
        const childMidY = pos.y + CARD_HEIGHT / 2;
        const parentEndX = parent.pos.x + CARD_WIDTH;

        if (Math.abs(midY - childMidY) < 0.5) {
          connectors.push(
            makeConnector(parentEndX, midY, pos.x, midY, {
              from: parent.id,
              to: match.id,
              parents: parent.id,
            })
          );
        } else {
          const junctionX = pos.x - 30;
          connectors.push(
            makeConnector(parentEndX, midY, junctionX, midY, {
              from: parent.id,
              to: match.id,
            })
          );
          connectors.push(
            makeVConnector(junctionX, midY, childMidY, {
              from: parent.id,
              to: match.id,
            })
          );
          connectors.push(
            makeConnector(junctionX, childMidY, pos.x, childMidY, {
              from: match.id,
              to: match.id,
              parents: parent.id,
            })
          );
        }
      }
    });
  });

  const totalRounds = orderedRounds.length;

  const titles = orderedRounds
    .map((round, idx) => {
      const bestOfLabel = round?.length ? getBestOfForMatch(round[0]) : null;
      const boBadge = bestOfLabel
        ? `<span class="round-bo">Bo${bestOfLabel}</span>`
        : "";

      const label = getRoundLabel(titlePrefix, idx, totalRounds, roundLabelOptions);

      return `<div class="round-title row-title" style="left:${
        offsetX + idx * (CARD_WIDTH + H_GAP)
      }px;">${label} ${boBadge}</div>`;
    })
    .join("");

  const html = `<div class="tree-bracket" style="height:${
    maxY + 20 + matchLayerOffset
  }px; margin-top:${titlePrefix === "Lower" ? 16 : 0}px;">
    ${titles}
    <div class="tree-match-layer" style="transform: translateY(${matchLayerOffset}px); height:${maxY}px;">
      ${matchCards.join("")}
      ${connectors.join("")}
    </div>
  </div>`;

  return { html: DOMPurify.sanitize(html), height: maxY };
}

function formatConnectorMeta(meta = {}) {
  const attrs = [];
  if (meta.from) attrs.push(`data-from="${meta.from}"`);
  if (meta.to) attrs.push(`data-to="${meta.to}"`);
  if (meta.parents) attrs.push(`data-parents="${meta.parents}"`);
  return attrs.join(" ");
}

export function makeConnector(x1, y1, x2, y2, meta = {}) {
  const attr = formatConnectorMeta(meta);
  return `<div class="connector h" ${attr} style="left:${Math.min(
    x1,
    x2
  )}px; top:${y1}px; width:${Math.abs(x2 - x1)}px;"></div>`;
}

export function makeVConnector(x, y1, y2, meta = {}) {
  const attr = formatConnectorMeta(meta);
  return `<div class="connector v" ${attr} style="left:${x}px; top:${Math.min(
    y1,
    y2
  )}px; height:${Math.abs(y2 - y1)}px;"></div>`;
}

function getRoundLabel(titlePrefix, idx, totalRounds, { hasGrandFinal = false } = {}) {
  const fromEnd = totalRounds - idx;

  if (titlePrefix === "Playoffs") {
    if (fromEnd === 1) return "Finals";
    if (fromEnd === 2) return "Semi-Finals";
    return `Round ${idx + 1}`;
  }

  if (titlePrefix === "Upper") {
    if (fromEnd === 1) return hasGrandFinal ? "Grand Final" : "Final";
    if (fromEnd === 2) return hasGrandFinal ? "Upper Final" : "Semi-final";
    if (fromEnd === 3) return hasGrandFinal ? "Semi-final" : "Quarterfinal";
    if (fromEnd === 4) return hasGrandFinal ? "Quarterfinal" : `Upper Round ${idx + 1}`;
    return `Upper Round ${idx + 1}`;
  }

  if (titlePrefix === "Lower") {
    if (fromEnd === 1) return "Lower Final";
    if (fromEnd === 2) return "Lower Semi-final";
    return `Lower Round ${idx + 1}`;
  }

  return `${titlePrefix} Round ${idx + 1}`;
}

export function layoutUpperBracket(bracket, lookup, playersById) {
  const winners = bracket.winners || [];
  if (!winners.length) {
    return `<div class="placeholder">Add players to generate the bracket.</div>`;
  }

  const layout = layoutBracketSection(winners, "Upper", lookup, playersById, 0);

  const titles = winners
    .map((round, idx) => {
      const bestOfLabel = round?.length ? getBestOfForMatch(round[0]) : null;
      const boBadge = bestOfLabel
        ? `<span class="round-bo">Bo${bestOfLabel}</span>`
        : "";
      return `<div class="round-title row-title" style="left:${
        idx * (layout.width || 0)
      }px;">${round.name || `Round ${idx + 1}`} ${boBadge}</div>`;
    })
    .join("");

  const html = `<div class="tree-bracket" style="height:${layout.height + 20}px">
    ${titles}
    ${layout.html}
  </div>`;

  return DOMPurify.sanitize(html);
}

export function getRoundRobinGroupHtml(rendered) {
  return DOMPurify.sanitize(rendered);
}

export function attachMatchHoverHandlers() {
  const grid = document.getElementById("bracketGrid");
  if (!grid) return;

  grid.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".row[data-player-id]");
    if (!target) return;
    const pid = target.dataset.playerId;
    if (!pid) return;

    document.querySelectorAll(".connector").forEach((c) => {
      const players = (c.dataset.players || "").split(",").filter(Boolean);
      if (players.includes(pid)) c.classList.add("highlight");
    });
  });

  grid.addEventListener("mouseout", (e) => {
    if (e.target.closest(".row[data-player-id]")) {
      document
        .querySelectorAll(".connector.highlight")
        .forEach((c) => c.classList.remove("highlight"));
    }
  });
}

export function annotateConnectorPlayers(lookup, playersById) {
  if (!lookup || !playersById) return;

  const participantIds = (match) => {
    if (!match) return new Set();
    const [a, b] = resolveParticipants(match, lookup, playersById);
    const ids = [a?.id, b?.id, match.winnerId, match.loserId].filter(Boolean);
    return new Set(ids);
  };

  document.querySelectorAll(".connector").forEach((el) => {
    const fromId = el.dataset.from;
    const toId = el.dataset.to;
    const parentIds = (el.dataset.parents || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const toMatch = toId ? lookup.get(toId) : null;
    if (!toMatch) {
      el.dataset.players = "";
      return;
    }

    const toSet = participantIds(toMatch);
    let fromUnion = new Set();

    if (fromId) {
      const fromMatch = lookup.get(fromId);
      if (fromMatch) fromUnion = participantIds(fromMatch);
    } else if (parentIds.length) {
      parentIds.forEach((pid) => {
        const m = lookup.get(pid);
        participantIds(m).forEach((id) => fromUnion.add(id));
      });
    }

    let shared = Array.from(fromUnion).filter((id) => toSet.has(id));
    if (
      !shared.length &&
      toMatch &&
      toMatch.winnerId &&
      fromUnion.has(toMatch.winnerId)
    ) {
      shared = [toMatch.winnerId];
    }
    if (!shared.length && fromUnion.size === 1) {
      shared = Array.from(fromUnion);
    }
    if (!shared.length && toSet.size === 1) {
      shared = Array.from(toSet);
    }
    el.dataset.players = shared.join(",");
  });
}

export function renderRoundRobinPlayoffs(bracket, lookup, playersById) {
  const mode = bracket.playoffs?.mode || "None";
  if (!mode || mode.toLowerCase() === "none") return "";
  const ROUND_TITLE_BAND = 60;
  const upperRounds = [...(bracket.winners || [])];
  if (bracket.finals) {
    upperRounds.push([{ ...bracket.finals, name: "Finals" }]);
  }

  const hasUpper = upperRounds.some((r) => r.length);
  const hasLower = (bracket.losers || []).some((r) => r.length);

  if (!hasUpper && !hasLower) {
    return DOMPurify.sanitize(`<div class="playoff-section">
      <div class="section-title">Playoffs (${escapeHtml(mode)})</div>
      <div class="placeholder">Waiting for group results.</div>
    </div>`);
  }

  const upper = layoutBracketSection(
    upperRounds,
    "Playoffs",
    lookup,
    playersById,
    0,
    ROUND_TITLE_BAND
  );

  let lower = { html: "", height: 0 };
  if (hasLower) {
    lower = layoutBracketSection(
      bracket.losers || [],
      "Lower",
      lookup,
      playersById,
      0,
      ROUND_TITLE_BAND
    );
  }

  const html = `<div class="playoff-section">
    <div class="section-title">Playoffs (${escapeHtml(mode)})</div>
    <div class="tree-wrapper">
      ${upper.html}
      ${lower.html}
    </div>
  </div>`;

  return DOMPurify.sanitize(html);
}

export function renderGroupBlock(group, bracket, lookup, playersById) {
  const computeGroupStandings = bracket.computeGroupStandings;
  const standings = computeGroupStandings
    ? computeGroupStandings(bracket, group, playersById, lookup)
    : [];
  const advanceCount = Math.max(
    0,
    Number(bracket?.roundRobin?.advancePerGroup || 0)
  );
  const winsByPlayer = new Map(
    standings.map((row) => [row.playerId, row.wins || 0])
  );
  const remainingByPlayer = new Map();
  const countRemaining = (pid) => {
    if (!pid) return;
    remainingByPlayer.set(pid, (remainingByPlayer.get(pid) || 0) + 1);
  };
  const isMatchComplete = (match) => {
    if (!match) return false;
    if (match.status === "complete" || match.winnerId || match.walkover)
      return true;
    const a = Number(match?.scores?.[0]);
    const b = Number(match?.scores?.[1]);
    const validA = Number.isFinite(a) ? a : 0;
    const validB = Number.isFinite(b) ? b : 0;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return false;
    const bestOf = getBestOfForMatch(match) || 1;
    const needed = Math.max(1, Math.ceil(bestOf / 2));
    return Math.max(validA, validB) >= needed;
  };
  (group.matches || []).forEach((gm) => {
    const match = lookup?.get(gm.id) || gm;
    const srcA = match?.sources?.[0] || {};
    const srcB = match?.sources?.[1] || {};
    const pA = srcA.playerId || null;
    const pB = srcB.playerId || null;
    if (!pA || !pB) return;
    if (isMatchComplete(match)) return;
    countRemaining(pA);
    countRemaining(pB);
  });
  const maxWinsByPlayer = new Map();
  standings.forEach((row) => {
    const remaining = remainingByPlayer.get(row.playerId) || 0;
    maxWinsByPlayer.set(row.playerId, (row.wins || 0) + remaining);
  });
  const isGuaranteed = (playerId) => {
    if (!advanceCount) return false;
    const minWins = winsByPlayer.get(playerId) || 0;
    let ahead = 0;
    let ties = 0;
    standings.forEach((row) => {
      if (row.playerId === playerId) return;
      const otherMax =
        maxWinsByPlayer.get(row.playerId) ?? (row.wins || 0);
      if (otherMax > minWins) {
        ahead += 1;
      } else if (otherMax === minWins) {
        ties += 1;
      }
    });
    const worstRank = 1 + ahead + ties;
    return worstRank <= advanceCount;
  };
  const qualifiedSet = new Set();
  standings.forEach((row) => {
    if (isGuaranteed(row.playerId)) qualifiedSet.add(row.playerId);
  });
  const remainingSlots = Math.max(0, advanceCount - qualifiedSet.size);
  const tieCandidates = new Set();
  if (remainingSlots === 1 && standings.length) {
    const cutoffIndex = Math.min(qualifiedSet.size, standings.length - 1);
    const cutoffRow = standings[cutoffIndex];
    const cutoffKey = `${cutoffRow.wins || 0}|${cutoffRow.mapDiff || 0}`;
    const tiedRows = standings.filter(
      (row) => `${row.wins || 0}|${row.mapDiff || 0}` === cutoffKey
    );
    if (tiedRows.length > 1) {
      tiedRows.forEach((row) => tieCandidates.add(row.playerId));
    }
  }
  const isTied = (playerId) => tieCandidates.has(playerId);
  const standingsRows =
    standings
      .map((row, idx) => {
        const player = playersById.get(row.playerId);
        const diff =
          row.mapDiff > 0 ? `+${row.mapDiff}` : String(row.mapDiff || 0);
        const pid = player?.id || "";
        const qualified = qualifiedSet.has(row.playerId);
        const tied = !qualified && isTied(row.playerId);
        const rowClass = qualified
          ? "is-qualified"
          : tied
          ? "is-tied"
          : "";
        const nameCell = player
          ? `<span class="player-detail-trigger name-text" data-player-id="${pid}">${escapeHtml(
              player.name
            )}</span>`
          : "TBD";
        return `<tr class="${rowClass}">
          <td>${idx + 1}</td>
          <td>${nameCell}</td>
          <td>${row.wins}-${row.losses}</td>
          <td>${diff}</td>
          <td>${row.mapFor}:${row.mapAgainst}</td>
        </tr>`;
      })
      .join("") ||
    `<tr><td colspan="5" class="helper">No results yet.</td></tr>`;

  const matchCards =
    (group.matches || [])
      .map((match) => {
        const [pA, pB] = resolveParticipants(match, lookup, playersById);
        return renderSimpleMatch(
          match,
          pA,
          pB,
          0,
          0,
          90,
          240,
          "",
          "",
          "group",
          lookup
        );
      })
      .join("") || `<div class="helper">No matches yet.</div>`;

  const html = `<div class="group-block">
    <div class="group-header">
      <h4>${escapeHtml(group.name || "Group")}</h4>
      <span class="helper">${group.playerIds?.length || 0} players</span>
    </div>
    <div class="group-body">
      <div class="group-standings">
        <div class="eyebrow">Standings</div>
        <table>
          <thead>
            <tr><th>#</th><th>Player</th><th>W-L</th><th>Diff</th><th>Maps</th></tr>
          </thead>
          <tbody>${standingsRows}</tbody>
        </table>
      </div>
      <div class="group-matches">
        <div class="eyebrow">Matches</div>
        <div class="group-match-list">${matchCards}</div>
      </div>
    </div>
  </div>`;

  return DOMPurify.sanitize(html);
}

export function renderRoundRobinView(
  bracket,
  playersById,
  computeGroupStandings
) {
  if (!bracket || !(bracket.groups || []).length) {
    return DOMPurify.sanitize(
      `<div class="placeholder">Add players to generate the bracket.</div>`
    );
  }
  buildMatchLetters(bracket);
  const lookup = getMatchLookup(bracket);
  const groups = bracket.groups || [];
  const groupHtml = groups
    .map((group) =>
      renderGroupBlock(group, { ...bracket, computeGroupStandings }, lookup, playersById)
    )
    .join("");

  const playoffsHtml = renderRoundRobinPlayoffs(bracket, lookup, playersById);

  return DOMPurify.sanitize(`<div class="group-stage">
    ${groupHtml}
  </div>
  ${playoffsHtml}`);
}

export function renderBracketView({
  bracket,
  players,
  format,
  ensurePlayoffs,
  getPlayersMap,
  attachMatchActionHandlers,
  computeGroupStandings,
  currentUsername,
}) {
  const grid = document.getElementById("bracketGrid");
  if (!grid) return;

  setCurrentUsernameHint(currentUsername);

  if (!bracket || !players.length) {
    grid.innerHTML = DOMPurify.sanitize(
      `<div class="placeholder">Add players to generate the bracket.</div>`
    );
    return;
  }

  buildMatchLetters(bracket);

  const isSingleElimination = format.toLowerCase().startsWith("single");
  const isRoundRobin = format.toLowerCase().includes("round robin");

  if (isRoundRobin) {
    ensurePlayoffs?.(bracket);
  }

  const lookup = getMatchLookup(bracket);
  const playersById = getPlayersMap();

  if (isRoundRobin) {
    grid.innerHTML = renderRoundRobinView(
      { ...bracket, computeGroupStandings },
      playersById,
      computeGroupStandings
    );
    attachMatchHoverHandlers();
    attachMatchActionHandlers?.();
    clampScoreSelectOptions();
    annotateConnectorPlayers(lookup, playersById);
    return;
  }

  const upperRounds = [...(bracket.winners || [])];

  if (bracket.finals) {
    upperRounds.push([{ ...bracket.finals, name: "Finals" }]);
  }

  const ROUND_TITLE_BAND = 60;
  const upper = layoutBracketSection(
    upperRounds,
    "Upper",
    lookup,
    playersById,
    0,
    ROUND_TITLE_BAND,
    { hasGrandFinal: Boolean(bracket.finals) }
  );

  let lower = { html: "", height: 0 };

  if (!isSingleElimination) {
    const lowerRounds = bracket.losers || [];
    lower = lowerRounds.length
      ? layoutBracketSection(
          lowerRounds,
          "Lower",
          lookup,
          playersById,
          0,
          ROUND_TITLE_BAND
        )
      : { html: "", height: 0 };
  }

  grid.innerHTML = DOMPurify.sanitize(`<div class="tree-wrapper">
    ${upper.html}
    ${lower.html}
  </div>`);

  attachMatchHoverHandlers();
  attachMatchActionHandlers?.();
  clampScoreSelectOptions();
  annotateConnectorPlayers(lookup, playersById);
}
