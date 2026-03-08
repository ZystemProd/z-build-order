function mergeMatchVetoes(local = {}, incoming = {}) {
  const out = { ...incoming };
  Object.keys(local || {}).forEach((matchId) => {
    const localEntry = local[matchId];
    const incomingEntry = incoming[matchId];
    const localUpdated = Number(localEntry?.updatedAt) || 0;
    const incomingUpdated = Number(incomingEntry?.updatedAt) || 0;
    if (!incomingEntry || localUpdated > incomingUpdated) {
      out[matchId] = localEntry;
    }
  });
  return out;
}

function stripVetoState(value) {
  const trimmed = { ...(value || {}) };
  delete trimmed.matchVetoes;
  delete trimmed.lastUpdated;
  delete trimmed.presence;
  return trimmed;
}

function hasCasterDataChanged(incoming, state) {
  return (
    JSON.stringify(incoming.casterRequests || []) !==
      JSON.stringify(state.casterRequests || []) ||
    JSON.stringify(incoming.casters || []) !==
      JSON.stringify(state.casters || []) ||
    JSON.stringify(incoming.matchCasts || {}) !==
      JSON.stringify(state.matchCasts || {})
  );
}

function buildInProgressVeto({ currentVetoMatchId, vetoState, state }) {
  const inProgressVetoId =
    currentVetoMatchId && vetoState && vetoState.stage !== "done"
      ? currentVetoMatchId
      : null;
  const inProgressVeto = inProgressVetoId
    ? {
        maps: vetoState?.picks || [],
        vetoed: vetoState?.vetoed || [],
        bestOf: vetoState?.bestOf || 1,
        updatedAt: vetoState?.updatedAt || Date.now(),
        participants: {
          lower: vetoState?.lowerName || "Lower seed",
          higher: vetoState?.higherName || "Higher seed",
        },
        mapResults: state.matchVetoes?.[inProgressVetoId]?.mapResults || [],
      }
    : null;
  return { inProgressVetoId, inProgressVeto };
}

