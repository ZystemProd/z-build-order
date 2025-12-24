import { auth } from "../../app.js";
import {
  isBracketInputEnabled,
  setBracketInputEnabled,
  isBuildInputShown,
  setBuildInputShown,
  getMainClanId,
  setMainClanId,
  loadUserSettings,
} from "./settings.js";
import { getUserClans } from "./clan.js";

let settingsModalInitialized = false;

export function initUserSettingsModal(options = {}) {
  if (settingsModalInitialized) return;

  const {
    onBracketToggleChange = null,
    onBuildToggleChange = null,
    autoOpenFlag = "openSettingsOnLoad",
  } = options;

  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  const settingsBtn = document.getElementById("settingsBtn");
  const closeBtn = document.getElementById("closeSettingsModal");
  const bracketToggle = document.getElementById("bracketInputToggle");
  const buildToggle = document.getElementById("buildInputToggle");
  const mainClanSelect = document.getElementById("mainClanSelect");
  const tabButtons = modal.querySelectorAll("[data-user-settings-tab]");
  const tabPanels = modal.querySelectorAll(".settings-panel");

  const setActiveTab = (targetId) => {
    if (!targetId) return;
    tabButtons.forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.userSettingsTab === targetId
      );
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === targetId);
    });
  };

  const syncToggles = () => {
    if (bracketToggle) {
      bracketToggle.checked = isBracketInputEnabled();
    }
    if (buildToggle) {
      buildToggle.checked = isBuildInputShown();
    }
  };

  const syncAvatarPreview = () => {
    const preview = document.getElementById("settingsCurrentAvatar");
    const buttonPreview = document.getElementById("settingsAvatarButtonImage");
    const userPhoto = document.getElementById("userPhoto");
    const src =
      userPhoto?.src || preview?.src || buttonPreview?.src || "img/SVG/user-svgrepo-com.svg";
    if (preview && src) {
      preview.src = src;
    }
    if (buttonPreview && src) {
      buttonPreview.src = src;
    }
  };

  const populateMainClanDropdown = async () => {
    if (!mainClanSelect) return;

    mainClanSelect.innerHTML = "";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "None";
    mainClanSelect.appendChild(noneOpt);

    if (!auth.currentUser) {
      mainClanSelect.disabled = true;
      mainClanSelect.value = "";
      return;
    }

    mainClanSelect.disabled = false;

    try {
      const clans = await getUserClans(auth.currentUser.uid);
      clans.forEach((clan) => {
      const opt = document.createElement("option");
      opt.value = clan.id;
      opt.textContent = clan.name;
      if (clan.abbreviation) {
        opt.dataset.abbr = clan.abbreviation;
      }
      mainClanSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load user clans", err);
    }

    const saved = getMainClanId();
    const hasSaved = Array.from(mainClanSelect.options).some(
      (opt) => opt.value === saved
    );
    mainClanSelect.value = hasSaved ? saved : "";
  };

  const hideModal = () => {
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
  };

  const showModal = async () => {
    modal.style.display = "block";
    document.body.classList.add("modal-open");
    await loadUserSettings();
    await populateMainClanDropdown();
    syncToggles();
    syncAvatarPreview();
    if (tabButtons.length) {
      setActiveTab(tabButtons[0].dataset.userSettingsTab);
    }
  };

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      const userMenu = document.getElementById("userMenu");
      if (userMenu) userMenu.style.display = "none";
      void showModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", hideModal);
  }

  window.addEventListener("mousedown", (event) => {
    if (event.target === modal) {
      hideModal();
    }
  });

  window.addEventListener("user-avatar-updated", syncAvatarPreview);
  syncAvatarPreview();

  if (bracketToggle) {
    bracketToggle.checked = isBracketInputEnabled();
    bracketToggle.addEventListener("change", () => {
      setBracketInputEnabled(bracketToggle.checked);
      if (typeof onBracketToggleChange === "function") {
        onBracketToggleChange(bracketToggle.checked);
      }
    });
  }

  if (buildToggle) {
    buildToggle.checked = isBuildInputShown();
    buildToggle.addEventListener("change", () => {
      setBuildInputShown(buildToggle.checked);
      if (typeof onBuildToggleChange === "function") {
        onBuildToggleChange(buildToggle.checked);
      }
    });
  }

  if (mainClanSelect) {
    mainClanSelect.addEventListener("change", () => {
      setMainClanId(mainClanSelect.value);
    });
  }

  if (tabButtons.length) {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.userSettingsTab);
      });
    });
  }

  auth.onAuthStateChanged(async () => {
    await loadUserSettings();
    await populateMainClanDropdown();
    syncToggles();
  });

  // Optional auto-open flag used by other pages to open settings on arrival
  try {
    const shouldOpen = localStorage.getItem(autoOpenFlag) === "true";
    if (shouldOpen) {
      localStorage.removeItem(autoOpenFlag);
      void showModal();
    }
  } catch {
    /* ignore */
  }

  settingsModalInitialized = true;
}
