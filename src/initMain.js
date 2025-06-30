import './app.js';
import { initializeAuthUI } from './app.js';
import { initializeIndexPage } from './js/modules/init/indexPageInit.js';
import { setSelectedGame } from './js/modules/gameSettings.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('selectedGame')) {
    setSelectedGame('stormgate');
  }
  initializeAuthUI();
  initializeIndexPage();
});
