export const STORAGE_KEY = "zboTournamentStateV1";
export const BROADCAST_NAME = "zboTournamentLive";
export const TOURNAMENT_REGISTRY_KEY = "zboTournamentRegistryV1";
export const TOURNAMENT_COLLECTION = "tournaments";
export const TOURNAMENT_STATE_COLLECTION = "tournamentStates";
export const CIRCUIT_REGISTRY_KEY = "zboCircuitRegistryV1";
export const CIRCUIT_COLLECTION = "tournamentCircuits";
export const MAPS_JSON_URL = "/data/maps.json";

export const FALLBACK_LADDER_MAPS = [
  { name: "10,000 Feet", file: "10000_feet.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Celestial Enclave", file: "celestial_enclave.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Mothership", file: "mothership.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Old Republic", file: "old_republic.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Ruby Rock", file: "ruby_rock.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Taito Citadel", file: "taito_citadel.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Tourmaline", file: "tourmaline.webp", folder: "current/1v1", mode: "1v1" },
  { name: "White Rabbit", file: "white_rabbit.webp", folder: "current/1v1", mode: "1v1" },
  { name: "Winter Madness", file: "winter_madness.webp", folder: "current/1v1", mode: "1v1" },
];

export const defaultState = {
  players: [],
  pointsLedger: {},
  bracket: null,
  needsReseed: false,
  manualSeedingEnabled: false,
  manualSeedingOrder: [],
  activity: [],
  lastUpdated: Date.now(),
  bracketLayoutVersion: 1,
  matchVetoes: {},
  casters: [],
  casterRequests: [],
  matchCasts: {},
  isLive: false,
  disableFinalAutoAdd: false,
};

export let currentSlug = null;
export let state = { ...defaultState };
export let pulseProfile = null;
export let derivedRace = null;
export let derivedMmr = null;
export let isAdmin = false;
export let registryCache = null;
export let currentTournamentMeta = null;
export let requirePulseLinkSetting = true;
export let requirePulseSyncSetting = true;
export let mapPoolSelection = new Set(FALLBACK_LADDER_MAPS.map((m) => m.name));
export let mapCatalog = [];
export let mapCatalogLoaded = false;
export let currentMapPoolMode = "ladder"; // ladder | custom
export const DEFAULT_PLAYER_AVATAR = "img/avatar/marine_avatar_1.webp";
export const MAX_SECONDARY_PULSE_LINKS = 5;
export const MIN_SECONDARY_PULSE_LINKS = 2;
export const GOOGLE_AVATAR_PATTERNS = [
  /googleusercontent\.com/i,
  /lh3\.googleusercontent\.com/i,
];
export let playerDetailModalInitialized = false;
export const defaultBestOf = {
  // upper bracket
  upper: 3,
  quarter: 3,
  semi: 3,
  upperFinal: 3,
  final: 5,
  // lower bracket
  lower: 1,
  lowerSemi: 1,
  lowerFinal: 3,
};
export const defaultRoundRobinSettings = {
  groups: 4,
  advancePerGroup: 2,
  playoffs: "None", // Single Elimination | Double Elimination | None
  bestOf: 3,
};
export let currentVetoMatchId = null;
export let vetoState = null;
export const bracketTestHarness = {
  active: false,
  count: 16,
};
export const broadcast =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(BROADCAST_NAME)
    : null;

// setters for mutable exports
export function setCurrentSlugState(next) {
  currentSlug = next;
}
export function setStateObj(next) {
  state = next;
}
export function setPulseProfileState(next) {
  pulseProfile = next;
}
export function setDerivedRaceState(next) {
  derivedRace = next;
}
export function setDerivedMmrState(next) {
  derivedMmr = next;
}
export function setIsAdminState(next) {
  isAdmin = next;
}
export function setRegistryCacheState(next) {
  registryCache = next;
}
export function setCurrentTournamentMetaState(next) {
  currentTournamentMeta = next;
}
export function setRequirePulseLinkSettingState(next) {
  requirePulseLinkSetting = next;
}
export function setRequirePulseSyncSettingState(next) {
  requirePulseSyncSetting = next;
}
export function setMapPoolSelectionState(next) {
  mapPoolSelection = next;
}
export function setMapCatalogState(next) {
  mapCatalog = next;
}
export function setMapCatalogLoadedState(next) {
  mapCatalogLoaded = next;
}
export function setCurrentMapPoolModeState(next) {
  currentMapPoolMode = next;
}
export function setPlayerDetailModalInitializedState(next) {
  playerDetailModalInitialized = next;
}
export function setCurrentVetoMatchIdState(next) {
  currentVetoMatchId = next;
}
export function setVetoStateState(next) {
  vetoState = next;
}
