import { db } from "../../../app.js";
import { doc, getDoc, collection } from "firebase/firestore";
import { TOURNAMENT_COLLECTION } from "./state.js";

export function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function isTournamentSlugTaken(slug) {
  if (!slug) return true;
  try {
    const snap = await getDoc(doc(collection(db, TOURNAMENT_COLLECTION), slug));
    return snap.exists();
  } catch (err) {
    console.warn("Failed to validate tournament slug", err);
    return false;
  }
}

async function ensureUniqueSlug(baseSlug, isTaken) {
  if (!baseSlug) return "";
  let candidate = baseSlug;
  let counter = 2;
  while (await isTaken(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return candidate;
}

export async function generateUniqueSlug(baseName = "") {
  const baseSlug = slugify(baseName);
  if (!baseSlug) {
    return `t-${Date.now().toString(36)}`;
  }
  return ensureUniqueSlug(baseSlug, isTournamentSlugTaken);
}

export function updateSlugPreview() {
  const slugInput = document.getElementById("tournamentSlugInput");
  const preview = document.getElementById("slugPreview");
  if (slugInput && preview) {
    const next = slugify(slugInput.value || "");
    if (slugInput.value !== next) slugInput.value = next;
    preview.textContent = next;
  }
}

export function updateFinalSlugPreview() {
  const slugInput = document.getElementById("finalTournamentSlugInput");
  const prefix = document.getElementById("finalSlugPrefix");
  if (slugInput && prefix) {
    const next = slugify(slugInput.value || "");
    if (slugInput.value !== next) slugInput.value = next;
    const circuitSlug = (document.getElementById("circuitSlugInput")?.value || "")
      .trim()
      .toLowerCase();
    prefix.textContent = `https://zbuildorder.com/${circuitSlug || ""}`;
  }
}
