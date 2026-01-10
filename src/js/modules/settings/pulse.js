import {
  deleteField,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { showToast } from "../toastHandler.js";
import {
  DEFAULT_PULSE_STATE,
  getPulseState,
  resetPulseState,
  setPulseState,
} from "./state.js";

const DEFAULT_PULSE_STATUS =
  "Paste your SC2Pulse profile link to sync your latest MMR.";
const MAX_SECONDARY_PULSE_LINKS = 5;
const MIN_SECONDARY_PULSE_LINKS = 2;

const RACE_UI = {
  zerg: { label: "Zerg", icon: "img/race/zerg2.webp", color: "#d16ba5" },
  terran: { label: "Terran", icon: "img/race/terran2.webp", color: "#4cc9f0" },
  protoss: {
    label: "Protoss",
    icon: "img/race/protoss2.webp",
    color: "#f6c177",
  },
  random: { label: "Random", icon: "img/race/terran2.webp", color: "#a0aec0" }, // fallback icon
};

const PULSE_ENDPOINTS = (() => {
  const endpoints = ["/api/pulse-mmr"];
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    endpoints.push(
      "http://localhost:5001/z-build-order/us-central1/fetchPulseMmr"
    );
  }
  endpoints.push(
    "https://us-central1-z-build-order.cloudfunctions.net/fetchPulseMmr"
  );
  return endpoints;
})();

let pulseUiInitialized = false;
let pulseHelpInitialized = false;
let secondaryPulseModalInitialized = false;

function extractSecondaryPulseUrls(secondary) {
  if (!Array.isArray(secondary)) return [];
  const urls = secondary
    .map((entry) =>
      entry && typeof entry === "object" ? entry.url || "" : entry || ""
    )
    .map((entry) => normalizePulseUrlClient(entry))
    .filter(Boolean);
  return Array.from(new Set(urls));
}

function normalizePulseUrlClient(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.hostname !== "sc2pulse.nephest.com") return "";
    const idParam = url.searchParams.get("id");
    const hasId = idParam && Number.isFinite(Number(idParam)) && Number(idParam) > 0;
    if (!hasId) return "";
    return url.toString();
  } catch (_) {
    return "";
  }
}

function parsePulseTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") {
    try {
      return value.toMillis();
    } catch (_) {
      return null;
    }
  }
  if (value?.seconds) return value.seconds * 1000;
  return null;
}

function setPulseStatus(message, tone = "muted", extraNode = null) {
  const statusEl = document.getElementById("pulseStatusText");
  if (!statusEl) return;
  let color = "#b0b0b0";
  if (tone === "error") color = "#ff9a9a";
  else if (tone === "success") color = "#9ae6b4";
  else if (tone === "info") color = "#8be9fd";

  statusEl.innerHTML = "";
  statusEl.style.whiteSpace = "pre-line";
  statusEl.style.color = color;
  const span = document.createElement("span");
  span.textContent = message || DEFAULT_PULSE_STATUS;
  statusEl.appendChild(span);
  if (extraNode) {
    statusEl.appendChild(extraNode);
  }
}

function setPulseControlsDisabled(isDisabled) {
  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (input) input.disabled = isDisabled;
  if (connectBtn) connectBtn.disabled = isDisabled;
}

function deriveOverallMmr(byRace, fallback) {
  if (byRace && typeof byRace === "object") {
    const vals = Object.values(byRace).filter((v) => Number.isFinite(v));
    if (vals.length) return Math.max(...vals);
  }
  return Number.isFinite(fallback) ? fallback : null;
}

