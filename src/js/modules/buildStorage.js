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

// Add this function to delete a build by index
export function deleteBuildFromStorage(index) {
  if (index >= 0 && index < savedBuilds.length) {
    savedBuilds.splice(index, 1); // Remove the build at the specified index
    saveSavedBuildsToLocalStorage(); // Save the updated builds to localStorage
  }
}
