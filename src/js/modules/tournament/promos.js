import { db } from "../../../app.js";
import { doc, getDoc, collection } from "firebase/firestore";
import { TOURNAMENT_COLLECTION } from "./state.js";
import { fetchCircuitMeta } from "./circuit.js";
import { sanitizeUrl } from "./bracket/renderUtils.js";
import {
  renderSponsorSettingsList,
  renderSocialSettingsList,
  readSponsorSettingsList,
  readSocialSettingsList,
  bindSponsorSettingsControls,
  bindSocialSettingsControls,
  normalizeSponsorEntry,
  normalizeSocialEntry,
  buildSocialIconSvg,
} from "./promosShared.js";

let circuitPromoCache = {
  circuitSlug: "",
  sponsors: [],
  socials: [],
  loading: false,
};

export function renderCircuitFinalSponsors(entries = []) {
  renderSponsorSettingsList(
    document.getElementById("circuitFinalSponsorsList"),
    entries,
    "No sponsors added yet."
  );
}

export function renderCircuitFinalSocials(entries = []) {
  renderSocialSettingsList(
    document.getElementById("circuitFinalSocialsList"),
    entries,
    "No social links added yet."
  );
}

export function renderTournamentSponsors(entries = []) {
  renderSponsorSettingsList(
    document.getElementById("tournamentSponsorsList"),
    entries,
    "No sponsors added yet."
  );
}

export function renderTournamentSocials(entries = []) {
  renderSocialSettingsList(
    document.getElementById("tournamentSocialsList"),
    entries,
    "No social links added yet."
  );
}

export function readCircuitFinalSponsors() {
  return readSponsorSettingsList(
    document.getElementById("circuitFinalSponsorsList")
  );
}

export function readCircuitFinalSocials() {
  return readSocialSettingsList(
    document.getElementById("circuitFinalSocialsList")
  );
}

export function readTournamentSponsors() {
  return readSponsorSettingsList(
    document.getElementById("tournamentSponsorsList")
  );
}

export function readTournamentSocials() {
  return readSocialSettingsList(
    document.getElementById("tournamentSocialsList")
  );
}

export function bindCircuitFinalSponsorControls() {
  bindSponsorSettingsControls(
    document.getElementById("circuitFinalSponsorsList"),
    document.getElementById("circuitFinalAddSponsorBtn"),
    readCircuitFinalSponsors,
    renderCircuitFinalSponsors
  );
}

export function bindCircuitFinalSocialControls() {
  bindSocialSettingsControls(
    document.getElementById("circuitFinalSocialsList"),
    document.getElementById("circuitFinalAddSocialBtn"),
    readCircuitFinalSocials,
    renderCircuitFinalSocials
  );
}

export function bindTournamentSponsorControls() {
  bindSponsorSettingsControls(
    document.getElementById("tournamentSponsorsList"),
    document.getElementById("tournamentAddSponsorBtn"),
    readTournamentSponsors,
    renderTournamentSponsors
  );
}

export function bindTournamentSocialControls() {
  bindSocialSettingsControls(
    document.getElementById("tournamentSocialsList"),
    document.getElementById("tournamentAddSocialBtn"),
    readTournamentSocials,
    renderTournamentSocials
  );
}

export function getCopyFromCircuitPromos(meta) {
  if (!meta?.circuitSlug) return false;
  return meta.copyFromCircuitPromos !== false;
}

async function loadCircuitPromoData(circuitSlug) {
  if (!circuitSlug) return { sponsors: [], socials: [] };
  if (
    circuitPromoCache.circuitSlug === circuitSlug &&
    !circuitPromoCache.loading
  ) {
    return {
      sponsors: circuitPromoCache.sponsors || [],
      socials: circuitPromoCache.socials || [],
    };
  }
  if (
    circuitPromoCache.loading &&
    circuitPromoCache.circuitSlug === circuitSlug
  ) {
    return {
      sponsors: circuitPromoCache.sponsors || [],
      socials: circuitPromoCache.socials || [],
    };
  }
  circuitPromoCache = {
    circuitSlug,
    sponsors: [],
    socials: [],
    loading: true,
  };
  try {
    const circuitMeta = await fetchCircuitMeta(circuitSlug);
    const finalSlug = circuitMeta?.finalTournamentSlug || "";
    if (!finalSlug) {
      circuitPromoCache.loading = false;
      return { sponsors: [], socials: [] };
    }
    const snap = await getDoc(
      doc(collection(db, TOURNAMENT_COLLECTION), finalSlug)
    );
    if (snap.exists()) {
      const data = snap.data() || {};
      circuitPromoCache.sponsors = Array.isArray(data.sponsors)
        ? data.sponsors
        : [];
      circuitPromoCache.socials = Array.isArray(data.socials)
        ? data.socials
        : [];
    }
  } catch (err) {
    console.warn("Failed to load circuit promos", err);
  }
  circuitPromoCache.loading = false;
  return {
    sponsors: circuitPromoCache.sponsors || [],
    socials: circuitPromoCache.socials || [],
  };
}

