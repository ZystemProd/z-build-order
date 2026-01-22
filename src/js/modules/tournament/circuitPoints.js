import { currentTournamentMeta, currentSlug, state, setStateObj } from "./state.js";
import { computeEliminationPlacements } from "./bracket/placements.js";
import { fetchCircuitMeta, normalizeCircuitTournamentSlugs, getLeaderboardKey } from "./circuit.js";
import { loadTournamentStateRemote } from "./sync/persistence.js";

const DEFAULT_CIRCUIT_POINTS = [
  { place: 1, points: 20 },
  { place: 2, points: 10 },
  { place: 3, points: 5 },
  { place: 4, points: 2 },
];

const DEFAULT_MAX_PLACEMENT = 64;
let circuitPointsLocked = true;

function resolveMaxPlacement() {
  const metaMax = Number(currentTournamentMeta?.maxPlayers);
  if (Number.isFinite(metaMax) && metaMax > 0) return metaMax;
  const rosterMax = Number(state.players?.length || 0);
  if (Number.isFinite(rosterMax) && rosterMax > 0) return rosterMax;
  return DEFAULT_MAX_PLACEMENT;
}

function buildPlacementOptions(maxPlayers) {
  const max = Number.isFinite(maxPlayers) && maxPlayers > 0
    ? maxPlayers
    : DEFAULT_MAX_PLACEMENT;
  const options = [
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
  ];
  let start = 5;
  let size = 2;
  while (start <= max) {
    const end = Math.min(max, start + size - 1);
    const label = start === end ? `${start}` : `${start}/${end}`;
    options.push({ value: start, label });
    start = end + 1;
    size *= 2;
  }
  return options;
}

function renderPlacementOptions(options, selected) {
  const hasSelected = options.some((opt) => opt.value === selected);
  const fullOptions = hasSelected
    ? options
    : Number.isFinite(selected) && selected > 0
    ? [...options, { value: selected, label: String(selected) }]
    : options;
  return fullOptions
    .map(
      (opt) =>
        `<option value="${opt.value}"${
          opt.value === selected ? " selected" : ""
        }>${opt.label}</option>`
    )
    .join("");
}

function renderBelowPlacementOptions(options, selected) {
  const normalized = Number.isFinite(selected) && selected > 0 ? selected : 0;
  const hasSelected = options.some((opt) => opt.value === normalized);
  const fullOptions =
    normalized > 0 && !hasSelected
      ? [...options, { value: normalized, label: String(normalized) }]
      : options;
  const base = [
    `<option value="0"${normalized === 0 ? " selected" : ""}>Off</option>`,
  ];
  const rest = fullOptions.map(
    (opt) =>
      `<option value="${opt.value}"${
        opt.value === normalized ? " selected" : ""
      }>${opt.label}+</option>`
  );
  return base.concat(rest).join("");
}

