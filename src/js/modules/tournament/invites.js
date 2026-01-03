import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  INVITE_STATUS,
  isInviteAccepted,
  normalizeInviteStatus,
} from "./rosterSeeding.js";
import { TOURNAMENT_STATE_COLLECTION } from "./state.js";

const ALLOWED_RACES = new Set(["Zerg", "Protoss", "Terran", "Random"]);

function normalizeRaceChoice(race) {
  if (!race) return "";
  const trimmed = String(race).trim();
  return ALLOWED_RACES.has(trimmed) ? trimmed : "";
}

function updateInviteStatusForPlayer(players = [], uid, status, race) {
  const nextStatus = normalizeInviteStatus(status);
  const chosenRace = normalizeRaceChoice(race);
  let found = false;
  const updatedPlayers = (players || []).map((player) => {
    if (!uid || player.uid !== uid) return player;
    found = true;
    const next = { ...player, inviteStatus: nextStatus };
    if (chosenRace && nextStatus === INVITE_STATUS.accepted) {
      next.race = chosenRace;
    }
    if (nextStatus !== INVITE_STATUS.accepted) {
      next.checkedInAt = null;
    }
    return next;
  });
  return { updatedPlayers, found };
}

function updateCheckInStatusForPlayer(players = [], uid) {
  let found = false;
  let allowed = false;
  let already = false;
  const updatedPlayers = (players || []).map((player) => {
    if (!uid || player.uid !== uid) return player;
    found = true;
    if (!isInviteAccepted(player)) {
      return player;
    }
    allowed = true;
    if (player.checkedInAt) {
      already = true;
      return player;
    }
    return { ...player, checkedInAt: Date.now() };
  });
  return { updatedPlayers, found, allowed, already };
}

function notifyInviteActionComplete(id, ok) {
  if (!id) return;
  document.dispatchEvent(
    new CustomEvent("tournament:notification-action-complete", {
      detail: { id, ok: Boolean(ok) },
    })
  );
}

export async function sendTournamentInviteNotification({
  db,
  auth,
  getCurrentUsername,
  userId,
  playerName,
  tournamentMeta,
  slug,
}) {
  if (!userId) return;
  const tournamentSlug = slug || tournamentMeta?.slug || tournamentMeta?.id || "";
  const tournamentName = tournamentMeta?.name || tournamentSlug || "Tournament";
  const baseUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const tournamentPath = tournamentSlug
    ? tournamentMeta?.circuitSlug
      ? `/tournament/${tournamentMeta.circuitSlug}/${tournamentSlug}`
      : `/tournament/${tournamentSlug}`
    : "";
  const senderUsername = getCurrentUsername?.() || "";
  const senderName = senderUsername || "Tournament admin";
  const payload = {
    userId,
    playerUid: userId,
    playerName: playerName || "",
    type: "tournament-invite",
    tournamentSlug,
    circuitSlug: tournamentMeta?.circuitSlug || "",
    tournamentName,
    tournamentUrl: tournamentPath
      ? `${baseUrl}${tournamentPath}`
      : "",
    senderUid: auth.currentUser?.uid || "",
    senderName,
    senderUsername,
    status: INVITE_STATUS.pending,
    createdAt: serverTimestamp(),
    message: `${senderName} invited you to ${tournamentName}.`,
  };
  await addDoc(collection(db, "users", userId, "notifications"), payload);
}

export async function sendTournamentCheckInNotifications({
  db,
  auth,
  getCurrentUsername,
  players = [],
  tournamentMeta,
  slug,
}) {
  if (!players.length) return;
  const tournamentSlug = slug || tournamentMeta?.slug || tournamentMeta?.id || "";
  const tournamentName = tournamentMeta?.name || tournamentSlug || "Tournament";
  const baseUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const tournamentPath = tournamentSlug
    ? tournamentMeta?.circuitSlug
      ? `/tournament/${tournamentMeta.circuitSlug}/${tournamentSlug}`
      : `/tournament/${tournamentSlug}`
    : "";
  const senderUsername = getCurrentUsername?.() || "";
  const senderName = senderUsername || "Tournament admin";
  const payloadBase = {
    type: "tournament-checkin",
    tournamentSlug,
    circuitSlug: tournamentMeta?.circuitSlug || "",
    tournamentName,
    tournamentUrl: tournamentPath ? `${baseUrl}${tournamentPath}` : "",
    senderUid: auth.currentUser?.uid || "",
    senderName,
    senderUsername,
    status: "open",
    createdAt: serverTimestamp(),
    message: `Check-in is open for ${tournamentName}.`,
  };
  await Promise.all(
    players
      .filter((player) => player?.uid)
      .map((player) =>
        addDoc(
          collection(db, "users", player.uid, "notifications"),
          {
            ...payloadBase,
            userId: player.uid,
            playerUid: player.uid,
            playerName: player.name || "",
          }
        )
      )
  );
}

export async function updateRemoteInviteStatus({
  db,
  slug,
  userId,
  status,
  race,
}) {
  if (!slug) throw new Error("Missing tournament slug.");
  const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Tournament state not found.");
  }
  const data = snap.data() || {};
  const { updatedPlayers, found } = updateInviteStatusForPlayer(
    data.players || [],
    userId,
    status,
    race
  );
  if (!found) {
    throw new Error("Invite not found in roster.");
  }
  await setDoc(
    ref,
    {
      players: updatedPlayers,
      needsReseed: true,
      lastUpdated: Date.now(),
    },
    { merge: true }
  );
}

