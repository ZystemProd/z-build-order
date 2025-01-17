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

export function saveBuilds(builds) {
  localStorage.setItem("savedBuilds", JSON.stringify(builds));
}
