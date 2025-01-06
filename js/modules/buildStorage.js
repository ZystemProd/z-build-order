let savedBuilds = [];

export function getSavedBuilds() {
  return savedBuilds;
}

export function setSavedBuilds(builds) {
  savedBuilds = builds;
}

export function saveSavedBuildsToLocalStorage() {
  localStorage.setItem("savedBuilds", JSON.stringify(savedBuilds));
}

export function loadSavedBuildsFromLocalStorage() {
  const storedBuilds = localStorage.getItem("savedBuilds");
  savedBuilds = storedBuilds ? JSON.parse(storedBuilds) : [];
}
