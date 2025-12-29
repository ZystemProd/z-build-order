export async function enforceCircuitFinalQualification({
  name,
  sc2Link,
  currentTournamentMeta,
  currentSlug,
  fetchCircuitMeta,
  buildCircuitLeaderboard,
  playerKey,
} = {}) {
  const qualifyCount = Number(currentTournamentMeta?.circuitQualifyCount);
  if (!currentTournamentMeta?.isCircuitFinal || !Number.isFinite(qualifyCount) || qualifyCount <= 0) {
    return { ok: true };
  }
  const circuitSlug = currentTournamentMeta?.circuitSlug || "";
  if (!circuitSlug) {
    return { ok: false, message: "Circuit leaderboard is unavailable for this finals event." };
  }
  const circuitMeta = await fetchCircuitMeta(circuitSlug);
  if (!circuitMeta) {
    return { ok: false, message: "Circuit leaderboard is unavailable for this finals event." };
  }
  let leaderboard = null;
  try {
    ({ leaderboard } = await buildCircuitLeaderboard(circuitMeta, [], { excludeSlug: currentSlug }));
  } catch (_) {
    leaderboard = null;
  }
  if (!leaderboard) {
    return { ok: false, message: "Circuit leaderboard is unavailable." };
  }
  if (!leaderboard.length) {
    return { ok: false, message: "Circuit leaderboard is empty." };
  }
  const key = playerKey(name, sc2Link);
  const qualified = leaderboard.slice(0, qualifyCount).some((entry) => entry.key === key);
  if (!qualified) {
    return {
      ok: false,
      message: `You must be in the top ${qualifyCount} of the circuit leaderboard to register.`,
    };
  }
  return { ok: true };
}
