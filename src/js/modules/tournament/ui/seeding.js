import { escapeHtml } from "../bracket/renderUtils.js";

export function renderSeedingTable(players = []) {
  const body = document.getElementById("playersTableBody");
  if (!body) return;

  const rows = (players || []).map((p, idx) => {
    const seed = idx + 1;
    const name = escapeHtml(p.name || "Unknown");
    const race = (p.race || "").trim();
    const points = Number.isFinite(p.points) ? p.points : 0;
    const mmr = Number.isFinite(p.mmr) ? Math.round(p.mmr) : null;
    const pulseLink = p.sc2Link || "";
    const raceTag = race ? `<span class="helper">${escapeHtml(race)}</span>` : "";
    const pulseHtml = pulseLink
      ? `<a href="${escapeHtml(pulseLink)}" target="_blank" rel="noopener">Link</a>`
      : "-";

    return `
      <tr>
        <td>#${seed}</td>
        <td>
          <div class="player-line">
            <span class="player-name">${name}</span>
            ${raceTag}
          </div>
        </td>
        <td>
          <input
            type="number"
            class="points-input"
            data-player-id="${escapeHtml(p.id || "")}"
            value="${points}"
            min="0"
          />
        </td>
        <td>${mmr ?? "-"}</td>
        <td>${pulseHtml}</td>
        <td>
          <button
            class="cta small subtle remove-player"
            data-player-id="${escapeHtml(p.id || "")}"
          >
            Remove
          </button>
        </td>
      </tr>
    `;
  });

  // Values are escaped already; avoid sanitizing away table cells.
  body.innerHTML = rows.join("");
}
