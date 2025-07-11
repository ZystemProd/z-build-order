export function setupMobileHeader() {
  const mainHeader = document.getElementById('main-header');
  const authContainer = document.getElementById('auth-container');
  const gameSelect = document.getElementById('game-select');

  if (!mainHeader || !authContainer || !gameSelect) return;

  const authParent = authContainer.parentNode;
  const authPlaceholder = document.createComment('auth-placeholder');
  const gameParent = gameSelect.parentNode;
  const gamePlaceholder = document.createComment('game-placeholder');

  function moveToHeader() {
    if (!mainHeader.contains(gameSelect)) {
      gameParent.insertBefore(gamePlaceholder, gameSelect);
      mainHeader.appendChild(gameSelect);
    }
    if (!mainHeader.contains(authContainer)) {
      authParent.insertBefore(authPlaceholder, authContainer);
      mainHeader.appendChild(authContainer);
    }
  }

  function restoreLayout() {
    if (mainHeader.contains(gameSelect) && gamePlaceholder.parentNode) {
      gamePlaceholder.parentNode.insertBefore(gameSelect, gamePlaceholder);
      gamePlaceholder.remove();
    }
    if (mainHeader.contains(authContainer) && authPlaceholder.parentNode) {
      authPlaceholder.parentNode.insertBefore(authContainer, authPlaceholder);
      authPlaceholder.remove();
    }
  }

  function handleResize() {
    if (window.innerWidth <= 768) {
      moveToHeader();
    } else {
      restoreLayout();
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize();
}
