const GAME_KEY = 'selectedGame';

export function getCurrentGame() {
  return localStorage.getItem(GAME_KEY) || 'sc2';
}

export function setCurrentGame(game) {
  if (game) {
    localStorage.setItem(GAME_KEY, game);
  } else {
    localStorage.removeItem(GAME_KEY);
  }
}