export function normalizeCircuitPoints(list = []) {
  const raw = Array.isArray(list) ? list : [];
  let below = null;
  const rows = raw
    .map((row) => ({
      place: Number(row?.place),
      points: Number(row?.points),
      below: Boolean(row?.below),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.place) &&
        row.place > 0 &&
        Number.isFinite(row.points) &&
        row.points >= 0
    );
  rows.forEach((row) => {
    if (row.below) below = { place: row.place, points: row.points };
  });
  const deduped = new Map();
  rows
    .filter((row) => !row.below)
    .forEach((row) => deduped.set(row.place, row.points));
  const normalized = Array.from(deduped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([place, points]) => ({ place, points }));
  return { rows: normalized, below };
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
  const belowRow = document.querySelector("[data-circuit-below-row]");
  const belowPlace = Number(
    belowRow?.querySelector("[data-circuit-below-place]")?.value
  );
  const belowPoints = Number(
    belowRow?.querySelector("[data-circuit-below-points]")?.value
  );
  const normalized = normalizeCircuitPoints(values);
  const belowValid =
    Number.isFinite(belowPlace) &&
    belowPlace > 0 &&
    Number.isFinite(belowPoints) &&
    belowPoints >= 0;
  let below = normalized.below;
  if (belowValid) {
    below = { place: belowPlace, points: belowPoints, below: true };
  }
  const filteredRows = below
    ? normalized.rows.filter((row) => row.place < below.place)
    : normalized.rows;
  const result = [...filteredRows];
  if (below) result.push({ ...below, below: true });
  return result;
}

export function renderCircuitPointsTable(points) {
  const body = document.getElementById("circuitPointsBody");
  if (!body) return;
  body.dataset.dirty = "false";
  const normalized = normalizeCircuitPoints(points);
  const below = normalized.below;
  const rows = (normalized.rows.length
    ? normalized.rows
    : DEFAULT_CIRCUIT_POINTS
  ).filter((row) => !below || row.place < below.place);
  const options = buildPlacementOptions(resolveMaxPlacement());
  body.innerHTML = rows
    .map(
      (row) => `
      <tr data-circuit-points-row>
        <td>
          <select data-circuit-place name="circuit-place-${row.place}">
            ${renderPlacementOptions(options, row.place)}
          </select>
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
    .join("")
    .concat(
      `
      <tr class="circuit-points-divider">
        <td colspan="3">Below placement (tie all remaining)</td>
      </tr>
      <tr data-circuit-below-row class="circuit-points-below-row">
        <td>
          <select data-circuit-below-place name="circuit-below-place">
            ${renderBelowPlacementOptions(options, below?.place || 0)}
          </select>
        </td>
        <td>
          <input type="number" min="0" data-circuit-below-points name="circuit-below-points" value="${
            Number.isFinite(below?.points) ? below.points : 0
          }" />
        </td>
        <td></td>
      </tr>
    `
    );
  applyCircuitPointsLockState();
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
  const body = document.getElementById("circuitPointsBody");
  if (!(body && body.dataset.dirty === "true")) {
    renderCircuitPointsTable(currentTournamentMeta?.circuitPoints || []);
  }
  applyCircuitPointsLockState();
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
  if (circuitPointsLocked) return;
  const rows = readCircuitPointsTable();
  const normalized = normalizeCircuitPoints(rows);
  const below = normalized.below;
  const used = new Set(normalized.rows.map((row) => row.place));
  const options = buildPlacementOptions(resolveMaxPlacement());
  const next = options.find(
    (opt) => !used.has(opt.value) && (!below || opt.value < below.place)
  );
  if (!next) return;
  normalized.rows.push({ place: next.value, points: 0 });
  const nextScheme = [...normalized.rows];
  if (below) nextScheme.push({ ...below, below: true });
  renderCircuitPointsTable(nextScheme);
}

export function handleRemoveCircuitPointsRow(event) {
  event?.preventDefault?.();
  if (circuitPointsLocked) return;
  const row = event.target.closest("[data-circuit-points-row]");
  if (!row) return;
  row.remove();
  const body = document.getElementById("circuitPointsBody");
  if (body) body.dataset.dirty = "true";
}

export function handleCircuitPointsChange(event) {
  const target = event.target;
  if (!target) return;
  if (circuitPointsLocked) return;
  const isPlacementField =
    target.matches("[data-circuit-place]") ||
    target.matches("[data-circuit-below-place]");
  const isPointsField =
    target.matches("[data-circuit-points]") ||
    target.matches("[data-circuit-below-points]");
  if (!isPlacementField && !isPointsField) return;
  const body = document.getElementById("circuitPointsBody");
  if (body) body.dataset.dirty = "true";
  if (!isPlacementField) return;
  const belowRow = document.querySelector("[data-circuit-below-row]");
  const belowPlace = Number(
    belowRow?.querySelector("[data-circuit-below-place]")?.value
  );
  if (!Number.isFinite(belowPlace) || belowPlace <= 0) return;
  const rows = Array.from(
    document.querySelectorAll("[data-circuit-points-row]")
  );
  rows.forEach((row) => {
    const placeValue = Number(
      row.querySelector("[data-circuit-place]")?.value
    );
    if (Number.isFinite(placeValue) && placeValue >= belowPlace) {
      row.remove();
    }
  });
}

export function handleEditCircuitPoints(event) {
  event?.preventDefault?.();
  if (!circuitPointsLocked) return;
  circuitPointsLocked = false;
  applyCircuitPointsLockState();
}

export async function handleSaveCircuitPoints(
  event,
  { handleSaveSettings } = {}
) {
  event?.preventDefault?.();
  if (circuitPointsLocked) return;
  if (typeof handleSaveSettings === "function") {
    await handleSaveSettings();
  }
  circuitPointsLocked = true;
  const body = document.getElementById("circuitPointsBody");
  if (body) body.dataset.dirty = "false";
  applyCircuitPointsLockState();
}

function applyCircuitPointsLockState() {
  const panel = document.getElementById("circuitPointsPanel");
  if (!panel) return;
  const body = document.getElementById("circuitPointsBody");
  if (body) {
    body
      .querySelectorAll("input, select, [data-circuit-remove='true']")
      .forEach((el) => {
        el.disabled = circuitPointsLocked;
      });
  }
  const addBtn = document.getElementById("addCircuitPointsRow");
  if (addBtn) addBtn.disabled = circuitPointsLocked;
  const editBtn = document.getElementById("editCircuitPointsBtn");
  const saveBtn = document.getElementById("saveTournamentCircuitPointsBtn");
  if (editBtn) editBtn.style.display = circuitPointsLocked ? "" : "none";
  if (saveBtn) saveBtn.style.display = circuitPointsLocked ? "none" : "";
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
      const { key, legacyKey } = getLeaderboardKey(player);
      if (!key) return;
      const ledgerPoints = Number(snapshot.pointsLedger?.[key]);
      const legacyLedgerPoints = Number(snapshot.pointsLedger?.[legacyKey]);
      const useLedger = Number.isFinite(ledgerPoints);
      const useLegacyLedger = !useLedger && Number.isFinite(legacyLedgerPoints);
      const playerPoints = Number(player.points);
      const rawPoints = useLedger
        ? ledgerPoints
        : useLegacyLedger
        ? legacyLedgerPoints
        : playerPoints;
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
  uid,
  circuitSlug,
  tournamentSlug,
} = {}) {
  const { key, legacyKey } = getLeaderboardKey({ uid, name, sc2Link });
  if (!key || !circuitSlug) return 0;
  const totals = await loadCircuitSeedPoints(circuitSlug, tournamentSlug || "");
  if (totals.has(key)) return totals.get(key) || 0;
  return legacyKey ? totals.get(legacyKey) || 0 : 0;
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
  const belowRule = scheme.find((row) => row?.below);
  const pointsByPlace = new Map(
    scheme.filter((row) => !row?.below).map((row) => [row.place, row.points])
  );
  const pointsLedger = { ...(state.pointsLedger || {}) };
  let updated = 0;
  const players = (state.players || []).map((player) => {
    const placement = placements.get(player.id);
    if (!placement) return player;
    const points = Number.isFinite(pointsByPlace.get(placement))
      ? pointsByPlace.get(placement)
      : belowRule && placement >= belowRule.place
      ? belowRule.points
      : undefined;
    if (!Number.isFinite(points)) return player;
    const { key, legacyKey } = getLeaderboardKey(player);
    const existingEarned = Number(pointsLedger[key]);
    const legacyEarned = Number(pointsLedger[legacyKey]);
    const earnedBefore = Number.isFinite(existingEarned)
      ? existingEarned
      : Number.isFinite(legacyEarned)
      ? legacyEarned
      : 0;
    const existingTotal = Number(player.points);
    const basePoints = Number.isFinite(existingTotal)
      ? Math.max(0, existingTotal - earnedBefore)
      : 0;
    const nextTotal = basePoints + points;
    const targetKey = key || legacyKey;
    if (targetKey) pointsLedger[targetKey] = points;
    updated += 1;
    return { ...player, points: nextTotal };
  });

  setStateObj({ ...state, players, pointsLedger });
  saveState?.({ players, pointsLedger });
  renderAll?.();
  if (statusEl) statusEl.textContent = `Applied points to ${updated} players.`;
  return { applied: true, updated };
}
