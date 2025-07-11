export function setupMobileHeader() {
  const mainHeader = document.getElementById('main-header');
  const authContainer = document.getElementById('auth-container');
  const gameSelect = document.getElementById('game-select');
  const communityBtn = document.getElementById('showCommunityModalButton');
  const buildsBtn = document.getElementById('showBuildsButton');

  if (!mainHeader || !authContainer || !gameSelect) return;

  const authParent = authContainer.parentNode;
  const authPlaceholder = document.createComment('auth-placeholder');
  const gameParent = gameSelect.parentNode;
  const gamePlaceholder = document.createComment('game-placeholder');
  const communityParent = communityBtn ? communityBtn.parentNode : null;
  const communityPlaceholder = document.createComment('community-placeholder');
  const buildsParent = buildsBtn ? buildsBtn.parentNode : null;
  const buildsPlaceholder = document.createComment('builds-placeholder');

  function moveToHeader() {
    if (!mainHeader.contains(gameSelect)) {
      gameParent.insertBefore(gamePlaceholder, gameSelect);
      mainHeader.appendChild(gameSelect);
    }
    if (communityBtn && !mainHeader.contains(communityBtn)) {
      communityParent.insertBefore(communityPlaceholder, communityBtn);
      mainHeader.appendChild(communityBtn);
    }
    if (buildsBtn && !mainHeader.contains(buildsBtn)) {
      buildsParent.insertBefore(buildsPlaceholder, buildsBtn);
      mainHeader.appendChild(buildsBtn);
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
    if (communityBtn && mainHeader.contains(communityBtn) && communityPlaceholder.parentNode) {
      communityPlaceholder.parentNode.insertBefore(communityBtn, communityPlaceholder);
      communityPlaceholder.remove();
    }
    if (buildsBtn && mainHeader.contains(buildsBtn) && buildsPlaceholder.parentNode) {
      buildsPlaceholder.parentNode.insertBefore(buildsBtn, buildsPlaceholder);
      buildsPlaceholder.remove();
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
