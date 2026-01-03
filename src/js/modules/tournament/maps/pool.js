import DOMPurify from "dompurify";
import { escapeHtml } from "../bracket/renderUtils.js";

export function renderMapPoolPicker(
  targetId,
  { mapPoolSelection, getAll1v1Maps } = {}
) {
  const pool = mapPoolSelection instanceof Set ? mapPoolSelection : new Set();
  const maps =
    typeof getAll1v1Maps === "function" ? getAll1v1Maps() : [];
  const picker = document.getElementById(targetId || "mapPoolPicker");
  if (!picker) return;
  const cards = maps.map((map) => {
    const selected = pool.has(map.name);
    const imgPath = `img/maps/${map.folder}/${map.file}`;
    return `<div class="tournament-map-card ${
      selected ? "selected" : ""
    }" data-map-name="${escapeHtml(map.name)}">
      <div class="map-thumb" style="background-image:url('${imgPath}')"></div>
      <div class="map-meta">
        <div class="map-name">${escapeHtml(map.name)}</div>
        <span class="map-mode">${map.mode || "1v1"}</span>
      </div>
    </div>`;
  });
  picker.innerHTML = DOMPurify.sanitize(cards.join(""));
}
