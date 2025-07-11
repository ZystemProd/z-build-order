export function setupMobileHeader() {
  const mobileHeader = document.getElementById('mobile-header');
  const authContainer = document.getElementById('auth-container');
  const gameSelect = document.getElementById('game-select');

  if (!mobileHeader || !authContainer || !gameSelect) return;

  const authParent = authContainer.parentNode;
  const authPlaceholder = document.createComment('auth-placeholder');
  const gameParent = gameSelect.parentNode;
  const gamePlaceholder = document.createComment('game-placeholder');

  function moveToHeader() {
    if (!mobileHeader.contains(gameSelect)) {
      gameParent.insertBefore(gamePlaceholder, gameSelect);
      mobileHeader.appendChild(gameSelect);
    }
    if (!mobileHeader.contains(authContainer)) {
      authParent.insertBefore(authPlaceholder, authContainer);
      mobileHeader.appendChild(authContainer);
    }
  }

  function restoreLayout() {
    if (mobileHeader.contains(gameSelect) && gamePlaceholder.parentNode) {
      gamePlaceholder.parentNode.insertBefore(gameSelect, gamePlaceholder);
      gamePlaceholder.remove();
    }
    if (mobileHeader.contains(authContainer) && authPlaceholder.parentNode) {
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