function buildMmrBadges(byRace, overall, updatedAt) {
  const order = ["zerg", "terran", "protoss", "random"];
  const frag = document.createDocumentFragment();
  const list = document.createElement("div");
  list.className = "mmr-badge-list";
  let hasBadges = false;

  order.forEach((race) => {
    const val =
      byRace && Number.isFinite(byRace[race]) ? Math.round(byRace[race]) : null;
    if (!val) return;
    const meta = RACE_UI[race] || { label: race, icon: "", color: "#9ae6b4" };
    const badge = document.createElement("div");
    badge.className = "mmr-badge";
    badge.style.setProperty("--race-color", meta.color || "#9ae6b4");

    if (meta.icon) {
      const img = document.createElement("img");
      img.className = "mmr-badge-icon";
      img.dataset.src = meta.icon;
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = `${meta.label} icon`;
      badge.appendChild(img);
    }

    const text = document.createElement("span");
    text.textContent = `${meta.label}: ${val} MMR`;
    badge.appendChild(text);

    list.appendChild(badge);
    hasBadges = true;
  });

  if (!hasBadges && Number.isFinite(overall)) {
    const badge = document.createElement("div");
    badge.className = "mmr-badge";
    const text = document.createElement("span");
    text.textContent = `${Math.round(overall)} MMR`;
    badge.appendChild(text);
    list.appendChild(badge);
    hasBadges = true;
  }

  if (hasBadges) {
    frag.appendChild(list);
    if (updatedAt) {
      const date = new Date(updatedAt);
      if (!Number.isNaN(date.getTime())) {
        const updatedEl = document.createElement("div");
        updatedEl.className = "mmr-updated";
        updatedEl.textContent = `Last updated ${date.toLocaleDateString()}`;
        frag.appendChild(updatedEl);
      }
    }
  }

  return hasBadges ? frag : null;
}

function updateUserMenuMmrFromProfile(userData) {
  const mmrEl = document.getElementById("userMmrMenu");
  if (!mmrEl) return;
  const byRace =
    userData?.pulse?.lastMmrByRace || userData?.lastKnownMMRByRace || null;
  const overall = (() => {
    if (byRace && typeof byRace === "object") {
      const vals = Object.values(byRace).filter((v) => Number.isFinite(v));
      if (vals.length) return Math.max(...vals);
    }
    const n = Number(
      userData?.pulse?.lastMmr ??
        userData?.pulse?.mmr ??
        userData?.lastKnownMMR
    );
    return Number.isFinite(n) ? n : null;
  })();
  const updatedAt = userData?.lastMmrUpdated?.toMillis?.();
  const badges = buildMmrBadges(byRace, overall, updatedAt);
  mmrEl.innerHTML = "";
  if (badges) {
    mmrEl.appendChild(badges);
    mmrEl.style.display = "block";
  } else {
    mmrEl.style.display = "none";
    mmrEl.textContent = "";
  }
}

function updateUserMmrBadge(mmr, byRace = null, updatedAt = null) {
  const mmrEl = document.getElementById("userMmrMenu");
  if (!mmrEl) return;
  const badges = buildMmrBadges(byRace, mmr, updatedAt);
  mmrEl.innerHTML = "";
  if (badges) {
    mmrEl.appendChild(badges);
    mmrEl.style.display = "block";
  } else {
    mmrEl.style.display = "none";
  }
}

function applyPulseStateFromProfile(pulseData = {}) {
  const byRace =
    pulseData.lastMmrByRace && typeof pulseData.lastMmrByRace === "object"
      ? pulseData.lastMmrByRace
      : pulseData.byRace && typeof pulseData.byRace === "object"
      ? pulseData.byRace
      : null;
  const mmrValue = deriveOverallMmr(
    byRace,
    Number(pulseData.lastMmr ?? pulseData.mmr)
  );
  const fetchedAt =
    parsePulseTimestamp(pulseData.fetchedAt) ||
    parsePulseTimestamp(pulseData.lastMmrUpdated);
  const accountName =
    (pulseData.name && pulseData.name.toString().trim()) ||
    (pulseData.accountName && pulseData.accountName.toString().trim()) ||
    "";
  const secondary =
    Array.isArray(pulseData.secondary) && pulseData.secondary.length
      ? pulseData.secondary.slice(0, MAX_SECONDARY_PULSE_LINKS)
      : [];
  const nextState = {
    url: typeof pulseData.url === "string" ? pulseData.url : "",
    mmr:
      Number.isFinite(mmrValue) && mmrValue > 0 ? Math.round(mmrValue) : null,
    fetchedAt,
    byRace,
    accountName,
    secondary,
  };
  setPulseState(nextState);

  const input = document.getElementById("sc2PulseInput");
  if (input) input.value = nextState.url || "";

  updateUserMmrBadge(nextState.mmr, nextState.byRace, nextState.fetchedAt);

  if (nextState.url && nextState.mmr) {
    const badgeFrag = buildMmrBadges(
      nextState.byRace,
      nextState.mmr,
      nextState.fetchedAt
    );
    setPulseStatus("Connected.", "success", badgeFrag);
  } else if (nextState.url) {
    setPulseStatus("Link saved. Click Update to refresh your MMR.", "info");
  } else {
    setPulseStatus(DEFAULT_PULSE_STATUS, "muted");
  }

  dispatchPulseState();
}

