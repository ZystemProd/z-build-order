import { auth } from "../../../app.js";
import { sanitizeUrl } from "./bracket/renderUtils.js";
import { loadTournamentRegistry } from "./sync/persistence.js";
import { lockBodyScroll, unlockBodyScroll } from "./modalLock.js";
import { currentTournamentMeta } from "./state.js";

function resolveCoverCircuitSlug(inputId) {
  if (inputId === "settingsImageInput") {
    return currentTournamentMeta?.circuitSlug || "";
  }
  if (inputId === "tournamentImageInput") {
    return (
      document.getElementById("createTournamentModal")?.dataset.circuitSlug || ""
    );
  }
  if (inputId === "finalTournamentImageInput") {
    const slugInput = document.getElementById("circuitSlugInput");
    return (slugInput?.value || "").trim().toLowerCase();
  }
  return "";
}

async function getCoverReuseCandidates(circuitSlug) {
  const registry = await loadTournamentRegistry(true);
  const uid = auth.currentUser?.uid || "";
  const unique = new Map();
  (registry || []).forEach((item) => {
    const coverUrl = sanitizeUrl(item.coverImageUrl || "");
    if (!coverUrl) return;
    const isOwner = uid && item.createdBy === uid;
    const isCircuitMatch = circuitSlug && item.circuitSlug === circuitSlug;
    if (!isOwner && !isCircuitMatch) return;
    if (!unique.has(coverUrl)) {
      unique.set(coverUrl, {
        url: coverUrl,
        name: item.name || item.slug || "Cover image",
      });
    }
  });
  return Array.from(unique.values());
}

export function initCoverReuseModal() {
  const modal = document.getElementById("coverReuseModal");
  const grid = document.getElementById("coverReuseGrid");
  const closeBtn = document.getElementById("closeCoverReuseModal");
  if (!modal || !grid) return;
  let activeTarget = null;

  const closeModal = () => {
    modal.style.display = "none";
    unlockBodyScroll();
    activeTarget = null;
  };

  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.querySelectorAll(".cover-reuse-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const inputId = btn.dataset.coverInput;
      const previewId = btn.dataset.coverPreview;
      const inputEl = inputId ? document.getElementById(inputId) : null;
      const previewEl = previewId ? document.getElementById(previewId) : null;
      if (!inputEl || !previewEl) return;
      activeTarget = { inputEl, previewEl };
      grid.innerHTML = `<p class="helper">Loading covers...</p>`;
      modal.style.display = "flex";
      lockBodyScroll();
      try {
        const circuitSlug = resolveCoverCircuitSlug(inputId);
        const candidates = await getCoverReuseCandidates(circuitSlug);
        if (!candidates.length) {
          grid.innerHTML = `<p class="helper">No saved covers yet.</p>`;
          return;
        }
        grid.innerHTML = "";
        candidates.forEach((candidate) => {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "cover-reuse-card";
          const thumb = document.createElement("span");
          thumb.className = "cover-reuse-thumb";
          thumb.style.backgroundImage = `url("${candidate.url}")`;
          const title = document.createElement("span");
          title.className = "cover-reuse-title";
          title.textContent = candidate.name;
          card.appendChild(thumb);
          card.appendChild(title);
          card.addEventListener("click", () => {
            if (!activeTarget) return;
            const { inputEl: targetInput, previewEl: targetPreview } = activeTarget;
            if (targetPreview.dataset.tempPreview) {
              try {
                URL.revokeObjectURL(targetPreview.dataset.tempPreview);
              } catch (_) {}
              delete targetPreview.dataset.tempPreview;
            }
            targetInput.value = "";
            targetPreview.src = candidate.url;
            targetPreview.style.display = "block";
            targetPreview.dataset.reuseUrl = candidate.url;
            closeModal();
          });
          grid.appendChild(card);
        });
      } catch (err) {
        console.error("Failed to load cover reuse candidates", err);
        grid.innerHTML = `<p class="helper">Failed to load covers.</p>`;
      }
    });
  });
}