function renderTournamentPromoStrip({ sponsors = [], socials = [] } = {}) {
  const strip = document.getElementById("tournamentPromoStrip");
  const sponsorList = document.getElementById("tournamentSponsorList");
  const socialList = document.getElementById("tournamentSocialList");
  if (!strip || !sponsorList || !socialList) return;
  const sponsorCard = sponsorList.closest(".tournament-promo-card");
  const socialCard = socialList.closest(".tournament-promo-card");
  const normalizedSponsors = (sponsors || [])
    .map((entry) => normalizeSponsorEntry(entry, { allowEmpty: true }))
    .filter(Boolean)
    .map((entry) => ({
      name: String(entry.name || "").trim(),
      imageUrl: sanitizeUrl(entry.imageUrl || ""),
      linkUrl: sanitizeUrl(entry.linkUrl || ""),
    }))
    .filter((entry) => entry.name || entry.imageUrl || entry.linkUrl);
  const normalizedSocials = (socials || [])
    .map((entry) => normalizeSocialEntry(entry, { allowEmpty: true }))
    .filter(Boolean)
    .map((entry) => ({
      type: String(entry.type || "custom").trim().toLowerCase(),
      label: String(entry.label || "").trim(),
      url: sanitizeUrl(entry.url || ""),
    }))
    .filter((entry) => entry.label || entry.url);
  sponsorList.replaceChildren();
  socialList.replaceChildren();
  strip.style.display = "grid";
  if (sponsorCard) {
    sponsorCard.style.display = "grid";
  }
  if (socialCard) {
    socialCard.style.display = "grid";
  }
  normalizedSponsors.forEach((entry) => {
    const anchor = document.createElement("a");
    anchor.className = "tournament-sponsor-item";
    anchor.href = entry.linkUrl || "#";
    anchor.target = entry.linkUrl ? "_blank" : "";
    anchor.rel = entry.linkUrl ? "noopener" : "";
    if (!entry.linkUrl) {
      anchor.removeAttribute("href");
    }
    const img = document.createElement("img");
    img.className = "sponsor-logo";
    img.alt = entry.name || "Sponsor";
    img.src = entry.imageUrl || "";
    const name = document.createElement("span");
    name.className = "sponsor-name";
    name.textContent = entry.name || "Sponsor";
    anchor.append(img, name);
    sponsorList.appendChild(anchor);
  });
  normalizedSocials.forEach((entry) => {
    const anchor = document.createElement("a");
    anchor.className = "tournament-social-link";
    anchor.href = entry.url || "#";
    anchor.target = entry.url ? "_blank" : "";
    anchor.rel = entry.url ? "noopener" : "";
    const label = entry.label || entry.url || "Social";
    anchor.setAttribute("aria-label", label);
    anchor.title = label;
    if (!entry.url) {
      anchor.removeAttribute("href");
    }
    anchor.innerHTML = buildSocialIconSvg(entry.type);
    socialList.appendChild(anchor);
  });
}

export async function refreshTournamentPromoStrip(meta) {
  if (!meta) return;
  const useCircuit = getCopyFromCircuitPromos(meta);
  if (useCircuit && meta?.circuitSlug) {
    const data = await loadCircuitPromoData(meta.circuitSlug);
    renderTournamentPromoStrip(data);
    return;
  }
  renderTournamentPromoStrip({
    sponsors: meta?.sponsors || [],
    socials: meta?.socials || [],
  });
}

function getCopyFromCircuitToggleValue(meta) {
  const sponsorToggle = document.getElementById(
    "settingsCopyCircuitSponsorsToggle"
  );
  const socialToggle = document.getElementById(
    "settingsCopyCircuitSocialsToggle"
  );
  if (sponsorToggle?.dataset.userSet === "true") {
    return Boolean(sponsorToggle.checked);
  }
  if (socialToggle?.dataset.userSet === "true") {
    return Boolean(socialToggle.checked);
  }
  return getCopyFromCircuitPromos(meta);
}

