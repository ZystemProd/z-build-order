import './app.js';
import { initializeAuthUI } from './app.js';
import { initializeIndexPage } from './js/modules/init/indexPageInit.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeAuthUI();
  initializeIndexPage();
});
