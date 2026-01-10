const BEST_OF_INPUT_IDS = {
  create: {
    upper: "bestOfUpperInput",
    lower: "bestOfLowerInput",
    lowerSemi: "bestOfLowerSemiInput",
    lowerFinal: "bestOfLowerFinalInput",
    quarter: "bestOfQuarterInput",
    semi: "bestOfSemiInput",
    upperFinal: "bestOfUpperFinalInput",
    final: "bestOfFinalInput",
  },
  settings: {
    upper: "settingsBestOfUpper",
    lower: "settingsBestOfLower",
    quarter: "settingsBestOfQuarter",
    semi: "settingsBestOfSemi",
    upperFinal: "settingsBestOfUpperFinal",
    final: "settingsBestOfFinal",
    lowerSemi: "settingsBestOfLowerSemi",
    lowerFinal: "settingsBestOfLowerFinal",
  },
  final: {
    upper: "finalBestOfUpperInput",
    lower: "finalBestOfLowerInput",
    lowerSemi: "finalBestOfLowerSemiInput",
    lowerFinal: "finalBestOfLowerFinalInput",
    quarter: "finalBestOfQuarterInput",
    semi: "finalBestOfSemiInput",
    upperFinal: "finalBestOfUpperFinalInput",
    final: "finalBestOfFinalInput",
  },
  circuitfinal: {
    upper: "circuitFinalBestOfUpperInput",
    lower: "circuitFinalBestOfLowerInput",
    lowerSemi: "circuitFinalBestOfLowerSemiInput",
    lowerFinal: "circuitFinalBestOfLowerFinalInput",
    quarter: "circuitFinalBestOfQuarterInput",
    semi: "circuitFinalBestOfSemiInput",
    upperFinal: "circuitFinalBestOfUpperFinalInput",
    final: "circuitFinalBestOfFinalInput",
  },
};

export function readBestOf(scope, defaultBestOf) {
  const ids = BEST_OF_INPUT_IDS[scope];
  if (!ids) return { ...defaultBestOf };
  return {
    upper: Number(document.getElementById(ids.upper)?.value || defaultBestOf.upper),
    lower: Number(document.getElementById(ids.lower)?.value || defaultBestOf.lower),
    lowerSemi: Number(document.getElementById(ids.lowerSemi)?.value || defaultBestOf.lowerSemi),
    lowerFinal: Number(document.getElementById(ids.lowerFinal)?.value || defaultBestOf.lowerFinal),
    quarter: Number(document.getElementById(ids.quarter)?.value || defaultBestOf.quarter),
    semi: Number(document.getElementById(ids.semi)?.value || defaultBestOf.semi),
    upperFinal: Number(
      document.getElementById(ids.upperFinal)?.value || defaultBestOf.upperFinal
    ),
    final: Number(document.getElementById(ids.final)?.value || defaultBestOf.final),
  };
}

export function buildCreateTournamentPayload({
  slug,
  name,
  description,
  rules,
  format,
  maxPlayers,
  startTime,
  checkInWindowMinutes,
  isInviteOnly,
  visibility,
  mapPool,
  createdBy,
  createdByName,
  roundRobin,
  bestOf,
  circuitSlug,
  isCircuitFinal,
}) {
  return {
    slug,
    name,
    description,
    rules,
    format,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    isInviteOnly: Boolean(isInviteOnly),
    visibility: visibility || "public",
    mapPool: Array.from(mapPool || []),
    createdBy: createdBy || null,
    createdByName: createdByName || "Unknown host",
    admins: [],
    roundRobin,
    bestOf,
    circuitSlug: circuitSlug || null,
    isCircuitFinal: Boolean(isCircuitFinal),
  };
}

export function buildSettingsPayload({
  currentTournamentMeta,
  newSlug,
  format,
  description,
  rules,
  coverImageUrl,
  maxPlayers,
  startTime,
  checkInWindowMinutes,
  isInviteOnly,
  visibility,
  bestOf,
  mapPool,
  roundRobin,
  requirePulseLink,
  circuitQualifyCount,
}) {
  return {
    ...(currentTournamentMeta || {}),
    slug: newSlug,
    format,
    description,
    rules,
    coverImageUrl,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    isInviteOnly: Boolean(isInviteOnly),
    visibility: visibility || "public",
    requirePulseLink: Boolean(requirePulseLink),
    circuitQualifyCount,
    bestOf,
    mapPool,
    roundRobin,
    lastUpdated: Date.now(),
  };
}

export function buildFinalTournamentPayload({
  slug,
  name,
  description,
  rules,
  format,
  maxPlayers,
  startTime,
  checkInWindowMinutes,
  isInviteOnly,
  visibility,
  mapPool,
  createdBy,
  createdByName,
  roundRobin,
  bestOf,
  circuitSlug,
  circuitQualifyCount,
}) {
  return {
    slug,
    name,
    description,
    rules,
    format,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    isInviteOnly: Boolean(isInviteOnly),
    visibility: visibility || "public",
    mapPool: Array.from(mapPool || []),
    createdBy: createdBy || null,
    createdByName: createdByName || "Unknown host",
    admins: [],
    roundRobin,
    bestOf,
    circuitSlug,
    isCircuitFinal: true,
    circuitQualifyCount:
      Number.isFinite(circuitQualifyCount) && circuitQualifyCount >= 0
        ? circuitQualifyCount
        : null,
  };
}