function syncCopyFromCircuitToggles(enabled) {
  const sponsorToggle = document.getElementById(
    "settingsCopyCircuitSponsorsToggle"
  );
  const socialToggle = document.getElementById(
    "settingsCopyCircuitSocialsToggle"
  );
  if (sponsorToggle) sponsorToggle.checked = enabled;
  if (socialToggle) socialToggle.checked = enabled;
}

function setSettingsListDisabled(list, disabled) {
  if (!list) return;
  list.querySelectorAll("input, select").forEach((el) => {
    el.disabled = disabled;
  });
  list.querySelectorAll("[data-sponsor-remove]").forEach((btn) => {
    btn.style.display = disabled ? "none" : "";
  });
  list.querySelectorAll("[data-social-remove]").forEach((btn) => {
    btn.style.display = disabled ? "none" : "";
  });
}

export async function refreshTournamentPromoSettings(meta) {
  if (!meta) return;
  const hasCircuit = Boolean(meta?.circuitSlug);
  const sponsorRow = document.getElementById("settingsCopyCircuitSponsorsRow");
  const socialRow = document.getElementById("settingsCopyCircuitSocialsRow");
  const sponsorNote = document.getElementById("settingsSponsorsCopyNote");
  const socialNote = document.getElementById("settingsSocialsCopyNote");
  const sponsorsList = document.getElementById("tournamentSponsorsList");
  const socialsList = document.getElementById("tournamentSocialsList");
  const sponsorAddBtn = document.getElementById("tournamentAddSponsorBtn");
  const socialAddBtn = document.getElementById("tournamentAddSocialBtn");
  const sponsorToggle = document.getElementById(
    "settingsCopyCircuitSponsorsToggle"
  );
  const socialToggle = document.getElementById(
    "settingsCopyCircuitSocialsToggle"
  );
  if (meta?.copyFromCircuitPromos !== undefined) {
    if (sponsorToggle) delete sponsorToggle.dataset.userSet;
    if (socialToggle) delete socialToggle.dataset.userSet;
  }
  if (sponsorRow) sponsorRow.style.display = hasCircuit ? "" : "none";
  if (socialRow) socialRow.style.display = hasCircuit ? "" : "none";
  const copyEnabled = hasCircuit ? getCopyFromCircuitToggleValue(meta) : false;
  syncCopyFromCircuitToggles(copyEnabled);
  if (sponsorNote) sponsorNote.style.display = copyEnabled ? "block" : "none";
  if (socialNote) socialNote.style.display = copyEnabled ? "block" : "none";
  if (sponsorAddBtn) sponsorAddBtn.style.display = copyEnabled ? "none" : "";
  if (socialAddBtn) socialAddBtn.style.display = copyEnabled ? "none" : "";
  if (copyEnabled && hasCircuit) {
    const data = await loadCircuitPromoData(meta.circuitSlug);
    renderTournamentSponsors(data.sponsors || []);
    renderTournamentSocials(data.socials || []);
    setSettingsListDisabled(sponsorsList, true);
    setSettingsListDisabled(socialsList, true);
    return;
  }
  renderTournamentSponsors(meta?.sponsors || []);
  renderTournamentSocials(meta?.socials || []);
  setSettingsListDisabled(sponsorsList, false);
  setSettingsListDisabled(socialsList, false);
}

export function bindTournamentPromoSettingsControls(metaGetter) {
  const sponsorToggle = document.getElementById(
    "settingsCopyCircuitSponsorsToggle"
  );
  const socialToggle = document.getElementById(
    "settingsCopyCircuitSocialsToggle"
  );
  if (sponsorToggle && sponsorToggle.dataset.bound === "true") return;
  if (sponsorToggle) sponsorToggle.dataset.bound = "true";
  if (socialToggle) socialToggle.dataset.bound = "true";
  const handleToggle = (value) => {
    syncCopyFromCircuitToggles(value);
    const meta = typeof metaGetter === "function" ? metaGetter() : null;
    refreshTournamentPromoSettings(meta);
  };
  sponsorToggle?.addEventListener("change", () => {
    if (sponsorToggle) sponsorToggle.dataset.userSet = "true";
    if (socialToggle) socialToggle.dataset.userSet = "true";
    handleToggle(Boolean(sponsorToggle.checked));
  });
  socialToggle?.addEventListener("change", () => {
    if (sponsorToggle) sponsorToggle.dataset.userSet = "true";
    if (socialToggle) socialToggle.dataset.userSet = "true";
    handleToggle(Boolean(socialToggle.checked));
  });
}
