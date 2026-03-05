import { showToast } from "../toastHandler.js";
import { defaultBestOf, defaultRoundRobinSettings } from "./state.js";
import { readBestOf } from "./tournamentPayloads.js";
import { extractRoundRobinSettings, syncFormatFieldVisibility } from "./settings/ui.js";
import { slugify } from "./slugs.js";
import { syncMarkdownSurfaceForInput } from "./markdownEditor.js";
import { auth } from "../../../app.js";
import { loadTournamentRegistry } from "./sync/persistence.js";

const TOURNAMENT_TEMPLATE_STORAGE_KEY = "zbo:tournamentTemplates:v1";
const TOURNAMENT_COPY_SOURCE_LIMIT = 24;
let tournamentTemplates = loadTournamentTemplates();

function loadTournamentTemplates() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TOURNAMENT_TEMPLATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load tournament templates", err);
    return [];
  }
}

function persistTournamentTemplates(nextTemplates) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TOURNAMENT_TEMPLATE_STORAGE_KEY,
      JSON.stringify(nextTemplates || [])
    );
  } catch (err) {
    console.warn("Failed to save tournament templates", err);
  }
}

function getTournamentTemplates() {
  return Array.isArray(tournamentTemplates) ? [...tournamentTemplates] : [];
}

function saveTournamentTemplate(template) {
  if (!template || !template.name) return null;
  const now = Date.now();
  const existingIndex = tournamentTemplates.findIndex(
    (item) => item.id === template.id
  );
  const existing =
    existingIndex >= 0 ? tournamentTemplates[existingIndex] : null;
  const existingIds = new Set(tournamentTemplates.map((item) => item.id).filter(Boolean));
  const nextId = template.id || buildUniqueTemplateId(template.name, existingIds, now);
  const savedTemplate = {
    ...template,
    id: nextId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (existingIndex >= 0) {
    tournamentTemplates.splice(existingIndex, 1, savedTemplate);
  } else {
    tournamentTemplates.unshift(savedTemplate);
  }
  persistTournamentTemplates(tournamentTemplates);
  return savedTemplate;
}

function buildUniqueTemplateId(name, existingIds, now) {
  const baseSlug = slugify(name) || `tpl-${now.toString(36)}`;
  let candidate = baseSlug;
  let counter = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function deleteTournamentTemplate(templateId) {
  if (!templateId) return false;
  const nextTemplates = tournamentTemplates.filter(
    (template) => template.id !== templateId
  );
  const changed = nextTemplates.length !== tournamentTemplates.length;
  if (changed) {
    tournamentTemplates = nextTemplates;
    persistTournamentTemplates(tournamentTemplates);
  }
  return changed;
}

function getCheckInWindowMinutes(selectInput) {
  const minutes = Number(selectInput?.value || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function normalizeTournamentVisibility(value) {
  return String(value || "public").toLowerCase() === "private"
    ? "private"
    : "public";
}

function getTournamentSortTimestamp(meta) {
  const startTime = Number(meta?.startTime);
  if (Number.isFinite(startTime) && startTime > 0) return startTime;
  const updatedAt = Number(meta?.updatedAt);
  if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
  const createdAt = Number(meta?.createdAt);
  if (Number.isFinite(createdAt) && createdAt > 0) return createdAt;
  return 0;
}

function pickRecentTournamentsForCopy(registry, uid) {
  const all = Array.isArray(registry)
    ? registry.filter((item) => item && (item.slug || item.id))
    : [];
  if (!all.length) return [];
  const owned = uid ? all.filter((item) => item.createdBy === uid) : [];
  const source = owned.length ? owned : all;
  return source
    .slice()
    .sort((a, b) => {
      const diff = getTournamentSortTimestamp(b) - getTournamentSortTimestamp(a);
      if (diff) return diff;
      return String(a.name || a.slug || "").localeCompare(
        String(b.name || b.slug || ""),
      );
    })
    .slice(0, TOURNAMENT_COPY_SOURCE_LIMIT);
}

function pickRecentTournamentsByCircuit(registry, circuitSlug) {
  const all = Array.isArray(registry)
    ? registry.filter((item) => item && (item.slug || item.id))
    : [];
  if (!all.length || !circuitSlug) return [];
  return all
    .filter((item) => String(item.circuitSlug || "") === String(circuitSlug))
    .sort((a, b) => {
      const diff = getTournamentSortTimestamp(b) - getTournamentSortTimestamp(a);
      if (diff) return diff;
      return String(a.name || a.slug || "").localeCompare(
        String(b.name || b.slug || ""),
      );
    })
    .slice(0, TOURNAMENT_COPY_SOURCE_LIMIT);
}

function buildTournamentCopyGroups(registry, uid, circuitSlug) {
  const recent = pickRecentTournamentsForCopy(registry, uid);
  if (!circuitSlug) {
    return recent.length
      ? [{ label: "Recent tournaments", items: recent }]
      : [];
  }
  const circuitRecent = pickRecentTournamentsByCircuit(registry, circuitSlug);
  const circuitIds = new Set(
    circuitRecent.map((item) => item.slug || item.id).filter(Boolean),
  );
  const remainingRecent = recent.filter(
    (item) => !circuitIds.has(item.slug || item.id),
  );
  const groups = [];
  if (circuitRecent.length) {
    groups.push({ label: "This circuit", items: circuitRecent });
  }
  if (remainingRecent.length) {
    groups.push({
      label: circuitRecent.length ? "Other recent tournaments" : "Recent tournaments",
      items: remainingRecent,
    });
  }
  return groups;
}

function formatTournamentCopyOptionLabel(meta) {
  const name = meta?.name || meta?.slug || "Untitled tournament";
  const format = meta?.format || "Format";
  const timestamp = getTournamentSortTimestamp(meta);
  if (!timestamp) return `${name} - ${format}`;
  const dateLabel = new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${name} - ${format} - ${dateLabel}`;
}

function buildTemplateSettingsFromTournament(meta) {
  return {
    mode: (meta?.mode || "1v1").trim(),
    format: (meta?.format || "Double Elimination").trim(),
    maxPlayers: Number.isFinite(meta?.maxPlayers) ? Number(meta.maxPlayers) : null,
    checkInWindowMinutes: Number(meta?.checkInWindowMinutes) > 0
      ? Number(meta.checkInWindowMinutes)
      : 0,
    allowCheckInAfterStart: Boolean(meta?.allowCheckInAfterStart),
    isInviteOnly: Boolean(meta?.isInviteOnly),
    visibility: normalizeTournamentVisibility(meta?.visibility),
    description: meta?.description || "",
    rules: meta?.rules || "",
    roundRobin: {
      ...defaultRoundRobinSettings,
      ...(meta?.roundRobin || {}),
    },
    bestOf: {
      ...defaultBestOf,
      ...(meta?.bestOf || {}),
    },
    grandFinalReset: Boolean(meta?.grandFinalReset),
    mapPool: Array.isArray(meta?.mapPool) ? meta.mapPool : [],
  };
}

function readTournamentTemplateForm(mapPoolSelection) {
  const nameInput = document.getElementById("tournamentTemplateNameInput");
  const modeSelect = document.getElementById("tournamentModeSelect");
  const formatSelect = document.getElementById("tournamentFormatSelect");
  const maxPlayersInput = document.getElementById("tournamentMaxPlayersInput");
  const checkInSelect = document.getElementById("checkInSelect");
  const checkInAfterStartToggle = document.getElementById(
    "checkInAfterStartToggle"
  );
  const accessSelect = document.getElementById("tournamentAccessSelect");
  const visibilitySelect = document.getElementById("tournamentVisibilitySelect");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const grandFinalResetToggle = document.getElementById(
    "grandFinalResetToggle",
  );
  const name = (nameInput?.value || "").trim();
  if (!name) {
    showToast?.("Template name is required.", "error");
    return null;
  }
  const id = nameInput?.dataset.templateId || "";
  const mode = (modeSelect?.value || "1v1").trim();
  const format = (formatSelect?.value || "Double Elimination").trim();
  const maxPlayers = maxPlayersInput?.value
    ? Number(maxPlayersInput.value)
    : null;
  const checkInWindowMinutes = getCheckInWindowMinutes(checkInSelect);
  const allowCheckInAfterStart = Boolean(checkInAfterStartToggle?.checked);
  const isInviteOnly = accessSelect?.value === "closed";
  const visibility = normalizeTournamentVisibility(visibilitySelect?.value);
  const description = descriptionInput?.value || "";
  const rules = rulesInput?.value || "";
  const rrSettings = extractRoundRobinSettings(
    "create",
    defaultRoundRobinSettings
  );
  const bestOf = readBestOf("create", defaultBestOf);
  const grandFinalReset = Boolean(grandFinalResetToggle?.checked);
  const mapPool = Array.from(mapPoolSelection || []);
  return {
    id,
    name,
    settings: {
      mode,
      format,
      maxPlayers,
      checkInWindowMinutes,
      allowCheckInAfterStart,
      isInviteOnly,
      visibility,
      description,
      rules,
      roundRobin: rrSettings,
      bestOf,
      grandFinalReset,
      mapPool,
    },
  };
}

function applyTournamentTemplate(template, setMapPoolSelection) {
  if (!template?.settings) return;
  const settings = template.settings;
  const modeSelect = document.getElementById("tournamentModeSelect");
  const formatSelect = document.getElementById("tournamentFormatSelect");
  const maxPlayersInput = document.getElementById("tournamentMaxPlayersInput");
  const checkInSelect = document.getElementById("checkInSelect");
  const checkInAfterStartToggle = document.getElementById(
    "checkInAfterStartToggle"
  );
  const accessSelect = document.getElementById("tournamentAccessSelect");
  const visibilitySelect = document.getElementById("tournamentVisibilitySelect");
  const descriptionInput = document.getElementById("tournamentDescriptionInput");
  const rulesInput = document.getElementById("tournamentRulesInput");
  const rrGroupsInput = document.getElementById("roundRobinGroupsInput");
  const rrAdvanceInput = document.getElementById("roundRobinAdvanceInput");
  const rrPlayoffsSelect = document.getElementById("roundRobinPlayoffsSelect");
  const rrBestOfInput = document.getElementById("roundRobinBestOfInput");
  const grandFinalResetToggle = document.getElementById(
    "grandFinalResetToggle",
  );

  if (modeSelect) modeSelect.value = settings.mode || "1v1";
  if (formatSelect) formatSelect.value = settings.format || "Double Elimination";
  syncFormatFieldVisibility("create");

  if (maxPlayersInput) {
    maxPlayersInput.value =
      Number.isFinite(settings.maxPlayers) ? settings.maxPlayers : "";
  }
  if (checkInSelect) {
    checkInSelect.value = String(settings.checkInWindowMinutes || 0);
  }
  if (checkInAfterStartToggle) {
    checkInAfterStartToggle.checked = Boolean(
      settings.allowCheckInAfterStart
    );
  }
  if (accessSelect) {
    accessSelect.value = settings.isInviteOnly ? "closed" : "open";
  }
  if (visibilitySelect) {
    visibilitySelect.value = normalizeTournamentVisibility(settings.visibility);
  }
  if (descriptionInput) descriptionInput.value = settings.description || "";
  if (rulesInput) rulesInput.value = settings.rules || "";
  syncMarkdownSurfaceForInput(descriptionInput);
  syncMarkdownSurfaceForInput(rulesInput);

  const roundRobin = settings.roundRobin || defaultRoundRobinSettings;
  if (rrGroupsInput) rrGroupsInput.value = roundRobin.groups ?? "";
  if (rrAdvanceInput)
    rrAdvanceInput.value = roundRobin.advancePerGroup ?? "";
  if (rrPlayoffsSelect)
    rrPlayoffsSelect.value = roundRobin.playoffs || "None";
  if (rrBestOfInput) rrBestOfInput.value = roundRobin.bestOf ?? "";

  const bestOf = { ...defaultBestOf, ...(settings.bestOf || {}) };
  const setBestOf = (id, value) => {
    const input = document.getElementById(id);
    if (input && Number.isFinite(value)) {
      input.value = String(value);
    }
  };
  setBestOf("bestOfUpperInput", bestOf.upper);
  setBestOf("bestOfLowerInput", bestOf.lower);
  setBestOf("bestOfLowerSemiInput", bestOf.lowerSemi);
  setBestOf("bestOfLowerFinalInput", bestOf.lowerFinal);
  setBestOf("bestOfQuarterInput", bestOf.quarter);
  setBestOf("bestOfSemiInput", bestOf.semi);
  setBestOf("bestOfUpperFinalInput", bestOf.upperFinal);
  setBestOf("bestOfFinalInput", bestOf.final);

  if (grandFinalResetToggle) {
    grandFinalResetToggle.checked = Boolean(settings.grandFinalReset);
  }

  if (Array.isArray(settings.mapPool)) {
    setMapPoolSelection?.(settings.mapPool);
  }

  descriptionInput?.dispatchEvent(new Event("input", { bubbles: true }));
  rulesInput?.dispatchEvent(new Event("input", { bubbles: true }));
}

export function initTournamentTemplateManager({
  mapPoolSelection,
  setMapPoolSelection,
  setModalVisible,
}) {
  const DRAFT_TEMPLATE_ID = "__draft__";
  const createModal = document.getElementById("createTournamentModal");
  const createModalContent = createModal?.querySelector(".modal-content");
  const createModalTitle = createModalContent?.querySelector(".modal-title-row h3");
  const originalCreateTitle = createModalTitle?.textContent || "Create tournament";
  const saveTournamentTemplateBtn = document.getElementById("saveTournamentTemplateBtn");
  const templateSelect = document.getElementById("tournamentTemplateSelect");
  const templateNameInput = document.getElementById("tournamentTemplateNameInput");
  const templateModal = document.getElementById("tournamentTemplateModal");
  const templateMain = document.getElementById("tournamentTemplateMain");
  const templateList = document.getElementById("tournamentTemplateList");
  const templateEmpty = document.getElementById("tournamentTemplateEmpty");
  const templateDeleteBtn = document.getElementById("deleteTournamentTemplateBtn");
  const templateNewBtn = document.getElementById("newTournamentTemplateBtn");
  const templateCloseBtn = document.getElementById("closeTournamentTemplateModal");
  const copyTournamentSelect = document.getElementById("copyTournamentSettingsSelect");
  const copyTournamentBtn = document.getElementById("copyTournamentSettingsBtn");
  let activeTemplateId = "";
  let lastTemplateSelection = "";
  let recentTournamentCopyOptions = [];
  let copyOptionsRequestId = 0;

  const ensureCreateModalHome = () => {
    if (!createModal || !createModalContent) return;
    if (createModalContent.parentElement !== createModal) {
      createModal.appendChild(createModalContent);
    }
  };

  const setTemplateManagerMode = (enabled) => {
    if (createModalContent) {
      createModalContent.classList.toggle("template-manager-mode", enabled);
    }
    if (createModalTitle) {
      createModalTitle.textContent = enabled ? "Template settings" : originalCreateTitle;
    }
  };

  const refreshTemplateSelect = (templates) => {
    if (!templateSelect) return;
    const currentValue = templateSelect.value;
    templateSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Template";
    placeholder.selected = true;
    templateSelect.appendChild(placeholder);
    const managerOption = document.createElement("option");
    managerOption.value = "__manager__";
    managerOption.textContent = "Template manager...";
    templateSelect.appendChild(managerOption);
    if (templates.length) {
      const divider = document.createElement("option");
      divider.disabled = true;
      divider.textContent = "--------";
      templateSelect.appendChild(divider);
    }
    templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });
    if (
      currentValue &&
      currentValue !== "__manager__" &&
      templateSelect.querySelector(`option[value="${currentValue}"]`)
    ) {
      templateSelect.value = currentValue;
    } else if (lastTemplateSelection) {
      templateSelect.value = lastTemplateSelection;
    }
  };

  const getDraftTemplate = () => {
    if (activeTemplateId !== DRAFT_TEMPLATE_ID) return null;
    const name = (templateNameInput?.value || "").trim() || "New template";
    return {
      id: DRAFT_TEMPLATE_ID,
      name,
      settings: { format: "Draft" },
    };
  };

  const renderTemplateList = (templates) => {
    if (!templateList) return;
    templateList.innerHTML = "";
    const draft = getDraftTemplate();
    const hasTemplates = Array.isArray(templates) && templates.length > 0;
    const hasAnyTemplates = hasTemplates || Boolean(draft);
    if (templateEmpty) templateEmpty.style.display = hasAnyTemplates ? "none" : "block";
    if (draft) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `template-manager-item${
        activeTemplateId === DRAFT_TEMPLATE_ID ? " is-active" : ""
      }`;
      const title = document.createElement("span");
      title.className = "template-manager-item-title";
      title.textContent = draft.name || "New template";
      const meta = document.createElement("span");
      meta.className = "template-manager-item-meta";
      meta.textContent = "Draft";
      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener("click", () => {
        activeTemplateId = DRAFT_TEMPLATE_ID;
        renderTemplateList(getTournamentTemplates());
      });
      templateList.appendChild(item);
    }
    if (!hasTemplates) return;
    templates.forEach((template) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `template-manager-item${
        template.id === activeTemplateId ? " is-active" : ""
      }`;
      const title = document.createElement("span");
      title.className = "template-manager-item-title";
      title.textContent = template.name || "Untitled template";
      const meta = document.createElement("span");
      meta.className = "template-manager-item-meta";
      meta.textContent = template.settings?.format || "Format";
      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener("click", () => {
        activeTemplateId = template.id;
        if (templateNameInput) {
          templateNameInput.value = template.name || "";
          if (template.id) {
            templateNameInput.dataset.templateId = template.id;
          } else {
            delete templateNameInput.dataset.templateId;
          }
        }
        applyTournamentTemplate(template, setMapPoolSelection);
        if (templateSelect) templateSelect.value = template.id || "";
        renderTemplateList(getTournamentTemplates());
      });
      templateList.appendChild(item);
    });
  };

  const refreshTemplateUI = () => {
    const templates = getTournamentTemplates();
    refreshTemplateSelect(templates);
    renderTemplateList(templates);
  };

  const renderCopyTournamentOptions = (groups) => {
    if (!copyTournamentSelect) return;
    const currentValue = copyTournamentSelect.value;
    const nextOptionMap = new Map();
    copyTournamentSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    const hasItems = Array.isArray(groups)
      ? groups.some((group) => Array.isArray(group?.items) && group.items.length > 0)
      : false;
    placeholder.textContent = hasItems
      ? "Choose a tournament..."
      : "No tournaments available";
    placeholder.selected = true;
    copyTournamentSelect.appendChild(placeholder);
    (groups || []).forEach((group) => {
      const entries = Array.isArray(group?.items) ? group.items : [];
      if (!entries.length) return;
      const optGroup = document.createElement("optgroup");
      optGroup.label = group?.label || "Recent tournaments";
      entries.forEach((item) => {
        const optionValue = item.slug || item.id || "";
        if (!optionValue || nextOptionMap.has(optionValue)) return;
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = formatTournamentCopyOptionLabel(item);
        optGroup.appendChild(option);
        nextOptionMap.set(optionValue, item);
      });
      if (optGroup.children.length > 0) {
        copyTournamentSelect.appendChild(optGroup);
      }
    });
    recentTournamentCopyOptions = Array.from(nextOptionMap.values());
    const hasCurrent = Array.from(copyTournamentSelect.options).some(
      (option) => option.value === currentValue,
    );
    if (hasCurrent) {
      copyTournamentSelect.value = currentValue;
    }
    const disabled = !hasItems;
    copyTournamentSelect.disabled = disabled;
    if (copyTournamentBtn) {
      copyTournamentBtn.disabled = disabled || !copyTournamentSelect.value;
    }
  };

  const refreshCopyTournamentOptions = async () => {
    if (!copyTournamentSelect) return;
    const requestId = ++copyOptionsRequestId;
    copyTournamentSelect.innerHTML = "";
    const loading = document.createElement("option");
    loading.value = "";
    loading.textContent = "Loading tournaments...";
    loading.selected = true;
    copyTournamentSelect.appendChild(loading);
    copyTournamentSelect.disabled = true;
    if (copyTournamentBtn) copyTournamentBtn.disabled = true;
    try {
      const registry = await loadTournamentRegistry(true);
      if (requestId !== copyOptionsRequestId) return;
      const uid = auth?.currentUser?.uid || "";
      const circuitSlug = (createModal?.dataset?.circuitSlug || "").trim();
      const groups = buildTournamentCopyGroups(registry, uid, circuitSlug);
      renderCopyTournamentOptions(groups);
    } catch (err) {
      if (requestId !== copyOptionsRequestId) return;
      recentTournamentCopyOptions = [];
      renderCopyTournamentOptions([]);
      console.warn("Failed to load tournaments for template copy", err);
    }
  };

  const openTemplateManager = () => {
    if (!templateModal || !templateMain || !createModalContent) return;
    if (createModalContent.parentElement !== templateMain) {
      templateMain.appendChild(createModalContent);
    }
    if (templateSelect?.value) {
      activeTemplateId = templateSelect.value === "__manager__" ? "" : templateSelect.value;
    }
    if (activeTemplateId) {
      lastTemplateSelection = activeTemplateId;
    }
    setTemplateManagerMode(true);
    setModalVisible?.(createModal, false);
    refreshTemplateUI();
    const templates = getTournamentTemplates();
    const activeTemplate = templates.find((template) => template.id === activeTemplateId);
    if (templateNameInput) {
      templateNameInput.value = activeTemplate?.name || "";
      if (activeTemplate?.id) {
        templateNameInput.dataset.templateId = activeTemplate.id;
      } else {
        delete templateNameInput.dataset.templateId;
      }
    }
    void refreshCopyTournamentOptions();
    setModalVisible?.(templateModal, true);
  };

  const closeTemplateManager = (reopenCreate = true) => {
    if (!templateModal) return;
    ensureCreateModalHome();
    setTemplateManagerMode(false);
    setModalVisible?.(templateModal, false);
    if (reopenCreate && createModal) {
      setModalVisible?.(createModal, true);
    }
  };

  saveTournamentTemplateBtn?.addEventListener("click", () => {
    const template = readTournamentTemplateForm(mapPoolSelection);
    if (!template) return;
    const saved = saveTournamentTemplate(template);
    if (!saved) return;
    showToast?.("Template saved.", "success");
    activeTemplateId = saved.id;
    lastTemplateSelection = saved.id;
    if (templateNameInput) {
      templateNameInput.value = saved.name || "";
      if (saved.id) templateNameInput.dataset.templateId = saved.id;
    }
    refreshTemplateUI();
  });
  templateNewBtn?.addEventListener("click", () => {
    activeTemplateId = DRAFT_TEMPLATE_ID;
    lastTemplateSelection = "";
    if (templateNameInput) {
      templateNameInput.value = "";
      delete templateNameInput.dataset.templateId;
    }
    renderTemplateList(getTournamentTemplates());
  });
  templateDeleteBtn?.addEventListener("click", () => {
    const templateId = templateNameInput?.dataset.templateId || activeTemplateId;
    if (!templateId) return;
    if (deleteTournamentTemplate(templateId)) {
      activeTemplateId = "";
      if (templateNameInput) {
        templateNameInput.value = "";
        delete templateNameInput.dataset.templateId;
      }
      refreshTemplateUI();
    }
  });
  templateCloseBtn?.addEventListener("click", () => {
    closeTemplateManager();
  });
  copyTournamentSelect?.addEventListener("change", () => {
    if (!copyTournamentBtn) return;
    copyTournamentBtn.disabled =
      copyTournamentSelect.disabled || !copyTournamentSelect.value;
  });
  copyTournamentBtn?.addEventListener("click", () => {
    const selectedId = copyTournamentSelect?.value || "";
    if (!selectedId) {
      showToast?.("Select a tournament to copy from.", "info");
      return;
    }
    const source = recentTournamentCopyOptions.find(
      (item) => (item.slug || item.id || "") === selectedId,
    );
    if (!source) {
      showToast?.("Could not find that tournament settings.", "error");
      return;
    }
    applyTournamentTemplate(
      {
        id: "",
        name: source.name || "Copied tournament",
        settings: buildTemplateSettingsFromTournament(source),
      },
      setMapPoolSelection,
    );
    activeTemplateId = DRAFT_TEMPLATE_ID;
    lastTemplateSelection = "";
    if (templateSelect) templateSelect.value = "";
    if (templateNameInput) {
      delete templateNameInput.dataset.templateId;
      if (!templateNameInput.value.trim()) {
        templateNameInput.value = `${source.name || "Tournament"} template`;
      }
    }
    renderTemplateList(getTournamentTemplates());
    showToast?.("Tournament settings copied.", "success");
  });
  templateSelect?.addEventListener("change", () => {
    if (!templateSelect) return;
    const selection = templateSelect.value;
    if (selection === "__manager__") {
      if (lastTemplateSelection) {
        templateSelect.value = lastTemplateSelection;
      } else {
        templateSelect.selectedIndex = 0;
      }
      openTemplateManager();
      return;
    }
    if (!selection) {
      activeTemplateId = "";
      return;
    }
    const templates = getTournamentTemplates();
    const template = templates.find((item) => item.id === selection);
    if (!template) return;
    activeTemplateId = template.id;
    lastTemplateSelection = template.id;
    applyTournamentTemplate(template, setMapPoolSelection);
  });
  templateNameInput?.addEventListener("input", () => {
    if (!activeTemplateId) return;
    renderTemplateList(getTournamentTemplates());
  });
  window.addEventListener("mousedown", (event) => {
    if (templateModal && templateModal.style.display === "flex" && event.target === templateModal) {
      closeTemplateManager();
    }
  });

  return {
    ensureCreateModalHome,
    setTemplateManagerMode,
    refreshTemplateUI,
    closeTemplateManager,
    openTemplateManager,
    isTemplateManagerOpen: () => templateModal?.style.display === "flex",
  };
}
