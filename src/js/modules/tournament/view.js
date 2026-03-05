function normalizeMode(mode) {
  return String(mode || "")
    .trim()
    .toLowerCase();
}

function parseTeamSizeFromMode(mode) {
  const parsed = Number(normalizeMode(mode).charAt(0));
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

function getParticipantRaceClassesForList(player, currentTournamentMeta, raceClassName) {
  const mode = normalizeMode(currentTournamentMeta?.mode || "1v1");
  const isTeamMode = mode === "2v2" || mode === "3v3" || mode === "4v4";
  if (!isTeamMode) {
    return [raceClassName(player?.race)];
  }
  if (!player || typeof player !== "object") {
    return [raceClassName("")];
  }
  const fallbackLeaderRace = String(player?.race || "").trim();
  const explicitTeamSize = Number(player?.team?.size);
  const teamSize = Math.max(
    2,
    Number.isFinite(explicitTeamSize) && explicitTeamSize > 1
      ? explicitTeamSize
      : parseTeamSizeFromMode(player?.team?.mode || mode),
  );
  const rawMembers = Array.isArray(player?.team?.members) ? player.team.members : [];
  const deduped = [];
  const seen = new Set();
  rawMembers.forEach((member) => {
    if (!member || typeof member !== "object") return;
    const uid = String(member.uid || "").trim();
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    deduped.push({
      uid,
      role: member.role === "leader" ? "leader" : "member",
      race: String(member.race || "").trim(),
    });
  });
  const leaderUid = String(player?.uid || "").trim();
  let leader =
    deduped.find(
      (entry) =>
        entry.role === "leader" && (!leaderUid || entry.uid === leaderUid),
    ) ||
    deduped.find((entry) => leaderUid && entry.uid === leaderUid) ||
    null;
  if (!leader) {
    leader = { uid: leaderUid || "leader", role: "leader", race: fallbackLeaderRace };
  } else if (!leader.race && fallbackLeaderRace && leaderUid && leader.uid === leaderUid) {
    leader = { ...leader, race: fallbackLeaderRace };
  }
  const teammates = deduped.filter((entry) => entry.uid !== leader.uid);
  const ordered = [leader, ...teammates].slice(0, Math.max(1, teamSize));
  const classes = ordered.map((entry) => raceClassName(String(entry?.race || "").trim()));
  return classes.length ? classes : [raceClassName(fallbackLeaderRace)];
}

function renderParticipantRaceStripMarkupForList(
  player,
  currentTournamentMeta,
  raceClassName,
  escapeHtml,
) {
  const raceClasses = getParticipantRaceClassesForList(
    player,
    currentTournamentMeta,
    raceClassName,
  );
  const signature = raceClasses.join("|");
  const strips = raceClasses
    .map((raceClass) => `<span class="race-strip ${raceClass}"></span>`)
    .join("");
  return `<span class="race-strip-group" data-race-signature="${escapeHtml(
    signature,
  )}" aria-hidden="true">${strips}</span>`;
}

function getParticipantRaceLabelForList(player, currentTournamentMeta) {
  const mode = normalizeMode(currentTournamentMeta?.mode || "1v1");
  const isTeamMode = mode === "2v2" || mode === "3v3" || mode === "4v4";
  if (!isTeamMode) {
    const race = String(player?.race || "").trim();
    return race || "Race TBD";
  }
  const members = Array.isArray(player?.team?.members) ? player.team.members : [];
  const labels = [];
  const seen = new Set();
  members.forEach((member) => {
    const uid = String(member?.uid || "").trim();
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    const race = String(member?.race || "").trim();
    if (race) labels.push(race);
  });
  return labels.length ? labels.join(" / ") : "Race TBD";
}

function getTeamMemberTooltipForList(player, currentTournamentMeta) {
  const mode = normalizeMode(currentTournamentMeta?.mode || "1v1");
  const isTeamMode = mode === "2v2" || mode === "3v3" || mode === "4v4";
  if (!isTeamMode || !player || typeof player !== "object") return "";
  const members = Array.isArray(player?.team?.members) ? player.team.members : [];
  const seen = new Set();
  const deduped = [];
  members.forEach((member) => {
    const uid = String(member?.uid || "").trim();
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    deduped.push({
      uid,
      role: member?.role === "leader" ? "leader" : "member",
      name: String(member?.name || "").trim(),
    });
  });
  const leaderUid = String(player?.uid || "").trim();
  deduped.sort((a, b) => {
    const rankA = a.role === "leader" || (leaderUid && a.uid === leaderUid) ? 0 : 1;
    const rankB = b.role === "leader" || (leaderUid && b.uid === leaderUid) ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
  const names = deduped
    .map((member) => member.name)
    .filter(Boolean);
  if (!names.length && player?.name) names.push(String(player.name).trim());
  if (!names.length) return "";
  return names.join("\n");
}

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
  const mode = String(currentTournamentMeta?.mode || "1v1")
    .trim()
    .toLowerCase();
  const isTeamMode = mode === "2v2" || mode === "3v3" || mode === "4v4";
  const displayName = (player) => {
    if (!player) return "—";
    if (isTeamMode) {
      const teamName = String(player?.team?.teamName || "").trim();
      if (teamName) return teamName;
    }
    return player?.name || "—";
  };
  const firstId = Array.from(placements.entries()).find(
    ([, place]) => place === 1,
  )?.[0];
  const secondId = Array.from(placements.entries()).find(
    ([, place]) => place === 2,
  )?.[0];
  const thirdIds = Array.from(placements.entries())
    .filter(([, place]) => place === 3)
    .map(([id]) => id);
  placementFirst.textContent = displayName(playersById.get(firstId));
  placementSecond.textContent = displayName(playersById.get(secondId));
  placementThirdFourth.textContent = thirdIds.length
    ? thirdIds.map((id) => displayName(playersById.get(id))).join(" · ")
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
  getTeamMembership,
  getTournamentTeamSize,
  normalizeTournamentMode,
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
  const directPlayer = currentUid
    ? (state.players || []).find((p) => p.uid === currentUid)
    : null;
  const teamMembership = currentUid
    ? getTeamMembership?.(state.players || [], currentUid, {
        includeDenied: false,
      }) || null
    : null;
  const currentPlayer =
    directPlayer || (teamMembership?.role === "leader" ? teamMembership.player : null);
  const isMemberOnly = Boolean(teamMembership && teamMembership.role === "member");
  const isMemberAccepted = isMemberOnly && teamMembership.status === "accepted";
  const memberInviteSentAt = Number(teamMembership?.member?.inviteSentAt || 0);
  const hasMemberInviteBeenSent =
    Number.isFinite(memberInviteSentAt) && memberInviteSentAt > 0;
  const isMemberPending =
    isMemberOnly &&
    teamMembership.status === "pending" &&
    hasMemberInviteBeenSent;
  const isMemberQueued =
    isMemberOnly &&
    teamMembership.status === "pending" &&
    !hasMemberInviteBeenSent;
  const currentInviteStatus = normalizeInviteStatus(currentPlayer?.inviteStatus);
  const teamSize = Number(getTournamentTeamSize?.(currentTournamentMeta) || 1);
  const tournamentMode = normalizeTournamentMode?.(currentTournamentMeta?.mode || "1v1") || "1v1";
  const isTeamMode = teamSize > 1;
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
    } else if (isTeamMode && isMemberQueued) {
      registerBtn.textContent = "Awaiting leader registration";
      registerBtn.disabled = true;
    } else if (isTeamMode && isMemberPending) {
      registerBtn.textContent = "Team invite pending";
      registerBtn.disabled = true;
    } else if (isTeamMode && isMemberAccepted) {
      registerBtn.textContent = "Team registered";
      registerBtn.disabled = true;
    } else if (
      currentPlayer &&
      !isTeamMode &&
      currentInviteStatus === INVITE_STATUS.pending
    ) {
      registerBtn.textContent = "Invitation pending";
      registerBtn.disabled = true;
    } else if (
      currentPlayer &&
      !isTeamMode &&
      currentInviteStatus === INVITE_STATUS.denied
    ) {
      registerBtn.textContent = "Invite declined";
      registerBtn.disabled = true;
    } else if (currentPlayer) {
      registerBtn.textContent = isTeamMode ? "Unregister team" : "Unregister";
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
        registerBtn.textContent = isTeamMode
          ? "Send invites & register"
          : "Register";
        registerBtn.disabled = Boolean(isRegisterLoading);
      }
    } else {
      registerBtn.textContent = isTeamMode ? "Send invites & register" : "Register";
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
            teamName: p?.team?.teamName || "",
            race: p.race || "",
            teamMembers: Array.isArray(p?.team?.members)
              ? p.team.members.map((member) => ({
                  uid: member?.uid || "",
                  name: member?.name || "",
                  race: member?.race || "",
                  role: member?.role || "",
                }))
              : [],
            mmr: Number.isFinite(p.mmr) ? Math.round(p.mmr) : "",
            clan: p.clan || "",
            clanLogoUrl: p.clanLogoUrl || "",
          })),
        );
        if (registeredPlayersList.dataset.listKey !== listKey) {
          registeredPlayersList.dataset.listKey = listKey;
          const items = eligiblePlayers.map((p) => {
            const displayName = isTeamMode
              ? String(p?.team?.teamName || "").trim() || p.name || "Unknown"
              : p.name || "Unknown";
            const name = escapeHtml(displayName);
            const teamTooltip = escapeHtml(
              getTeamMemberTooltipForList(p, currentTournamentMeta),
            );
            const raceLabel = escapeHtml(
              getParticipantRaceLabelForList(p, currentTournamentMeta),
            );
            const mmr = Number.isFinite(p.mmr)
              ? `${Math.round(p.mmr)} MMR`
              : "MMR TBD";
            const clanImg = isTeamMode
              ? ""
              : (() => {
                  const clanLogo = p?.clanLogoUrl ? sanitizeUrl(p.clanLogoUrl) : "";
                  const clanName = (p?.clan || "").trim();
                  return clanLogo
                    ? `<img class="registered-clan-logo" src="${escapeHtml(
                        clanLogo,
                      )}" alt="Clan logo" ${
                        clanName ? `data-tooltip="${escapeHtml(clanName)}"` : ""
                      } />`
                    : `<img class="registered-clan-logo is-placeholder" src="img/clan/logo-18px.webp" alt="No clan logo" />`;
                })();
            return `<li data-player-id="${escapeHtml(p.id || "")}">
                ${renderParticipantRaceStripMarkupForList(
                  p,
                  currentTournamentMeta,
                  raceClassName,
                  escapeHtml,
                )}
                ${clanImg}
                <span class="name-text" translate="no" ${
                  teamTooltip ? `data-tooltip="${teamTooltip}"` : ""
                }>${name}</span>
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
