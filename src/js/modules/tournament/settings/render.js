import DOMPurify from "dompurify";
import { defaultBestOf } from "../state.js";
import { normalizeRoundRobinSettings } from "../bracket/build.js";

export function applyBestOfToSettings(bestOf) {
  const upperInput = document.getElementById("settingsBestOfUpper");
  const lowerInput = document.getElementById("settingsBestOfLower");
  const quarterInput = document.getElementById("settingsBestOfQuarter");
  const semiInput = document.getElementById("settingsBestOfSemi");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");

  if (upperInput) upperInput.value = bestOf.upper ?? defaultBestOf.upper;
  if (lowerInput) lowerInput.value = bestOf.lower ?? defaultBestOf.lower;
  if (quarterInput)
    quarterInput.value = bestOf.quarter ?? defaultBestOf.quarter;
  if (semiInput) semiInput.value = bestOf.semi ?? defaultBestOf.semi;
  if (finalInput) finalInput.value = bestOf.final ?? defaultBestOf.final;
  if (lbSemiInput)
    lbSemiInput.value = bestOf.lowerSemi ?? defaultBestOf.lowerSemi;
  if (lbFinalInput)
    lbFinalInput.value = bestOf.lowerFinal ?? defaultBestOf.lowerFinal;
}

export function populateSettingsPanel({
  tournament,
  setMapPoolSelection,
  getDefaultMapPoolNames,
  updateSettingsDescriptionPreview,
  updateSettingsRulesPreview,
  syncFormatFieldVisibility,
}) {
  if (!tournament) return;
  const storedFormat =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("zboSettingsFormat")) ||
    "";
  const nameInput = document.getElementById("settingsNameInput");
  const slugInput = document.getElementById("settingsSlugInput");
  const descInput = document.getElementById("settingsDescriptionInput");
  const rulesInput = document.getElementById("settingsRulesInput");
  const formatSelect = document.getElementById("settingsFormatSelect");
  const maxInput = document.getElementById("settingsMaxPlayersInput");
  const startInput = document.getElementById("settingsStartInput");
  const imageInput = document.getElementById("settingsImageInput");
  const imagePreview = document.getElementById("settingsImagePreview");
  const rrBestOf = document.getElementById("settingsRoundRobinBestOf");
  const bestOf = {
    ...defaultBestOf,
    ...(tournament.bestOf || {}),
  };
  const upperInput = document.getElementById("settingsBestOfUpper");
  const lowerInput = document.getElementById("settingsBestOfLower");
  const quarterInput = document.getElementById("settingsBestOfQuarter");
  const semiInput = document.getElementById("settingsBestOfSemi");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");
  const rrGroups = document.getElementById("settingsRoundRobinGroups");
  const rrAdvance = document.getElementById("settingsRoundRobinAdvance");
  const rrPlayoffs = document.getElementById("settingsRoundRobinPlayoffs");
  if (nameInput) nameInput.value = tournament.name || "";
  if (slugInput) slugInput.value = tournament.slug || "";
  if (descInput) descInput.value = tournament.description || "";
  if (rulesInput) rulesInput.value = tournament.rules || "";
  if (formatSelect)
    formatSelect.value =
      tournament.format || storedFormat || "Double Elimination";
  if (maxInput) maxInput.value = tournament.maxPlayers || "";
  if (startInput) {
    startInput.value = tournament.startTime
      ? new Date(tournament.startTime).toISOString().slice(0, 16)
      : "";
  }
  if (imageInput) imageInput.value = "";
  if (imagePreview) {
    if (tournament.coverImageUrl) {
      imagePreview.src = tournament.coverImageUrl;
      imagePreview.style.display = "block";
      delete imagePreview.dataset.tempPreview;
    } else {
      imagePreview.removeAttribute("src");
      imagePreview.style.display = "none";
      delete imagePreview.dataset.tempPreview;
    }
  }
  const requirePulseInput = document.getElementById("settingsRequirePulseLink");
  if (requirePulseInput)
    requirePulseInput.checked = tournament.requirePulseLink ?? true;
  setMapPoolSelection(
    tournament.mapPool?.length ? tournament.mapPool : getDefaultMapPoolNames()
  );
  updateSettingsDescriptionPreview();
  updateSettingsRulesPreview();
  if (upperInput) upperInput.value = bestOf.upper ?? defaultBestOf.upper;
  if (lowerInput) lowerInput.value = bestOf.lower ?? defaultBestOf.lower;
  if (quarterInput)
    quarterInput.value = bestOf.quarter ?? defaultBestOf.quarter;
  if (semiInput) semiInput.value = bestOf.semi ?? defaultBestOf.semi;
  if (finalInput) finalInput.value = bestOf.final ?? defaultBestOf.final;
  if (lbSemiInput)
    lbSemiInput.value = bestOf.lowerSemi ?? defaultBestOf.lowerSemi;
  if (lbFinalInput)
    lbFinalInput.value = bestOf.lowerFinal ?? defaultBestOf.lowerFinal;
  const rrSettings = normalizeRoundRobinSettings(tournament.roundRobin || {});
  if (rrGroups) rrGroups.value = rrSettings.groups;
  if (rrAdvance) rrAdvance.value = rrSettings.advancePerGroup;
  if (rrPlayoffs) rrPlayoffs.value = rrSettings.playoffs;
  if (rrBestOf) rrBestOf.value = rrSettings.bestOf ?? defaultRoundRobinSettings.bestOf;

  applyBestOfToSettings({
    ...defaultBestOf,
    ...(tournament.bestOf || {}),
  });
  syncFormatFieldVisibility("settings");
}