function resetPulseUi() {
  resetPulseState();
  updateUserMmrBadge(null, null);
  const input = document.getElementById("sc2PulseInput");
  if (input) input.value = "";
  setPulseStatus(DEFAULT_PULSE_STATUS, "muted");
  dispatchPulseState();
}

function dispatchPulseState() {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  )
    return;
  window.dispatchEvent(
    new CustomEvent("pulse-state-changed", {
      detail: { ...getPulseState() },
    })
  );
}

function dispatchPulseSyncComplete(detail = {}) {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  )
    return;
  window.dispatchEvent(
    new CustomEvent("pulse-sync-complete", {
      detail: { ...detail },
    })
  );
}

function dispatchSecondaryPulseSyncComplete(detail = {}) {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  )
    return;
  window.dispatchEvent(
    new CustomEvent("pulse-secondary-sync-complete", {
      detail: { ...detail },
    })
  );
}

function setupPulseSettingsSection() {
  if (pulseUiInitialized) return;
  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (!input || !connectBtn) return;

  connectBtn.addEventListener("click", handleConnectPulse);
  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      setPulseStatus(DEFAULT_PULSE_STATUS, "muted");
    }
  });

  setupPulseHelpModal();

  pulseUiInitialized = true;
}

function setupPulseHelpModal() {
  if (pulseHelpInitialized) return;
  const openBtn = document.getElementById("pulseHelpBtn");
  const modal = document.getElementById("pulseHelpModal");
  const closeBtn = document.getElementById("closePulseHelp");
  if (!openBtn || !modal) return;

  const hide = () => {
    modal.style.display = "none";
  };
  const show = () => {
    modal.style.display = "block";
  };

  openBtn.addEventListener("click", show);
  if (closeBtn) closeBtn.addEventListener("click", hide);
  window.addEventListener("mousedown", (e) => {
    if (e.target === modal) hide();
  });

  pulseHelpInitialized = true;
}

