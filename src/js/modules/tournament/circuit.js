import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import DOMPurify from "dompurify";
import { db } from "../../../app.js";
import { CIRCUIT_COLLECTION } from "./state.js";
import { setTournamentListItems } from "./listSlider.js";
import {
  loadTournamentRegistry,
  loadCircuitRegistry,
  loadTournamentStateRemote,
} from "./sync/persistence.js";
import { computePlacementsForBracket } from "./bracket/placements.js";
import { sanitizeUrl, escapeHtml } from "./bracket/renderUtils.js";
import { playerKey } from "./playerKey.js";
import { syncMarkdownSurfaceForInput } from "./markdownEditor.js";

function normalizeRaceLabel(raw) {
  const val = (raw || "").toString().toLowerCase();
  if (val.startsWith("z")) return "Zerg";
  if (val.startsWith("p")) return "Protoss";
  if (val.startsWith("t")) return "Terran";
  if (val.startsWith("r")) return "Random";
  return "";
}

function normalizeRaceKey(raw) {
  const val = (raw || "").toString().toLowerCase();
  if (val.startsWith("z")) return "zerg";
  if (val.startsWith("p")) return "protoss";
  if (val.startsWith("t")) return "terran";
  if (val.startsWith("r")) return "random";
  return "";
}

function pickBestRace(byRace = null, fallbackMmr = null) {
  const entries = Object.entries(byRace || {}).map(([race, value]) => ({
    race: normalizeRaceLabel(race),
    key: normalizeRaceKey(race),
    mmr: Number(value),
  }));
  const valid = entries
    .filter((entry) => entry.key && Number.isFinite(entry.mmr) && entry.mmr > 0)
    .sort((a, b) => b.mmr - a.mmr);

  if (valid.length) {
    return { race: valid[0].race, mmr: Math.round(valid[0].mmr) };
  }

  const mmr = Number.isFinite(fallbackMmr)
    ? Math.round(Math.max(0, fallbackMmr))
    : null;
  return { race: null, mmr };
}

function resolveSecondaryPulseEntry(entry) {
  const profiles = Array.isArray(entry?.secondaryPulseProfiles)
    ? entry.secondaryPulseProfiles
    : [];
  const links = Array.isArray(entry?.secondaryPulseLinks)
    ? entry.secondaryPulseLinks
    : [];
  const profile = profiles.find(
    (profileEntry) =>
      profileEntry &&
      (profileEntry.url ||
        profileEntry.lastMmrByRace ||
        profileEntry.byRace ||
        Number.isFinite(profileEntry.lastMmr) ||
        Number.isFinite(profileEntry.mmr))
  );
  if (profile) return profile;
  if (links.length) return { url: links[0] };
  return null;
}

function normalizeBracketForPlacements(bracket) {
  if (!bracket || typeof bracket !== "object") return bracket || null;
  const toArr = (obj) =>
    Array.isArray(obj)
      ? obj
      : obj && typeof obj === "object"
      ? Object.keys(obj)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => obj[key])
      : [];
  const normalizeRounds = (rounds) =>
    toArr(rounds)
      .map((round) => toArr(round))
      .filter((round) => round.length);
  const clampRounds = (rounds, count) => {
    if (!Number.isFinite(count)) return rounds;
    return rounds.slice(0, Math.max(0, count));
  };
  const winners = clampRounds(normalizeRounds(bracket.winners), bracket.winnersRoundCount);
  const losers = clampRounds(normalizeRounds(bracket.losers), bracket.losersRoundCount);
  return {
    ...bracket,
    winners,
    losers,
    groups: toArr(bracket.groups),
  };
}

