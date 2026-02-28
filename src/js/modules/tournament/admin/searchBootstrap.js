import { httpsCallable } from "firebase/functions";
import { createAdminPlayerSearch } from "./addSearchPlayer.js";

let bootstrapped = false;
let superAdminAddPlayerCallable = null;

export function initAdminSearchBootstrap({
  db,
  auth,
  functions,
  getState,
  getIsAdmin,
  isSuperAdminUser,
  showToast,
  normalizeRaceLabel,
  sanitizeUrl,
  getCircuitSeedPoints,
  getCurrentTournamentMeta,
  getCurrentSlug,
  hydrateStateFromRemote,
  applyRosterSeedingWithMode,
  deserializeBracket,
  saveState,
  renderAll,
  bracketHasRecordedResults,
  pickBestRace,
  DEFAULT_PLAYER_AVATAR,
  getDoc,
  doc,
  updateRosterWithTransaction,
  upsertRosterPlayer,
  addActivity,
  sendTournamentInviteNotification,
  getCurrentUsername,
  buildPlayerFromData,
  INVITE_STATUS,
}) {
  const hasSearchUi = Boolean(
    document.getElementById("finalAdminSearchInput") ||
      document.getElementById("superAdminSearchInput"),
  );
  if (!hasSearchUi) return;
  if (bootstrapped) return;
  bootstrapped = true;

  const setSuperAdminSearchStatus = (message) => {
    const statusEl = document.getElementById("superAdminAddPlayerStatus");
    if (statusEl) statusEl.textContent = message || "";
  };

  const renderSuperAdminSearchResults = (results = []) => {
    const resultsEl = document.getElementById("superAdminSearchResults");
    if (!resultsEl) return;
    resultsEl.replaceChildren();
    const players = getState()?.players || [];
    results.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "admin-search-item";
      const label = document.createElement("span");
      label.setAttribute("translate", "no");
      label.textContent = entry.username;
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "cta small primary";
      addBtn.textContent = "Add direct";
      addBtn.dataset.superAdminAddUsername = entry.username;
      if (entry.userId) {
        addBtn.dataset.superAdminUserId = entry.userId;
      }
      const alreadyAdded = players.some(
        (player) =>
          (entry.userId && player.uid === entry.userId) ||
          (player.name || "").toLowerCase() === entry.username.toLowerCase(),
      );
      if (alreadyAdded) {
        addBtn.disabled = true;
        addBtn.textContent = "Added";
      }
      row.append(label, addBtn);
      resultsEl.append(row);
    });
  };

  const addSuperAdminPlayerFromSearch = async ({
    userId,
    username,
    userData,
    selectedRace,
  }) => {
    if (!isSuperAdminUser()) {
      showToast?.("Unauthorized.", "error");
      return;
    }
    const meta = getCurrentTournamentMeta();
    const slug = getCurrentSlug() || meta?.slug || "";
    if (!slug) throw new Error("Tournament not loaded.");
    if (!userId) throw new Error("Missing target user id.");
    const displayName = (userData?.username || username || "").trim();
    if (!displayName) throw new Error("Missing target username.");
    const race = normalizeRaceLabel(selectedRace) || "Random";
    const pulse = userData?.pulse || {};
    const sc2Link = sanitizeUrl(userData?.sc2PulseUrl || pulse.url || "");
    const twitchUrl = sanitizeUrl(userData?.twitchUrl || "");
    const country = String(userData?.country || "").trim().toUpperCase();
    let startingPoints = null;
    if (meta?.circuitSlug && displayName) {
      startingPoints = await getCircuitSeedPoints({
        name: displayName,
        sc2Link,
        uid: userId,
        circuitSlug: meta.circuitSlug,
        tournamentSlug: slug,
      });
    }
    if (!superAdminAddPlayerCallable) {
      superAdminAddPlayerCallable = httpsCallable(
        functions,
        "superAdminAddPlayer",
      );
    }
    await superAdminAddPlayerCallable({
      slug,
      name: displayName,
      race,
      uid: userId,
      sc2Link,
      twitchUrl,
      country,
      points: Number.isFinite(startingPoints) ? startingPoints : 0,
    });
    await hydrateStateFromRemote(
      slug,
      applyRosterSeedingWithMode,
      deserializeBracket,
      saveState,
      renderAll,
      getState()?.lastUpdated || 0,
    );
    renderAll();
    showToast?.(`${displayName} added directly to tournament.`, "success");
  };

  const initSuperAdminSearch = () => {
    const input = document.getElementById("superAdminSearchInput");
    const resultsEl = document.getElementById("superAdminSearchResults");
    if (!input || !resultsEl) return;
    const search = createAdminPlayerSearch({
      db,
      getIsEnabled: () => isSuperAdminUser(),
      getPlayers: () => getState()?.players || [],
      onStatus: setSuperAdminSearchStatus,
      onResults: renderSuperAdminSearchResults,
      onError: (err) => {
        if (err?.message) showToast?.(err.message, "error");
      },
      onSuccess: () => {
        input.value = "";
        renderSuperAdminSearchResults([]);
        setSuperAdminSearchStatus("");
      },
      addPlayer: async ({ userId, username, userData, options }) => {
        const race = normalizeRaceLabel(options?.selectedRace) || "Random";
        setSuperAdminSearchStatus(`Fetching SC2Pulse MMR for ${race}...`);
        await addSuperAdminPlayerFromSearch({
          userId,
          username,
          userData,
          selectedRace: race,
        });
        setSuperAdminSearchStatus("Player added.");
      },
    });

    input.addEventListener("input", () => {
      search.debouncedSearch(input.value);
    });
    resultsEl.addEventListener("click", (event) => {
      const target = event.target.closest("[data-super-admin-add-username]");
      if (!target) return;
      const username = target.dataset.superAdminAddUsername || "";
      const userId = target.dataset.superAdminUserId || "";
      const selectedRace =
        normalizeRaceLabel(
          document.getElementById("superAdminRaceSelect")?.value || "Random",
        ) || "Random";
      search.addByUsername(username, userId, {
        mode: "super-admin",
        selectedRace,
      });
    });
  };

  const setFinalAdminSearchStatus = (message) => {
    const statusEl = document.getElementById("finalAdminSearchStatus");
    if (statusEl) statusEl.textContent = message || "";
  };

  const renderFinalAdminSearchResults = (results = []) => {
    const resultsEl = document.getElementById("finalAdminSearchResults");
    if (!resultsEl) return;
    resultsEl.replaceChildren();
    const players = getState()?.players || [];
    results.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "admin-search-item";
      const label = document.createElement("span");
      label.setAttribute("translate", "no");
      label.textContent = entry.username;
      const inviteBtn = document.createElement("button");
      inviteBtn.type = "button";
      inviteBtn.className = "cta small ghost";
      inviteBtn.textContent = "Invite";
      inviteBtn.dataset.adminAddUsername = entry.username;
      inviteBtn.dataset.adminAddMode = "invite";
      if (entry.userId) {
        inviteBtn.dataset.adminUserId = entry.userId;
      }
      const alreadyAdded = players.some(
        (player) =>
          (entry.userId && player.uid === entry.userId) ||
          (player.name || "").toLowerCase() === entry.username.toLowerCase(),
      );
      if (alreadyAdded) {
        inviteBtn.disabled = true;
        inviteBtn.textContent = "Added";
      }
      row.append(label, inviteBtn);
      resultsEl.append(row);
    });
  };

  const initFinalAdminSearch = () => {
    const input = document.getElementById("finalAdminSearchInput");
    const resultsEl = document.getElementById("finalAdminSearchResults");
    if (!input || !resultsEl) return;
    const search = createAdminPlayerSearch({
      db,
      getIsEnabled: () => getIsAdmin(),
      getPlayers: () => getState()?.players || [],
      onStatus: setFinalAdminSearchStatus,
      onResults: renderFinalAdminSearchResults,
      onError: (err) => {
        if (err?.message) showToast?.(err.message, "error");
      },
      onSuccess: () => {
        input.value = "";
        renderFinalAdminSearchResults([]);
        setFinalAdminSearchStatus("");
      },
      addPlayer: async ({ userId, username, userData, options }) => {
        const currentState = getState();
        if (bracketHasRecordedResults(currentState.bracket)) {
          showToast?.("Cannot add players after scores are recorded.", "error");
          return;
        }
        const displayName = userData.username || username;
        const pulse = userData?.pulse || {};
        const byRace = pulse.lastMmrByRace || pulse.byRace || null;
        const fallbackMmr = Number(pulse.lastMmr ?? pulse.mmr);
        const pick = pickBestRace(byRace, fallbackMmr);
        const race = pick.race || "Random";
        const mmr = Number.isFinite(pick.mmr) ? pick.mmr : 0;
        const sc2Link = sanitizeUrl(userData.sc2PulseUrl || pulse.url || "");
        const meta = getCurrentTournamentMeta();
        const slug = getCurrentSlug();
        let startingPoints = null;
        if (meta?.circuitSlug && displayName) {
          startingPoints = await getCircuitSeedPoints({
            name: displayName,
            sc2Link,
            uid: userId,
            circuitSlug: meta.circuitSlug,
            tournamentSlug: slug,
          });
        }
        const avatarUrl =
          userData?.profile?.avatarUrl ||
          userData?.avatarUrl ||
          DEFAULT_PLAYER_AVATAR;
        const secondaryPulseProfiles = Array.isArray(pulse.secondary)
          ? pulse.secondary
          : [];
        const secondaryPulseLinks = secondaryPulseProfiles
          .map((entry) => (entry && typeof entry === "object" ? entry.url : ""))
          .filter(Boolean);
        let clanName = "";
        let clanAbbreviation = "";
        let clanLogoUrl = "";
        const mainClanId = userData?.settings?.mainClanId || "";
        if (mainClanId) {
          try {
            const clanDoc = await getDoc(doc(db, "clans", mainClanId));
            if (clanDoc.exists()) {
              const clanData = clanDoc.data() || {};
              clanName = clanData?.name || "";
              clanAbbreviation = clanData?.abbreviation || "";
              clanLogoUrl = clanData?.logoUrlSmall || clanData?.logoUrl || "";
            }
          } catch (err) {
            console.warn("Could not fetch clan data", err);
          }
        }
        const addMode = options?.mode === "super" ? "super" : "invite";
        const inviterName = getCurrentUsername?.() || "Tournament admin";
        const newPlayer = buildPlayerFromData({
          name: displayName,
          race,
          sc2Link,
          mmr,
          points: Number.isFinite(startingPoints) ? startingPoints : 0,
          inviteStatus:
            addMode === "super" ? INVITE_STATUS.accepted : INVITE_STATUS.pending,
          ...(addMode === "super"
            ? {}
            : {
                invitedAt: Date.now(),
                invitedByUid: auth.currentUser?.uid || "",
                invitedByName: inviterName,
              }),
          avatarUrl,
          twitchUrl: userData?.twitchUrl || "",
          secondaryPulseLinks,
          secondaryPulseProfiles,
          mmrByRace: byRace || null,
          country: (userData?.country || "").toUpperCase(),
          clan: clanName,
          clanAbbreviation,
          clanLogoUrl,
          pulseName: pulse.name || pulse.accountName || "",
          uid: userId,
        });
        await updateRosterWithTransaction(
          (players) => upsertRosterPlayer(players, newPlayer),
          {},
          { optimistic: true },
        );
        if (addMode === "super") {
          addActivity(`Admin added ${newPlayer.name}.`);
        } else {
          addActivity(`Admin invited ${newPlayer.name}.`);
          try {
            await sendTournamentInviteNotification({
              db,
              auth,
              getCurrentUsername,
              userId,
              playerName: newPlayer.name,
              tournamentMeta: meta,
              slug,
            });
          } catch (err) {
            console.error("Failed to send invite notification", err);
            showToast?.(
              "Invite created, but notification failed to send.",
              "error",
            );
          }
        }
        renderAll();
        if (addMode === "super") {
          showToast?.(`${newPlayer.name} added to player list.`, "success");
        } else {
          showToast?.(`Invite sent to ${newPlayer.name}.`, "success");
        }
      },
    });

    input.addEventListener("input", () => {
      search.debouncedSearch(input.value);
    });
    resultsEl.addEventListener("click", (event) => {
      const target = event.target.closest("[data-admin-add-username]");
      if (!target) return;
      const username = target.dataset.adminAddUsername || "";
      const userId = target.dataset.adminUserId || "";
      const mode = target.dataset.adminAddMode || "invite";
      search.addByUsername(username, userId, { mode });
    });
  };

  initFinalAdminSearch();
  initSuperAdminSearch();
}
