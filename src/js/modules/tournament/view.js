export function updatePlacementsRowView({
  currentTournamentMeta,
  state,
  getEligiblePlayers,
  computePlacementsForBracket,
  getPlayersMap,
}) {
  if (!currentTournamentMeta) return;
  const placementsRow = document.getElementById("tournamentPlacements");
  const placementFirst = document.getElementById("placementFirst");
  const placementSecond = document.getElementById("placementSecond");
  const placementThirdFourth = document.getElementById("placementThirdFourth");
  if (
    !placementsRow ||
    !placementFirst ||
    !placementSecond ||
    !placementThirdFourth
  ) {
    return;
  }
  const eligiblePlayers = getEligiblePlayers(state.players || []);
  const placements = computePlacementsForBracket(
    state.bracket,
    eligiblePlayers.length || 0,
  );
  if (!placements) {
    placementsRow.style.display = "none";
    return;
  }
  const playersById = getPlayersMap();
  const firstId = Array.from(placements.entries()).find(
    ([, place]) => place === 1,
  )?.[0];
  const secondId = Array.from(placements.entries()).find(
    ([, place]) => place === 2,
  )?.[0];
  const thirdIds = Array.from(placements.entries())
    .filter(([, place]) => place === 3)
    .map(([id]) => id);
  placementFirst.textContent = playersById.get(firstId)?.name || "—";
  placementSecond.textContent = playersById.get(secondId)?.name || "—";
  placementThirdFourth.textContent = thirdIds.length
    ? thirdIds.map((id) => playersById.get(id)?.name || "—").join(" · ")
    : "—";
  placementsRow.style.display = "flex";
}

export function renderBracketContent({
  bracketContainer,
  bracket,
  playersArr,
  format,
  matchIds,
  isGroupStageFormat,
  getMatchLookup,
  getPlayersMap,
  updateTreeMatchCards,
  getCurrentUsername,
  auth,
  annotateConnectorPlayers,
  clampScoreSelectOptions,
  ensureRoundRobinPlayoffs,
  saveState,
  renderRoundRobinView,
  computeGroupStandings,
  DOMPurify,
  attachMatchActionHandlers,
  renderBracketView,
  attachMatchHoverHandlers,
  enableDragScroll,
}) {
  if (!bracketContainer || !bracket) return;
  let lookup = getMatchLookup(bracket);
  const playersById = getPlayersMap();
  const shouldPartialUpdate =
    Array.isArray(matchIds) && matchIds.length && !isGroupStageFormat(format);
  let didPartialUpdate = false;

  if (shouldPartialUpdate) {
    didPartialUpdate = updateTreeMatchCards(matchIds, lookup, playersById, {
      currentUsername: getCurrentUsername?.() || "",
      currentUid: auth.currentUser?.uid || "",
    });
    if (didPartialUpdate) {
      annotateConnectorPlayers(lookup, playersById);
      clampScoreSelectOptions();
    }
  }

  if (!didPartialUpdate) {
    if (isGroupStageFormat(format)) {
      const changed = ensureRoundRobinPlayoffs(bracket, playersById, lookup);
      if (changed) {
        lookup = getMatchLookup(bracket);
        saveState({ bracket }, { skipRoster: true });
      }
      const html = renderRoundRobinView(
        { ...bracket },
        playersById,
        computeGroupStandings,
      );
      bracketContainer.innerHTML = DOMPurify.sanitize(html);
      attachMatchActionHandlers?.();
    } else {
      renderBracketView({
        bracket,
        players: playersArr,
        format,
        ensurePlayoffs: (nextBracket) =>
          ensureRoundRobinPlayoffs(nextBracket, playersById, lookup),
        getPlayersMap,
        attachMatchActionHandlers,
        computeGroupStandings,
        currentUsername: getCurrentUsername?.() || "",
        currentUid: auth.currentUser?.uid || "",
      });
    }
    attachMatchHoverHandlers();
    annotateConnectorPlayers(lookup, playersById);
    clampScoreSelectOptions();
    const groupScrolls = bracketContainer.querySelectorAll(
      ".group-stage-scroll, .playoff-scroll",
    );
    groupScrolls.forEach((el) => {
      if (el.dataset.dragScrollBound === "true") return;
      enableDragScroll(el, {
        axisLock: true,
        scrollXElement: el,
        scrollYElement: el,
        ignoreSelector:
          'a, button, input, select, textarea, label, [contenteditable="true"], [data-no-drag]',
      });
      el.dataset.dragScrollBound = "true";
    });
  }
}