function setupSecondaryPulseModal() {
  if (secondaryPulseModalInitialized) return;
  const openBtn = document.getElementById("openSecondaryPulseModalBtn");
  const modal = document.getElementById("secondaryPulseModal");
  const closeBtn = document.getElementById("closeSecondaryPulseModal");
  const addBtn = document.getElementById("secondaryAddInputBtn");
  const saveBtn = document.getElementById("saveSecondaryPulseBtn");
  const listEl = document.getElementById("secondaryPulseList");
  const helper = document.getElementById("secondaryPulseHelper");
  if (!openBtn || !modal || !listEl) return;

  const extractUrls = (secondary) =>
    Array.isArray(secondary)
      ? secondary
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : entry && typeof entry === "object"
              ? entry.url || ""
              : ""
          )
          .filter(Boolean)
      : [];

  const createRow = (value = "") => {
    const row = document.createElement("div");
    row.className = "secondary-pulse-row";
    const input = document.createElement("input");
    input.type = "url";
    input.className = "settings-input secondary-pulse-input";
    input.placeholder = "add link here...";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = value;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "secondary-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      if (listEl.contains(row)) {
        row.remove();
        ensureMinRows();
        updateHelper();
        updateAddButtonState();
      }
    });
    row.append(input, removeBtn);
    return row;
  };

  const ensureMinRows = () => {
    while (listEl.children.length < MIN_SECONDARY_PULSE_LINKS) {
      listEl.appendChild(createRow());
    }
  };

  const updateHelper = () => {
    if (!helper) return;
    const remaining = Math.max(
      0,
      MAX_SECONDARY_PULSE_LINKS - listEl.children.length
    );
    helper.textContent = `You can add up to ${MAX_SECONDARY_PULSE_LINKS} secondary SC2Pulse links. ${remaining} slot${
      remaining === 1 ? "" : "s"
    } remaining.`;
  };

  const updateAddButtonState = () => {
    if (!addBtn) return;
    addBtn.disabled = listEl.children.length >= MAX_SECONDARY_PULSE_LINKS;
  };

  const addSecondaryRow = (value = "") => {
    if (listEl.children.length >= MAX_SECONDARY_PULSE_LINKS) return;
    listEl.appendChild(createRow(value));
    updateHelper();
    updateAddButtonState();
  };

  const collectValues = () =>
    Array.from(listEl.querySelectorAll("input.secondary-pulse-input"))
      .map((input) => input.value.trim())
      .filter(Boolean)
      .slice(0, MAX_SECONDARY_PULSE_LINKS);

  const prefillFromState = async () => {
    const urlsFromState = extractUrls(getPulseState().secondary);
    let urls = [...urlsFromState];

    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const secondary =
          snap.exists() && Array.isArray(snap.data()?.pulse?.secondary)
            ? snap.data().pulse.secondary
            : [];
        const urlsFromDb = extractUrls(secondary);
        if (urlsFromDb.length) {
          urls = Array.from(new Set([...urlsFromDb, ...urls]));
          applyPulseStateFromProfile({
            ...getPulseState(),
            secondary,
          });
        }
      } catch (err) {
        console.warn("Could not prefill secondary links from Firestore", err);
      }
    }

    if (!urls.length) return;
    listEl.innerHTML = "";
    urls.forEach((url) => addSecondaryRow(url));
  };

  const buildSecondaryProfiles = (links) =>
    links
      .map((link) => normalizePulseUrlClient(link))
      .filter(Boolean)
      .map((url) => ({ url }));

  const enrichSecondaryProfiles = async (profiles) => {
    const enriched = [];
    for (const profile of profiles) {
      const enrichedProfile = { ...profile };
      try {
        const payload = await fetchPulseMmrFromBackend(profile.url);
        const byRace = payload.byRace || null;
        const mmr = deriveOverallMmr(byRace, Number(payload.mmr));
        enrichedProfile.name = (payload.pulseName || "").toString();
        enrichedProfile.lastMmrByRace = byRace;
        enrichedProfile.lastMmr = Number.isFinite(mmr) ? Math.round(mmr) : null;
        enrichedProfile.fetchedAt = Date.now();
      } catch (err) {
        console.warn("Failed to fetch secondary SC2Pulse link", err);
      }
      enriched.push(enrichedProfile);
    }
    return enriched;
  };

  const persistSecondaryProfiles = async (links) => {
    if (!auth.currentUser) {
      showToast("? Please sign in to save secondary links.", "error");
      return [];
    }
    const baseProfiles = buildSecondaryProfiles(links);
    // Always persist URLs, even if enrichment fails
    let profilesToSave = baseProfiles;
    try {
      profilesToSave = await enrichSecondaryProfiles(baseProfiles);
    } catch (_) {
      profilesToSave = baseProfiles;
    }

    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { pulse: { secondary: profilesToSave } },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to save secondary SC2Pulse links", err);
      throw err;
    }
    // Update local state + downstream listeners
    applyPulseStateFromProfile({ ...getPulseState(), secondary: profilesToSave });
    dispatchSecondaryPulseSyncComplete({ profiles: profilesToSave });
    return profilesToSave;
  };

  const showModal = async () => {
    modal.style.display = "block";
    await prefillFromState();
    ensureMinRows();
    updateHelper();
    updateAddButtonState();
  };

  // Keep inputs in sync when pulse state changes (e.g., after reload)
  window.addEventListener("pulse-state-changed", (event) => {
    const urls = extractUrls(event?.detail?.secondary);
    if (!urls.length) return;
    listEl.innerHTML = "";
    urls.forEach((url) => addSecondaryRow(url));
    ensureMinRows();
    updateHelper();
    updateAddButtonState();
  });

  const hideModal = () => {
    modal.style.display = "none";
  };

  openBtn.addEventListener("click", (event) => {
    event.preventDefault();
    showModal();
  });
  if (closeBtn) closeBtn.addEventListener("click", hideModal);
  window.addEventListener("mousedown", (event) => {
    if (event.target === modal) {
      hideModal();
    }
  });
  if (addBtn) {
    addBtn.addEventListener("click", (event) => {
      event.preventDefault();
      addSecondaryRow();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const values = collectValues();
      const original = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      try {
        const profiles = await persistSecondaryProfiles(values);
        showToast(
          `Saved ${profiles.length} secondary link${
            profiles.length === 1 ? "" : "s"
          }.`,
          "success"
        );
        hideModal();
      } catch (err) {
        showToast("Failed to save secondary links.", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = original;
      }
    });
  }

  ensureMinRows();
  updateHelper();
  updateAddButtonState();
  secondaryPulseModalInitialized = true;
}

