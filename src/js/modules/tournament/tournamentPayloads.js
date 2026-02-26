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
    finalReset: "settingsBestOfFinalReset",
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
  const fallbackFinalReset =
    defaultBestOf.finalReset ?? defaultBestOf.final ?? 1;
  const finalResetValue = ids.finalReset
    ? Number(
        document.getElementById(ids.finalReset)?.value || fallbackFinalReset
      )
    : fallbackFinalReset;
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
    finalReset: finalResetValue,
  };
}

export function buildCreateTournamentPayload({
  slug,
  name,
  description,
  rules,
  format,
  coverImageUrl,
  coverImageUrlSmall,
  maxPlayers,
  startTime,
  checkInWindowMinutes,
  allowCheckInAfterStart,
  isInviteOnly,
  visibility,
  mapPool,
  createdBy,
  createdByName,
  roundRobin,
  bestOf,
  grandFinalReset,
  circuitSlug,
  isCircuitFinal,
}) {
  return {
    slug,
    name,
    description,
    rules,
    format,
    coverImageUrl: coverImageUrl || "",
    coverImageUrlSmall: coverImageUrlSmall || "",
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    allowCheckInAfterStart: Boolean(allowCheckInAfterStart),
    checkInManuallyClosed: false,
    isInviteOnly: Boolean(isInviteOnly),
    visibility: visibility || "public",
    mapPool: Array.from(mapPool || []),
    createdBy: createdBy || null,
    createdByName: createdByName || "Unknown host",
    admins: [],
    adminUids: [],
    roundRobin,
    bestOf,
    grandFinalReset: Boolean(grandFinalReset),
    prizePoolTotal: null,
    prizePoolCurrency: "USD",
    prizePoolCurrencyCustom: "",
    prizePoolSplit: [],
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
  coverImageUrlSmall,
  maxPlayers,
  startTime,
  checkInWindowMinutes,
  allowCheckInAfterStart,
  checkInManuallyClosed,
  isInviteOnly,
  visibility,
  bestOf,
  mapPool,
  roundRobin,
  requirePulseLink,
  grandFinalReset,
  circuitQualifyCount,
  prizePoolTotal,
  prizePoolCurrency,
  prizePoolCurrencyCustom,
  prizePoolSplit,
}) {
  return {
    ...(currentTournamentMeta || {}),
    slug: newSlug,
    format,
    description,
    rules,
    coverImageUrl,
    coverImageUrlSmall,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    allowCheckInAfterStart: Boolean(allowCheckInAfterStart),
    checkInManuallyClosed: Boolean(checkInManuallyClosed),
    isInviteOnly: Boolean(isInviteOnly),
    visibility: visibility || "public",
    requirePulseLink: Boolean(requirePulseLink),
    prizePoolTotal:
      Number.isFinite(prizePoolTotal) && prizePoolTotal >= 0
        ? Math.round(prizePoolTotal)
        : null,
    prizePoolCurrency: String(prizePoolCurrency || "USD").toUpperCase(),
    prizePoolCurrencyCustom: String(prizePoolCurrencyCustom || "").trim(),
    prizePoolSplit: Array.isArray(prizePoolSplit)
      ? prizePoolSplit
          .map((row, idx) => {
            if (row && typeof row === "object") {
              return {
                place: Number(row.place),
                amount: Number(
                  row.amount ?? row.value ?? row.points ?? row.percent ?? 0,
                ),
              };
            }
            const amount = Number(row);
            return { place: idx + 1, amount };
          })
          .filter(
            (row) =>
              Number.isFinite(row.place) &&
              row.place > 0 &&
              Number.isFinite(row.amount) &&
              row.amount >= 0,
          )
      : [],
    circuitQualifyCount,
    bestOf,
    grandFinalReset: Boolean(grandFinalReset),
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
  coverImageUrl,
  coverImageUrlSmall,
  maxPlayers,
  startTime,
  checkInWindowMinutes,
  allowCheckInAfterStart,
  isInviteOnly,
  visibility,
  mapPool,
  createdBy,
  createdByName,
  roundRobin,
  bestOf,
  grandFinalReset,
  circuitSlug,
  circuitQualifyCount,
}) {
  return {
    slug,
    name,
    description,
    rules,
    format,
    coverImageUrl: coverImageUrl || "",
    coverImageUrlSmall: coverImageUrlSmall || "",
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
    startTime: startTime ? startTime.getTime() : null,
    checkInWindowMinutes,
    allowCheckInAfterStart: Boolean(allowCheckInAfterStart),
    checkInManuallyClosed: false,
    isInviteOnly: Boolean(isInviteOnly),
    visibility: visibility || "public",
    mapPool: Array.from(mapPool || []),
    createdBy: createdBy || null,
    createdByName: createdByName || "Unknown host",
    admins: [],
    adminUids: [],
    roundRobin,
    bestOf,
    grandFinalReset: Boolean(grandFinalReset),
    prizePoolTotal: null,
    prizePoolCurrency: "USD",
    prizePoolCurrencyCustom: "",
    prizePoolSplit: [],
    circuitSlug,
    isCircuitFinal: true,
    circuitQualifyCount:
      Number.isFinite(circuitQualifyCount) && circuitQualifyCount >= 0
        ? circuitQualifyCount
        : null,
  };
}