export async function updateRemoteCheckInStatus({ db, slug, userId }) {
  if (!slug) throw new Error("Missing tournament slug.");
  const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Tournament state not found.");
  }
  const data = snap.data() || {};
  const { updatedPlayers, found, allowed, already } = updateCheckInStatusForPlayer(
    data.players || [],
    userId
  );
  if (!found) {
    throw new Error("Player not found in roster.");
  }
  if (!allowed) {
    throw new Error("Invite not accepted.");
  }
  if (already) {
    return;
  }
  await setDoc(
    ref,
    {
      players: updatedPlayers,
      lastUpdated: Date.now(),
    },
    { merge: true }
  );
}

export async function handleTournamentCheckInAction({
  notification,
  auth,
  db,
  currentSlug,
  checkInLocal,
  showToast,
}) {
  if (!notification || notification.type !== "tournament-checkin") return;
  const notificationId = notification.id || "";
  const userId = auth.currentUser?.uid || "";
  if (!userId) {
    showToast?.("Sign in to check in.", "error");
    notifyInviteActionComplete(notificationId, false);
    return;
  }
  const targetSlug = notification.tournamentSlug || currentSlug;
  if (!targetSlug) {
    showToast?.("This notification is missing tournament details.", "error");
    notifyInviteActionComplete(notificationId, false);
    return;
  }
  try {
    if (targetSlug === currentSlug && typeof checkInLocal === "function") {
      checkInLocal();
    } else {
      await updateRemoteCheckInStatus({ db, slug: targetSlug, userId });
    }
    if (notificationId) {
      const notificationUserId = notification.userId || userId;
      await updateDoc(
        doc(db, "users", notificationUserId, "notifications", notificationId),
        {
          status: "checked-in",
          respondedAt: serverTimestamp(),
        }
      );
    }
    showToast?.("Checked in.", "success");
    notifyInviteActionComplete(notificationId, true);
  } catch (err) {
    console.error("Failed to check in from notification", err);
    showToast?.("Could not check in.", "error");
    notifyInviteActionComplete(notificationId, false);
  }
}

export async function handleTournamentInviteAction({
  notification,
  action,
  race,
  auth,
  db,
  currentSlug,
  state,
  isLive,
  setSeedingNotice,
  saveState,
  renderAll,
  rebuildBracket,
  seedEligiblePlayers,
  bracketHasResults,
  showToast,
}) {
  if (!notification || !action) return;
  if (notification.type !== "tournament-invite") return;
  const notificationId = notification.id || "";
  const normalizedAction = action.toLowerCase();
  const status =
    normalizedAction === "accept"
      ? INVITE_STATUS.accepted
      : normalizedAction === "deny"
      ? INVITE_STATUS.denied
      : null;
  if (!status) {
    notifyInviteActionComplete(notificationId, false);
    return;
  }
  const userId = auth.currentUser?.uid || "";
  if (!userId) {
    showToast?.("Sign in to respond to invites.", "error");
    notifyInviteActionComplete(notificationId, false);
    return;
  }
  const targetSlug = notification.tournamentSlug || currentSlug;
  if (!targetSlug) {
    showToast?.("This invite is missing tournament details.", "error");
    notifyInviteActionComplete(notificationId, false);
    return;
  }
  if (targetSlug === currentSlug && isLive) {
    showToast?.("Tournament is live. Invites are locked.", "error");
    notifyInviteActionComplete(notificationId, false);
    return;
  }
  try {
    if (targetSlug === currentSlug) {
      const { updatedPlayers, found } = updateInviteStatusForPlayer(
        state.players || [],
        userId,
        status,
        race
      );
      if (!found) {
        showToast?.("Invite not found in roster.", "error");
        notifyInviteActionComplete(notificationId, false);
        return;
      }
      const hasCompletedMatches = bracketHasResults();
      const { mergedPlayers } = seedEligiblePlayers(updatedPlayers);
      saveState({ players: mergedPlayers, needsReseed: hasCompletedMatches });
      if (!hasCompletedMatches) {
        rebuildBracket(
          true,
          status === INVITE_STATUS.accepted ? "Invite accepted" : "Invite declined"
        );
      } else {
        setSeedingNotice(true);
        renderAll();
      }
    } else {
      await updateRemoteInviteStatus({ db, slug: targetSlug, userId, status, race });
    }
    if (notificationId) {
      const notificationUserId = notification.userId || userId;
      await updateDoc(
        doc(db, "users", notificationUserId, "notifications", notificationId),
        {
          status,
          respondedAt: serverTimestamp(),
        }
      );
    }
    showToast?.(
      status === INVITE_STATUS.accepted
        ? "Invite accepted."
        : "Invite declined.",
      "success"
    );
    notifyInviteActionComplete(notificationId, true);
  } catch (err) {
    console.error("Failed to respond to invite", err);
    showToast?.("Could not update invite response.", "error");
    notifyInviteActionComplete(notificationId, false);
  }
}
