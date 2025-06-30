import { getSelectedGame } from '../modules/gameSettings.js';

const selectedGame = getSelectedGame();
let data;
if (selectedGame === 'stormgate') {
  data = await import('./games/stormgate/index.js');
} else {
  data = await import('./games/stormgate/index.js');
}

export const { units, structures, upgrades, unitImages, structureImages, upgradeImages } = data;
