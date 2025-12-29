export function setupMobileHeader() {
  const mainHeader = document.getElementById('main-header');
  const authContainer = document.getElementById('auth-container');
  const communityBtn = document.getElementById('showCommunityModalButton');
  const buildsBtn = document.getElementById('showBuildsButton');
  const vetoBtn = document.getElementById('mapVetoBtn');
  const tournamentBtn = document.getElementById('tournamentBtn');

  if (!mainHeader || !authContainer) return;

  const authParent = authContainer.parentNode;
  const authPlaceholder = document.createComment('auth-placeholder');
  const communityParent = communityBtn ? communityBtn.parentNode : null;
  const communityPlaceholder = document.createComment('community-placeholder');
  const buildsParent = buildsBtn ? buildsBtn.parentNode : null;
  const buildsPlaceholder = document.createComment('builds-placeholder');
  const vetoParent = vetoBtn ? vetoBtn.parentNode : null;
  const vetoPlaceholder = document.createComment('veto-placeholder');
  const tournamentParent = tournamentBtn ? tournamentBtn.parentNode : null;
  const tournamentPlaceholder = document.createComment('tournament-placeholder');

  function moveToHeader() {
    if (communityBtn && !mainHeader.contains(communityBtn)) {
      communityParent.insertBefore(communityPlaceholder, communityBtn);
      mainHeader.appendChild(communityBtn);
    }
    if (buildsBtn && !mainHeader.contains(buildsBtn)) {
      buildsParent.insertBefore(buildsPlaceholder, buildsBtn);
      mainHeader.appendChild(buildsBtn);
    }
    if (vetoBtn && !mainHeader.contains(vetoBtn)) {
      vetoParent.insertBefore(vetoPlaceholder, vetoBtn);
      mainHeader.appendChild(vetoBtn);
    }
    if (tournamentBtn && tournamentParent && !mainHeader.contains(tournamentBtn)) {
      tournamentParent.insertBefore(tournamentPlaceholder, tournamentBtn);
      mainHeader.appendChild(tournamentBtn);
    }
    if (!mainHeader.contains(authContainer)) {
      authParent.insertBefore(authPlaceholder, authContainer);
      mainHeader.appendChild(authContainer);
    }
  }

  function restoreLayout() {
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
    if (vetoBtn && mainHeader.contains(vetoBtn) && vetoPlaceholder.parentNode) {
      vetoPlaceholder.parentNode.insertBefore(vetoBtn, vetoPlaceholder);
      vetoPlaceholder.remove();
    }
    if (tournamentBtn && mainHeader.contains(tournamentBtn) && tournamentPlaceholder.parentNode) {
      tournamentPlaceholder.parentNode.insertBefore(tournamentBtn, tournamentPlaceholder);
      tournamentPlaceholder.remove();
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
