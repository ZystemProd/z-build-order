import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  runTransaction,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  TOURNAMENT_COLLECTION,
  TOURNAMENT_REGISTRY_KEY,
  TOURNAMENT_STATE_COLLECTION,
  CIRCUIT_COLLECTION,
  CIRCUIT_REGISTRY_KEY,
  STORAGE_KEY,
  defaultState,
} from "../state.js";
import { db, functions } from "../../../../app.js";

const DEBUG_TOURNAMENT_SYNC = false;

function dbg(label, payload) {
  if (!DEBUG_TOURNAMENT_SYNC) return;
  console.groupCollapsed(`🧪 [tournament-sync] ${label}`);
  try {
    console.log(payload);
  } finally {
    console.groupEnd();
  }
}

// Local storage helpers
export function cacheTournamentRegistry(registry) {
  try {
    if (!registry) {
      localStorage.removeItem(TOURNAMENT_REGISTRY_KEY);
    } else {
      localStorage.setItem(TOURNAMENT_REGISTRY_KEY, JSON.stringify(registry));
    }
  } catch (_) {
    // ignore
  }
}

export function loadTournamentRegistryCache() {
  try {
    const raw = localStorage.getItem(TOURNAMENT_REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function getRegisteredTournaments() {
  try {
    const raw = localStorage.getItem("registeredTournaments");
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (_) {
    return [];
  }
}

export function setRegisteredTournament(slug) {
  if (!slug) return;
  try {
    const existing = new Set(getRegisteredTournaments());
    existing.add(slug);
    localStorage.setItem(
      "registeredTournaments",
      JSON.stringify(Array.from(existing))
    );
  } catch (_) {
    // ignore storage errors
  }
}

// Registry (Firestore + cache)
export async function loadTournamentRegistry(force = false) {
  if (!force && loadTournamentRegistry.cached)
    return loadTournamentRegistry.cached;
  const fallback = loadTournamentRegistryCache();
  try {
    const snap = await getDocs(collection(db, TOURNAMENT_COLLECTION));
    const list = snap.docs.map((d) => {
      const data = d.data() || {};
      const startTime = data.startTime?.toMillis
        ? data.startTime.toMillis()
        : data.startTime;
      return {
        id: d.id,
        slug: data.slug || d.id,
        name: data.name || d.id,
        description: data.description || "",
        rules: data.rules || "",
        mapPool: data.mapPool?.length ? data.mapPool : [],
        format: data.format || "Tournament",
        coverImageUrl: data.coverImageUrl || "",
        coverImageUrlSmall: data.coverImageUrlSmall || "",
        sponsors: Array.isArray(data.sponsors) ? data.sponsors : [],
        socials: Array.isArray(data.socials) ? data.socials : [],
        maxPlayers: data.maxPlayers || null,
        startTime: startTime || null,
        createdBy: data.createdBy || null,
        createdByName: data.createdByName || data.hostName || null,
        circuitSlug: data.circuitSlug || null,
        isInviteOnly: Boolean(data.isInviteOnly),
        visibility:
          String(data.visibility || "public").toLowerCase() === "private"
            ? "private"
            : "public",
        bestOf: data.bestOf || defaultState.bestOf || null,
      };
    });
    loadTournamentRegistry.cached = list;
    cacheTournamentRegistry(list);
    return list;
  } catch (_) {
    loadTournamentRegistry.cached = fallback;
    return fallback || [];
  }
}

export function cacheCircuitRegistry(registry) {
  try {
    if (!registry) {
      localStorage.removeItem(CIRCUIT_REGISTRY_KEY);
    } else {
      localStorage.setItem(CIRCUIT_REGISTRY_KEY, JSON.stringify(registry));
    }
  } catch (_) {
    // ignore
  }
}

export function loadCircuitRegistryCache() {
  try {
    const raw = localStorage.getItem(CIRCUIT_REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

export async function loadCircuitRegistry(force = false) {
  if (!force && loadCircuitRegistry.cached) return loadCircuitRegistry.cached;
  const fallback = loadCircuitRegistryCache();
  try {
    const snap = await getDocs(collection(db, CIRCUIT_COLLECTION));
    const list = snap.docs.map((d) => {
      const data = d.data() || {};
      const createdAt = data.createdAt?.toMillis
        ? data.createdAt.toMillis()
        : data.createdAt;
      const tournaments = Array.isArray(data.tournaments)
        ? data.tournaments
        : [];
      const slugs = tournaments
        .map((entry) => (typeof entry === "string" ? entry : entry?.slug))
        .filter(Boolean);
      return {
        id: d.id,
        slug: data.slug || d.id,
        name: data.name || d.id,
        description: data.description || "",
        coverImageUrl:
          data.coverImageUrl || data.coverUrl || data.coverImage || "",
        tournaments: Array.from(new Set(slugs)),
        finalTournamentSlug: data.finalTournamentSlug || "",
        createdBy: data.createdBy || null,
        createdByName: data.createdByName || data.hostName || null,
        createdAt: createdAt || null,
      };
    });
    loadCircuitRegistry.cached = list;
    cacheCircuitRegistry(list);
    return list;
  } catch (_) {
    loadCircuitRegistry.cached = fallback;
    return fallback || [];
  }
}

// State (local + Firestore)
export function loadState(currentSlug, applySeedingFn, deserializeBracketFn) {
  if (!currentSlug) return { ...defaultState };

  try {
    const key = getStorageKey(currentSlug);
    const raw = localStorage.getItem(key);

    if (!raw) {
      dbg("loadState: localStorage MISS", { slug: currentSlug, key });
      return { ...defaultState };
    }

    const parsed = JSON.parse(raw);

    dbg("loadState: localStorage HIT", {
      slug: currentSlug,
      key,
      lastUpdated: parsed?.lastUpdated || 0,
      playersCount: Array.isArray(parsed?.players) ? parsed.players.length : 0,
      playerUids: Array.isArray(parsed?.players)
        ? parsed.players.map((p) => p?.uid).filter(Boolean)
        : [],
    });

    const bracket = deserializeBracketFn
      ? deserializeBracketFn(parsed.bracket)
      : parsed.bracket;

    return {
      ...defaultState,
      ...parsed,
      players: applySeedingFn(parsed.players || [], parsed),
      activity: parsed.activity || [],
      bracket,
    };
  } catch (err) {
    dbg("loadState: localStorage ERROR", { slug: currentSlug, err });
    return { ...defaultState };
  }
}

export async function loadTournamentStateRemote(slug) {
  if (!slug) return null;
  try {
    const snap = await getDoc(
      doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug)
    );
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const lastUpdated = data.lastUpdated?.toMillis
      ? data.lastUpdated.toMillis()
      : data.lastUpdated;
    return { ...data, lastUpdated: lastUpdated || Date.now() };
  } catch (_) {
    return null;
  }
}

export async function hydrateStateFromRemote(
  slug,
  applySeedingFn,
  deserializeBracketFn,
  saveStateFn,
  renderAllFn,
  localLastUpdated = 0
) {
  if (!slug) return;

  const remote = await loadTournamentStateRemote(slug);
  if (!remote) return;

  const remoteUpdated = Number(remote.lastUpdated) || 0;
  const localUpdated = Number(localLastUpdated) || 0;

  // If local is newer, do NOT overwrite it with stale remote data.
  // This prevents “new player disappears on reload”.
  if (localUpdated && remoteUpdated && remoteUpdated < localUpdated) {
    return;
  }

  const merged = {
    ...defaultState,
    ...remote,
    players: applySeedingFn(remote.players || [], remote),
    activity: remote.activity || [],
    bracket: deserializeBracketFn(remote.bracket),
  };

  // Save ONLY locally (do not bounce back to remote)
  saveStateFn(merged, { skipRemote: true, keepTimestamp: true });

  // Debug (must use `slug`, not `currentSlug`, and no `options` here)
  dbg("hydrateStateFromRemote: applied", {
    slug,
    lastUpdated: merged.lastUpdated,
    playersCount: Array.isArray(merged.players) ? merged.players.length : 0,
    playerUids: Array.isArray(merged.players)
      ? merged.players.map((p) => p?.uid).filter(Boolean)
      : [],
    localLastUpdated: localUpdated,
    remoteLastUpdated: remoteUpdated,
  });

  renderAllFn();
}

const remotePersistState = new Map();
const REMOTE_PERSIST_DEBOUNCE_MS = 1200;

export function persistTournamentStateRemote(
  snapshot,
  currentSlug,
  serializeBracketFn,
  showToast,
  options = {}
) {
  if (!currentSlug) return;
  const entry = remotePersistState.get(currentSlug) || {};
  entry.pending = { snapshot, serializeBracketFn, showToast, options };
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    void flushTournamentStateRemote(currentSlug);
  }, REMOTE_PERSIST_DEBOUNCE_MS);
  remotePersistState.set(currentSlug, entry);
}

async function flushTournamentStateRemote(currentSlug) {
  const entry = remotePersistState.get(currentSlug);
  if (!entry?.pending) return;
  const { snapshot, serializeBracketFn, showToast, options } = entry.pending;
  entry.pending = null;
  try {
    const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), currentSlug);
    const bracket = snapshot.bracket
      ? serializeBracketFn(snapshot.bracket)
      : null;
    const payload = stripUndefinedDeep({
      ...snapshot,
      bracket,
      lastUpdated: snapshot.lastUpdated || Date.now(),
    });
    if (options?.skipRoster) {
      delete payload.players;
    }
    const comparable = { ...payload };
    delete comparable.lastUpdated;
    const hash = stableStringify(comparable);
    const writePayload = async (force = false) => {
      if (!force && entry.lastHash === hash) return true;
      entry.lastHash = hash;
      await setDoc(ref, payload, { merge: true });
      return true;
    };
    try {
      await writePayload(false);
    } catch (err) {
      const code = err?.code || "";
      const msg = String(err?.message || "");
      const isPrecondition =
        code === "failed-precondition" ||
        msg.includes("FAILED_PRECONDITION") ||
        msg.includes("base version");
      if (!isPrecondition) throw err;
      try {
        await getDoc(ref);
      } catch (_) {
        // ignore refresh errors, still retry the write
      }
      await writePayload(true);
    }
  } catch (err) {
    console.error("Failed to persist tournament state to Firestore", err);
    showToast?.(
      "Could not sync tournament state to Firestore. Changes stay local.",
      "error"
    );
  }
}

const submitMatchScoreCallable = httpsCallable(functions, "submitMatchScore");

export async function submitMatchScoreRemote(payload, showToast) {
  if (!payload?.slug || !payload?.matchId) return null;
  try {
    const response = await submitMatchScoreCallable({
      slug: payload.slug,
      matchId: payload.matchId,
      scoreA: payload.scoreA,
      scoreB: payload.scoreB,
      finalize: payload.finalize !== false,
    });
    return response.data || null;
  } catch (err) {
    console.error("Failed to submit match score via Cloud Function", err);
    showToast?.("Could not submit match score. Changes stay local.", "error");
    return null;
  }
}

export function saveState(
  next,
  options,
  state,
  defaultState,
  currentSlug,
  broadcast,
  saveStateFn,
  persistFn
) {
  const timestamp =
    options.keepTimestamp && typeof next?.lastUpdated === "number"
      ? next.lastUpdated
      : Date.now();
  const merged = { ...state, ...next, lastUpdated: timestamp };
  saveStateFn(merged);
  try {
    localStorage.setItem(getStorageKey(currentSlug), JSON.stringify(merged));
  } catch (_) {
    // storage may be unavailable
  }
  broadcast?.postMessage({ slug: currentSlug, payload: merged });
  if (!options.skipRemote) {
    persistFn(merged, options);
  }
}

export function getStorageKey(currentSlug) {
  return `${currentSlug || "tournament"}:${STORAGE_KEY}`;
}

export async function updateTournamentRosterRemote(
  slug,
  updater,
  patch = {}
) {
  if (!slug || typeof updater !== "function") return null;
  try {
    const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug);
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() || {} : {};
      const currentPlayers = Array.isArray(data.players) ? data.players : [];
      const updateResult = updater(currentPlayers, data);
      const nextPlayers = Array.isArray(updateResult?.players)
        ? updateResult.players
        : Array.isArray(updateResult)
        ? updateResult
        : currentPlayers;
      const updatePatch =
        updateResult && typeof updateResult === "object"
          ? updateResult.patch
          : null;
      const lastUpdated = Date.now();
      const payload = stripUndefinedDeep({
        players: nextPlayers,
        ...(updatePatch && typeof updatePatch === "object" ? updatePatch : {}),
        ...(patch && typeof patch === "object" ? patch : {}),
        lastUpdated,
      });
      tx.set(ref, payload, { merge: true });
      return { players: nextPlayers, lastUpdated, patch: payload, data };
    });
    return result;
  } catch (err) {
    console.error("Failed to update tournament roster", err);
    return null;
  }
}

// Local helper to strip undefined values deeply
function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const cleaned = stripUndefinedDeep(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",");
  return `{${body}}`;
}
