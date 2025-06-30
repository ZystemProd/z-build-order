import { getSelectedGame } from '../modules/gameSettings.js';

const selectedGame = getSelectedGame();
let data;
if (selectedGame === 'aoe2') {
  data = await import('./games/aoe2/index.js');
} else {
  data = await import('./games/sc2/index.js');
}

export const { units, structures, upgrades, unitImages, structureImages, upgradeImages } = data;
