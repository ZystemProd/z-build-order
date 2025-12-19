import DOMPurify from "dompurify";
import {
  MAX_SECONDARY_PULSE_LINKS,
  DEFAULT_PLAYER_AVATAR,
  playerDetailModalInitialized,
  setPlayerDetailModalInitializedState,
} from "./state.js";
import { escapeHtml } from "./bracket/renderUtils.js";

function formatPulseLinks(list = [], linkClass = "secondary-pulse-link") {
  if (!Array.isArray(list) || !list.length) {
    return DOMPurify.sanitize(`<p class="helper">No secondary links</p>`);
  }

  const items = list.slice(0, MAX_SECONDARY_PULSE_LINKS).map((entry, idx) => {
    const normalized =
      typeof entry === "string"
        ? { url: entry }
        : entry && typeof entry === "object"
        ? entry
        : {};
    const url = normalized.url || "";
    const name =
      (normalized.name && escapeHtml(String(normalized.name))) ||
      `SC2Pulse #${idx + 1}`;
    if (!url) {
      return `<div class="secondary-pulse-row readonly"><span class="pill">${name}</span><span class="muted">No link</span></div>`;
    }
    return `<div class="secondary-pulse-row readonly"><a class="${escapeHtml(
      linkClass
    )}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${name}</a></div>`;
  });

  const html = `
    <div class="secondary-section-header">Secondary Accounts</div>
    ${items.join("")}
  `;

  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

function formatMmrByRace(player) {
  const list = document.getElementById("playerDetailMmrList");
  if (!list) return;
  const mmrByRace = player?.mmrByRace || {};
  const races = ["Zerg", "Protoss", "Terran", "Random"];
  const rows = races.map((race) => {
    const key = race.toLowerCase();
    const value = Number.isFinite(mmrByRace?.[key]) ? Math.round(mmrByRace[key]) : null;
    const display = value !== null ? `${value}` : "No MMR";
    return `<li><span class="pill">${race}</span><strong>${display}</strong></li>`;
  });
  list.innerHTML = DOMPurify.sanitize(rows.join(""));
}

function resolvePlayerAvatar(player) {
  const userPhoto = document.getElementById("userPhoto")?.src;
  return player?.avatarUrl || userPhoto || DEFAULT_PLAYER_AVATAR;
}

export function setupPlayerDetailModal() {
  if (playerDetailModalInitialized) return;
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const closeBtn = document.getElementById("closePlayerDetailModal");

  const hide = () => {
    modal.style.display = "none";
  };
  const show = () => {
    modal.style.display = "block";
  };

  closeBtn?.addEventListener("click", hide);
  window.addEventListener("mousedown", (e) => {
    if (e.target === modal) hide();
  });

  modal.dataset.ready = "true";
  modal.showModal = show;
  setPlayerDetailModalInitializedState(true);
}

export function attachPlayerDetailHandlers({ getPlayersMap }) {
  setupPlayerDetailModal();
  const bracketGrid = document.getElementById("bracketGrid");
  const playersTable = document.getElementById("playersTableBody");

  const handler = (e) => {
    const inRoundRobinGroupStage = Boolean(e.target.closest(".group-stage"));
    if (inRoundRobinGroupStage) {
      const nameTarget = e.target.closest(".name-text");
      if (!nameTarget) return;
      const trigger =
        nameTarget.closest("[data-player-id]") ||
        nameTarget.closest(".row[data-player-id]");
      const pid = trigger?.dataset?.playerId;
      if (!pid) return;
      const player = getPlayersMap().get(pid);
      if (player) openPlayerDetailModal(player);
      return;
    }

    if (
      e.target.closest("select") ||
      e.target.closest(".remove-player") ||
      e.target.closest(".points-input")
    ) {
      return;
    }
    const trigger = e.target.closest("[data-player-id]");
    if (!trigger) return;
    const pid = trigger.dataset.playerId;
    if (!pid) return;
    const player = getPlayersMap().get(pid);
    if (player) {
      openPlayerDetailModal(player);
    }
  };

  bracketGrid?.addEventListener("click", handler);
  playersTable?.addEventListener("click", handler);
}

export function openPlayerDetailModal(player) {
  const modal = document.getElementById("playerDetailModal");
  if (!modal) return;
  const avatar = document.getElementById("playerDetailAvatar");
  const nameEl = document.getElementById("playerDetailName");
  const clanEl = document.getElementById("playerDetailClan");
  const raceEl = document.getElementById("playerDetailRace");
  const pointsEl = document.getElementById("playerDetailPoints");
  const mainPulseEl = document.getElementById("playerDetailMainPulse");
  const secondaryEl = document.getElementById("playerDetailSecondary");
  const twitchEl = document.getElementById("playerDetailTwitch");
  const achievementsEl = document.getElementById("playerDetailAchievements");

  const avatarUrl = resolvePlayerAvatar(player);
  if (avatar) avatar.src = avatarUrl;
  if (nameEl) {
    const abbr = player?.clanAbbreviation;
    const displayName = player?.pulseName || player?.name;
    const safeName = displayName || "Player";
    nameEl.textContent = abbr ? `[${abbr}] ${safeName}` : safeName;
  }
  if (clanEl) {
    const clan = player?.clan || "";
    clanEl.textContent = clan || "No clan";
    clanEl.style.display = clan ? "inline-flex" : "none";
  }
  if (raceEl) raceEl.textContent = player?.race || "";
  if (pointsEl)
    pointsEl.textContent = `${player?.points || 0} pts  ${player?.mmr || 0} MMR`;

  if (mainPulseEl) {
    const displayName = player?.pulseName || "Main SC2Pulse";
    if (player?.sc2Link) {
      mainPulseEl.href = player.sc2Link;
      mainPulseEl.textContent = displayName;
    } else {
      mainPulseEl.removeAttribute("href");
      mainPulseEl.textContent = "Not provided";
    }
  }

  if (secondaryEl) {
    const secondaryProfiles =
      player?.secondaryPulseProfiles && player.secondaryPulseProfiles.length
        ? player.secondaryPulseProfiles
        : player?.secondaryPulseLinks && player.secondaryPulseLinks.length
        ? player.secondaryPulseLinks
        : [];
    const linkClass =
      (mainPulseEl && mainPulseEl.className) || "secondary-pulse-link";
    secondaryEl.innerHTML = formatPulseLinks(secondaryProfiles, linkClass);
  }

  if (twitchEl) {
    const twitchUrl = player?.twitchUrl || "";
    if (twitchUrl) {
      twitchEl.href = twitchUrl;
      twitchEl.innerHTML = `<img src="img/SVG/glitch_flat_purple.svg" class="menu-icon settings-list-icon" aria-hidden="true" /> ${escapeHtml(
        twitchUrl
      )}`;
    } else {
      twitchEl.removeAttribute("href");
      twitchEl.textContent = "Not provided";
    }
  }

  if (achievementsEl) {
    achievementsEl.textContent = "Coming soon: tournament wins and milestones.";
  }

  formatMmrByRace(player);
  modal.dataset.ready = "true";
  modal.showModal?.();
}