export function syncFromRemoteCore({
  incoming,
  getState,
  setStateObj,
  currentSlug,
  safeJsonEqual,
  refreshMatchInfoPresenceIfOpen,
  applyRosterSeedingWithMode,
  deserializeBracket,
  currentVetoMatchId,
  vetoState,
  defaultState,
  shouldUsePartialRender,
  getFormat,
  getBracketMatchIdsForPartial,
  getChangedMatchIdsFromMap,
  maybeToastMyMatchReady,
  refreshMatchInfoModalIfOpen,
  refreshVetoModalIfOpen,
  renderAll,
  renderActivityList,
  escapeHtml,
  formatTime,
  refreshPlayerDetailModalIfOpen,
  getPlayersMap,
}) {
  if (!incoming || typeof incoming !== "object") return;
  const state = getState();

  const incomingPlayersArr = Array.isArray(incoming?.players)
    ? incoming.players
    : [];
  const localPlayersArr = Array.isArray(state?.players) ? state.players : [];

  const incomingUids = incomingPlayersArr.map((p) => p?.uid).filter(Boolean);
  const localUids = localPlayersArr.map((p) => p?.uid).filter(Boolean);

  const incomingNames = incomingPlayersArr.map((p) => p?.name).filter(Boolean);
  const localNames = localPlayersArr.map((p) => p?.name).filter(Boolean);

  const localOnly = localUids.filter((uid) => !incomingUids.includes(uid));
  const incomingOnly = incomingUids.filter((uid) => !localUids.includes(uid));

  void incomingNames;
  void localNames;
  void localOnly;
  void incomingOnly;

  if (
    incomingPlayersArr.length === 0 &&
    Array.isArray(state?.players) &&
    state.players.length > 0
  ) {
    console.warn(
      "🛑 [tournament-sync] syncFromRemote ignored empty incoming.players",
      {
        slug: currentSlug,
        incomingLastUpdated: Number(incoming?.lastUpdated) || 0,
        localPlayersCount: state.players.length,
      },
    );
    return;
  }

  const incomingPresence = incoming.presence?.matchInfo || null;
  const currentPresence = state?.presence?.matchInfo || null;
  const presenceChanged =
    incomingPresence &&
    JSON.stringify(incomingPresence) !== JSON.stringify(currentPresence || {});
  const matchVetoesChangedEarly = !safeJsonEqual(
    incoming.matchVetoes || {},
    state.matchVetoes || {},
  );
  const playersChangedEarly = !safeJsonEqual(
    incomingPlayersArr,
    localPlayersArr,
  );
  const activityChangedEarly = !safeJsonEqual(
    incoming.activity || [],
    state.activity || [],
  );
  const pointsLedgerChangedEarly = !safeJsonEqual(
    incoming.pointsLedger || {},
    state.pointsLedger || {},
  );
  const scoreReportsChangedEarly = !safeJsonEqual(
    incoming.scoreReports || {},
    state.scoreReports || {},
  );
  const manualSeedingChangedEarly =
    !safeJsonEqual(
      incoming.manualSeedingEnabled,
      state.manualSeedingEnabled,
    ) ||
    !safeJsonEqual(
      incoming.manualSeedingOrder || [],
      state.manualSeedingOrder || [],
    );
  const lifecycleChangedEarly =
    !safeJsonEqual(incoming.isLive, state.isLive) ||
    !safeJsonEqual(incoming.hasBeenLive, state.hasBeenLive) ||
    !safeJsonEqual(incoming.disableFinalAutoAdd, state.disableFinalAutoAdd) ||
    !safeJsonEqual(incoming.needsReseed, state.needsReseed) ||
    !safeJsonEqual(
      incoming.bracketLayoutVersion,
      state.bracketLayoutVersion,
    );
  const bracketChangedEarly = !safeJsonEqual(
    incoming.bracket || null,
    state.bracket || null,
  );
  const staleHasMeaningfulChanges =
    playersChangedEarly ||
    activityChangedEarly ||
    pointsLedgerChangedEarly ||
    scoreReportsChangedEarly ||
    manualSeedingChangedEarly ||
    lifecycleChangedEarly ||
    bracketChangedEarly ||
    hasCasterDataChanged(incoming, state);
  const incomingLastUpdated = Number(incoming.lastUpdated) || 0;
  const localLastUpdated = Number(state.lastUpdated) || 0;
  const incomingIsStale =
    incomingLastUpdated > 0 && incomingLastUpdated <= localLastUpdated;
  const staleLifecycleRegression =
    incomingIsStale &&
    (!safeJsonEqual(incoming.isLive, state.isLive) ||
      !safeJsonEqual(incoming.hasBeenLive, state.hasBeenLive));

  if (staleLifecycleRegression) {
    if (presenceChanged) {
      setStateObj({ ...state, presence: { matchInfo: incomingPresence } });
      refreshMatchInfoPresenceIfOpen?.();
    }
    return;
  }

  if (
    incomingIsStale &&
    !matchVetoesChangedEarly &&
    !staleHasMeaningfulChanges
  ) {
    if (presenceChanged) {
      setStateObj({ ...state, presence: { matchInfo: incomingPresence } });
      refreshMatchInfoPresenceIfOpen?.();
    }
    return;
  }

  const prevState = state;
  const nextPlayers = applyRosterSeedingWithMode(
    incoming.players || [],
    incoming,
  );
  const nextBracket = deserializeBracket(incoming.bracket);
  const { inProgressVetoId, inProgressVeto } = buildInProgressVeto({
    currentVetoMatchId,
    vetoState,
    state,
  });

  const nextState = {
    ...defaultState,
    ...incoming,
    players: nextPlayers,
    pointsLedger: incoming.pointsLedger || {},
    activity: incoming.activity || [],
    bracket: nextBracket,
  };
  if (incomingIsStale) {
    // Keep local caster state when handling an older snapshot
    // (for example when only match vetoes changed remotely).
    nextState.matchCasts = state.matchCasts || {};
    nextState.casters = state.casters || [];
    nextState.casterRequests = state.casterRequests || [];
  }
  nextState.matchVetoes = mergeMatchVetoes(
    state.matchVetoes || {},
    nextState.matchVetoes || {},
  );
  if (inProgressVetoId && inProgressVeto) {
    const incomingEntry = nextState.matchVetoes?.[inProgressVetoId] || null;
    const incomingUpdated = Number(incomingEntry?.updatedAt) || 0;
    const localUpdated = Number(inProgressVeto.updatedAt) || 0;
    if (localUpdated >= incomingUpdated) {
      nextState.matchVetoes = {
        ...(nextState.matchVetoes || {}),
        [inProgressVetoId]: inProgressVeto,
      };
    }
  }

  const activityChanged = !safeJsonEqual(
    prevState.activity || [],
    nextState.activity || [],
  );
  const matchVetoesChanged = !safeJsonEqual(
    prevState.matchVetoes || {},
    nextState.matchVetoes || {},
  );
  const onlyVetoChange =
    matchVetoesChanged &&
    !activityChanged &&
    prevState.isLive === nextState.isLive &&
    prevState.hasBeenLive === nextState.hasBeenLive &&
    prevState.disableFinalAutoAdd === nextState.disableFinalAutoAdd &&
    prevState.needsReseed === nextState.needsReseed &&
    prevState.bracketLayoutVersion === nextState.bracketLayoutVersion &&
    safeJsonEqual(prevState.players || [], nextState.players || []) &&
    safeJsonEqual(prevState.bracket || null, nextState.bracket || null) &&
    safeJsonEqual(prevState.pointsLedger || {}, nextState.pointsLedger || {}) &&
    safeJsonEqual(
      prevState.manualSeedingEnabled,
      nextState.manualSeedingEnabled,
    ) &&
    safeJsonEqual(
      prevState.manualSeedingOrder || [],
      nextState.manualSeedingOrder || [],
    ) &&
    safeJsonEqual(prevState.matchCasts || {}, nextState.matchCasts || {}) &&
    safeJsonEqual(prevState.scoreReports || {}, nextState.scoreReports || {}) &&
    safeJsonEqual(prevState.casters || [], nextState.casters || []) &&
    safeJsonEqual(
      prevState.casterRequests || [],
      nextState.casterRequests || [],
    );
  const vetoOnlyChange =
    matchVetoesChanged &&
    safeJsonEqual(stripVetoState(prevState), stripVetoState(nextState));

  let allowPartial = shouldUsePartialRender(prevState, nextState, getFormat?.());
  let matchIds = [];
  if (allowPartial) {
    const bracketMatchIds = getBracketMatchIdsForPartial(
      prevState.bracket,
      nextBracket,
    );
    if (bracketMatchIds === null) {
      allowPartial = false;
    } else {
      const combined = new Set(bracketMatchIds);
      getChangedMatchIdsFromMap(prevState.matchCasts, nextState.matchCasts).forEach(
        (id) => combined.add(id),
      );
      getChangedMatchIdsFromMap(
        prevState.scoreReports,
        nextState.scoreReports,
      ).forEach((id) => combined.add(id));
      matchIds = Array.from(combined).filter(Boolean);
    }
  }

  setStateObj(nextState);
  maybeToastMyMatchReady(prevState, nextState);

  if (onlyVetoChange || vetoOnlyChange) {
    refreshMatchInfoModalIfOpen?.();
    refreshVetoModalIfOpen?.();
    return;
  }

  if (
    allowPartial &&
    !matchIds.length &&
    matchVetoesChanged &&
    !activityChanged
  ) {
    refreshMatchInfoModalIfOpen?.();
    refreshVetoModalIfOpen?.();
    return;
  }
  if (allowPartial && !matchIds.length && !activityChanged && !matchVetoesChanged) {
    // No visual state changed; avoid forcing a full bracket render on heartbeat-like snapshots.
    refreshMatchInfoModalIfOpen?.();
    return;
  }
  if (allowPartial && matchIds.length) {
    renderAll(matchIds);
    if (activityChanged) {
      renderActivityList({ state: getState(), escapeHtml, formatTime });
    }
  } else if (allowPartial && activityChanged) {
    renderActivityList({ state: getState(), escapeHtml, formatTime });
  } else {
    renderAll();
  }
  refreshPlayerDetailModalIfOpen(getPlayersMap);
  refreshMatchInfoModalIfOpen?.();
  if (matchVetoesChanged) {
    refreshVetoModalIfOpen?.();
  }
}
