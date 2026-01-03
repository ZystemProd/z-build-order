import { createAdminPlayerSearch } from "./addSearchPlayer.js";

export function createAdminManager({
  auth,
  db,
  doc,
  collection,
  setDoc,
  CIRCUIT_COLLECTION,
  TOURNAMENT_COLLECTION,
  lockBodyScroll,
  unlockBodyScroll,
  showToast,
  getCurrentTournamentMeta,
  setCurrentTournamentMeta,
  getCurrentCircuitMeta,
  setCurrentCircuitMeta,
} = {}) {
  const normalizeAdminList = (list) =>
    Array.isArray(list)
      ? list
          .map((entry) => ({
            uid: entry?.uid || entry?.userId || "",
            name: entry?.name || entry?.username || "",
          }))
          .filter((entry) => entry.uid || entry.name)
      : [];

  const getAdminEntries = (meta) => {
    const hostName = (meta?.createdByName || "Unknown host").trim() || "Unknown host";
    const hostUid = meta?.createdBy || "";
    const entries = [
      {
        uid: hostUid,
        name: hostName,
        role: "Host",
      },
    ];
    const admins = normalizeAdminList(meta?.admins);
    admins.forEach((entry) => {
      if (entry.uid && hostUid && entry.uid === hostUid) return;
      entries.push({
        uid: entry.uid,
        name: entry.name || "Admin",
        role: "Admin",
      });
    });
    return entries;
  };

  const renderAdminEntries = (listEl, entries = []) => {
    if (!listEl) return;
    listEl.replaceChildren();
    entries.forEach((entry) => {
      const chip = document.createElement("div");
      chip.className = "hero-admin-chip";
      const name = document.createElement("span");
      name.textContent = entry.name || "Admin";
      const role = document.createElement("span");
      role.className = "hero-admin-role";
      role.textContent = entry.role || "Admin";
      chip.append(name, role);
      listEl.appendChild(chip);
    });
  };

  const renderTournamentAdmins = (meta = getCurrentTournamentMeta?.()) => {
    const listEl = document.getElementById("tournamentAdminList");
    const section = document.getElementById("tournamentAdminSection");
    if (!listEl || !section) return;
    if (!meta) {
      listEl.replaceChildren();
      section.style.display = "none";
      return;
    }
    section.style.display = "grid";
    renderAdminEntries(listEl, getAdminEntries(meta));
    updateTournamentAdminInviteVisibility(meta);
  };

  const renderCircuitAdmins = (meta = getCurrentCircuitMeta?.()) => {
    const listEl = document.getElementById("circuitAdminList");
    const section = document.getElementById("circuitAdminSection");
    if (!listEl || !section) return;
    if (!meta) {
      listEl.replaceChildren();
      section.style.display = "none";
      return;
    }
    section.style.display = "grid";
    renderAdminEntries(listEl, getAdminEntries(meta));
    updateCircuitAdminInviteVisibility(meta);
  };

  const isAdminForMeta = (meta, uid) => {
    if (!uid || !meta) return false;
    if (meta.createdBy && meta.createdBy === uid) return true;
    const admins = normalizeAdminList(meta.admins);
    return admins.some((entry) => entry.uid === uid);
  };

  const updateTournamentAdminInviteVisibility = (meta = getCurrentTournamentMeta?.()) => {
    const inviteBtn = document.getElementById("inviteTournamentAdminBtn");
    if (!inviteBtn) return;
    const uid = auth?.currentUser?.uid || "";
    inviteBtn.style.display = uid && meta?.createdBy === uid ? "inline-flex" : "none";
  };

  const updateCircuitAdminInviteVisibility = (meta = getCurrentCircuitMeta?.()) => {
    const inviteBtn = document.getElementById("inviteCircuitAdminBtn");
    if (!inviteBtn) return;
    const uid = auth?.currentUser?.uid || "";
    inviteBtn.style.display = uid && meta?.createdBy === uid ? "inline-flex" : "none";
  };

  const setAdminInviteStatus = (message) => {
    const statusEl = document.getElementById("adminInviteStatus");
    if (statusEl) statusEl.textContent = message || "";
  };

  const getAdminInviteMeta = (scope) =>
    scope === "circuit" ? getCurrentCircuitMeta?.() : getCurrentTournamentMeta?.();

  const getAdminInviteExisting = (scope) =>
    getAdminEntries(getAdminInviteMeta(scope)).map((entry) => ({
      uid: entry.uid,
      name: entry.name,
    }));

  const renderAdminInviteResults = (results = [], scope = "tournament") => {
    const resultsEl = document.getElementById("adminInviteSearchResults");
    if (!resultsEl) return;
    resultsEl.replaceChildren();
    const existing = getAdminInviteExisting(scope);
    results.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "admin-search-item";
      const label = document.createElement("span");
      label.textContent = entry.username;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cta small primary";
      button.textContent = "Add admin";
      button.dataset.adminInviteUsername = entry.username;
      if (entry.userId) {
        button.dataset.adminInviteUserId = entry.userId;
      }
      const alreadyAdded = existing.some(
        (item) =>
          (entry.userId && item.uid === entry.userId) ||
          (item.name || "").toLowerCase() === entry.username.toLowerCase()
      );
      if (alreadyAdded) {
        button.disabled = true;
        button.textContent = "Added";
      }
      row.append(label, button);
      resultsEl.append(row);
    });
  };

  const renderAdminInviteCurrent = (scope = "tournament") => {
    const listEl = document.getElementById("adminInviteCurrentList");
    if (!listEl) return;
    listEl.replaceChildren();
    const entries = getAdminEntries(getAdminInviteMeta(scope));
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "admin-invite-row";
      const labelWrap = document.createElement("div");
      labelWrap.className = "admin-invite-row-label";
      const name = document.createElement("span");
      name.textContent = entry.name || "Admin";
      const role = document.createElement("span");
      role.className = "admin-invite-role";
      role.textContent = entry.role || "Admin";
      labelWrap.append(name, role);
      row.append(labelWrap);
      const actions = document.createElement("div");
      actions.className = "admin-invite-actions";
      if (entry.role === "Admin" && entry.uid) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon-btn admin-remove-btn";
        button.textContent = "x";
        button.title = "Remove";
        button.setAttribute("aria-label", "Remove");
        button.dataset.adminRemoveUid = entry.uid;
        actions.append(button);
      }
      row.append(actions);
      listEl.append(row);
    });
  };

  const saveAdminsForScope = async (scope, nextAdmins) => {
    const meta = getAdminInviteMeta(scope);
    if (!meta?.slug) return false;
    const collectionName =
      scope === "circuit" ? CIRCUIT_COLLECTION : TOURNAMENT_COLLECTION;
    await setDoc(
      doc(collection(db, collectionName), meta.slug),
      { admins: nextAdmins },
      { merge: true }
    );
    if (scope === "circuit") {
      setCurrentCircuitMeta?.({ ...meta, admins: nextAdmins });
      renderCircuitAdmins(getCurrentCircuitMeta?.());
    } else {
      const nextMeta = { ...meta, admins: nextAdmins };
      setCurrentTournamentMeta?.(nextMeta);
      renderTournamentAdmins(nextMeta);
    }
    return true;
  };

  const removeAdminFromScope = async (scope, uid) => {
    const meta = getAdminInviteMeta(scope);
    if (!meta?.slug || !uid) return false;
    const admins = normalizeAdminList(meta.admins);
    const nextAdmins = admins.filter((admin) => admin.uid !== uid);
    if (nextAdmins.length === admins.length) {
      setAdminInviteStatus("Admin not found.");
      return false;
    }
    await saveAdminsForScope(scope, nextAdmins);
    setAdminInviteStatus("Admin removed.");
    return true;
  };

  const addAdminToScope = async (scope, { userId, username }) => {
    const meta = getAdminInviteMeta(scope);
    if (!meta?.slug || !userId) return false;
    if (meta.createdBy && meta.createdBy === userId) {
      setAdminInviteStatus("User is already the host.");
      return false;
    }
    const admins = normalizeAdminList(meta.admins);
    if (admins.some((admin) => admin.uid === userId)) {
      setAdminInviteStatus("User is already an admin.");
      return false;
    }
    const nextAdmins = [...admins, { uid: userId, name: username }];
    await saveAdminsForScope(scope, nextAdmins);
    setAdminInviteStatus("Admin added.");
    renderAdminInviteCurrent(scope);
    return true;
  };

  const initAdminInviteModal = () => {
    const modal = document.getElementById("adminInviteModal");
    const closeBtn = document.getElementById("closeAdminInviteModal");
    const titleEl = document.getElementById("adminInviteTitle");
    const input = document.getElementById("adminInviteSearchInput");
    const resultsEl = document.getElementById("adminInviteSearchResults");
    const currentListEl = document.getElementById("adminInviteCurrentList");
    const inviteTournamentBtn = document.getElementById("inviteTournamentAdminBtn");
    const inviteCircuitBtn = document.getElementById("inviteCircuitAdminBtn");
    if (!modal || !input || !resultsEl || !titleEl || !currentListEl) return;

    let currentScope = "tournament";
    const search = createAdminPlayerSearch({
      db,
      getIsEnabled: () => {
        const meta = getAdminInviteMeta(currentScope);
        const uid = auth?.currentUser?.uid || "";
        return Boolean(uid && meta?.createdBy === uid);
      },
      getPlayers: () => getAdminInviteExisting(currentScope),
      onStatus: setAdminInviteStatus,
      onResults: (results) => renderAdminInviteResults(results, currentScope),
      onError: (err) => {
        if (err?.message) showToast?.(err.message, "error");
      },
      onSuccess: () => {
        input.value = "";
        renderAdminInviteResults([], currentScope);
      },
      addPlayer: async ({ userId, username }) => {
        const added = await addAdminToScope(currentScope, {
          userId,
          username,
        });
        if (added) {
          showToast?.(`Added ${username} as admin.`, "success");
        }
      },
    });

    const openModal = (scope) => {
      currentScope = scope;
      titleEl.textContent =
        scope === "circuit" ? "Manage circuit admins" : "Manage tournament admins";
      input.value = "";
      renderAdminInviteCurrent(currentScope);
      renderAdminInviteResults([], currentScope);
      setAdminInviteStatus("");
      modal.style.display = "flex";
      lockBodyScroll?.();
      input.focus();
    };

    const closeModal = () => {
      modal.style.display = "none";
      unlockBodyScroll?.();
    };

    inviteTournamentBtn?.addEventListener("click", () => openModal("tournament"));
    inviteCircuitBtn?.addEventListener("click", () => openModal("circuit"));
    closeBtn?.addEventListener("click", () => closeModal());
    window.addEventListener("mousedown", (event) => {
      if (modal.style.display === "flex" && event.target === modal) {
        closeModal();
      }
    });

    input.addEventListener("input", () => {
      search.debouncedSearch(input.value);
    });
    resultsEl.addEventListener("click", (event) => {
      const target = event.target.closest("[data-admin-invite-username]");
      if (!target) return;
      const username = target.dataset.adminInviteUsername || "";
      const userId = target.dataset.adminInviteUserId || "";
      search.addByUsername(username, userId);
    });
    currentListEl.addEventListener("click", async (event) => {
      const target = event.target.closest("[data-admin-remove-uid]");
      if (!target) return;
      const uid = target.dataset.adminRemoveUid || "";
      const removed = await removeAdminFromScope(currentScope, uid);
      if (removed) {
        renderAdminInviteCurrent(currentScope);
        showToast?.("Admin removed.", "success");
      }
    });
  };

  return {
    isAdminForMeta,
    renderTournamentAdmins,
    renderCircuitAdmins,
    updateTournamentAdminInviteVisibility,
    updateCircuitAdminInviteVisibility,
    initAdminInviteModal,
  };
}
