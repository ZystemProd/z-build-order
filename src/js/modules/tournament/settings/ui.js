import DOMPurify from "dompurify";
import { normalizeRoundRobinSettings } from "../bracket/build.js";

export function syncFormatFieldVisibility(scope) {
  const selectId =
    scope === "settings"
      ? "settingsFormatSelect"
      : scope === "final"
      ? "finalFormatSelect"
      : "tournamentFormatSelect";
  const value = document.getElementById(selectId)?.value || "";
  const isRR = (value || "").toLowerCase().startsWith("round robin");
  const rrBlocks = document.querySelectorAll(
    `[data-format-scope="${scope}-roundrobin"]`
  );
  rrBlocks.forEach((el) => {
    el.style.display = isRR ? "flex" : "none";
  });
}

export function updateSettingsDescriptionPreview(renderMarkdown) {
  const descInput = document.getElementById("settingsDescriptionInput");
  const preview = document.getElementById("settingsDescriptionPreview");
  if (!preview) return;
  preview.innerHTML = DOMPurify.sanitize(
    renderMarkdown(descInput?.value || "")
  );
}

export function updateSettingsRulesPreview(renderMarkdown) {
  const rulesInput = document.getElementById("settingsRulesInput");
  const preview = document.getElementById("settingsRulesPreview");
  if (!preview) return;
  preview.innerHTML = DOMPurify.sanitize(renderMarkdown(rulesInput?.value || ""));
}

export function extractRoundRobinSettings(scope, defaultRoundRobinSettings) {
  const ids =
    scope === "settings"
      ? {
          groups: "settingsRoundRobinGroups",
          advance: "settingsRoundRobinAdvance",
          playoffs: "settingsRoundRobinPlayoffs",
          bestOf: "settingsRoundRobinBestOf",
        }
      : scope === "final"
      ? {
          groups: "finalRoundRobinGroupsInput",
          advance: "finalRoundRobinAdvanceInput",
          playoffs: "finalRoundRobinPlayoffsSelect",
          bestOf: "finalRoundRobinBestOfInput",
        }
      : {
          groups: "roundRobinGroupsInput",
          advance: "roundRobinAdvanceInput",
          playoffs: "roundRobinPlayoffsSelect",
          bestOf: "roundRobinBestOfInput",
        };

  const groupsVal = Number(
    document.getElementById(ids.groups)?.value ||
      defaultRoundRobinSettings.groups
  );
  const advanceVal = Number(
    document.getElementById(ids.advance)?.value ||
      defaultRoundRobinSettings.advancePerGroup
  );
  const playoffsVal =
    document.getElementById(ids.playoffs)?.value ||
    defaultRoundRobinSettings.playoffs;
  const bestOfVal = Number(
    document.getElementById(ids.bestOf)?.value || defaultRoundRobinSettings.bestOf
  );

  return normalizeRoundRobinSettings({
    groups: groupsVal,
    advancePerGroup: advanceVal,
    playoffs: playoffsVal,
    bestOf: bestOfVal,
  });
}
