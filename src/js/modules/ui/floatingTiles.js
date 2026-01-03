export function updateFloatingTilePositions() {
  const authEl = document.getElementById("auth-container");
  const vetoEl = document.getElementById("mapVetoTile");
  const tournamentEl = document.getElementById("tournamentTile");
  if (!authEl) return;

  // Skip on mobile (tiles are hidden there)
  if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
    return;
  }

  // Preferred horizontal gap between elements
  const gap = 16; // px

  const rect = authEl.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    if (vetoEl) vetoEl.style.right = "10px";
    if (tournamentEl) tournamentEl.style.right = "10px";
    return;
  }

  // Place tiles to the left of auth container with a fixed gap
  let currentRight = Math.max(10, window.innerWidth - rect.left + gap);
  if (vetoEl) {
    vetoEl.style.right = `${currentRight}px`;
    currentRight += (vetoEl.offsetWidth || 150) + gap;
  }
  if (tournamentEl) {
    tournamentEl.style.right = `${currentRight}px`;
  }
}

export function initFloatingTilePositioning() {
  const safeUpdate = () => {
    try {
      updateFloatingTilePositions();
    } catch (_) {}
  };
  window.addEventListener("resize", safeUpdate);
  window.addEventListener("load", safeUpdate);
}
