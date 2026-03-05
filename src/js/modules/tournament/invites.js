import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
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
const TEAM_MEMBER_STATUS = {
  accepted: "accepted",
  pending: "pending",
  denied: "denied",
};

function normalizeRaceChoice(race) {
  if (!race) return "";
  const trimmed = String(race).trim();
  return ALLOWED_RACES.has(trimmed) ? trimmed : "";
}

function normalizeTeamMemberStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (
    normalized === TEAM_MEMBER_STATUS.accepted ||
    normalized === TEAM_MEMBER_STATUS.pending ||
    normalized === TEAM_MEMBER_STATUS.denied
  ) {
    return normalized;
  }
  return TEAM_MEMBER_STATUS.pending;
}

function normalizeTournamentMode(mode) {
  const normalized = String(mode || "")
    .trim()
    .toLowerCase();
  return ["1v1", "2v2", "3v3", "4v4"].includes(normalized) ? normalized : "1v1";
}

function getTeamSizeFromMode(mode) {
  const normalized = normalizeTournamentMode(mode);
  const size = Number(normalized.charAt(0));
  return Number.isFinite(size) && size > 1 ? size : 1;
}

function normalizeMmrByRace(raw) {
  if (!raw || typeof raw !== "object") return null;
  const normalized = {};
  const keys = ["zerg", "protoss", "terran", "random"];
  keys.forEach((key) => {
    const value = Number(raw[key]);
    if (Number.isFinite(value) && value > 0) {
      normalized[key] = Math.round(value);
    }
  });
  return Object.keys(normalized).length ? normalized : null;
}

function resolveRaceMmr(byRace, race, fallback) {
  const key = String(race || "")
    .trim()
    .toLowerCase();
  if (key && byRace && Number.isFinite(byRace[key])) {
    return Math.round(byRace[key]);
  }
  const parsedFallback = Number(fallback);
  return Number.isFinite(parsedFallback) ? Math.round(parsedFallback) : 0;
}

function buildTeamMemberProfilePatch(userData = {}, chosenRace = "") {
  const pulse = userData?.pulse && typeof userData.pulse === "object" ? userData.pulse : {};
  const mmrByRace = normalizeMmrByRace(pulse.lastMmrByRace || pulse.byRace || null);
  const fallbackMmr = pulse.lastMmr ?? pulse.mmr ?? null;
  const resolvedRace = normalizeRaceChoice(chosenRace);
  const mmr = resolveRaceMmr(mmrByRace, resolvedRace, fallbackMmr);
  const secondaryPulseProfiles = Array.isArray(pulse.secondary)
    ? pulse.secondary
    : [];
  const secondaryPulseLinks = secondaryPulseProfiles
    .map((entry) => (entry && typeof entry === "object" ? String(entry.url || "").trim() : ""))
    .filter(Boolean);
  return {
    race: resolvedRace,
    sc2Link: String(userData?.sc2PulseUrl || pulse.url || "").trim(),
    pulseName: String(pulse.accountName || pulse.name || "").trim(),
    mmr: Number.isFinite(mmr) ? Math.max(0, mmr) : 0,
    mmrByRace: mmrByRace || null,
    secondaryPulseProfiles,
    secondaryPulseLinks,
    twitchUrl: String(userData?.twitchUrl || "").trim(),
    country: String(userData?.country || "").trim().toUpperCase(),
    avatarUrl: String(userData?.profile?.avatarUrl || userData?.avatarUrl || "").trim(),
  };
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

export async function sendTeamInviteNotification({
  db,
  auth,
  getCurrentUsername,
  userId,
  teammateName,
  tournamentMeta,
  slug,
  teamId,
  leaderName,
  mode,
}) {
  if (!userId || !teamId) return;
  const tournamentSlug = slug || tournamentMeta?.slug || tournamentMeta?.id || "";
  const tournamentName = tournamentMeta?.name || tournamentSlug || "Tournament";
  const teamMode = normalizeTournamentMode(mode || tournamentMeta?.mode || "1v1");
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
  const senderName = senderUsername || leaderName || "Team leader";
  const payload = {
    userId,
    teammateUid: userId,
    teammateName: teammateName || "",
    type: "teammate-invite",
    tournamentSlug,
    circuitSlug: tournamentMeta?.circuitSlug || "",
    tournamentName,
    tournamentUrl: tournamentPath ? `${baseUrl}${tournamentPath}` : "",
    teamId,
    teamMode,
    leaderUid: auth.currentUser?.uid || "",
    leaderName: leaderName || senderName,
    senderUid: auth.currentUser?.uid || "",
    senderName,
    senderUsername,
    status: INVITE_STATUS.pending,
    createdAt: serverTimestamp(),
    message: `${leaderName || senderName} invited you to join their ${teamMode} team in ${tournamentName}.`,
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
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("Tournament state not found.");
    }
    const data = snap.data() || {};
    const { updatedPlayers, found } = updateInviteStatusForPlayer(
      data.players || [],
      userId,
      status,
      race,
    );
    if (!found) {
      throw new Error("Invite not found in roster.");
    }
    const lastUpdated = Date.now();
    tx.set(
      ref,
      {
        players: updatedPlayers,
        needsReseed: true,
        lastUpdated,
      },
      { merge: true },
    );
    return { players: updatedPlayers, lastUpdated };
  });
}

