import { auth, db, getCurrentUsername } from "../../../app.js";
import { showToast } from "../toastHandler.js";
import { state, isAdmin } from "./state.js";
import { escapeHtml, sanitizeUrl } from "./bracket/renderUtils.js";
import { doc, getDoc } from "firebase/firestore";

let casterDeps = null;
let castPopover = null;
let castPopoverMatchId = null;
const casterStreamCache = new Map();

export function getCasterEntryByUid(uid) {
  if (!uid) return null;
  return (state.casters || []).find((entry) => entry.uid === uid) || null;
}

function getCasterRequestByUid(uid) {
  if (!uid) return null;
  return (state.casterRequests || []).find((entry) => entry.uid === uid) || null;
}

function getCasterProfileFromUser(uid) {
  if (!uid) return null;
  const name = (getCurrentUsername?.() || auth.currentUser?.displayName || "Caster").trim();
  const twitchUrl = document.getElementById("settingsTwitchInput")?.value?.trim() || "";
  return {
    uid,
    name: name || "Caster",
    twitchUrl,
  };
}

export function renderCasterSection() {
  const requestBtn = document.getElementById("requestCasterBtn");
  const statusEl = document.getElementById("casterRequestStatus");
  const adminPanel = document.getElementById("casterRequestPanel");
  const requestList = document.getElementById("casterRequestList");
  const adminStatus = document.getElementById("casterRequestAdminStatus");
  const uid = auth.currentUser?.uid || null;
  const casterEntry = getCasterEntryByUid(uid);
  const requestEntry = getCasterRequestByUid(uid);
  const isCaster = Boolean(casterEntry || isAdmin);

  if (requestBtn) {
    if (!uid) {
      requestBtn.style.display = "none";
    } else {
      requestBtn.style.display = "inline-flex";
      requestBtn.disabled = Boolean(isCaster || requestEntry);
      if (isCaster) requestBtn.textContent = "Caster approved";
      else if (requestEntry) requestBtn.textContent = "Request pending";
      else requestBtn.textContent = "Request caster access";
    }
  }

  if (statusEl) {
    let message = "";
    if (!uid) {
      message = "Sign in to request caster access.";
    } else if (isCaster) {
      message = "You are approved to cast matches.";
    } else if (requestEntry) {
      message = "Caster request pending approval.";
    }
    statusEl.textContent = message;
  }

  if (adminPanel) {
    adminPanel.style.display = isAdmin ? "grid" : "none";
  }

  if (requestList) {
    const requests = Array.isArray(state.casterRequests) ? state.casterRequests : [];
    if (!requests.length) {
      requestList.replaceChildren();
    } else {
      requestList.innerHTML = requests
        .map((entry) => {
          const safeUrl = sanitizeUrl(entry.twitchUrl || "");
          const twitchLabel = safeUrl
            ? `<a class="ghost-link" href="${escapeHtml(
                safeUrl
              )}" target="_blank" rel="noopener">Twitch</a>`
            : `<span class="helper">No Twitch link</span>`;
          const name = escapeHtml(entry.name || "Caster");
          const entryUid = escapeHtml(entry.uid || "");
          return `<div class="caster-request-item">
            <div class="caster-request-meta">
              <strong>${name}</strong>
              ${twitchLabel}
            </div>
            <div class="caster-request-actions">
              <button class="cta small primary" type="button" data-caster-action="approve" data-caster-uid="${entryUid}">
                Accept
              </button>
              <button class="cta small ghost" type="button" data-caster-action="deny" data-caster-uid="${entryUid}">
                Decline
              </button>
            </div>
          </div>`;
        })
        .join("");
    }
  }

  if (adminStatus) {
    const pending = Array.isArray(state.casterRequests) ? state.casterRequests.length : 0;
    adminStatus.textContent = pending ? "" : "No pending caster requests.";
  }
}