async function fetchPulseMmrFromBackend(url) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please sign in first.");
  }

  let lastError = null;

  for (const endpoint of PULSE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, url }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (_) {
        // ignore json parse errors; handled below
      }

      if (!response.ok) {
        const message =
          (payload && payload.error) ||
          `Failed to fetch MMR (status ${response.status}).`;
        lastError = new Error(message);
        // Try next endpoint (helps when local dev lacks hosting rewrite)
        continue;
      }

      if (!Number.isFinite(payload?.mmr)) {
        lastError = new Error("Could not read MMR from SC2Pulse.");
        continue;
      }

      return payload;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error("Failed to fetch MMR from SC2Pulse.");
}

async function handleConnectPulse(event) {
  if (event?.preventDefault) event.preventDefault();

  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (!input || !connectBtn) return;

  const user = auth.currentUser;
  if (!user) {
    setPulseStatus("Sign in to connect your SC2Pulse link.", "error");
    showToast("? Please sign in to connect SC2Pulse.", "error");
    return;
  }

  const rawUrl = (input.value || "").trim();
  if (!rawUrl) {
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { pulse: deleteField(), sc2PulseUrl: deleteField() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to clear SC2Pulse link:", err);
    }
    resetPulseUi();
    setPulseStatus("SC2Pulse link removed.", "info");
    showToast("? SC2Pulse link removed.", "success");
    return;
  }

  const normalizedUrl = normalizePulseUrlClient(rawUrl);
  if (!normalizedUrl) {
    setPulseStatus(
      "Paste a SC2Pulse link that includes a character id (id=...).",
      "error"
    );
    return;
  }

  connectBtn.disabled = true;
  const originalHtml = connectBtn.innerHTML;
  connectBtn.textContent = "Fetching...";
  setPulseStatus("Fetching MMR from SC2Pulse...", "info");

  try {
    const payload = await fetchPulseMmrFromBackend(normalizedUrl);
    const byRace = payload.byRace || null;
    const overall = deriveOverallMmr(byRace, Number(payload.mmr));
    const pulsePayload = {
      url: payload.url || normalizedUrl,
      fetchedAt: Date.now(),
      lastMmrByRace: byRace,
      name: payload.pulseName || "",
      secondary: getPulseState().secondary || DEFAULT_PULSE_STATE.secondary,
    };

    await setDoc(
      doc(db, "users", user.uid),
      { pulse: pulsePayload, sc2PulseUrl: normalizedUrl },
      { merge: true }
    );

    applyPulseStateFromProfile(pulsePayload);
    const badgeFrag = buildMmrBadges(byRace, overall, pulsePayload.fetchedAt);
    setPulseStatus("Connected.", "success", badgeFrag);
    showToast("? SC2Pulse connected and MMR updated.", "success");
    dispatchPulseSyncComplete({ url: pulsePayload.url, fetchedAt: pulsePayload.fetchedAt });
  } catch (error) {
    console.error("SC2Pulse fetch failed:", error);
    const message = error?.message || "Failed to fetch MMR from SC2Pulse.";
    setPulseStatus(message.replace("?", "").trim(), "error");
    showToast(message.startsWith("?") ? message : `? ${message}`, "error");
  } finally {
    connectBtn.disabled = false;
    connectBtn.innerHTML = originalHtml;
  }
}

