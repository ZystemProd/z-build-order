import './app.js';
import { initializeAuthUI } from './app.js';
import { initializeIndexPage } from './js/modules/init/indexPageInit.js';
import { setupMobileHeader } from './js/modules/mobileHeader.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeAuthUI();
  initializeIndexPage();
  setupMobileHeader();
});
