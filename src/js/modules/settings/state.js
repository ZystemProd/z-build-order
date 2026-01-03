const DEFAULT_PULSE_STATE = {
  url: "",
  mmr: null,
  fetchedAt: null,
  byRace: null,
  accountName: "",
  secondary: [],
};

let currentUsername = null;
let currentUserProfile = null;
let pulseState = { ...DEFAULT_PULSE_STATE };

function getCurrentUsername() {
  return currentUsername || "";
}

function setCurrentUsername(value) {
  currentUsername = value || null;
}

function getCurrentUserProfile() {
  return currentUserProfile ? { ...currentUserProfile } : null;
}

function setCurrentUserProfile(profile) {
  currentUserProfile = profile && typeof profile === "object" ? profile : null;
}

function getPulseState() {
  return {
    ...pulseState,
    secondary: Array.isArray(pulseState.secondary)
      ? pulseState.secondary.slice()
      : [],
  };
}

function setPulseState(next) {
  pulseState = {
    ...DEFAULT_PULSE_STATE,
    ...(next && typeof next === "object" ? next : {}),
  };
}

function resetPulseState() {
  pulseState = { ...DEFAULT_PULSE_STATE };
}

export {
  DEFAULT_PULSE_STATE,
  getCurrentUsername,
  setCurrentUsername,
  getCurrentUserProfile,
  setCurrentUserProfile,
  getPulseState,
  setPulseState,
  resetPulseState,
};
