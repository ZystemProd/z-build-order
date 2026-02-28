export function registerTournamentEvents({
  auth,
  db,
  onAuthStateChanged,
  getCurrentSlug,
  getState,
  getCurrentTournamentMeta,
  getCurrentUserAvatarUrl,
  getPulseState,
  showToast,
  saveState,
  renderAll,
  rebuildBracket,
  bracketHasResults,
  seedEligiblePlayersWithMode,
  checkInCurrentPlayer,
  syncCurrentPlayerAvatar,
  hydratePulseFromState,
  recomputeAdminFromMeta,
  recomputeCircuitAdminFromMeta,
  handleTournamentCheckInAction,
  handleTournamentInviteAction,
  initTabAlerts,
  handleUnreadChatEvent,
  handleRouteChange,
  configureFinalMapPool,
  getDefaultMapPoolNames,
  getAll1v1Maps,
  getMapByName,
  renderMapPoolPickerUI,
  renderChosenMapsUI,
  isDefaultLadderSelection,
  initTournamentPage,
  buildTournamentPageInitArgs,
  ensureMapCatalogLoadedForUi,
  initCoverReuseModal,
  initCasterControls,
  ensureAdminSearchBootstrap,
  getIsAdmin,
  bindTournamentSponsorControls,
  bindTournamentSocialControls,
  bindTournamentPromoSettingsControls,
  initInviteLinksPanel,
  initAdminInviteModal,
  updateCheckInUI,
  setMapPoolSelection,
  resetFinalMapPoolSelection,
  ensureSettingsUiReady,
  initializeAuthUI,
}) {
  if (typeof window !== "undefined") {
    window.addEventListener("pulse-state-changed", (event) => {
      hydratePulseFromState(event.detail);
      if (getCurrentTournamentMeta()) {
        renderAll();
      }
    });
    window.addEventListener("user-avatar-updated", (event) => {
      const avatarUrl =
        event?.detail?.avatarUrl || getCurrentUserAvatarUrl?.() || "";
      syncCurrentPlayerAvatar(avatarUrl);
    });
    window.addEventListener("user-profile-updated", () => {
      const avatarUrl = getCurrentUserAvatarUrl?.() || "";
      syncCurrentPlayerAvatar(avatarUrl);
    });
  }

  onAuthStateChanged?.(auth, () => {
    recomputeAdminFromMeta();
    recomputeCircuitAdminFromMeta();
    if (getIsAdmin?.()) {
      void ensureAdminSearchBootstrap?.();
    }
    if (getCurrentTournamentMeta()) {
      renderAll();
    }
  });

  document.addEventListener("tournament:notification-action", (event) => {
    const detail = event.detail || {};
    if (detail.notification?.type === "tournament-checkin") {
      handleTournamentCheckInAction({
        notification: detail.notification,
        auth,
        db,
        currentSlug: getCurrentSlug(),
        checkInLocal: checkInCurrentPlayer,
        showToast,
      });
      return;
    }
    const state = getState();
    handleTournamentInviteAction({
      notification: detail.notification,
      action: detail.action,
      race: detail.race,
      auth,
      db,
      currentSlug: getCurrentSlug(),
      state,
      isLive: state.isLive,
      saveState,
      renderAll,
      rebuildBracket,
      seedEligiblePlayers: seedEligiblePlayersWithMode,
      bracketHasResults,
      showToast,
    });
  });

  document.addEventListener("DOMContentLoaded", async () => {
    initTabAlerts();
    document.addEventListener(
      "tournament:match-chat-unread",
      handleUnreadChatEvent,
    );

    window.addEventListener("popstate", async () => {
      try {
        await handleRouteChange();
      } catch (err) {
        console.error("Failed to handle history navigation", err);
      }
    });

    configureFinalMapPool({
      getDefaultMapPoolNames,
      getAll1v1Maps,
      getMapByName,
      renderMapPoolPickerUI,
      renderChosenMapsUI,
      isDefaultLadderSelection,
    });

    initTournamentPage(buildTournamentPageInitArgs());

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const mapSelector =
        "#mapPoolPicker, #settingsMapPoolPicker, #finalMapPoolPicker, #circuitFinalMapPoolPicker";
      if (target.closest(mapSelector)) {
        ensureMapCatalogLoadedForUi();
      }
    });

    initCoverReuseModal();
    initCasterControls({ saveState });
    if (getIsAdmin?.()) {
      void ensureAdminSearchBootstrap?.();
    }
    bindTournamentSponsorControls();
    bindTournamentSocialControls();
    bindTournamentPromoSettingsControls(getCurrentTournamentMeta);
    initInviteLinksPanel();
    initAdminInviteModal();

    if (typeof window !== "undefined") {
      setInterval(() => {
        if (getCurrentTournamentMeta()) {
          updateCheckInUI();
        }
      }, 30000);
    }

    try {
      setMapPoolSelection(getDefaultMapPoolNames());
      resetFinalMapPoolSelection();
      ensureSettingsUiReady();
      initializeAuthUI();
      hydratePulseFromState(getPulseState());
      await handleRouteChange();
    } catch (err) {
      console.error("Tournament page init failed", err);
    }
  });
}