function handleCasterRequest() {
  showToast?.("Sending caster request...", "info");
  const uid = auth.currentUser?.uid || null;
  if (!uid) {
    showToast?.("Sign in to request caster access.", "error");
    return;
  }
  if (getCasterEntryByUid(uid)) {
    showToast?.("You are already an approved caster.", "info");
    return;
  }
  if (getCasterRequestByUid(uid)) {
    showToast?.("Caster request already sent.", "info");
    return;
  }
  const profile = getCasterProfileFromUser(uid);
  if (!profile) {
    showToast?.("Could not read caster profile.", "error");
    return;
  }
  const nextRequests = [...(state.casterRequests || []), { ...profile, requestedAt: Date.now() }];
  casterDeps?.saveState?.({ casterRequests: nextRequests });
  showToast?.("Caster request sent.", "success");
  renderCasterSection();
}

function handleCasterRequestClick(event) {
  const button = event.target.closest("#requestCasterBtn");
  if (!button) return;
  event.preventDefault();
  handleCasterRequest();
}

function approveCasterRequest(uid) {
  if (!isAdmin) {
    showToast?.("Only admins can approve casters.", "error");
    return;
  }
  const requests = Array.isArray(state.casterRequests) ? state.casterRequests : [];
  const requestEntry = requests.find((entry) => entry.uid === uid);
  if (!requestEntry) return;
  const casters = Array.isArray(state.casters) ? state.casters : [];
  const hasCaster = casters.some((entry) => entry.uid === uid);
  const nextCasters = hasCaster
    ? casters
    : [...casters, { ...requestEntry, approvedAt: Date.now() }];
  const nextRequests = requests.filter((entry) => entry.uid !== uid);
  casterDeps?.saveState?.({ casters: nextCasters, casterRequests: nextRequests });
  showToast?.("Caster approved.", "success");
  renderCasterSection();
}

function denyCasterRequest(uid) {
  if (!isAdmin) {
    showToast?.("Only admins can decline caster requests.", "error");
    return;
  }
  const requests = Array.isArray(state.casterRequests) ? state.casterRequests : [];
  const nextRequests = requests.filter((entry) => entry.uid !== uid);
  casterDeps?.saveState?.({ casterRequests: nextRequests });
  showToast?.("Caster request removed.", "info");
  renderCasterSection();
}

function handleCasterAdminAction(event) {
  const button = event.target.closest("[data-caster-action]");
  if (!button) return;
  const uid = button.dataset.casterUid;
  if (!uid) return;
  if (button.dataset.casterAction === "approve") {
    approveCasterRequest(uid);
  } else if (button.dataset.casterAction === "deny") {
    denyCasterRequest(uid);
  }
}

function closeCastPopover() {
  if (!castPopover) return;
  castPopover.remove();
  castPopover = null;
  castPopoverMatchId = null;
}

async function getCasterStreamUrl(uid, fallback = "") {
  if (!uid) return fallback || "";
  if (casterStreamCache.has(uid)) return casterStreamCache.get(uid) || fallback || "";
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() || {} : {};
    const url = (data?.twitchUrl || "").trim();
    casterStreamCache.set(uid, url);
    return url || fallback || "";
  } catch (_) {
    return fallback || "";
  }
}

async function buildCastPopoverContent(matchId) {
  const cast = state.matchCasts?.[matchId] || null;
  if (!cast) return "";
  const casterName = escapeHtml(cast.name || "Caster");
  const twitchUrl = await getCasterStreamUrl(cast.uid, cast.twitchUrl || "");
  const safeUrl = sanitizeUrl(twitchUrl || "");
  const link = safeUrl
    ? `<a class="cast-popover-link" href="${escapeHtml(
        safeUrl
      )}" target="_blank" rel="noopener" aria-label="Open caster stream">
        <img src="img/SVG/glitch_flat_purple.svg" alt="Twitch" />
      </a>`
    : `<span class="cast-popover-link is-disabled" aria-label="No stream link">
        <img src="img/SVG/glitch_flat_purple.svg" alt="Twitch" />
      </span>`;
  return `<div class="cast-popover-title">Casters</div>
    <div class="cast-popover-divider"></div>
    <div class="cast-popover-item">
      <span class="cast-popover-name">${casterName}</span>
      ${link}
    </div>`;
}