function updateTeamInviteStatusForPlayer(
  players = [],
  uid,
  status,
  notification = {},
  race = "",
  teammateProfile = null,
) {
  const nextStatus = normalizeInviteStatus(status);
  const chosenRace = normalizeRaceChoice(race);
  const targetTeamId = String(notification?.teamId || "").trim();
  const modeFromNotification = normalizeTournamentMode(notification?.teamMode || "1v1");
  const memberStatusRank = (value) => {
    const normalized = normalizeTeamMemberStatus(value);
    if (normalized === TEAM_MEMBER_STATUS.accepted) return 0;
    if (normalized === TEAM_MEMBER_STATUS.pending) return 1;
    return 2;
  };
  const memberTs = (member) => Number(member?.respondedAt || member?.invitedAt || 0) || 0;
  const pickBetterMember = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    const roleA = a.role === "leader" ? 0 : 1;
    const roleB = b.role === "leader" ? 0 : 1;
    if (roleA !== roleB) return roleA < roleB ? a : b;
    const rankA = memberStatusRank(a.status);
    const rankB = memberStatusRank(b.status);
    if (rankA !== rankB) return rankA < rankB ? a : b;
    return memberTs(a) >= memberTs(b) ? a : b;
  };
  let found = false;
  const updatedPlayers = (players || []).map((player) => {
    const team = player?.team && typeof player.team === "object" ? player.team : null;
    if (!team) return player;
    const teamId = String(team.teamId || "").trim();
    const members = Array.isArray(team.members) ? team.members : [];
    const memberIndex = members.findIndex(
      (member) => String(member?.uid || "").trim() === String(uid || "").trim(),
    );
    if (memberIndex < 0) return player;
    if (targetTeamId && teamId && teamId !== targetTeamId) return player;
    found = true;
    const now = Date.now();
    const nextMembers = members.map((member, idx) => {
      if (!member || typeof member !== "object") return member;
      if (idx !== memberIndex) return member;
      const nextMember = {
        ...member,
        status: normalizeTeamMemberStatus(nextStatus),
        respondedAt: now,
      };
      if (chosenRace && normalizeTeamMemberStatus(nextStatus) === TEAM_MEMBER_STATUS.accepted) {
        nextMember.race = chosenRace;
        if (teammateProfile && typeof teammateProfile === "object") {
          nextMember.sc2Link = teammateProfile.sc2Link || "";
          nextMember.pulseName = teammateProfile.pulseName || "";
          nextMember.mmr = Number.isFinite(Number(teammateProfile.mmr))
            ? Math.max(0, Number(teammateProfile.mmr))
            : 0;
          nextMember.mmrByRace = teammateProfile.mmrByRace || null;
          nextMember.secondaryPulseProfiles = Array.isArray(
            teammateProfile.secondaryPulseProfiles,
          )
            ? teammateProfile.secondaryPulseProfiles
            : [];
          nextMember.secondaryPulseLinks = Array.isArray(
            teammateProfile.secondaryPulseLinks,
          )
            ? teammateProfile.secondaryPulseLinks
            : [];
          nextMember.twitchUrl = teammateProfile.twitchUrl || "";
          nextMember.country = teammateProfile.country || "";
          nextMember.avatarUrl = teammateProfile.avatarUrl || "";
        }
      }
      return nextMember;
    });
    const teamSize = Math.max(
      1,
      Number(team.size) || getTeamSizeFromMode(team.mode || modeFromNotification),
    );
    const requiredTeammates = Math.max(0, teamSize - 1);
    const dedupedByUid = new Map();
    nextMembers
      .filter((member) => member?.role !== "leader")
      .forEach((member) => {
        const memberUid = String(member?.uid || "").trim();
        if (!memberUid) return;
        dedupedByUid.set(
          memberUid,
          pickBetterMember(dedupedByUid.get(memberUid), member),
        );
      });
    const nonLeader = Array.from(dedupedByUid.values());
    const acceptedTeammates = nonLeader.filter(
      (member) =>
        normalizeTeamMemberStatus(member?.status) === TEAM_MEMBER_STATUS.accepted,
    ).length;
    const complete = acceptedTeammates >= requiredTeammates;
    const inviteStatus = complete ? INVITE_STATUS.accepted : INVITE_STATUS.pending;
    return {
      ...player,
      inviteStatus,
      checkedInAt: inviteStatus === INVITE_STATUS.accepted ? player.checkedInAt || null : null,
      team: {
        ...team,
        mode: normalizeTournamentMode(team.mode || modeFromNotification),
        size: teamSize,
        updatedAt: now,
        members: nextMembers,
      },
    };
  });
  return { updatedPlayers, found };
}

