export function getSelectedGame() {
  return localStorage.getItem('selectedGame') || 'stormgate';
}

export function setSelectedGame(game) {
  localStorage.setItem('selectedGame', game);
}
