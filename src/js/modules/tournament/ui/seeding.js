import { escapeHtml } from "../bracket/renderUtils.js";

export function renderSeedingTable(
  players = [],
  { isLive = false, isAdmin = false, manualSeeding = false } = {}
) {
  const body = document.getElementById("playersTableBody");
  if (!body) return;
  body.classList.toggle("manual-seeding-active", manualSeeding && !isLive);
  body.classList.toggle("manual-seeding-locked", manualSeeding && isLive);

  const normalizeInviteStatus = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "pending" || normalized === "denied" || normalized === "accepted") {
      return normalized;
    }
    return "accepted";
  };

  const rows = (players || []).map((p, idx) => {
    const seed = idx + 1;
    const name = escapeHtml(p.name || "Unknown");
    const race = (p.race || "").trim();
    const inviteStatus = normalizeInviteStatus(p.inviteStatus);
    const statusLabel =
      inviteStatus === "pending"
        ? "Pending"
        : inviteStatus === "denied"
        ? "Denied"
        : "Accepted";
    const points = Number.isFinite(p.points) ? p.points : 0;
    const mmr = Number.isFinite(p.mmr) ? Math.round(p.mmr) : null;
    const pulseLink = p.sc2Link || "";
    const raceTag =
      inviteStatus === "pending"
        ? `<span class="helper">TBD</span>`
        : race
        ? `<span class="helper">${escapeHtml(race)}</span>`
        : "";
    const pulseHtml = pulseLink
      ? `<a href="${escapeHtml(pulseLink)}" target="_blank" rel="noopener">Link</a>`
      : "-";
    const isInviteLocked = inviteStatus !== "accepted";
    const checkinPill = `<span class="checkin-pill ${p.checkedInAt ? "is-checked" : "is-missing"}">
        ${p.checkedInAt ? "Checked in" : "Not checked in"}
      </span>`;
    const checkInAction = isAdmin
      ? isInviteLocked
        ? `<span class="helper">-</span>`
        : `<div class="checkin-editor">
          <select
            class="checkin-select checkin-select-pill ${p.checkedInAt ? "is-checked" : "is-missing"}"
            data-player-id="${escapeHtml(p.id || "")}"
          >
            <option value="checked" ${p.checkedInAt ? "selected" : ""}>Checked in</option>
            <option value="not" ${p.checkedInAt ? "" : "selected"}>Not checked in</option>
          </select>
        </div>`
      : isInviteLocked
      ? `<span class="helper">-</span>`
      : checkinPill;

    const isForfeit = Boolean(p.forfeit);
    const forfeitUndoBlocked = Boolean(p.forfeitUndoBlocked);
    const forfeitAction = isAdmin && isLive
      ? (() => {
        if (isForfeit && forfeitUndoBlocked) {
          return `<span class="forfeit-tooltip" data-tooltip="Cannot undo after a later match has a recorded score.">
            <button
              class="cta small ghost forfeit-player"
              data-player-id="${escapeHtml(p.id || "")}"
              data-forfeit="false"
              disabled
              aria-disabled="true"
            >
              Undo
            </button>
          </span>`;
        }
        return `<button
          class="cta small ${isForfeit ? "ghost" : "danger"} forfeit-player"
          data-player-id="${escapeHtml(p.id || "")}"
          data-forfeit="${isForfeit ? "false" : "true"}"
        >
          ${isForfeit ? "Undo" : "Forfeit"}
        </button>`;
      })()
      : `<span class="helper">-</span>`;

    const dragHandle = manualSeeding
      ? `<span class="seeding-drag-handle ${isLive ? "is-disabled" : ""}" title="Drag to reorder" aria-hidden="true" ${isLive ? "" : 'draggable="true"'}>&equiv;</span>`
      : "";

    return `
      <tr data-player-id="${escapeHtml(p.id || "")}">
        <td class="seed-cell">
          <div class="seed-cell-inner">
            ${dragHandle}
            <span class="seed-index">#${seed}</span>
          </div>
        </td>
        <td>
          <div class="player-line">
            <span class="player-name">${name}</span>
            ${raceTag}
          </div>
        </td>
        <td>
          <span class="seed-status ${inviteStatus}">${statusLabel}</span>
        </td>
        <td>
          <input
            type="number"
            class="points-input"
            data-player-id="${escapeHtml(p.id || "")}"
            value="${points}"
            min="0"
            ${isLive || isInviteLocked ? "disabled" : ""}
          />
        </td>
        <td>${mmr ?? "-"}</td>
        <td>${pulseHtml}</td>
        <td>
          <div class="checkin-cell">
            ${checkInAction}
          </div>
        </td>
        <td>
          ${forfeitAction}
        </td>
        <td>
          ${
            isLive
              ? `<span class="helper">Locked</span>`
              : `<button
                  class="cta small subtle remove-player"
                  data-player-id="${escapeHtml(p.id || "")}"
                >
                  Remove
                </button>`
          }
        </td>
      </tr>
    `;
  });

  // Values are escaped already; avoid sanitizing away table cells.
  body.innerHTML = rows.join("");
}