export async function updateRemoteTeamInviteStatus({
  db,
  slug,
  userId,
  status,
  notification,
  race,
}) {
  if (!slug) throw new Error("Missing tournament slug.");
  const ref = doc(collection(db, TOURNAMENT_STATE_COLLECTION), slug);
  return runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", userId);
    const userSnap = userId ? await tx.get(userRef) : null;
    const teammateProfile = buildTeamMemberProfilePatch(
      userSnap?.exists() ? userSnap.data() || {} : {},
      race,
    );
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("Tournament state not found.");
    }
    const data = snap.data() || {};
    const { updatedPlayers, found } = updateTeamInviteStatusForPlayer(
      data.players || [],
      userId,
      status,
      notification,
      race,
      teammateProfile,
    );
    if (!found) {
      throw new Error("Team invite not found in roster.");
    }
    const lastUpdated = Date.now();
    tx.set(
      ref,
      {
        players: updatedPlayers,
        needsReseed: true,
        lastUpdated,
      },
      { merge: true },
    );
    return { players: updatedPlayers, lastUpdated };
  });
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
  saveState,
  renderAll,
  rebuildBracket,
  seedEligiblePlayers,
  bracketHasResults,
  showToast,
}) {
  if (!notification || !action) return;
  const isTournamentInvite = notification.type === "tournament-invite";
  const isTeamInvite = notification.type === "teammate-invite";
  if (!isTournamentInvite && !isTeamInvite) return;
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
    const remoteResult = isTeamInvite
      ? await updateRemoteTeamInviteStatus({
          db,
          slug: targetSlug,
          userId,
          status,
          notification,
          race,
        })
      : await updateRemoteInviteStatus({
          db,
          slug: targetSlug,
          userId,
          status,
          race,
        });

    if (targetSlug === currentSlug && Array.isArray(remoteResult?.players)) {
      const hasCompletedMatches = bracketHasResults();
      const { mergedPlayers } = seedEligiblePlayers(remoteResult.players);
      saveState(
        {
          players: mergedPlayers,
          needsReseed: hasCompletedMatches,
          ...(Number.isFinite(remoteResult?.lastUpdated)
            ? { lastUpdated: Number(remoteResult.lastUpdated) }
            : {}),
        },
        { skipRemote: true, keepTimestamp: Number.isFinite(remoteResult?.lastUpdated) },
      );
      if (!hasCompletedMatches) {
        rebuildBracket(
          true,
          status === INVITE_STATUS.accepted
            ? isTeamInvite
              ? "Team invite accepted"
              : "Invite accepted"
            : isTeamInvite
              ? "Team invite declined"
              : "Invite declined",
        );
      } else {
        renderAll();
      }
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
        ? isTeamInvite
          ? "Team invite accepted."
          : "Invite accepted."
        : isTeamInvite
          ? "Team invite declined."
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
