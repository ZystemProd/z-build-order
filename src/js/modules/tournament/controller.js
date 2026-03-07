export function createTournamentController({
  db,
  TOURNAMENT_COLLECTION,
  setCurrentSlugState,
  loadLocalState,
  applyRosterSeedingWithMode,
  deserializeBracket,
  setStateObj,
  getDoc,
  doc,
  collection,
  setCurrentTournamentMetaState,
  refreshInviteLinkGate,
  recomputeAdminFromMeta,
  refreshInviteLinksPanel,
  hydrateStateFromRemote,
  saveState,
  renderAll,
  refreshPlayerDetailModalIfOpen,
  getPlayersMap,
  getState,
  subscribeTournamentStateRemote,
  setCurrentCircuitMeta,
  setIsCircuitAdmin,
  updateCircuitAdminVisibility,
  logAnalyticsEvent,
  switchTab,
  setIsAdminState,
  updateAdminVisibility,
  getUnsubscribeRemoteState,
  setUnsubscribeRemoteState,
  fetchCircuitMeta,
  getEnterCircuit,
}) {
  function setBackLink(circuitSlug = "") {
    const backLink = document.getElementById("tournamentBackLink");
    if (!backLink) return;
    const label = backLink.querySelector("[data-back-label]");
    backLink.href = circuitSlug ? `/tournament/${circuitSlug}` : "/tournament";
    if (label) {
      label.textContent = circuitSlug ? "Circuit Page" : "Tournament Center";
    }
  }

  function setViewVisibility({ landing, tournament, circuit }) {
    const landingView = document.getElementById("landingView");
    const tournamentView = document.getElementById("tournamentView");
    const circuitView = document.getElementById("circuitView");
    if (landingView) landingView.style.display = landing ? "block" : "none";
    if (tournamentView) {
      tournamentView.style.display = tournament ? "block" : "none";
    }
    if (circuitView) circuitView.style.display = circuit ? "block" : "none";
  }

  function getRouteFromPath() {
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    if (!parts.length) {
      return { view: "landing", slug: "" };
    }
    if (parts.length === 1 && parts[0].toLowerCase() === "tournament") {
      return { view: "landing", slug: "" };
    }
    if (
      parts[0].toLowerCase() === "tournament" &&
      parts[1]?.toLowerCase() === "circuit" &&
      parts[2]
    ) {
      return { view: "circuitLegacy", slug: parts[2] };
    }
    if (parts[0].toLowerCase() === "tournament" && parts.length >= 3) {
      return {
        view: "circuitTournament",
        circuitSlug: parts[1],
        slug: parts[2],
      };
    }
    if (parts[0].toLowerCase() === "tournament" && parts.length === 2) {
      return { view: "slug", slug: parts[1] };
    }
    return { view: "landing", slug: "" };
  }

  async function enterTournament(slug, options = {}) {
    const { circuitSlug = "" } = options;
    setCurrentSlugState(slug || null);
    if (slug) {
      const target = circuitSlug
        ? `/tournament/${circuitSlug}/${slug}`
        : `/tournament/${slug}`;
      if (window.location.pathname !== target) {
        window.history.pushState({}, "", target);
      }
    }
    setBackLink(circuitSlug);

    const local = loadLocalState(
      slug,
      applyRosterSeedingWithMode,
      deserializeBracket,
    );
    setStateObj(local);

    try {
      const snap = await getDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
      if (snap.exists()) {
        const meta = snap.data() || null;
        if (meta && circuitSlug && !meta.circuitSlug) {
          meta.circuitSlug = circuitSlug;
        }
        setCurrentTournamentMetaState(meta);
        const metaCircuitSlug = meta?.circuitSlug || "";
        if (slug && metaCircuitSlug && !circuitSlug) {
          const target = `/tournament/${metaCircuitSlug}/${slug}`;
          if (window.location.pathname !== target) {
            window.history.pushState({}, "", target);
          }
        }
        setBackLink(metaCircuitSlug);
        await refreshInviteLinkGate(slug);
      } else {
        if (typeof window !== "undefined") {
          window.location.href = "/404.html";
        }
        return;
      }
    } catch (_) {
      // ignore
    }

    recomputeAdminFromMeta();
    await refreshInviteLinksPanel();
    await hydrateStateFromRemote(
      slug,
      applyRosterSeedingWithMode,
      deserializeBracket,
      saveState,
      () => {
        renderAll();
        refreshPlayerDetailModalIfOpen(getPlayersMap);
      },
      getState()?.lastUpdated || 0,
    );

    subscribeTournamentStateRemote(slug);
    setViewVisibility({ landing: false, tournament: true, circuit: false });
    setCurrentCircuitMeta(null);
    setIsCircuitAdmin(false);
    updateCircuitAdminVisibility();
    renderAll();
    logAnalyticsEvent("tournament_viewed");
    switchTab("bracketTab");
  }

  async function showLanding() {
    try {
      getUnsubscribeRemoteState()?.();
    } catch (_) {
      // ignore
    }
    setUnsubscribeRemoteState(null);
    setIsAdminState(false);
    updateAdminVisibility();
    setViewVisibility({ landing: true, tournament: false, circuit: false });
    setCurrentCircuitMeta(null);
    setIsCircuitAdmin(false);
    updateCircuitAdminVisibility();
    switchTab("registrationTab");
  }

  async function handleRouteChange() {
    const route = getRouteFromPath();
    const enterCircuit = getEnterCircuit();
    if (route.view === "circuitLegacy" && route.slug) {
      await enterCircuit(route.slug);
      return;
    }
    if (route.view === "circuitTournament" && route.slug && route.circuitSlug) {
      await enterTournament(route.slug, { circuitSlug: route.circuitSlug });
      return;
    }
    if (route.view === "circuit" && route.slug) {
      await enterCircuit(route.slug);
      return;
    }
    if (route.view === "slug" && route.slug) {
      const meta = await fetchCircuitMeta(route.slug);
      if (meta) {
        await enterCircuit(route.slug, { meta });
        return;
      }
      try {
        const snap = await getDoc(
          doc(collection(db, TOURNAMENT_COLLECTION), route.slug),
        );
        if (snap.exists()) {
          const tournamentMeta = snap.data() || {};
          const circuitSlug = String(tournamentMeta?.circuitSlug || "").trim();
          if (circuitSlug) {
            await enterTournament(route.slug, { circuitSlug });
            return;
          }
        }
      } catch (_) {
        // ignore lookup errors
      }
      await enterTournament(route.slug);
      return;
    }
    await showLanding();
  }

  return {
    getRouteFromPath,
    handleRouteChange,
    enterTournament,
    showLanding,
  };
}
