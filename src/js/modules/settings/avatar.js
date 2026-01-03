import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { showToast } from "../toastHandler.js";

const DEFAULT_AVATAR_URL = "img/avatar/marine_avatar_1.webp";
const AVATAR_MANIFEST_URL = "img/avatar/avatars.json";
const FALLBACK_AVATAR_OPTIONS = [
  "img/avatar/marine_avatar_1.webp",
  "img/avatar/protoss_avatar_1.webp",
  "img/avatar/zergling_avatar_1.webp",
];

let currentUserAvatarUrl = DEFAULT_AVATAR_URL;
let avatarOptionsCache = null;
let avatarModalInitialized = false;
let lastFocusedBeforeAvatarModal = null;
let closeUserMenuHandler = null;

const avatarModalElements = {
  changeBtn: null,
  modal: null,
  grid: null,
  closeBtn: null,
};

function sanitizeAvatarUrl(url) {
  if (typeof url !== "string") return DEFAULT_AVATAR_URL;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_AVATAR_URL;
  const lower = trimmed.toLowerCase();
  const allowedStarts = [
    "http://",
    "https://",
    "data:image",
    "img/",
    "/img/",
    "./img/",
  ];
  if (allowedStarts.some((prefix) => lower.startsWith(prefix))) {
    return trimmed.replace(/^\.\//, "");
  }
  return trimmed.endsWith(".webp")
    ? `img/avatar/${trimmed}`
    : DEFAULT_AVATAR_URL;
}

function emitAvatarUpdate(avatarUrl) {
  const sanitized = sanitizeAvatarUrl(avatarUrl);
  const settingsPreview = document.getElementById("settingsCurrentAvatar");
  if (settingsPreview) {
    settingsPreview.src = sanitized;
  }
  const buttonPreview = document.getElementById("settingsAvatarButtonImage");
  if (buttonPreview) {
    buttonPreview.src = sanitized;
  }

  window.dispatchEvent(
    new CustomEvent("user-avatar-updated", { detail: { avatarUrl: sanitized } })
  );
}

async function loadAvatarOptions() {
  if (Array.isArray(avatarOptionsCache) && avatarOptionsCache.length) {
    return avatarOptionsCache;
  }

  const options = new Set([DEFAULT_AVATAR_URL]);

  try {
    const response = await fetch(AVATAR_MANIFEST_URL, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload)) {
        payload.forEach((entry) => {
          if (typeof entry !== "string") return;
          const sanitized = sanitizeAvatarUrl(entry);
          if (sanitized) options.add(sanitized);
        });
      }
    }
  } catch (error) {
    console.warn(
      "Failed to load avatar manifest, using fallback avatars.",
      error
    );
  }

  FALLBACK_AVATAR_OPTIONS.forEach((fallback) => {
    const sanitized = sanitizeAvatarUrl(fallback);
    if (sanitized) options.add(sanitized);
  });

  avatarOptionsCache = Array.from(options);
  return avatarOptionsCache;
}

function updateAvatarSelectionHighlight(selectedUrl) {
  const grid = avatarModalElements.grid;
  if (!grid) return;

  const sanitizedSelected = sanitizeAvatarUrl(selectedUrl);

  grid.querySelectorAll(".avatar-option").forEach((button) => {
    const isSelected = button.dataset.avatar === sanitizedSelected;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

async function populateAvatarGrid() {
  const grid = avatarModalElements.grid;
  if (!grid) return;

  const avatars = await loadAvatarOptions();
  grid.innerHTML = "";

  avatars.forEach((avatarUrl) => {
    const sanitized = sanitizeAvatarUrl(avatarUrl);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "avatar-option";
    button.dataset.avatar = sanitized;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Select avatar");

    const img = document.createElement("img");
    img.src = sanitized;
    img.alt = "Avatar option";
    img.loading = "lazy";

    button.appendChild(img);
    button.addEventListener("click", () => handleAvatarSelection(sanitized));
    grid.appendChild(button);
  });

  updateAvatarSelectionHighlight(currentUserAvatarUrl);
}

async function openAvatarModal() {
  if (!avatarModalInitialized) return;
  if (!auth.currentUser) {
    showToast("Sign in to change your avatar.", "info");
    return;
  }

  if (typeof closeUserMenuHandler === "function") {
    closeUserMenuHandler();
  }
  await populateAvatarGrid();

  const modal = avatarModalElements.modal;
  if (!modal) return;

  lastFocusedBeforeAvatarModal = document.activeElement;
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");

  const focusTarget =
    avatarModalElements.closeBtn ||
    modal.querySelector(".avatar-option") ||
    modal;
  if (focusTarget && typeof focusTarget.focus === "function") {
    focusTarget.focus();
  }
}

function closeAvatarModal() {
  const modal = avatarModalElements.modal;
  if (!modal) return;

  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  if (
    lastFocusedBeforeAvatarModal &&
    typeof lastFocusedBeforeAvatarModal.focus === "function"
  ) {
    lastFocusedBeforeAvatarModal.focus();
  }
  lastFocusedBeforeAvatarModal = null;
}

async function handleAvatarSelection(avatarUrl) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Sign in to change your avatar.", "info");
    return;
  }

  const sanitized = sanitizeAvatarUrl(avatarUrl);
  if (!sanitized) return;

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      { profile: { avatarUrl: sanitized } },
      { merge: true }
    );

    currentUserAvatarUrl = sanitized;
    updateAvatarSelectionHighlight(sanitized);

    if (auth.currentUser) {
      auth.currentUser.photoURL = sanitized;
    }

    const userPhotoEl = document.getElementById("userPhoto");
    if (userPhotoEl) {
      userPhotoEl.src = sanitized;
    }

    emitAvatarUpdate(sanitized);
    showToast("Avatar updated!", "success");
    closeAvatarModal();
  } catch (error) {
    console.error("Failed to update avatar:", error);
    showToast("Failed to update avatar. Please try again.", "error");
  }
}

function resolveUserAvatar(userData) {
  const profileAvatar = userData?.profile?.avatarUrl;
  if (profileAvatar) return profileAvatar;
  return "img/default-avatar.webp";
}

function setupAvatarModal({ closeUserMenu } = {}) {
  if (closeUserMenu) {
    closeUserMenuHandler = closeUserMenu;
  }
  if (avatarModalInitialized) {
    updateAvatarSelectionHighlight(currentUserAvatarUrl);
    return;
  }

  const changeBtn = document.getElementById("changeAvatarBtn");
  const modal = document.getElementById("avatarModal");
  const grid = document.getElementById("avatarGrid");
  const closeBtn = document.getElementById("closeAvatarModal");

  if (!changeBtn || !modal || !grid || !closeBtn) {
    return;
  }

  avatarModalElements.changeBtn = changeBtn;
  avatarModalElements.modal = modal;
  avatarModalElements.grid = grid;
  avatarModalElements.closeBtn = closeBtn;

  changeBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await openAvatarModal();
  });

  closeBtn.addEventListener("click", closeAvatarModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAvatarModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.style.display === "block") {
      closeAvatarModal();
    }
  });

  avatarModalInitialized = true;
}

function getCurrentUserAvatarUrl() {
  return currentUserAvatarUrl;
}

function setCurrentUserAvatarUrl(url) {
  currentUserAvatarUrl = sanitizeAvatarUrl(url);
}

export {
  DEFAULT_AVATAR_URL,
  emitAvatarUpdate,
  closeAvatarModal,
  getCurrentUserAvatarUrl,
  resolveUserAvatar,
  setCurrentUserAvatarUrl,
  setupAvatarModal,
  updateAvatarSelectionHighlight,
};
