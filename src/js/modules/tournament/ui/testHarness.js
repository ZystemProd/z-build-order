import { bracketTestHarness, state, setStateObj, broadcast, currentSlug, defaultState } from "../state.js";
import { applySeeding } from "../bracket/build.js";
import { saveState as persistState, persistTournamentStateRemote } from "../sync/persistence.js";

function buildTestPlayers(count) {
  const pool = [
    "ShadowFox",
    "Starweaver",
    "CryoCore",
    "StormRider",
    "NovaWing",
    "Solaris",
    "Flareheart",
    "Nightfall",
    "Zephyr",
    "Flux",
    "Helix",
    "Starlance",
    "Skyforge",
    "NeonViper",
    "Astra",
    "GrimNova",
    "LunarEdge",
    "Pulsefire",
    "VoidReaper",
    "IronWarden",
    "Frostbyte",
    "WarpDrive",
    "StormBreaker",
    "Obsidian",
    "Blazeheart",
    "RiftWalker",
    "Ironclad",
    "Starforge",
    "CryoCoreX",
    "Tempest",
    "Halcyon",
    "Wraith",
    "Aurora",
    "Thunderstrike",
    "Falconer",
    "Glacier",
    "Pyre",
    "Volt",
    "Spectre",
    "Onyx",
    "Nimbus",
    "DriftKing",
    "Arclight",
  ];
  const races = ["Zerg", "Protoss", "Terran", "Random"];
  const createdAt = Date.now();

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  return picked.map((name, idx) => ({
    id: `test-${idx + 1}`,
    name,
    race: races[Math.floor(Math.random() * races.length)],
    sc2Link: "",
    mmr: 4000 - idx * 25,
    points: 1000 - idx,
    seed: idx + 1,
    createdAt,
  }));
}

function updateTestHarnessLabel() {
  const label = document.getElementById("testBracketLabel");
  if (!label) return;
  label.textContent = bracketTestHarness.active
    ? `Testing ${bracketTestHarness.count} players`
    : "Test harness not started";
}

function setTestBracketCount(count) {
  const clamped = Math.max(1, Math.min(32, count));
  bracketTestHarness.active = true;
  bracketTestHarness.count = clamped;
  const testPlayers = buildTestPlayers(clamped);
  const ledger = {};
  testPlayers.forEach((p) => {
    ledger[`${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`] = p.points ?? 0;
  });
  const seededPlayers = applySeeding(testPlayers);
  const next = {
    ...state,
    players: seededPlayers,
    pointsLedger: ledger,
    needsReseed: false,
    lastUpdated: Date.now(),
  };
  setStateObj(next);
  persistState(next, { skipRemote: false }, state, defaultState, currentSlug, broadcast, setStateObj, () =>
    persistTournamentStateRemote(next, currentSlug, () => null)
  );
  updateTestHarnessLabel();
}

function cycleTestBracketCount(delta) {
  if (!bracketTestHarness.active) {
    setTestBracketCount(16);
    return;
  }
  setTestBracketCount(bracketTestHarness.count + delta);
}

export function ensureTestHarnessPanel() {
  if (typeof window !== "undefined" && window.__tournamentIsAdmin === false) {
    return;
  }
  const host =
    document.getElementById("bracketTab") ||
    document.getElementById("seedingCard") ||
    document.getElementById("adminTab") ||
    document.getElementById("registrationCard") ||
    document.body;
  if (!host) return;
  if (document.getElementById("testBracketPanel")) {
    updateTestHarnessLabel();
    return;
  }
  const panel = document.createElement("div");
  panel.id = "testBracketPanel";
  panel.style.marginTop = "8px";
  panel.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      <button class="cta small ghost" id="testBracketStart">Start 1-16 Test</button>
      <button class="cta small ghost" id="testBracketStart32">Start 17-32 Test</button>
      <button class="cta small ghost" id="testBracketPrev">Prev</button>
      <button class="cta small ghost" id="testBracketNext">Next</button>
      <span class="helper" id="testBracketLabel">Test harness not started</span>
    </div>
  `;
  if (host.firstChild) {
    host.insertBefore(panel, host.firstChild);
  } else {
    host.appendChild(panel);
  }
  updateTestHarnessLabel();
}

export function bindTestHarnessButtons() {
  document
    .getElementById("testBracketStart")
    ?.addEventListener("click", () => setTestBracketCount(16));
  document
    .getElementById("testBracketStart32")
    ?.addEventListener("click", () => setTestBracketCount(32));
  document
    .getElementById("testBracketPrev")
    ?.addEventListener("click", () => cycleTestBracketCount(-1));
  document
    .getElementById("testBracketNext")
    ?.addEventListener("click", () => cycleTestBracketCount(1));
}