async function syncSecondaryPulseProfilesFromState() {
  const user = auth.currentUser;
  if (!user) {
    showToast("? Please sign in to sync SC2Pulse.", "error");
    return { count: 0, updated: false };
  }

  const currentSecondary = getPulseState().secondary || [];
  const urls = extractSecondaryPulseUrls(currentSecondary);
  if (!urls.length) {
    return { count: 0, updated: false };
  }

  const existingByUrl = new Map(
    currentSecondary
      .filter((entry) => entry && typeof entry === "object" && entry.url)
      .map((entry) => [normalizePulseUrlClient(entry.url), entry])
      .filter(([url]) => url)
  );

  const profiles = [];
  for (const url of urls) {
    const nextProfile = { url };
    try {
      const payload = await fetchPulseMmrFromBackend(url);
      const byRace = payload.byRace || null;
      const mmr = deriveOverallMmr(byRace, Number(payload.mmr));
      nextProfile.name = (payload.pulseName || "").toString();
      nextProfile.lastMmrByRace = byRace;
      nextProfile.lastMmr = Number.isFinite(mmr) ? Math.round(mmr) : null;
      nextProfile.fetchedAt = Date.now();
    } catch (err) {
      const existing = existingByUrl.get(url);
      if (existing) {
        profiles.push({ ...existing });
        continue;
      }
    }
    profiles.push(nextProfile);
  }

  try {
    await setDoc(
      doc(db, "users", user.uid),
      { pulse: { secondary: profiles } },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to sync secondary SC2Pulse links", err);
    throw err;
  }

  applyPulseStateFromProfile({ ...getPulseState(), secondary: profiles });
  dispatchSecondaryPulseSyncComplete({ profiles });
  return { count: profiles.length, updated: true };
}

async function syncPulseNow() {
  if (!auth.currentUser) {
    showToast("? Please sign in to sync SC2Pulse.", "error");
    return;
  }

  const pulseState = getPulseState();
  const pulseUrl = normalizePulseUrlClient(pulseState?.url || "");
  const input = document.getElementById("sc2PulseInput");
  const connectBtn = document.getElementById("connectPulseBtn");
  if (input && pulseUrl && !input.value.trim()) {
    input.value = pulseUrl;
  }

  if (pulseUrl) {
    try {
      if (input && connectBtn) {
        await handleConnectPulse({ preventDefault() {} });
      } else {
        const payload = await fetchPulseMmrFromBackend(pulseUrl);
        const byRace = payload.byRace || null;
        const overall = deriveOverallMmr(byRace, Number(payload.mmr));
        const pulsePayload = {
          url: payload.url || pulseUrl,
          fetchedAt: Date.now(),
          lastMmrByRace: byRace,
          name: payload.pulseName || "",
          secondary: pulseState.secondary || DEFAULT_PULSE_STATE.secondary,
        };
        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          { pulse: pulsePayload, sc2PulseUrl: pulsePayload.url },
          { merge: true }
        );
        applyPulseStateFromProfile(pulsePayload);
        showToast(
          `? SC2Pulse updated${
            Number.isFinite(overall) ? "." : ", but no MMR found."
          }`,
          "success"
        );
        dispatchPulseSyncComplete({
          url: pulsePayload.url,
          fetchedAt: pulsePayload.fetchedAt,
        });
      }
    } catch (err) {
      const message = err?.message || "Failed to sync SC2Pulse.";
      showToast(message.startsWith("?") ? message : `? ${message}`, "error");
    }
  }

  let secondaryResult = { updated: false };
  try {
    secondaryResult = await syncSecondaryPulseProfilesFromState();
  } catch (err) {
    const message =
      err?.message || "Failed to sync secondary SC2Pulse links.";
    showToast(message.startsWith("?") ? message : `? ${message}`, "error");
  }

  if (!pulseUrl && !secondaryResult.updated) {
    showToast("? Add your SC2Pulse link in Settings to sync.", "error");
  }
}

export {
  buildMmrBadges,
  updateUserMenuMmrFromProfile,
  applyPulseStateFromProfile,
  resetPulseUi,
  setPulseControlsDisabled,
  setPulseStatus,
  setupPulseSettingsSection,
  setupSecondaryPulseModal,
  syncPulseNow,
};
