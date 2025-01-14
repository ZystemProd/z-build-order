import {
  initializeEventListeners,
  initializeModalEventListeners,
} from "./modules/eventHandlers.js";

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  initializeModalEventListeners();
});
