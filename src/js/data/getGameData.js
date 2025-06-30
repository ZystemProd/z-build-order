import { getCurrentGame } from '../modules/states/gameState.js';

let cachedGame = null;
let cachedData = null;

export async function loadGameData() {
  const game = getCurrentGame();
  if (cachedGame === game && cachedData) return cachedData;

  let unitsModule, structuresModule, upgradesModule, imagesModule, abbrModule;

  if (game === 'stormgate') {
    unitsModule = await import('./stormgate/units.js');
    structuresModule = await import('./stormgate/structures.js');
    upgradesModule = await import('./stormgate/upgrades.js');
    imagesModule = await import('./stormgate/images.js');
    abbrModule = await import('./stormgate/abbreviations.js');
  } else {
    unitsModule = await import('./units.js');
    structuresModule = await import('./structures.js');
    upgradesModule = await import('./upgrades.js');
    imagesModule = await import('./images.js');
    abbrModule = await import('./abbreviationMap.js');
  }

  cachedData = {
    units: unitsModule.units,
    structures: structuresModule.structures,
    upgrades: upgradesModule.upgrades,
    unitImages: imagesModule.unitImages,
    structureImages: imagesModule.structureImages,
    upgradeImages: imagesModule.upgradeImages,
    abbreviationMap: abbrModule.abbreviationMap,
  };
  cachedGame = game;
  return cachedData;
}