function positionCastPopover(anchor) {
  if (!castPopover || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const popRect = castPopover.getBoundingClientRect();
  let top = rect.top + window.scrollY + rect.height + 8;
  let left = rect.left + window.scrollX + rect.width / 2 - popRect.width / 2;
  const maxLeft = window.scrollX + window.innerWidth - popRect.width - 12;
  const maxTop = window.scrollY + window.innerHeight - popRect.height - 12;
  left = Math.min(Math.max(left, 12 + window.scrollX), maxLeft);
  top = Math.min(Math.max(top, 12 + window.scrollY), maxTop);
  castPopover.style.left = `${left}px`;
  castPopover.style.top = `${top}px`;
}

function openCastPopover(matchId, anchor) {
  if (!matchId || !anchor) return;
  if (castPopover && castPopoverMatchId === matchId) {
    closeCastPopover();
    return;
  }
  closeCastPopover();
  const content = `<div class="cast-popover-title">Casters</div>
    <div class="cast-popover-divider"></div>
    <div class="cast-popover-item">
      <span class="cast-popover-name">Loading…</span>
      <span class="cast-popover-link is-disabled" aria-label="Loading stream link">
        <img src="img/SVG/glitch_flat_purple.svg" alt="Twitch" />
      </span>
    </div>`;
  const pop = document.createElement("div");
  pop.className = "cast-popover";
  pop.dataset.matchId = matchId;
  pop.innerHTML = content;
  document.body.appendChild(pop);
  castPopover = pop;
  castPopoverMatchId = matchId;
  positionCastPopover(anchor);
  void refreshCastPopover(matchId);
}

async function refreshCastPopover(matchId) {
  if (!castPopover || castPopoverMatchId !== matchId) return;
  const content = await buildCastPopoverContent(matchId);
  if (!content) {
    closeCastPopover();
    return;
  }
  castPopover.innerHTML = content;
  const anchor = document.querySelector(
    `.cast-indicator-btn[data-match-id="${castPopoverMatchId}"]`
  );
  if (anchor) positionCastPopover(anchor);
}

function handleCastIndicatorClick(event) {
  const button = event.target.closest(".cast-indicator-btn");
  if (!button) return;
  event.preventDefault();
  const matchId = button.dataset.matchId;
  openCastPopover(matchId, button);
}

function handleGlobalCastDismiss(event) {
  if (!castPopover) return;
  const target = event.target;
  if (target.closest(".cast-popover")) return;
  if (target.closest(".cast-indicator-btn")) return;
  closeCastPopover();
}

function handleGlobalCastKey(event) {
  if (event.key !== "Escape") return;
  closeCastPopover();
}

function handleGlobalCastReposition() {
  if (!castPopover) return;
  const anchor = document.querySelector(
    `.cast-indicator-btn[data-match-id="${castPopoverMatchId}"]`
  );
  if (!anchor) {
    closeCastPopover();
    return;
  }
  positionCastPopover(anchor);
}

export function initCasterControls(deps = {}) {
  casterDeps = deps;
  const requestBtn = document.getElementById("requestCasterBtn");
  if (requestBtn) requestBtn.addEventListener("click", handleCasterRequest);
  const requestList = document.getElementById("casterRequestList");
  if (requestList) requestList.addEventListener("click", handleCasterAdminAction);
  document.addEventListener("click", handleCasterRequestClick);
  document.addEventListener("click", handleCastIndicatorClick);
  document.addEventListener("click", handleGlobalCastDismiss);
  document.addEventListener("keydown", handleGlobalCastKey);
  window.addEventListener("resize", handleGlobalCastReposition);
  window.addEventListener("scroll", handleGlobalCastReposition, { passive: true });
  renderCasterSection();
}
