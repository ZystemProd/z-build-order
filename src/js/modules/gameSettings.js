export function getSelectedGame() {
  return localStorage.getItem('selectedGame') || 'sc2';
}

export function setSelectedGame(game) {
  localStorage.setItem('selectedGame', game);
}