function buildCircuitLeaderboardCsv(leaderboard = [], { includeFirstPlaces = false } = {}) {
  const headers = ["Placement", "Player Name"];
  if (includeFirstPlaces) headers.push("1st Place Wins");
  headers.push(
    "Points",
    "Main SC2Pulse Name",
    "Main SC2Pulse URL",
    "Main Race",
    "Main MMR",
    "Secondary SC2Pulse Name",
    "Secondary SC2Pulse URL",
    "Secondary Race",
    "Secondary MMR"
  );
  const rows = [headers];
  (leaderboard || []).forEach((entry, idx) => {
    const mainRace = normalizeRaceLabel(entry?.race || "") || entry?.race || "";
    const mainMmr = Number.isFinite(entry?.mmr) ? Math.round(entry.mmr) : "";
    const secondaryProfile = resolveSecondaryPulseEntry(entry);
    const mainPulseName = entry?.pulseName || "";
    const secondaryName = secondaryProfile?.name || "";
    const secondaryUrl = secondaryProfile?.url || "";
    const { race: secondaryRaceRaw, mmr: secondaryMmrRaw } = pickBestRace(
      secondaryProfile?.lastMmrByRace || secondaryProfile?.byRace || null,
      secondaryProfile?.lastMmr ?? secondaryProfile?.mmr ?? null
    );
    const secondaryRace = secondaryRaceRaw || "";
    const secondaryMmr = Number.isFinite(secondaryMmrRaw) ? secondaryMmrRaw : "";
    const baseRow = [idx + 1, entry?.name || ""];
    if (includeFirstPlaces) {
      baseRow.push(Number.isFinite(entry?.firstPlaces) ? entry.firstPlaces : 0);
    }
    baseRow.push(
      Number.isFinite(entry?.points) ? entry.points : "",
      mainPulseName,
      entry?.sc2Link || "",
      mainRace,
      mainMmr,
      secondaryName,
      secondaryUrl,
      secondaryRace,
      secondaryMmr
    );
    rows.push(baseRow);
  });

  const escapeCsv = (value) => {
    const str = value == null ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
  };

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function downloadCircuitLeaderboardCsv(leaderboard, meta) {
  const slug = String(meta?.slug || "leaderboard").trim() || "leaderboard";
  const safeSlug = slug.replace(/[^a-z0-9_-]+/gi, "-");
  const csv = buildCircuitLeaderboardCsv(leaderboard, {
    includeFirstPlaces: Boolean(meta?.sortByFirstPlace),
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `circuit-${safeSlug}-leaderboard.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function normalizeCircuitData(data = {}, fallbackSlug = "") {
  const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
  const slugs = tournaments
    .map((entry) => (typeof entry === "string" ? entry : entry?.slug))
    .filter(Boolean);
  const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
  const coverImageUrl =
    data.coverImageUrl || data.coverUrl || data.coverImage || "";
  return {
    id: data.id || fallbackSlug,
    slug: data.slug || fallbackSlug,
    name: data.name || fallbackSlug,
    description: data.description || "",
    coverImageUrl,
    tournaments: Array.from(new Set(slugs)),
    finalTournamentSlug: data.finalTournamentSlug || "",
    pointsOverrides:
      data.pointsOverrides && typeof data.pointsOverrides === "object"
        ? { ...data.pointsOverrides }
        : {},
    sortByFirstPlace: Boolean(data.sortByFirstPlace),
    admins: Array.isArray(data.admins) ? data.admins : [],
    createdBy: data.createdBy || null,
    createdByName: data.createdByName || data.hostName || null,
    createdAt: createdAt || null,
  };
}

export function normalizeCircuitTournamentSlugs(meta) {
  const base = Array.isArray(meta?.tournaments) ? meta.tournaments : [];
  const slugs = base
    .map((entry) => (typeof entry === "string" ? entry : entry?.slug))
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  const finalSlug = String(meta?.finalTournamentSlug || "").trim();
  if (finalSlug && !slugs.includes(finalSlug)) {
    slugs.push(finalSlug);
  }
  return Array.from(new Set(slugs));
}

export async function fetchCircuitMeta(slug) {
  if (!slug) return null;
  try {
    const snap = await getDoc(doc(collection(db, CIRCUIT_COLLECTION), slug));
    if (!snap.exists()) return null;
    return normalizeCircuitData(snap.data() || {}, slug);
  } catch (_) {
    return null;
  }
}

export async function renderCircuitList({ onEnterCircuit } = {}) {
  const listEl = document.getElementById("tournamentList");
  const statTournaments = document.getElementById("statTournaments");
  const statNextStart = document.getElementById("statNextStart");
  const listTitle = document.getElementById("tournamentListTitle");
  if (listTitle) listTitle.textContent = "Circuits";
  if (!listEl) return;
  listEl.innerHTML = `<li class="muted">Loading circuits...</li>`;
  try {
    const items = await loadCircuitRegistry(true);
    const normalized = (items || []).map((item) =>
      normalizeCircuitData(item, item.slug || item.id || "")
    );
    const sorted = normalized.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!sorted.length) {
      listEl.innerHTML = `<li class="muted">No circuits found.</li>`;
      setTournamentListItems([], { mode: "circuits" });
    } else {
      setTournamentListItems(sorted, {
        mode: "circuits",
        renderItem: (item, targetList) => {
          const li = document.createElement("li");
          li.className = "tournament-card circuit-card";
          const tournamentCount = item.tournaments.length;
          const description = item.description || "Circuit points race.";
          const metaBits = [
            `${tournamentCount} tournaments`,
            `Host: ${item.createdByName || "Unknown"}`,
          ];
          if (item.finalTournamentSlug) {
            metaBits.unshift(`Finals: ${item.finalTournamentSlug}`);
          }
          li.innerHTML = DOMPurify.sanitize(`
            <div class="card-cover"></div>
            <div class="card-top">
              <div class="time-block">
                <span class="time-label">Tournaments</span>
                <span class="time-value">${tournamentCount}</span>
              </div>
              <span class="status-chip status-circuit">Circuit</span>
            </div>
            <h4>${escapeHtml(item.name)}</h4>
            <p class="tournament-format">${escapeHtml(description)}</p>
            <div class="meta">
              ${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join("")}
            </div>
          `);
          if (onEnterCircuit) {
            li.addEventListener("click", () => onEnterCircuit(item.slug));
          }
          targetList.appendChild(li);
        },
      });
    }
    if (statTournaments) statTournaments.textContent = String(normalized.length);
    if (statNextStart) statNextStart.textContent = "TBD";
  } catch (err) {
    console.error("Failed to load circuits", err);
    listEl.innerHTML = `<li class="muted error">Failed to load circuits.</li>`;
  }
}

export async function renderCircuitView(
  meta,
  { onEnterTournament, onDeleteTournament, showDelete = false, showEdit = false } = {}
) {
  const titleEl = document.getElementById("circuitTitle");
  const descEl = document.getElementById("circuitDescription");
  const statTournaments = document.getElementById("circuitStatTournaments");
  const statNextStart = document.getElementById("circuitStatNextStart");
  const finalLink = document.getElementById("circuitFinalLink");
  const circuitHero = document.querySelector("#circuitView .hero");
  if (titleEl) titleEl.textContent = meta?.name || "Circuit";
  if (descEl) {
    descEl.textContent = meta?.description || "Circuit overview.";
  }
  if (circuitHero) {
    const coverUrl = sanitizeUrl(meta?.coverImageUrl || "");
    if (coverUrl) {
      circuitHero.classList.add("has-cover");
      circuitHero.style.setProperty(
        "--hero-cover-image",
        `url("${coverUrl}")`
      );
    } else {
      circuitHero.classList.remove("has-cover");
      circuitHero.style.removeProperty("--hero-cover-image");
    }
  }
  const finalSlug = String(meta?.finalTournamentSlug || "").trim();
  if (finalLink) {
    if (finalSlug) {
      const circuitSlug = String(meta?.slug || "").trim();
      finalLink.href = circuitSlug
        ? `/tournament/${circuitSlug}/${finalSlug}`
        : `/tournament/${finalSlug}`;
      finalLink.textContent = `Final tournament: ${finalSlug}`;
      finalLink.style.display = "inline-flex";
    } else {
      finalLink.style.display = "none";
    }
  }
  const slugs = normalizeCircuitTournamentSlugs(meta);
  if (statTournaments) statTournaments.textContent = String(slugs.length);
  if (statNextStart) statNextStart.textContent = "TBD";
  if (statNextStart && slugs.length) {
    try {
      const registry = await loadTournamentRegistry(true);
      const now = Date.now();
      const nextStart = (registry || [])
        .filter((item) => slugs.includes(item.slug))
        .map((item) => item.startTime)
        .filter((time) => Number.isFinite(time) && time > now)
        .sort((a, b) => a - b)[0];
      if (nextStart) {
        statNextStart.textContent = new Date(nextStart).toLocaleString([], {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch (_) {
      // ignore
    }
  }
  await Promise.all([
    renderCircuitTournamentList(meta, slugs, {
      onEnterTournament,
      onDeleteTournament,
      showDelete,
    }),
    renderCircuitLeaderboard(meta, slugs, { showEdit }),
  ]);
}

export async function renderCircuitTournamentList(
  meta,
  slugs = [],
  { onEnterTournament, onDeleteTournament, showDelete = false } = {}
) {
  const listEl = document.getElementById("circuitTournamentList");
  if (!listEl) return;
  listEl.innerHTML = `<li class="muted">Loading tournaments...</li>`;
  if (!slugs.length) {
    listEl.innerHTML = `<li class="muted">No tournaments added yet.</li>`;
    return;
  }
  try {
    const registry = await loadTournamentRegistry(true);
    const bySlug = new Map((registry || []).map((item) => [item.slug, item]));
    listEl.innerHTML = "";
    slugs.forEach((slug) => {
      const item = bySlug.get(slug) || {
        slug,
        name: slug,
        format: "Tournament",
        startTime: null,
        maxPlayers: null,
        coverImageUrl: "",
        createdByName: null,
      };
      const li = document.createElement("li");
      li.className = "tournament-card";
      const coverUrl = sanitizeUrl(item.coverImageUrl || "");
      const startLabel = item.startTime
        ? new Date(item.startTime).toLocaleString()
        : "TBD";
      const playerLabel = item.maxPlayers
        ? `Up to ${item.maxPlayers} players`
        : "Players TBD";
      const now = Date.now();
      let statusLabel = "TBD";
      let statusClass = "status-tbd";
      if (item.startTime) {
        if (item.startTime <= now) {
          statusLabel = "Started";
          statusClass = "status-started";
        } else {
          statusLabel = "Upcoming";
          statusClass = "status-upcoming";
        }
      }
      const metaBits = [
        playerLabel,
        `Host: ${item.createdByName || "Unknown"}`,
      ];
      if (meta?.finalTournamentSlug && slug === meta.finalTournamentSlug) {
        metaBits.unshift("Finals event");
      }
      li.innerHTML = DOMPurify.sanitize(`
        <div class="card-cover${coverUrl ? " has-image" : ""}"${
          coverUrl ? ` style="background-image:url('${escapeHtml(coverUrl)}')"` : ""
        }></div>
        <h4>${escapeHtml(item.name)}</h4>
        <div class="card-top">
          <div class="time-block">
            <span class="time-label">Start</span>
            <span class="time-value">${escapeHtml(startLabel)}</span>
          </div>
          <span class="status-chip ${statusClass}">${statusLabel}</span>
        </div>
        <p class="tournament-format">${escapeHtml(item.format || "Tournament")}</p>
        <div class="meta">
          ${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join("")}
        </div>
      `);
      if (onEnterTournament) {
        li.addEventListener("click", () => onEnterTournament(item.slug, meta?.slug || ""));
      }
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load circuit tournaments", err);
    listEl.innerHTML = `<li class="muted error">Failed to load tournaments.</li>`;
  }
}

let circuitPointsModalBound = false;
let circuitPointsEditEntries = [];
let circuitPointsEditMeta = null;

function bindCircuitPointsModal() {
  if (circuitPointsModalBound) return;
  circuitPointsModalBound = true;
  const modal = document.getElementById("circuitPointsModal");
  const closeBtn = document.getElementById("closeCircuitPointsModal");
  const saveBtn = document.getElementById("saveCircuitPointsBtn");
  closeBtn?.addEventListener("click", () => {
    if (modal) modal.style.display = "none";
  });
  window.addEventListener("mousedown", (e) => {
    if (modal && modal.style.display === "flex" && e.target === modal) {
      modal.style.display = "none";
    }
  });
  saveBtn?.addEventListener("click", async () => {
    if (!circuitPointsEditMeta?.slug) return;
    const body = document.getElementById("circuitPointsEditBody");
    if (!body) return;
    const rows = Array.from(body.querySelectorAll("[data-points-edit-row]"));
    const overrides = {};
    rows.forEach((row) => {
      const key = row.dataset.playerKey || "";
      const input = row.querySelector("input");
      const value = Number(input?.value);
      if (!key || !Number.isFinite(value) || value < 0) return;
      overrides[key] = value;
    });
    try {
      await setDoc(
        doc(collection(db, CIRCUIT_COLLECTION), circuitPointsEditMeta.slug),
        { pointsOverrides: overrides },
        { merge: true }
      );
      circuitPointsEditMeta.pointsOverrides = overrides;
      await renderCircuitLeaderboard(
        circuitPointsEditMeta,
        normalizeCircuitTournamentSlugs(circuitPointsEditMeta),
        { showEdit: true }
      );
      if (modal) modal.style.display = "none";
    } catch (err) {
      console.error("Failed to save circuit points", err);
    }
  });
}

function openCircuitPointsModal(entries, meta) {
  const modal = document.getElementById("circuitPointsModal");
  const body = document.getElementById("circuitPointsEditBody");
  const search = document.getElementById("circuitPointsSearch");
  if (!modal || !body) return;
  bindCircuitPointsModal();
  circuitPointsEditEntries = entries || [];
  circuitPointsEditMeta = meta || null;
  const renderRows = (filterText) => {
    const query = (filterText || "").trim().toLowerCase();
    const rows = circuitPointsEditEntries.filter((entry) => {
      if (!query) return true;
      return String(entry.name || "").toLowerCase().includes(query);
    });
    body.innerHTML = rows
      .map(
        (entry) => `
          <tr data-points-edit-row data-player-key="${escapeHtml(entry.key)}">
            <td>${escapeHtml(entry.name || "Unknown")}</td>
            <td>
              <input type="number" min="0" class="points-input" value="${Number(entry.points) || 0}" />
            </td>
          </tr>
        `
      )
      .join("");
  };
  if (search) {
    search.value = "";
    search.oninput = () => renderRows(search.value);
  }
  renderRows("");
  modal.style.display = "flex";
}

export async function buildCircuitLeaderboard(meta, slugs = [], { excludeSlug } = {}) {
  const base = Array.isArray(slugs) && slugs.length ? slugs : normalizeCircuitTournamentSlugs(meta);
  const filtered = base
    .map((slug) => String(slug || "").trim())
    .filter(Boolean)
    .filter((slug) => (excludeSlug ? slug !== excludeSlug : true));
  if (!filtered.length) {
    return { leaderboard: [], slugs: [] };
  }
  const states = await Promise.all(filtered.map((slug) => loadTournamentStateRemote(slug)));
  const totals = new Map();
  states.forEach((snapshot, idx) => {
    if (!snapshot) return;
    const tournamentSlug = filtered[idx];
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    const bracket = normalizeBracketForPlacements(snapshot.bracket);
    const placements = computePlacementsForBracket(bracket, players.length || 0);
    const winnerId = placements
      ? Array.from(placements.entries()).find(([, place]) => place === 1)?.[0]
      : null;
    const winner = winnerId
      ? players.find((player) => player?.id === winnerId)
      : null;
    const winnerKey = winner ? playerKey(winner.name, winner.sc2Link) : "";
    players.forEach((player) => {
      const key = playerKey(player.name, player.sc2Link);
      if (!key) return;
      const playerPoints = Number(player.points);
      const ledgerPoints = Number(snapshot.pointsLedger?.[key]);
      const useLedger = Number.isFinite(ledgerPoints);
      const rawPoints = useLedger ? ledgerPoints : playerPoints;
      const points = Number.isFinite(rawPoints) ? rawPoints : 0;
      const entry = totals.get(key) || {
        name: player.name || "Unknown",
        points: 0,
        firstPlaces: 0,
        tournaments: new Set(),
        sc2Link: player.sc2Link || "",
        pulseName: "",
        race: "",
        mmr: null,
        secondaryPulseLinks: [],
        secondaryPulseProfiles: [],
      };
      entry.points += points;
      if (tournamentSlug) entry.tournaments.add(tournamentSlug);
      if (!entry.name && player.name) entry.name = player.name;
      if (!entry.sc2Link && player.sc2Link) entry.sc2Link = player.sc2Link;
      if (!entry.pulseName && player.pulseName) entry.pulseName = player.pulseName;
      const race = normalizeRaceLabel(player.race || "") || player.race || "";
      if (!entry.race && race) entry.race = race;
      if (
        (!Number.isFinite(entry.mmr) || entry.mmr <= 0) &&
        Number.isFinite(player.mmr)
      ) {
        entry.mmr = player.mmr;
      }
      if (
        !entry.secondaryPulseProfiles.length &&
        Array.isArray(player.secondaryPulseProfiles) &&
        player.secondaryPulseProfiles.length
      ) {
        entry.secondaryPulseProfiles = player.secondaryPulseProfiles;
      }
      if (
        !entry.secondaryPulseLinks.length &&
        Array.isArray(player.secondaryPulseLinks) &&
        player.secondaryPulseLinks.length
      ) {
        entry.secondaryPulseLinks = player.secondaryPulseLinks;
      }
      if (winnerKey && key === winnerKey) {
        entry.firstPlaces += 1;
      }
      totals.set(key, entry);
    });
  });
  const useFirstPlaceSort = Boolean(meta?.sortByFirstPlace);
  const leaderboard = Array.from(totals.entries())
    .map(([key, entry]) => {
      const override = Number(meta?.pointsOverrides?.[key]);
      return {
        key,
        name: entry.name,
        points: Number.isFinite(override) ? override : entry.points,
        firstPlaces: entry.firstPlaces || 0,
        tournaments: entry.tournaments.size,
        sc2Link: entry.sc2Link || "",
        pulseName: entry.pulseName || "",
        race: entry.race || "",
        mmr: entry.mmr,
        secondaryPulseLinks: entry.secondaryPulseLinks || [],
        secondaryPulseProfiles: entry.secondaryPulseProfiles || [],
      };
    })
    .sort((a, b) => {
      if (useFirstPlaceSort) {
        const diff = (b.firstPlaces || 0) - (a.firstPlaces || 0);
        if (diff) return diff;
      }
      return b.points - a.points || a.name.localeCompare(b.name);
    });
  return { leaderboard, slugs: filtered };
}

export async function renderCircuitLeaderboard(meta, slugs = [], { showEdit = false } = {}) {
  const body = document.getElementById("circuitLeaderboardBody");
  const note = document.getElementById("circuitLeaderboardNote");
  const editBtn = document.getElementById("openCircuitPointsEditBtn");
  const downloadBtn = document.getElementById("downloadCircuitLeaderboardBtn");
  const table = document.getElementById("circuitLeaderboardTable");
  const firstPlaceHeader = document.getElementById("circuitLeaderboardFirstPlaceHeader");
  if (!body) return;
  const showFirstPlaces = Boolean(meta?.sortByFirstPlace);
  const columnCount = showFirstPlaces ? 5 : 4;
  if (table) table.classList.toggle("has-first-places", showFirstPlaces);
  if (firstPlaceHeader) {
    firstPlaceHeader.style.display = showFirstPlaces ? "" : "none";
  }
  if (editBtn) editBtn.style.display = showEdit ? "inline-flex" : "none";
  if (downloadBtn) downloadBtn.style.display = showEdit ? "inline-flex" : "none";
  body.innerHTML = `<tr><td colspan="${columnCount}" class="helper">Loading leaderboard...</td></tr>`;
  if (!slugs.length) {
    body.innerHTML = `<tr><td colspan="${columnCount}" class="helper">No tournaments yet.</td></tr>`;
    if (note) note.textContent = "Add tournaments to build the leaderboard.";
    if (editBtn) editBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
    return;
  }
  try {
    const { leaderboard, slugs: usedSlugs } = await buildCircuitLeaderboard(meta, slugs);
    if (!usedSlugs.length) {
      body.innerHTML = `<tr><td colspan="${columnCount}" class="helper">No tournaments yet.</td></tr>`;
      if (note) note.textContent = "Add tournaments to build the leaderboard.";
      if (editBtn) editBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
      return;
    }
    if (!leaderboard.length) {
      body.innerHTML = `<tr><td colspan="${columnCount}" class="helper">No players yet.</td></tr>`;
      if (note) note.textContent = "Points will appear after tournaments log players.";
      if (editBtn) editBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
      return;
    }
    body.innerHTML = "";
    const editEntries = [];
    leaderboard.forEach((entry, idx) => {
      const row = document.createElement("tr");

      const rankCell = document.createElement("td");
      rankCell.textContent = String(idx + 1);

      const nameCell = document.createElement("td");
      nameCell.textContent = entry.name || "Unknown";

      const firstPlaceCell = document.createElement("td");
      firstPlaceCell.className = "first-place-cell";
      firstPlaceCell.textContent = String(entry.firstPlaces || 0);

      const pointsCell = document.createElement("td");
      pointsCell.className = "points-cell";
      pointsCell.textContent = String(entry.points || 0);

      const eventsCell = document.createElement("td");
      eventsCell.className = "events-cell";
      eventsCell.textContent = String(entry.tournaments || 0);

      if (showFirstPlaces) {
        row.append(rankCell, nameCell, firstPlaceCell, pointsCell, eventsCell);
      } else {
        row.append(rankCell, nameCell, pointsCell, eventsCell);
      }
      body.appendChild(row);
      editEntries.push({ key: entry.key, name: entry.name, points: entry.points });
    });
    if (editBtn) {
      editBtn.disabled = false;
      editBtn.onclick = () => openCircuitPointsModal(editEntries, meta);
    }
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.onclick = () => downloadCircuitLeaderboardCsv(leaderboard, meta);
    }
    if (note) note.textContent = `Totals across ${usedSlugs.length} tournaments.`;
  } catch (err) {
    console.error("Failed to load circuit leaderboard", err);
    body.innerHTML = `<tr><td colspan="${columnCount}" class="helper">Failed to load leaderboard.</td></tr>`;
    if (note) note.textContent = "Try refreshing in a moment.";
    if (editBtn) editBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
  }
}

export async function generateCircuitSlug() {
  return `c-${Date.now().toString(36)}`;
}

export function updateCircuitSlugPreview() {
  const slugInput = document.getElementById("circuitSlugInput");
  const preview = document.getElementById("circuitSlugPreview");
  if (slugInput && preview) {
    const next = (slugInput.value || "").toLowerCase();
    if (slugInput.value !== next) slugInput.value = next;
    preview.textContent = next;
  }
}

export async function populateCreateCircuitForm() {
  const nameInput = document.getElementById("circuitNameInput");
  const slugInput = document.getElementById("circuitSlugInput");
  const descInput = document.getElementById("circuitDescriptionInput");
  const firstPlaceToggle = document.getElementById("circuitFirstPlaceSortToggle");
  const finalNameInput = document.getElementById("finalTournamentNameInput");
  const finalSlugInput = document.getElementById("finalTournamentSlugInput");
  const finalVisibilitySelect = document.getElementById("finalTournamentVisibilitySelect");
  const finalAccessSelect = document.getElementById("finalTournamentAccessSelect");
  const finalDescInput = document.getElementById("finalTournamentDescriptionInput");
  const finalRulesInput = document.getElementById("finalTournamentRulesInput");
  const finalStartInput = document.getElementById("finalTournamentStartInput");
  const finalMaxPlayersInput = document.getElementById("finalTournamentMaxPlayersInput");
  const finalCheckInSelect = document.getElementById("finalCheckInSelect");
  const finalImageInput = document.getElementById("finalTournamentImageInput");
  const finalImagePreview = document.getElementById("finalTournamentImagePreview");
  const finalQualifyInput = document.getElementById("finalQualifyCountInput");
  if (nameInput) nameInput.value = "";
  if (descInput) descInput.value = "";
  syncMarkdownSurfaceForInput(descInput);
  if (firstPlaceToggle) firstPlaceToggle.checked = false;
  if (slugInput && !slugInput.value) {
    slugInput.value = await generateCircuitSlug();
  }
  if (finalNameInput) finalNameInput.value = "";
  if (finalVisibilitySelect) finalVisibilitySelect.value = "public";
  if (finalAccessSelect) finalAccessSelect.value = "open";
  if (finalDescInput) finalDescInput.value = "";
  if (finalRulesInput) finalRulesInput.value = "";
  syncMarkdownSurfaceForInput(finalDescInput);
  syncMarkdownSurfaceForInput(finalRulesInput);
  if (finalStartInput) {
    finalStartInput.value = "";
    if (finalStartInput._flatpickr) {
      finalStartInput._flatpickr.clear();
    }
  }
  if (finalMaxPlayersInput) finalMaxPlayersInput.value = "";
  if (finalCheckInSelect) finalCheckInSelect.value = "0";
  if (finalQualifyInput) finalQualifyInput.value = "";
  if (finalImageInput) finalImageInput.value = "";
  if (finalImagePreview) {
    if (finalImagePreview.dataset.tempPreview) {
      try {
        URL.revokeObjectURL(finalImagePreview.dataset.tempPreview);
      } catch (_) {}
    }
    finalImagePreview.removeAttribute("src");
    finalImagePreview.style.display = "none";
    delete finalImagePreview.dataset.tempPreview;
    delete finalImagePreview.dataset.reuseUrl;
  }
  if (finalSlugInput && slugInput) {
    const baseSlug = (slugInput.value || "").trim().toLowerCase();
    finalSlugInput.value = baseSlug ? `${baseSlug}-final` : "";
  }
  updateCircuitSlugPreview();
}
