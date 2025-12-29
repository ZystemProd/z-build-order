export function createCircuitPageHandlers({
  fetchCircuitMeta,
  renderCircuitView,
  enterTournament,
  openDeleteTournamentModal,
  showToast,
  showLanding,
  setIsAdminState,
  updateAdminVisibility,
  getUnsubscribeRemoteState,
  setUnsubscribeRemoteState,
  getCurrentCircuitMeta,
  setCurrentCircuitMeta,
  getAuthUid,
  getIsCircuitAdmin,
  setIsCircuitAdmin,
  isAdminForMeta,
  renderAdmins,
} = {}) {
  if (!fetchCircuitMeta || !renderCircuitView) {
    throw new Error("Missing dependencies for circuit page handlers.");
  }

  function updateCircuitAdminVisibility() {
    const createBtn = document.getElementById("openCreateCircuitTournament");
    if (!createBtn) return;
    createBtn.style.display = getIsCircuitAdmin() ? "inline-flex" : "none";
  }

  function recomputeCircuitAdminFromMeta() {
    const uid = getAuthUid();
    const meta = getCurrentCircuitMeta();
    const isAdmin = typeof isAdminForMeta === "function"
      ? isAdminForMeta(meta, uid)
      : Boolean(uid && meta?.createdBy === uid);
    setIsCircuitAdmin(isAdmin);
    updateCircuitAdminVisibility();
    renderAdmins?.(meta);
  }

  async function enterCircuit(slug, options = {}) {
    const { meta, skipPush = false } = options || {};
    if (!slug) return;
    try {
      getUnsubscribeRemoteState?.()?.();
    } catch (_) {
      // ignore
    }
    setUnsubscribeRemoteState?.(null);
    setIsAdminState?.(false);
    updateAdminVisibility?.();
    const target = `/tournament/${slug}`;
    if (!skipPush && typeof window !== "undefined" && window.location.pathname !== target) {
      window.history.pushState({}, "", target);
    }
    const landingView = document.getElementById("landingView");
    const tournamentView = document.getElementById("tournamentView");
    const circuitView = document.getElementById("circuitView");
    if (landingView) landingView.style.display = "none";
    if (tournamentView) tournamentView.style.display = "none";
    if (circuitView) circuitView.style.display = "block";
    try {
      const fetched = meta || (await fetchCircuitMeta(slug));
      if (!fetched) {
        showToast?.("Circuit not found.", "error");
        await showLanding?.();
        return;
      }
      setCurrentCircuitMeta(fetched);
      recomputeCircuitAdminFromMeta();
      await renderCircuitView(fetched, {
        onEnterTournament: (tournamentSlug) =>
          enterTournament(tournamentSlug, { circuitSlug: fetched?.slug || "" }),
        onDeleteTournament: (tournamentSlug) =>
          openDeleteTournamentModal({
            slug: tournamentSlug,
            circuitSlug: fetched?.slug || "",
          }),
        showDelete: getIsCircuitAdmin(),
        showEdit: getIsCircuitAdmin(),
      });
      updateCircuitAdminVisibility();
      if (!skipPush) {
        const target = `/tournament/${slug}`;
        if (typeof window !== "undefined") {
          window.history.pushState({}, "", target);
        }
      }
    } catch (err) {
      console.error("Failed to load circuit", err);
      showToast?.("Failed to load circuit.", "error");
      await showLanding?.();
    }
  }

  async function refreshCircuitView() {
    const meta = getCurrentCircuitMeta();
    if (!meta?.slug) return;
    await enterCircuit(meta.slug, { skipPush: true });
  }

  return {
    enterCircuit,
    refreshCircuitView,
    updateCircuitAdminVisibility,
    recomputeCircuitAdminFromMeta,
  };
}
