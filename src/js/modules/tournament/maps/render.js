import DOMPurify from "dompurify";
import { escapeHtml } from "../bracket/renderUtils.js";

export function renderMapsTab(tournament, { mapPoolSelection, getDefaultMapPoolNames, getMapByName }) {
  const grid = document.getElementById("tournamentMapGrid");
  if (!grid) return;
  const poolNames =
    tournament?.mapPool && tournament.mapPool.length
      ? tournament.mapPool
      : getDefaultMapPoolNames();
  if (!poolNames.length) {
    grid.innerHTML = DOMPurify.sanitize(`<p class="helper">No maps selected yet.</p>`);
    return;
  }
  const cards = poolNames.map((name) => {
    const map = getMapByName(name);
    const imgPath = map ? `img/maps/${map.folder}/${map.file}` : null;
    return `<div class="tournament-map-card">
      <div class="map-thumb"${imgPath ? ` style="background-image:url('${imgPath}')"` : ""}></div>
      <div class="map-meta">
        <div class="map-name" translate="no">${escapeHtml(name)}</div>
        <span class="map-mode">${escapeHtml(map?.mode || "1v1")}</span>
      </div>
    </div>`;
  });
  grid.innerHTML = DOMPurify.sanitize(cards.join(""));
}

export function renderChosenMaps(targetId, { mapPoolSelection, getMapByName }) {
  const container = document.getElementById(targetId || "chosenMapList");
  if (!container) return;
  const selectedNames = Array.from(mapPoolSelection);
  if (!selectedNames.length) {
    container.innerHTML = DOMPurify.sanitize(`<p class="helper">No maps selected.</p>`);
    return;
  }
  const cards = selectedNames.map((name) => {
    const map = getMapByName(name);
    const imgPath = map ? `img/maps/${map.folder}/${map.file}` : null;
    return `<div class="tournament-map-card selected">
      <div class="map-thumb"${imgPath ? ` style="background-image:url('${imgPath}')"` : ""}></div>
      <div class="map-meta">
        <div class="map-name" translate="no">${escapeHtml(name)}</div>
        <span class="map-mode">${escapeHtml(map?.mode || "1v1")}</span>
      </div>
    </div>`;
  });
  container.innerHTML = DOMPurify.sanitize(cards.join(""));
}

export function updateMapButtons(currentMapPoolMode) {
  const ladderBtns = [
    document.getElementById("useLadderMapsBtn"),
    document.getElementById("settingsUseLadderMapsBtn"),
  ];
  const customBtns = [
    document.getElementById("clearMapPoolBtn"),
    document.getElementById("settingsClearMapPoolBtn"),
  ];
  const isLadder = currentMapPoolMode === "ladder";
  ladderBtns.forEach((btn) => btn?.classList.toggle("active", isLadder));
  customBtns.forEach((btn) => btn?.classList.toggle("active", !isLadder));
}