export function renderTournamentMetaSection({
  currentTournamentMeta,
  state,
  isAdmin,
  currentSlug,
  inviteLinkGate,
  auth,
  setTabAlertsBaseTitle,
  sanitizeUrl,
  renderMarkdown,
  renderPrizeInfoMarkup,
  isDualTournamentFormat,
  getStartTimeMs,
  getEligiblePlayers,
  formatPrizePoolTotal,
  isInviteOnlyTournament,
  normalizeInviteStatus,
  INVITE_STATUS,
  updatePlacementsRow,
  getCheckInWindowState,
  bracketHasResults,
  normalizeSc2PulseIdUrl,
  updateCheckInUI,
  renderCasterSection,
  saveState,
  renderAll,
  hideMatchInfoModal,
  escapeHtml,
  raceClassName,
  renderActivityList,
  formatTime,
  populateSettingsPanelUI,
  setMapPoolSelection,
  getDefaultMapPoolNames,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  syncFormatFieldVisibility,
  updatePrizeSplitWarning,
  updateSettingsScoreLocks,
  getPromoStripRenderKey,
  promoStripRenderKey,
  setPromoStripRenderKey,
  refreshTournamentPromoStrip,
  refreshTournamentPromoSettings,
  renderCircuitPointsSettings,
  hydrateCurrentUserClanLogo,
}) {
  if (!currentTournamentMeta) return;
  const tournamentTitle = document.getElementById("tournamentTitle");
  const tournamentFormat = document.getElementById("tournamentFormat");
  const tournamentStart = document.getElementById("tournamentStart");
  const descriptionBody = document.getElementById("tournamentDescriptionBody");
  const rulesBody = document.getElementById("tournamentRulesBody");
  const prizeInfoSection = document.getElementById("tournamentPrizeInfoSection");
  const prizeInfoBody = document.getElementById("tournamentPrizeInfoBody");
  const statPlayers = document.getElementById("statPlayers");
  const tournamentPrizePool = document.getElementById("tournamentPrizePool");
  const registerBtn = document.getElementById("registerBtn");
  const goLiveBtn = document.getElementById("rebuildBracketBtn");
  const recreateBracketBtn = document.getElementById("recreateBracketBtn");
  const notifyCheckInBtn = document.getElementById("notifyCheckInBtn");
  const refreshMmrBtn = document.getElementById("refreshMmrBtn");
  const resetTournamentBtn = document.getElementById("resetTournamentBtn");
  const resetScoresBtn = document.getElementById("resetScoresBtn");
  const resetVetoScoreChatBtn = document.getElementById("resetVetoScoreChatBtn");
  const startMs = getStartTimeMs(currentTournamentMeta);
  const liveDot = document.getElementById("liveDot");
  const bracketPreviewControls = document.getElementById("bracketPreviewControls");
  const bracketShowPreviewToggle = document.getElementById(
    "bracketShowPreviewToggle",
  );
  const bracketShowPreviewPublicToggle = document.getElementById(
    "bracketShowPreviewPublicToggle",
  );
  const bracketGrid = document.getElementById("bracketGrid");
  const bracketNotLive = document.getElementById("bracketNotLive");
  const matchInfoModal = document.getElementById("matchInfoModal");
  const bracketNotLiveMessage = document.getElementById("bracketNotLiveMessage");
  const registeredPlayersList = document.getElementById("registeredPlayersList");
  const activityCard = document.getElementById("activityCard");
  const casterLiveCard = document.getElementById("casterLiveCard");
  const bracketTitle = document.getElementById("bracketTitle");
  const currentUid = auth.currentUser?.uid || null;
  const currentPlayer = currentUid
    ? (state.players || []).find((p) => p.uid === currentUid)
    : null;
  const currentInviteStatus = normalizeInviteStatus(currentPlayer?.inviteStatus);
  const eligiblePlayers = getEligiblePlayers(state.players || []);
  const hasCheckedIn = eligiblePlayers.some((player) => player.checkedInAt);
  const isInviteOnly = isInviteOnlyTournament(currentTournamentMeta);
  const accessNote = document.getElementById("registrationAccessNote");
  const registrationForm = document.getElementById("registrationForm");
  const registrationCard = document.getElementById("registrationCard");
  const registrationGuestMessage = document.getElementById(
    "registrationGuestMessage",
  );
  const isGuest = !auth.currentUser;

  hydrateCurrentUserClanLogo();

  if (registrationGuestMessage) {
    registrationGuestMessage.style.display = isGuest ? "block" : "none";
  }
  if (registrationCard) {
    registrationCard.style.display = isGuest ? "none" : "";
  }

  if (tournamentTitle) {
    tournamentTitle.textContent = currentTournamentMeta.name || "Tournament";
    setTabAlertsBaseTitle(tournamentTitle.textContent);
  }
  const tournamentHero = document.querySelector("#tournamentView .hero");
  if (tournamentHero) {
    const coverUrl = sanitizeUrl(currentTournamentMeta.coverImageUrl || "");
    if (coverUrl) {
      if (tournamentHero.dataset.coverUrl !== coverUrl) {
        tournamentHero.classList.add("has-cover");
        tournamentHero.style.setProperty(
          "--hero-cover-image",
          `url("${coverUrl}")`,
        );
        tournamentHero.dataset.coverUrl = coverUrl;
      } else {
        tournamentHero.classList.add("has-cover");
      }
    } else {
      tournamentHero.classList.remove("has-cover");
      tournamentHero.style.removeProperty("--hero-cover-image");
      if (tournamentHero.dataset.coverUrl) {
        delete tournamentHero.dataset.coverUrl;
      }
    }
  }
  if (tournamentFormat) {
    tournamentFormat.textContent = currentTournamentMeta.format || "Tournament";
  }
  if (descriptionBody) {
    descriptionBody.innerHTML = renderMarkdown(currentTournamentMeta.description || "");
  }
  if (rulesBody) {
    rulesBody.innerHTML = renderMarkdown(currentTournamentMeta.rules || "");
  }
  if (prizeInfoSection && prizeInfoBody) {
    const markup = renderPrizeInfoMarkup(currentTournamentMeta);
    prizeInfoSection.style.display = markup ? "" : "none";
    prizeInfoBody.innerHTML = markup;
  }
  if (bracketTitle) {
    const formatLabel = (currentTournamentMeta.format || "").toLowerCase();
    const isGroupStage =
      formatLabel.includes("round robin") || isDualTournamentFormat(formatLabel);
    bracketTitle.textContent = isGroupStage
      ? "Group Stage"
      : currentTournamentMeta.format || "Bracket";
  }
  if (tournamentStart) {
    tournamentStart.textContent = startMs
      ? new Date(startMs).toLocaleString([], {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TBD";
  }
  if (statPlayers) statPlayers.textContent = String(eligiblePlayers.length || 0);
  if (tournamentPrizePool) {
    tournamentPrizePool.textContent = formatPrizePoolTotal({
      total: currentTournamentMeta?.prizePoolTotal,
      currency: currentTournamentMeta?.prizePoolCurrency || "USD",
      customCurrency: currentTournamentMeta?.prizePoolCurrencyCustom || "",
    });
  }

  const tokenActive =
    isInviteOnly &&
    !isAdmin &&
    !currentPlayer &&
    inviteLinkGate?.slug === currentSlug &&
    Boolean(inviteLinkGate?.token);
  const inviteLinkExhausted =
    tokenActive &&
    inviteLinkGate.status === "ready" &&
    !inviteLinkGate.ok &&
    String(inviteLinkGate.message || "")
      .toLowerCase()
      .includes("no remaining uses");

  if (accessNote) {
    accessNote.classList.toggle("is-blocking", inviteLinkExhausted);
    if (isInviteOnly && !isAdmin) {
      if (tokenActive) {
        accessNote.textContent = inviteLinkGate.message || "Invite link detected.";
      } else {
        accessNote.textContent =
          "This tournament is invite-only. Ask an admin for an invite.";
      }
      accessNote.style.display = "block";
    } else {
      accessNote.textContent = "";
      accessNote.style.display = "none";
    }
  }

  if (registrationForm) {
    registrationForm.style.display = inviteLinkExhausted ? "none" : "";
  }

  updatePlacementsRow();

  if (registerBtn) {
    const isRegisterLoading = registerBtn.classList.contains("is-loading");
    if (state.isLive) {
      registerBtn.textContent = "Registration closed";
      registerBtn.disabled = true;
    } else if (currentPlayer && currentInviteStatus === INVITE_STATUS.pending) {
      registerBtn.textContent = "Invitation pending";
      registerBtn.disabled = true;
    } else if (currentPlayer && currentInviteStatus === INVITE_STATUS.denied) {
      registerBtn.textContent = "Invite declined";
      registerBtn.disabled = true;
    } else if (currentPlayer) {
      registerBtn.textContent = "Unregister";
      registerBtn.disabled = false;
    } else if (isInviteOnly && !isAdmin) {
      const hasToken =
        inviteLinkGate?.slug === currentSlug && Boolean(inviteLinkGate?.token);
      if (!hasToken) {
        registerBtn.textContent = "Invite required";
        registerBtn.disabled = true;
      } else if (inviteLinkGate.status === "loading") {
        registerBtn.textContent = "Checking invite link...";
        registerBtn.disabled = true;
      } else if (!inviteLinkGate.ok) {
        registerBtn.textContent = "Invite link invalid";
        registerBtn.disabled = true;
      } else {
        registerBtn.textContent = "Register";
        registerBtn.disabled = Boolean(isRegisterLoading);
      }
    } else {
      registerBtn.textContent = "Register";
      registerBtn.disabled = Boolean(isRegisterLoading);
    }
  }

  if (goLiveBtn) {
    const checkInState = getCheckInWindowState(currentTournamentMeta);
    const requiresManualClose = checkInState.allowAfterStart && checkInState.isOpen;
    const canResumeExistingBracket =
      Boolean(state.hasBeenLive) && Boolean(state.bracket) && bracketHasResults();
    if (state.isLive) {
      goLiveBtn.disabled = false;
      goLiveBtn.textContent = "Set Not Live";
      goLiveBtn.classList.add("danger");
      goLiveBtn.classList.remove("success");
    } else {
      goLiveBtn.disabled = canResumeExistingBracket
        ? false
        : !hasCheckedIn || requiresManualClose;
      goLiveBtn.textContent = canResumeExistingBracket ? "Resume Live" : "Go Live";
      goLiveBtn.classList.add("success");
      goLiveBtn.classList.remove("danger");
    }
  }
  if (recreateBracketBtn) {
    const show = isAdmin && !state.isLive && Boolean(state.hasBeenLive);
    recreateBracketBtn.style.display = show ? "" : "none";
    recreateBracketBtn.disabled = false;
  }
  if (resetTournamentBtn) resetTournamentBtn.classList.add("danger");
  if (resetScoresBtn) resetScoresBtn.classList.add("danger");
  if (resetVetoScoreChatBtn) resetVetoScoreChatBtn.classList.add("danger");
  if (notifyCheckInBtn) {
    const checkInState = getCheckInWindowState(currentTournamentMeta);
    const eligibleNotCheckedIn = eligiblePlayers.filter((p) => !p.checkedInAt);
    notifyCheckInBtn.disabled =
      state.isLive || !checkInState.isOpen || eligibleNotCheckedIn.length === 0;
  }
  if (refreshMmrBtn) {
    const refreshable = eligiblePlayers.some((player) =>
      normalizeSc2PulseIdUrl(player?.sc2Link || ""),
    );
    refreshMmrBtn.disabled = state.isLive || !refreshable;
  }

  updateCheckInUI();
  renderCasterSection();

  if (liveDot) {
    liveDot.textContent = state.isLive ? "Live" : "Not Live";
    liveDot.classList.toggle("not-live", !state.isLive);
  }

  const showPreview = Boolean(state.showPreview);
  const showPreviewPublic = Boolean(state.showPreviewPublic);
  if (bracketPreviewControls) {
    bracketPreviewControls.style.display = isAdmin && !state.isLive ? "flex" : "none";
  }
  if (bracketShowPreviewToggle) {
    bracketShowPreviewToggle.checked = showPreview;
    bracketShowPreviewToggle.disabled = !isAdmin || state.isLive;
    bracketShowPreviewToggle.onchange = () => {
      if (!isAdmin || state.isLive) return;
      saveState(
        { showPreview: Boolean(bracketShowPreviewToggle.checked) },
        { skipRoster: true },
      );
      renderAll();
    };
  }
  if (bracketShowPreviewPublicToggle) {
    bracketShowPreviewPublicToggle.checked = showPreviewPublic;
    bracketShowPreviewPublicToggle.disabled = !isAdmin || state.isLive;
    bracketShowPreviewPublicToggle.onchange = () => {
      if (!isAdmin || state.isLive) return;
      saveState(
        { showPreviewPublic: Boolean(bracketShowPreviewPublicToggle.checked) },
        { skipRoster: true },
      );
      renderAll();
    };
  }

  if (bracketGrid && bracketNotLive) {
    if (!state.isLive) {
      const hasBeenLive =
        Boolean(state.hasBeenLive) ||
        (state.activity || []).some(
          (entry) =>
            entry?.message === "Tournament went live." ||
            entry?.message === "Tournament set to not live.",
        );

      if (bracketNotLiveMessage) {
        bracketNotLiveMessage.style.display = hasBeenLive ? "" : "none";
      }

      const canShowBracketPreview = showPreviewPublic || (isAdmin && showPreview);
      bracketGrid.style.display = canShowBracketPreview ? "flex" : "none";
      bracketNotLive.style.display = canShowBracketPreview ? "none" : "block";

      if (matchInfoModal) {
        matchInfoModal.style.display = canShowBracketPreview ? "" : "none";
        if (!canShowBracketPreview) {
          hideMatchInfoModal();
        }
      }

      if (registeredPlayersList) {
        registeredPlayersList.style.display = "";
        const listKey = JSON.stringify(
          eligiblePlayers.map((p) => ({
            id: p.id || "",
            name: p.name || "",
            race: p.race || "",
            mmr: Number.isFinite(p.mmr) ? Math.round(p.mmr) : "",
            clan: p.clan || "",
            clanLogoUrl: p.clanLogoUrl || "",
          })),
        );
        if (registeredPlayersList.dataset.listKey !== listKey) {
          registeredPlayersList.dataset.listKey = listKey;
          const items = eligiblePlayers.map((p) => {
            const name = escapeHtml(p.name || "Unknown");
            const race = (p.race || "").trim();
            const raceClass = raceClassName(race);
            const raceLabel = race ? escapeHtml(race) : "Race TBD";
            const mmr = Number.isFinite(p.mmr)
              ? `${Math.round(p.mmr)} MMR`
              : "MMR TBD";
            const clanLogo = p?.clanLogoUrl ? sanitizeUrl(p.clanLogoUrl) : "";
            const clanName = (p?.clan || "").trim();
            const clanImg = clanLogo
              ? `<img class="registered-clan-logo" src="${escapeHtml(
                  clanLogo,
                )}" alt="Clan logo" ${
                  clanName ? `data-tooltip="${escapeHtml(clanName)}"` : ""
                } />`
              : `<img class="registered-clan-logo is-placeholder" src="img/clan/logo-18px.webp" alt="No clan logo" />`;
            return `<li data-player-id="${escapeHtml(p.id || "")}">
                <span class="race-strip ${raceClass}"></span>
                ${clanImg}
                <span class="name-text" translate="no">${name}</span>
                <span class="registered-meta">${raceLabel} - ${mmr}</span>
              </li>`;
          });
          registeredPlayersList.innerHTML = items.join("");
        }
      }
    } else {
      if (bracketNotLiveMessage) {
        bracketNotLiveMessage.style.display = "";
      }
      bracketGrid.style.display = "flex";
      bracketNotLive.style.display = "none";
      if (matchInfoModal) matchInfoModal.style.display = "";
    }
  }

  if (activityCard) {
    activityCard.style.display = state.isLive ? "" : "none";
  }
  if (casterLiveCard) {
    casterLiveCard.style.display = state.isLive ? "" : "none";
  }
  renderActivityList({ state, escapeHtml, formatTime });
  populateSettingsPanelUI({
    tournament: currentTournamentMeta,
    setMapPoolSelection,
    getDefaultMapPoolNames,
    updateSettingsDescriptionPreview,
    updateSettingsRulesPreview,
    syncFormatFieldVisibility,
  });
  updatePrizeSplitWarning();
  updateSettingsScoreLocks();
  const nextPromoKey = getPromoStripRenderKey(currentTournamentMeta);
  if (nextPromoKey && nextPromoKey !== promoStripRenderKey) {
    setPromoStripRenderKey(nextPromoKey);
    void refreshTournamentPromoStrip(currentTournamentMeta);
  }
  void refreshTournamentPromoSettings(currentTournamentMeta);
  renderCircuitPointsSettings();
}
