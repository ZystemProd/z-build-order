import { applySeeding } from "./bracket/build.js";

export const INVITE_STATUS = {
  accepted: "accepted",
  pending: "pending",
  denied: "denied",
};

export function normalizeInviteStatus(status) {
  const normalized = (status || "").toLowerCase();
  if (
    normalized === INVITE_STATUS.pending ||
    normalized === INVITE_STATUS.denied ||
    normalized === INVITE_STATUS.accepted
  ) {
    return normalized;
  }
  return INVITE_STATUS.accepted;
}

export function isInviteAccepted(player) {
  return normalizeInviteStatus(player?.inviteStatus) === INVITE_STATUS.accepted;
}

export function getEligiblePlayers(players = []) {
  return (players || []).filter((player) => isInviteAccepted(player));
}

export function seedEligiblePlayers(players = []) {
  const eligible = getEligiblePlayers(players);
  const seededEligible = applySeeding(eligible);
  const seedById = new Map(
    seededEligible.map((player) => [player.id, player.seed])
  );
  const mergedPlayers = (players || []).map((player) => {
    const inviteStatus = normalizeInviteStatus(player.inviteStatus);
    const seed = seedById.get(player.id);
    if (Number.isFinite(seed)) {
      return { ...player, seed, inviteStatus };
    }
    if (inviteStatus !== INVITE_STATUS.accepted) {
      const { seed: _seed, ...rest } = player;
      return { ...rest, inviteStatus };
    }
    return { ...player, inviteStatus };
  });
  return { seededEligible, mergedPlayers };
}

export function applyRosterSeeding(players = []) {
  const inputCount = Array.isArray(players) ? players.length : 0;
  const out = seedEligiblePlayers(players).mergedPlayers;
  const outputCount = Array.isArray(out) ? out.length : 0;

  console.log("🧪 [tournament-sync] applyRosterSeeding", {
    inputCount,
    outputCount,
    removed: inputCount - outputCount,
    inputUids: (players || []).map((p) => p?.uid).filter(Boolean),
    outputUids: (out || []).map((p) => p?.uid).filter(Boolean),
  });

  return out;
}
