import { doc, getDoc, getDocs, setDoc, collection } from "firebase/firestore";
import {
  TOURNAMENT_COLLECTION,
  TOURNAMENT_REGISTRY_KEY,
  TOURNAMENT_STATE_COLLECTION,
  STORAGE_KEY,
  defaultState,
} from "../state.js";
import { db } from "../../../../app.js";

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
  if (!force && loadTournamentRegistry.cached) return loadTournamentRegistry.cached;
  const fallback = loadTournamentRegistryCache();
  try {
    const snap = await getDocs(collection(db, TOURNAMENT_COLLECTION));
    const list = snap.docs.map((d) => {
      const data = d.data() || {};
      const startTime = data.startTime?.toMillis ? data.startTime.toMillis() : data.startTime;
      return {
        id: d.id,
        slug: data.slug || d.id,
        name: data.name || d.id,
        description: data.description || "",
        rules: data.rules || "",
        mapPool: data.mapPool?.length ? data.mapPool : [],
        format: data.format || "Tournament",
        coverImageUrl: data.coverImageUrl || "",
        maxPlayers: data.maxPlayers || null,
        startTime: startTime || null,
        createdBy: data.createdBy || null,
        createdByName: data.createdByName || data.hostName || null,
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

// State (local + Firestore)
export function loadState(currentSlug, applySeedingFn, deserializeBracketFn) {
  if (!currentSlug) return { ...defaultState };
  try {
    const raw = localStorage.getItem(getStorageKey(currentSlug));
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      players: applySeedingFn(parsed.players || []),
      activity: parsed.activity || [],
    };
  } catch (_) {
    return { ...defaultState };
  }
}

export async function loadTournamentStateRemote(slug) {
  if (!slug) return null;
  try {
    const snap = await getDoc(doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const lastUpdated = data.lastUpdated?.toMillis ? data.lastUpdated.toMillis() : data.lastUpdated;
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
  renderAllFn
) {
  if (!slug) return;
  const remote = await loadTournamentStateRemote(slug);
  if (!remote) return;
  const merged = {
    ...defaultState,
    ...remote,
    players: applySeedingFn(remote.players || []),
    activity: remote.activity || [],
    bracket: deserializeBracketFn(remote.bracket),
  };
  saveStateFn(merged, { skipRemote: true, keepTimestamp: true });
  renderAllFn();
}

export async function persistTournamentStateRemote(
  snapshot,
  currentSlug,
  serializeBracketFn,
  showToast
) {
  if (!currentSlug) return;
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

    await setDoc(ref, payload, { merge: true });
  } catch (_) {
    console.error("Failed to persist tournament state to Firestore", _);
    showToast?.(
      "Could not sync tournament state to Firestore. Changes stay local.",
      "error"
    );
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
    persistFn(merged);
  }
}

export function getStorageKey(currentSlug) {
  return `${currentSlug || "tournament"}:${STORAGE_KEY}`;
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
