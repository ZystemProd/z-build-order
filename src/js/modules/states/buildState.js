// src/js/modules/state/buildState.js

let currentBuildId = null;

/**
 * Sets the current build ID being edited or viewed.
 * @param {string|null} id - The build ID or null to clear it
 */
export function setCurrentBuildId(id) {
  currentBuildId = id;
}

/**
 * Returns the current build ID in use.
 * @returns {string|null} The current build ID or null if not set
 */
export function getCurrentBuildId() {
  return currentBuildId;
}
