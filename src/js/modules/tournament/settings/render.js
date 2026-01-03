import DOMPurify from "dompurify";
import { defaultBestOf } from "../state.js";
import { normalizeRoundRobinSettings } from "../bracket/build.js";
import { syncMarkdownSurfaceForInput } from "../markdownEditor.js";

export function applyBestOfToSettings(bestOf) {
  const upperInput = document.getElementById("settingsBestOfUpper");
  const lowerInput = document.getElementById("settingsBestOfLower");
  const quarterInput = document.getElementById("settingsBestOfQuarter");
  const semiInput = document.getElementById("settingsBestOfSemi");
  const upperFinalInput = document.getElementById("settingsBestOfUpperFinal");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");

  if (upperInput) upperInput.value = bestOf.upper ?? defaultBestOf.upper;
  if (lowerInput) lowerInput.value = bestOf.lower ?? defaultBestOf.lower;
  if (quarterInput)
    quarterInput.value = bestOf.quarter ?? defaultBestOf.quarter;
  if (semiInput) semiInput.value = bestOf.semi ?? defaultBestOf.semi;
  if (upperFinalInput)
    upperFinalInput.value = bestOf.upperFinal ?? defaultBestOf.upperFinal;
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
  const checkInSelect = document.getElementById("settingsCheckInSelect");
  const accessSelect = document.getElementById("settingsAccessSelect");
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
  const upperFinalInput = document.getElementById("settingsBestOfUpperFinal");
  const finalInput = document.getElementById("settingsBestOfFinal");
  const lbSemiInput = document.getElementById("settingsBestOfLowerSemi");
  const lbFinalInput = document.getElementById("settingsBestOfLowerFinal");
  const rrGroups = document.getElementById("settingsRoundRobinGroups");
  const rrAdvance = document.getElementById("settingsRoundRobinAdvance");
  const rrPlayoffs = document.getElementById("settingsRoundRobinPlayoffs");
  const qualifyRow = document.getElementById("settingsCircuitQualifyRow");
  const qualifyInput = document.getElementById("settingsCircuitQualifyCount");
  if (nameInput) nameInput.value = tournament.name || "";
  if (slugInput) slugInput.value = tournament.slug || "";
  if (descInput) descInput.value = tournament.description || "";
  if (rulesInput) rulesInput.value = tournament.rules || "";
  syncMarkdownSurfaceForInput(descInput);
  syncMarkdownSurfaceForInput(rulesInput);
  syncMarkdownSurfaceForInput(descInput);
  syncMarkdownSurfaceForInput(rulesInput);
  if (formatSelect)
    formatSelect.value =
      tournament.format || storedFormat || "Double Elimination";
  if (maxInput) maxInput.value = tournament.maxPlayers || "";
  if (startInput) {
    startInput.value = tournament.startTime
      ? new Date(tournament.startTime).toISOString().slice(0, 16)
      : "";
    if (startInput._flatpickr) {
      if (startInput.value) {
        startInput._flatpickr.setDate(startInput.value, false);
      } else {
        startInput._flatpickr.clear();
      }
    }
  }
  if (checkInSelect) {
    const total = Number(tournament.checkInWindowMinutes || 0);
    const normalized = Math.max(0, Math.min(180, Math.round(total / 15) * 15));
    checkInSelect.value = String(normalized);
  }
  if (accessSelect) {
    accessSelect.value = tournament.isInviteOnly ? "closed" : "open";
  }
  if (imageInput) imageInput.value = "";
  if (imagePreview) {
    if (tournament.coverImageUrl) {
      imagePreview.src = tournament.coverImageUrl;
      imagePreview.style.display = "block";
      delete imagePreview.dataset.tempPreview;
      imagePreview.dataset.reuseUrl = tournament.coverImageUrl;
    } else {
      imagePreview.removeAttribute("src");
      imagePreview.style.display = "none";
      delete imagePreview.dataset.tempPreview;
      delete imagePreview.dataset.reuseUrl;
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
  if (upperFinalInput)
    upperFinalInput.value = bestOf.upperFinal ?? defaultBestOf.upperFinal;
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

  const qualifyCount = Number(tournament.circuitQualifyCount);
  if (qualifyInput) {
    qualifyInput.value = Number.isFinite(qualifyCount) ? qualifyCount : "";
  }
  if (qualifyRow) {
    qualifyRow.style.display = tournament.isCircuitFinal ? "" : "none";
  }

  applyBestOfToSettings({
    ...defaultBestOf,
    ...(tournament.bestOf || {}),
  });
  syncFormatFieldVisibility("settings");
}
