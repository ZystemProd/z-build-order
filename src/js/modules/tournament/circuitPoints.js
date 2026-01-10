import { currentTournamentMeta, currentSlug, state, setStateObj } from "./state.js";
import { computeEliminationPlacements } from "./bracket/placements.js";
import { playerKey } from "./playerKey.js";
import { fetchCircuitMeta, normalizeCircuitTournamentSlugs } from "./circuit.js";
import { loadTournamentStateRemote } from "./sync/persistence.js";

const DEFAULT_CIRCUIT_POINTS = [
  { place: 1, points: 20 },
  { place: 2, points: 10 },
  { place: 3, points: 5 },
  { place: 4, points: 2 },
];

export function normalizeCircuitPoints(list = []) {
  const raw = Array.isArray(list) ? list : [];
  const rows = raw
    .map((row) => ({
      place: Number(row?.place),
      points: Number(row?.points),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.place) &&
        row.place > 0 &&
        Number.isFinite(row.points) &&
        row.points >= 0
    );
  const deduped = new Map();
  rows.forEach((row) => deduped.set(row.place, row.points));
  return Array.from(deduped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([place, points]) => ({ place, points }));
}

export function readCircuitPointsTable() {
  const rows = Array.from(
    document.querySelectorAll("[data-circuit-points-row]")
  );
  const values = rows
    .map((row) => {
      const placeInput = row.querySelector("[data-circuit-place]");
      const pointsInput = row.querySelector("[data-circuit-points]");
      return {
        place: Number(placeInput?.value),
        points: Number(pointsInput?.value),
      };
    })
    .filter(
      (row) =>
        Number.isFinite(row.place) &&
        row.place > 0 &&
        Number.isFinite(row.points) &&
        row.points >= 0
    );
  return normalizeCircuitPoints(values);
}

export function renderCircuitPointsTable(points) {
  const body = document.getElementById("circuitPointsBody");
  if (!body) return;
  const normalized = normalizeCircuitPoints(points);
  const rows = normalized.length ? normalized : DEFAULT_CIRCUIT_POINTS;
  body.innerHTML = rows
    .map(
      (row) => `
      <tr data-circuit-points-row>
        <td>
          <input type="number" min="1" data-circuit-place name="circuit-place-${row.place}" value="${row.place}" />
        </td>
        <td>
          <input type="number" min="0" data-circuit-points name="circuit-points-${row.place}" value="${row.points}" />
        </td>
        <td>
          <button class="cta small ghost circuit-remove-btn" type="button" data-circuit-remove="true">
            Remove
          </button>
        </td>
      </tr>
    `
    )
    .join("");
}

export function renderCircuitPointsSettings() {
  const panel = document.getElementById("circuitPointsPanel");
  const tabBtn = document.getElementById("circuitPointsTabBtn");
  if (!panel) return;
  const isCircuit = Boolean(currentTournamentMeta?.circuitSlug);
  panel.style.display = isCircuit ? "block" : "none";
  if (tabBtn) tabBtn.style.display = isCircuit ? "" : "none";
  if (!isCircuit && tabBtn?.classList.contains("active")) {
    window.__switchTournamentTab?.("settingsTab");
  }
  if (!isCircuit) return;
  renderCircuitPointsTable(currentTournamentMeta?.circuitPoints || []);
  const statusEl = document.getElementById("circuitPointsStatus");
  if (statusEl) statusEl.textContent = "";
  const applyBtn = document.getElementById("applyCircuitPointsBtn");
  if (applyBtn) {
    const applied = Boolean(currentTournamentMeta?.circuitPointsApplied);
    applyBtn.disabled = applied;
    applyBtn.textContent = applied ? "Points applied" : "Apply points to players";
  }
}

export function handleAddCircuitPointsRow(event) {
  event?.preventDefault?.();
  const rows = readCircuitPointsTable();
  const maxPlace = rows.reduce((max, row) => Math.max(max, row.place), 0);
  rows.push({ place: maxPlace + 1, points: 0 });
  renderCircuitPointsTable(rows);
}

export function handleRemoveCircuitPointsRow(event) {
  event?.preventDefault?.();
  const row = event.target.closest("[data-circuit-points-row]");
  if (!row) return;
  row.remove();
}

const seedCache = {
  slug: "",
  currentSlug: "",
  map: null,
};

async function loadCircuitSeedPoints(circuitSlug, excludeSlug) {
  if (!circuitSlug) return new Map();
  if (
    seedCache.map &&
    seedCache.slug === circuitSlug &&
    seedCache.currentSlug === (excludeSlug || "")
  ) {
    return seedCache.map;
  }
  const meta = await fetchCircuitMeta(circuitSlug);
  if (!meta) return new Map();
  const slugs = normalizeCircuitTournamentSlugs(meta).filter(
    (slug) => slug && slug !== excludeSlug
  );
  const states = await Promise.all(
    slugs.map((slug) => loadTournamentStateRemote(slug))
  );
  const totals = new Map();
  states.forEach((snapshot) => {
    if (!snapshot) return;
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    players.forEach((player) => {
      const key = playerKey(player.name, player.sc2Link);
      if (!key) return;
      const ledgerPoints = Number(snapshot.pointsLedger?.[key]);
      const useLedger = Number.isFinite(ledgerPoints);
      const playerPoints = Number(player.points);
      const rawPoints = useLedger ? ledgerPoints : playerPoints;
      const points = Number.isFinite(rawPoints) ? rawPoints : 0;
      const current = totals.get(key) || 0;
      totals.set(key, current + points);
    });
  });
  seedCache.slug = circuitSlug;
  seedCache.currentSlug = excludeSlug || "";
  seedCache.map = totals;
  return totals;
}

export async function getCircuitSeedPoints({
  name,
  sc2Link,
  circuitSlug,
  tournamentSlug,
} = {}) {
  const key = playerKey(name, sc2Link);
  if (!key || !circuitSlug) return 0;
  const totals = await loadCircuitSeedPoints(circuitSlug, tournamentSlug || "");
  return totals.get(key) || 0;
}


export function handleApplyCircuitPoints(event, { saveState, renderAll } = {}) {
  event?.preventDefault?.();
  const statusEl = document.getElementById("circuitPointsStatus");
  if (currentTournamentMeta?.circuitPointsApplied) {
    if (statusEl) statusEl.textContent = "Points have already been applied.";
    return { applied: false, reason: "already_applied" };
  }
  const scheme = readCircuitPointsTable();
  if (!scheme.length) {
    if (statusEl) statusEl.textContent = "Add at least one placement row.";
    return { applied: false, reason: "missing_scheme" };
  }
  const { placements, error } = computeEliminationPlacements({
    bracket: state.bracket,
    totalPlayers: state.players?.length || 0,
    format: currentTournamentMeta?.format || "",
  });
  if (error) {
    if (statusEl) statusEl.textContent = error;
    return { applied: false, reason: "placement_error" };
  }
  const pointsByPlace = new Map(
    scheme.map((row) => [row.place, row.points])
  );
  const pointsLedger = { ...(state.pointsLedger || {}) };
  let updated = 0;
  const players = (state.players || []).map((player) => {
    const placement = placements.get(player.id);
    if (!placement) return player;
    const points = pointsByPlace.get(placement);
    if (!Number.isFinite(points)) return player;
    const key = playerKey(player.name, player.sc2Link);
    const existingEarned = Number(pointsLedger[key]);
    const earnedBefore = Number.isFinite(existingEarned) ? existingEarned : 0;
    const existingTotal = Number(player.points);
    const basePoints = Number.isFinite(existingTotal)
      ? Math.max(0, existingTotal - earnedBefore)
      : 0;
    const nextTotal = basePoints + points;
    if (key) pointsLedger[key] = points;
    updated += 1;
    return { ...player, points: nextTotal };
  });

  setStateObj({ ...state, players, pointsLedger });
  saveState?.({ players, pointsLedger });
  renderAll?.();
  if (statusEl) statusEl.textContent = `Applied points to ${updated} players.`;
  return { applied: true, updated };
}
