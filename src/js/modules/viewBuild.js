import DOMPurify from "dompurify";
import { auth, db, initializeAuthUI } from "../../app.js"; // ✅ Reuse Firebase app
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  setDoc,
  increment,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  getDocs,
  where,
  startAfter,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import {
  formatActionText,
  formatWorkersOrTimestampText,
} from "../modules/textFormatters.js"; // ✅ Format build steps
import {
  MapAnnotations,
  renderMapCards,
  loadMapsOnDemand,
} from "./interactive_map.js"; // ✅ Map support
import { updateYouTubeEmbed, clearYouTubeEmbed } from "./youtube.js";
import { getPublisherClanInfo } from "./community.js";
import { formatShortDate } from "./modal.js";
import { showToast } from "./toastHandler.js";
import { bannedWords } from "../data/bannedWords.js";

initializeAuthUI();

const adminEmails = (
  Array.isArray(window?.adminEmails) ? window.adminEmails : []
)
  .map((email) => (typeof email === "string" ? email.toLowerCase() : ""))
  .filter(Boolean);

const DEFAULT_AVATAR_URL = "img/avatar/marine_avatar_1.webp";
const MAX_COMMENTS_TO_DISPLAY = 50;

let commentsUnsubscribe = null;
let latestComments = [];
const commentCache = new Map();
let currentBuildId = "";
let cachedUserProfile = null;
let pendingCommentUser = null;
let hasPendingCommentUser = false;
let pendingCommentRender = false;
let pendingCommentsListHtml = null;
let hasPendingCommentsListHtml = false;
let commentShellInitialized = false;
const userProfileCache = new Map();

const MAX_THREAD_DEPTH = 7;
const REPLY_BATCH_SIZE = 10;

const commentThreadState = {
  replyVisibility: new Map(),
  nodesById: new Map(),
  adjacency: new Map(),
  replyCounts: new Map(),
  totalReplyCounts: new Map(),
  roots: [],
  visibleReplies: new Map(),
  replyPagination: new Map(),
};

const blockedUsersState = {
  set: new Set(),
  unsubscribe: null,
};

let openIdentityMenu = null;
let openActionsMenu = null;

function closeOpenIdentityMenu(options = {}) {
  if (!openIdentityMenu) return;

  const { focusTrigger = false } = options;
  const menuToClose = openIdentityMenu;

  if (menuToClose.isConnected) {
    menuToClose.classList.remove("comment-identity-wrapper--open");
    const toggleBtn = menuToClose.querySelector(".comment-identity");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "false");
      if (focusTrigger) {
        toggleBtn.focus();
      }
    }
  }

  openIdentityMenu = null;
}

function closeOpenActionsMenu(options = {}) {
  if (!openActionsMenu) return;

  const { focusTrigger = false } = options;
  const menuToClose = openActionsMenu;

  menuToClose.classList.remove("comment-actions-menu--open");
  const toggleBtn = menuToClose.querySelector(".comment-actions-menu-toggle");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", "false");
    if (focusTrigger) {
      toggleBtn.focus();
    }
  }

  openActionsMenu = null;
}

function createCommentActionsMenu({ canEdit, canRemove, onEdit, onRemove }) {
  if (!canEdit && !canRemove) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "comment-actions-menu";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "comment-actions-menu-toggle";
  toggleBtn.setAttribute("aria-haspopup", "true");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.setAttribute("aria-label", "Comment options");
  toggleBtn.innerHTML = '<span aria-hidden="true">⋮</span>';

  const menuList = document.createElement("div");
  menuList.className = "comment-actions-menu-list";

  if (canEdit && typeof onEdit === "function") {
    const editItem = document.createElement("button");
    editItem.type = "button";
    editItem.className = "comment-actions-menu-item";
    const editIcon = document.createElement("img");
    editIcon.src = "img/SVG/pencil.svg";
    editIcon.alt = "";
    editIcon.setAttribute("aria-hidden", "true");
    editIcon.className = "comment-actions-menu-item-icon";

    const editLabel = document.createElement("span");
    editLabel.className = "comment-actions-menu-item-label";
    editLabel.textContent = "Edit";

    editItem.appendChild(editIcon);
    editItem.appendChild(editLabel);
    editItem.addEventListener("click", () => {
      closeOpenActionsMenu();
      onEdit();
    });
    menuList.appendChild(editItem);
  }

  if (canRemove && typeof onRemove === "function") {
    const removeItem = document.createElement("button");
    removeItem.type = "button";
    removeItem.className =
      "comment-actions-menu-item comment-actions-menu-item--danger";

    const removeIcon = document.createElement("img");
    removeIcon.src = "img/SVG/trash.svg";
    removeIcon.alt = "";
    removeIcon.setAttribute("aria-hidden", "true");
    removeIcon.className = "comment-actions-menu-item-icon";

    const removeLabel = document.createElement("span");
    removeLabel.className = "comment-actions-menu-item-label";
    removeLabel.textContent = "Remove";

    removeItem.appendChild(removeIcon);
    removeItem.appendChild(removeLabel);
    removeItem.addEventListener("click", () => {
      onRemove();
    });
    menuList.appendChild(removeItem);
  }

  if (!menuList.childElementCount) {
    return null;
  }

  toggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    if (openActionsMenu && openActionsMenu !== wrapper) {
      closeOpenActionsMenu();
    }

    const willOpen = !wrapper.classList.contains("comment-actions-menu--open");

    if (willOpen) {
      closeOpenIdentityMenu();
      wrapper.classList.add("comment-actions-menu--open");
      toggleBtn.setAttribute("aria-expanded", "true");
      openActionsMenu = wrapper;
    } else {
      closeOpenActionsMenu();
    }
  });

  wrapper.addEventListener("focusout", (event) => {
    const nextFocusTarget = event.relatedTarget;
    if (nextFocusTarget && wrapper.contains(nextFocusTarget)) {
      return;
    }
    if (openActionsMenu === wrapper) {
      closeOpenActionsMenu();
    }
  });

  menuList.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  wrapper.appendChild(toggleBtn);
  wrapper.appendChild(menuList);

  return wrapper;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const bannedWordsPattern = bannedWords
  .filter((word) => typeof word === "string" && word.trim().length > 0)
  .map((word) => escapeRegExp(word.trim()))
  .join("|");

const bannedWordsRegex = bannedWordsPattern
  ? new RegExp(`(${bannedWordsPattern})`, "gi")
  : null;

function buildCommentSectionMarkup() {
  return `
    <div class="comment-section-header">
      <h3>Comments <span id="commentsCount" class="comment-count">0 comments</span></h3>
      <button id="commentSignInBtn" class="comment-signin-btn" type="button">Sign in to comment</button>
    </div>
    <div id="commentForm" class="comment-form" style="display: none;">
      <textarea id="newCommentInput" placeholder="Write a comment..."></textarea>
      <button id="postCommentBtn" type="button">Post</button>
    </div>
    <p id="commentSignInPrompt" class="comment-signin-prompt">Sign in to share your thoughts.</p>
    <div id="commentsList" class="comments-list">
      <p class="comment-loading">Loading comments...</p>
    </div>
  `;
}

function ensureCommentSectionStructure() {
  const viewBuildContainer = document.querySelector(".view-build-container");
  if (!viewBuildContainer) return null;

  let commentSection = viewBuildContainer.querySelector(".comment-section");
  const requiredIds = [
    "commentsList",
    "commentForm",
    "commentSignInPrompt",
    "commentSignInBtn",
    "newCommentInput",
    "postCommentBtn",
    "commentsCount",
  ];

  if (!commentSection) {
    commentSection = document.createElement("div");
    commentSection.className = "comment-section";
    commentSection.innerHTML = buildCommentSectionMarkup();

    const mainLayout = viewBuildContainer.querySelector(".main-layout");

    if (mainLayout) {
      // ✅ Place comment section *after* main-layout (bottom of page)
      mainLayout.insertAdjacentElement("afterend", commentSection);
    } else {
      // fallback if main-layout not found
      viewBuildContainer.appendChild(commentSection);
    }
  } else {
    const isMissingRequiredChild = requiredIds.some(
      (id) => !commentSection.querySelector(`#${id}`)
    );

    if (isMissingRequiredChild) {
      commentSection.innerHTML = buildCommentSectionMarkup();
    }
  }

  return {
    section: commentSection,
    commentsList: commentSection.querySelector("#commentsList"),
    commentForm: commentSection.querySelector("#commentForm"),
    signInPrompt: commentSection.querySelector("#commentSignInPrompt"),
    signInButton: commentSection.querySelector("#commentSignInBtn"),
    textarea: commentSection.querySelector("#newCommentInput"),
    postButton: commentSection.querySelector("#postCommentBtn"),
    commentsCount: commentSection.querySelector("#commentsCount"),
  };
}

const backButton = document.getElementById("backButton");
const pageBackButton = document.getElementById("pageBackButton");
const ratingItem = document.getElementById("ratingItem");
const infoGrid = document.querySelector(".build-info-grid");
const mobileInfoItem = document.querySelector(
  ".build-info-item.mobile-info"
);

function removeDeprecatedCategoryMetadata() {
  const desktopCategoryItems = document.querySelectorAll(
    ".build-info-item.desktop-info"
  );

  desktopCategoryItems.forEach((item) => {
    const labelText = item
      .querySelector("label")
      ?.textContent?.trim()
      .toLowerCase();

    if (labelText === "category") {
      item.remove();
    }
  });

  const mobileCategoryRows = document.querySelectorAll(
    ".build-info-item.mobile-info .info-row, .build-info-item.mobile-info .info-pair"
  );

  mobileCategoryRows.forEach((row) => {
    const labelText = row
      .querySelector("label, .info-label")
      ?.textContent?.trim()
      .toLowerCase();

    if (labelText === "category") {
      row.remove();
    }
  });
}

removeDeprecatedCategoryMetadata();
const buildOrderContainer = document.getElementById("buildOrder");
const mainLayout = document.querySelector(".main-layout");
let focusBtn = document.getElementById("openFocusModal");
let focusModal = document.getElementById("focusModal");
let closeFocusBtn = document.getElementById("closeFocusModal");
let increaseFontBtn = document.getElementById("increaseFontBtn");
let decreaseFontBtn = document.getElementById("decreaseFontBtn");
let focusContent = document.getElementById("focusContent");
let focusFontSize = 1;

function sanitizePlainText(text) {
  if (typeof text !== "string") return "";
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

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
  ]; // Support hosted + local assets
  if (allowedStarts.some((prefix) => lower.startsWith(prefix))) {
    return trimmed;
  }
  return DEFAULT_AVATAR_URL;
}

function filterBannedWords(text) {
  if (typeof text !== "string") return "";
  if (!text.trim() || !bannedWordsRegex) return text;
  return text.replace(bannedWordsRegex, "*****");
}

function sanitizeAndFilterComment(text) {
  const sanitized = sanitizePlainText(text);
  return filterBannedWords(sanitized);
}

function normalizeCommentText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\r\n/g, "\n");
}

function formatCommentDisplayHtml(text) {
  if (typeof text !== "string" || text.length === 0) {
    return "";
  }

  const lines = text.split(/\r?\n/);
  const formattedLines = lines.map((line) => {
    if (!line || !line.trim()) return "";
    return formatActionText(line);
  });

  const combinedHtml = formattedLines.join("<br>");

  return DOMPurify.sanitize(combinedHtml, {
    ALLOWED_TAGS: ["br", "span", "strong", "img", "svg", "path", "sup"],
    ALLOWED_ATTR: [
      "class",
      "src",
      "alt",
      "data-tooltip",
      "style",
      "height",
      "width",
      "viewBox",
      "fill",
      "xmlns",
      "d",
    ],
  });
}

async function submitCommentToFirestore(buildId, user, text, parentId = null) {
  if (!buildId || !user) return false;

  const profile = await loadCurrentUserProfile();
  const username = profile?.username || "Anonymous";
  const photoURL = sanitizeAvatarUrl(profile?.photoURL || "");

  await addDoc(collection(db, `publishedBuilds/${buildId}/comments`), {
    userId: user.uid,
    username,
    photoURL,
    text,
    isEdited: false,
    parentId: parentId || null,
    timestamp: serverTimestamp(),
  });

  return true;
}

function prepareCommentText(rawInput) {
  const trimmed = typeof rawInput === "string" ? rawInput.trim() : "";

  if (trimmed.length < 2) {
    showToast("⚠️ Comment must be at least 2 characters.", "warning");
    return null;
  }

  if (trimmed.length > 1200) {
    showToast(
      "⚠️ Comment is too long. Please keep it under 1200 characters.",
      "warning"
    );
    return null;
  }

  const sanitized = sanitizePlainText(trimmed);
  if (!sanitized || sanitized.length < 2) {
    showToast("⚠️ Please enter a valid comment.", "warning");
    return null;
  }

  const filtered = filterBannedWords(sanitized);
  if (!filtered || filtered.length < 2) {
    showToast("⚠️ Please enter a valid comment.", "warning");
    return null;
  }

  return filtered;
}

function formatRelativeTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffSeconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 45) return "Just now";
  if (diffSeconds < 90) return "1 minute ago";

  const units = [
    { seconds: 60, label: "minute" },
    { seconds: 3600, label: "hour" },
    { seconds: 86400, label: "day" },
    { seconds: 604800, label: "week" },
    { seconds: 2592000, label: "month" },
    { seconds: 31536000, label: "year" },
  ];

  for (let i = units.length - 1; i >= 0; i--) {
    const { seconds, label } = units[i];
    if (diffSeconds >= seconds) {
      const value = Math.floor(diffSeconds / seconds);
      return `${value} ${label}${value !== 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
}

function updateCommentCount(count) {
  ensureCommentSectionStructure();
  const countEl = document.getElementById("commentsCount");
  if (!countEl) return;

  let label = `${count} comments`;
  if (count === 0) label = "0 comments";
  else if (count === 1) label = "1 comment";

  countEl.textContent = label;
}

function ensureCommentShellVisible() {
  const { section: commentSection } = ensureCommentSectionStructure() || {};
  if (!commentSection) return false;

  if (!commentShellInitialized) {
    commentSection.classList.add("comment-section--ready");
  }

  if (typeof window !== "undefined") {
    try {
      const computed = window.getComputedStyle(commentSection);
      if (computed?.display === "none") {
        commentSection.style.display = "flex";
      }
    } catch (err) {
      commentSection.style.display = "flex";
    }
  }

  if (
    !commentSection.style.display ||
    commentSection.style.display === "none"
  ) {
    commentSection.style.display = "flex";
  }

  commentShellInitialized = true;
  return true;
}

function setCommentsListContent(html) {
  const { commentsList } = ensureCommentSectionStructure() || {};
  if (!commentsList) {
    pendingCommentRender = true;
    pendingCommentsListHtml = html;
    hasPendingCommentsListHtml = true;
    return false;
  }

  ensureCommentShellVisible();

  commentsList.innerHTML = html;
  pendingCommentRender = false;
  pendingCommentsListHtml = null;
  hasPendingCommentsListHtml = false;
  return true;
}

function resetCommentThreadData() {
  commentThreadState.nodesById = new Map();
  commentThreadState.adjacency = new Map();
  commentThreadState.replyCounts = new Map();
  commentThreadState.totalReplyCounts = new Map();
  commentThreadState.roots = [];
}

function pruneReplyVisibility() {
  commentThreadState.replyVisibility.forEach((_, commentId) => {
    if (!commentThreadState.nodesById.has(commentId)) {
      commentThreadState.replyVisibility.delete(commentId);
    }
  });
}

function pruneVisibleReplies() {
  commentThreadState.visibleReplies.forEach((childIds, parentId) => {
    if (!commentThreadState.nodesById.has(parentId)) {
      commentThreadState.visibleReplies.delete(parentId);
      return;
    }

    const filtered = childIds.filter((childId) =>
      commentThreadState.nodesById.has(childId)
    );

    if (filtered.length) {
      commentThreadState.visibleReplies.set(parentId, filtered);
    } else {
      commentThreadState.visibleReplies.delete(parentId);
    }
  });
}

function pruneReplyPagination() {
  commentThreadState.replyPagination.forEach((_, parentId) => {
    if (!commentThreadState.nodesById.has(parentId)) {
      commentThreadState.replyPagination.delete(parentId);
    }
  });
}

function recomputeTotalReplyCounts() {
  const totals = new Map();

  const compute = (commentId) => {
    if (totals.has(commentId)) return totals.get(commentId);

    const children = commentThreadState.adjacency.get(commentId) || [];
    let total = 0;

    children.forEach((childId) => {
      total += 1 + compute(childId);
    });

    totals.set(commentId, total);
    return total;
  };

  commentThreadState.nodesById.forEach((_, commentId) => {
    if (!totals.has(commentId)) {
      compute(commentId);
    }
  });

  commentThreadState.totalReplyCounts = totals;
}

function hydrateCommentThreadState() {
  const rawById = new Map();
  commentCache.forEach((data, id) => {
    if (!id || !data) return;
    rawById.set(id, { ...data });
  });

  const hiddenCache = new Map();
  const isHidden = (commentId) => {
    if (!rawById.has(commentId)) return true;
    if (hiddenCache.has(commentId)) return hiddenCache.get(commentId);

    const data = rawById.get(commentId);
    let hidden = false;

    if (blockedUsersState.set.has(data.userId)) {
      hidden = true;
    } else if (data.parentId && rawById.has(data.parentId)) {
      hidden = isHidden(data.parentId);
    }

    hiddenCache.set(commentId, hidden);
    return hidden;
  };

  const nodesById = new Map();
  const adjacency = new Map();
  const replyCounts = new Map();
  const roots = [];

  rawById.forEach((data, id) => {
    if (isHidden(id)) return;
    nodesById.set(id, { id, data });
  });

  const sortIdsByTimestamp = (ids) =>
    ids.sort((a, b) => {
      const aData = nodesById.get(a)?.data;
      const bData = nodesById.get(b)?.data;
      return (
        (aData?.resolvedTimestampMs || aData?.timestamp?.toMillis?.() || 0) -
        (bData?.resolvedTimestampMs || bData?.timestamp?.toMillis?.() || 0)
      );
    });

  nodesById.forEach((node) => {
    const parentId = node.data?.parentId || null;
    if (parentId && nodesById.has(parentId)) {
      if (!adjacency.has(parentId)) adjacency.set(parentId, []);
      adjacency.get(parentId).push(node.id);
    } else {
      roots.push(node.id);
    }
  });

  adjacency.forEach((ids, parentId) => {
    sortIdsByTimestamp(ids);
    replyCounts.set(parentId, ids.length);
  });

  sortIdsByTimestamp(roots);

  commentThreadState.nodesById = nodesById;
  commentThreadState.adjacency = adjacency;
  commentThreadState.replyCounts = replyCounts;
  commentThreadState.roots = roots;
  recomputeTotalReplyCounts();
  pruneReplyVisibility();
  pruneVisibleReplies();
  pruneReplyPagination();

  commentThreadState.visibleReplies.forEach((visibleIds, parentId) => {
    const allChildren = commentThreadState.adjacency.get(parentId) || [];
    if (!allChildren.length) {
      commentThreadState.visibleReplies.delete(parentId);
      return;
    }

    const existingSet = new Set(visibleIds);
    const ordered = allChildren.filter((childId) => existingSet.has(childId));
    const appended = allChildren.filter((childId) => !existingSet.has(childId));

    commentThreadState.visibleReplies.set(parentId, [...ordered, ...appended]);
  });
}

function getChildIds(commentId) {
  const children = commentThreadState.adjacency.get(commentId);
  return children ? [...children] : [];
}

function getReplyCount(commentId) {
  return commentThreadState.replyCounts.get(commentId) || 0;
}

function getTotalReplyCount(commentId) {
  return commentThreadState.totalReplyCounts.get(commentId) || 0;
}

function getVisibleReplyIds(commentId) {
  return commentThreadState.visibleReplies.get(commentId) || [];
}

function setVisibleReplyIds(commentId, ids) {
  if (!Array.isArray(ids) || !ids.length) {
    commentThreadState.visibleReplies.delete(commentId);
    return;
  }
  const uniqueIds = Array.from(new Set(ids));
  commentThreadState.visibleReplies.set(commentId, uniqueIds);
}

function ensureReplyPaginationState(commentId) {
  if (!commentThreadState.replyPagination.has(commentId)) {
    commentThreadState.replyPagination.set(commentId, {
      lastDoc: null,
      hasMore: true,
      loading: false,
    });
  }
  return commentThreadState.replyPagination.get(commentId);
}

function insertChildInAdjacency(parentId, childId, childData) {
  if (!parentId || !childId || !childData) return;
  const existing = commentThreadState.adjacency.get(parentId) || [];
  if (existing.includes(childId)) return;

  const timestamp =
    childData.resolvedTimestampMs ||
    childData.timestamp?.toMillis?.() ||
    childData.timestamp?.seconds * 1000 ||
    0;

  let inserted = false;
  for (let index = 0; index < existing.length; index += 1) {
    const siblingId = existing[index];
    const siblingData = commentThreadState.nodesById.get(siblingId)?.data;
    const siblingTimestamp =
      siblingData?.resolvedTimestampMs ||
      siblingData?.timestamp?.toMillis?.() ||
      siblingData?.timestamp?.seconds * 1000 ||
      0;
    if (timestamp < siblingTimestamp) {
      existing.splice(index, 0, childId);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    existing.push(childId);
  }

  commentThreadState.adjacency.set(parentId, existing);
  commentThreadState.replyCounts.set(parentId, existing.length);
}

function createMoreRepliesButton(parentId, depth) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "comment-more-replies-btn";
  button.dataset.commentId = parentId;
  button.textContent = `View ${REPLY_BATCH_SIZE} more repl${
    REPLY_BATCH_SIZE === 1 ? "y" : "ies"
  }`;

  button.addEventListener("click", async () => {
    const container = document.querySelector(
      `.comment-replies[data-comment-id="${parentId}"]`
    );
    if (!container) return;

    if (button.disabled) return;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Loading...";

    try {
      await loadRepliesForComment(parentId, depth, {
        container,
        reset: false,
      });
    } catch (error) {
      console.error("❌ Failed to load additional replies:", error);
      showToast("❌ Unable to load more replies right now.", "error");
      button.disabled = false;
      button.textContent = originalLabel;
      return;
    }

    button.disabled = false;
    button.textContent = originalLabel;
  });

  return button;
}

function renderRepliesContainer(container, parentId, depth, options = {}) {
  if (!container) return;
  const { animateIds = [] } = options;
  if (typeof depth === "number" && !Number.isNaN(depth)) {
    container.dataset.depth = String(depth);
  }
  const visibleChildren = getVisibleReplyIds(parentId);

  const existingNodes = new Map();
  Array.from(
    container.querySelectorAll(":scope > .comment-thread")
  ).forEach((threadNode) => {
    if (threadNode instanceof HTMLElement) {
      existingNodes.set(threadNode.dataset.commentId, threadNode);
    }
  });

  const existingButton = container.querySelector(
    ":scope > .comment-more-replies-btn"
  );
  if (existingButton) existingButton.remove();

  visibleChildren.forEach((childId) => {
    let childThread = existingNodes.get(childId);
    if (childThread) {
      existingNodes.delete(childId);
    } else {
      childThread = createCommentThreadElement(childId, depth);
      if (!childThread) return;
      if (animateIds.includes(childId)) {
        childThread.classList.add("comment-thread--entering");
        requestAnimationFrame(() => {
          childThread.classList.remove("comment-thread--entering");
        });
      }
    }

    container.appendChild(childThread);
  });

  existingNodes.forEach((node) => node.remove());

  const pagination = commentThreadState.replyPagination.get(parentId);
  if (pagination?.hasMore) {
    container.appendChild(createMoreRepliesButton(parentId, depth));
  }

  container.dataset.loaded = visibleChildren.length ? "true" : "false";
  if (container.dataset.expanded === "true") {
    container.style.height = "auto";
  } else {
    container.style.height = "0px";
  }
}

async function loadRepliesForComment(parentId, depth, options = {}) {
  if (!currentBuildId || !parentId) return [];
  const { container = null, reset = false } = options;

  const pagination = ensureReplyPaginationState(parentId);

  if (reset) {
    pagination.lastDoc = null;
    pagination.hasMore = true;
    pagination.loading = false;
    commentThreadState.visibleReplies.delete(parentId);
  }

  if (pagination.loading) return [];
  if (!pagination.hasMore && !reset) return [];

  pagination.loading = true;

  try {
    const repliesRef = collection(
      db,
      `publishedBuilds/${currentBuildId}/comments`
    );
    const constraints = [
      where("parentId", "==", parentId),
      orderBy("timestamp", "asc"),
    ];

    if (pagination.lastDoc) {
      constraints.push(startAfter(pagination.lastDoc));
    }

    constraints.push(limit(REPLY_BATCH_SIZE));

    const repliesQuery = query(repliesRef, ...constraints);
    const snapshot = await getDocs(repliesQuery);

    const docs = snapshot.docs;
    const enrichedReplies = await Promise.all(
      docs.map((docSnap) =>
        enrichCommentEntry({ id: docSnap.id, data: docSnap.data() })
      )
    );

    const appendedIds = [];
    const visibleSet = new Set(getVisibleReplyIds(parentId));

    enrichedReplies.forEach((entry) => {
      if (!entry?.id || !entry?.data) return;

      commentCache.set(entry.id, entry.data);

      const existingIndex = latestComments.findIndex(
        (existing) => existing.id === entry.id
      );
      if (existingIndex === -1) {
        latestComments.push(entry);
      } else {
        latestComments[existingIndex] = entry;
      }

      commentThreadState.nodesById.set(entry.id, {
        id: entry.id,
        data: entry.data,
      });

      insertChildInAdjacency(parentId, entry.id, entry.data);

      if (!visibleSet.has(entry.id)) {
        visibleSet.add(entry.id);
        appendedIds.push(entry.id);
      }
    });

    const orderedVisible = (commentThreadState.adjacency.get(parentId) || []).filter(
      (id) => visibleSet.has(id)
    );
    setVisibleReplyIds(parentId, orderedVisible);

    recomputeTotalReplyCounts();

    pagination.lastDoc = docs.length ? docs[docs.length - 1] : pagination.lastDoc;
    pagination.hasMore = docs.length === REPLY_BATCH_SIZE;

    if (container) {
      renderRepliesContainer(container, parentId, depth, {
        animateIds: appendedIds,
      });
    }

    pagination.loading = false;
    updateReplyToggleLabel(parentId);

    return appendedIds;
  } catch (error) {
    pagination.loading = false;

    if (reset) {
      const existingChildren = getChildIds(parentId);
      if (existingChildren.length && container) {
        setVisibleReplyIds(parentId, existingChildren);
        renderRepliesContainer(container, parentId, depth, {
          animateIds: existingChildren,
        });
      }
    }

    throw error;
  }
}

function animateReplies(container, expand) {
  if (!container) return;

  const startHeight = container.scrollHeight;
  container.style.overflow = "hidden";

  if (expand) {
    container.style.height = "0px";
    container.style.opacity = "0";
    container.dataset.expanded = "true";

    requestAnimationFrame(() => {
      const targetHeight = container.scrollHeight || startHeight;
      container.style.height = `${targetHeight}px`;
      container.style.opacity = "1";
    });
  } else {
    container.style.height = `${startHeight}px`;
    container.style.opacity = "1";

    requestAnimationFrame(() => {
      container.dataset.expanded = "false";
      container.style.height = "0px";
      container.style.opacity = "0";
    });
  }

  const cleanup = (event) => {
    if (event.propertyName !== "height") return;
    if (container.dataset.expanded === "true") {
      container.style.height = "auto";
      container.style.overflow = "visible";
    } else {
      container.style.overflow = "hidden";
    }
    container.removeEventListener("transitionend", cleanup);
  };

  container.addEventListener("transitionend", cleanup);
}

function updateReplyToggleLabel(commentId) {
  const toggleBtn = document.querySelector(
    `.comment-toggle-replies-btn[data-comment-id="${commentId}"]`
  );
  if (!toggleBtn) return;

  const directReplies = getReplyCount(commentId);
  const totalReplies = getTotalReplyCount(commentId);
  const isExpanded =
    commentThreadState.replyVisibility.get(commentId) || false;

  if (!directReplies) {
    toggleBtn.textContent = isExpanded ? "Hide replies" : "View replies";
    return;
  }

  const displayCount = totalReplies || directReplies;

  toggleBtn.textContent = isExpanded
    ? "Hide replies"
    : `View ${displayCount} repl${displayCount === 1 ? "y" : "ies"}`;
}

function createCommentFooter(cardEl, commentId, commentData, depth) {
  const footer = document.createElement("div");
  footer.className = "comment-footer";

  const actionsLeft = document.createElement("div");
  actionsLeft.className = "comment-footer-left";

  if (depth < MAX_THREAD_DEPTH - 1) {
    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "comment-footer-reply";
    replyBtn.textContent = "Reply";
    replyBtn.addEventListener("click", () => toggleReplyForm(cardEl, commentId));
    actionsLeft.appendChild(replyBtn);
  }

  const actionsRight = document.createElement("div");
  actionsRight.className = "comment-footer-right";

  const directReplies = getReplyCount(commentId);
  const totalReplies = getTotalReplyCount(commentId);
  const isExpanded = commentThreadState.replyVisibility.get(commentId) || false;

  if (directReplies > 0) {
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "comment-toggle-replies-btn";
    toggleBtn.dataset.commentId = commentId;
    const displayCount = totalReplies || directReplies;
    toggleBtn.textContent = isExpanded
      ? "Hide replies"
      : `View ${displayCount} repl${displayCount === 1 ? "y" : "ies"}`;
    toggleBtn.addEventListener("click", () => toggleReplies(commentId));
    actionsRight.appendChild(toggleBtn);
  }

  const hasLeftActions = actionsLeft.childElementCount > 0;
  const hasRightActions = actionsRight.childElementCount > 0;

  if (!hasLeftActions && !hasRightActions) {
    return null;
  }

  if (hasLeftActions) {
    footer.appendChild(actionsLeft);
  }
  if (hasRightActions) {
    footer.appendChild(actionsRight);
  }

  return footer;
}

function createCommentCard(commentId, depth) {
  const node = commentThreadState.nodesById.get(commentId);
  if (!node) return null;
  const commentData = { ...node.data };

  const currentUserId = auth.currentUser?.uid || "";
  const currentUserEmail = auth.currentUser?.email
    ? auth.currentUser.email.toLowerCase()
    : "";
  const isAdminUser = currentUserEmail
    ? adminEmails.includes(currentUserEmail)
    : false;

  const username = sanitizePlainText(commentData.username || "Anonymous");
  const baseText =
    typeof commentData.text === "string" ? commentData.text : "";
  const filteredText = sanitizeAndFilterComment(baseText);
  const safeHtml = formatCommentDisplayHtml(filteredText);

  let timestampDate = commentData.resolvedTimestamp;
  if (
    !(timestampDate instanceof Date) ||
    Number.isNaN(timestampDate?.getTime?.())
  ) {
    try {
      if (commentData.timestamp?.toDate) {
        timestampDate = commentData.timestamp.toDate();
      } else if (commentData.timestamp instanceof Date) {
        timestampDate = commentData.timestamp;
      } else if (commentData.timestamp) {
        const parsed = new Date(commentData.timestamp);
        timestampDate = Number.isNaN(parsed.getTime()) ? null : parsed;
      }
    } catch (err) {
      timestampDate = null;
    }
  }

  const timeLabel = formatRelativeTime(timestampDate || new Date());
  const isOwner = commentData.userId === currentUserId;
  const allowDelete = isOwner || isAdminUser;
  const avatarSource =
    commentData.photoURL || cachedUserProfile?.photoURL || DEFAULT_AVATAR_URL;
  const effectiveAvatar = sanitizeAvatarUrl(avatarSource);

  const card = document.createElement("div");
  card.className = "comment-card";
  if (depth > 0) card.classList.add("comment-card--child");
  card.dataset.commentId = commentId;
  card.dataset.userId = commentData.userId || "";
  card.dataset.depth = String(depth);

  const avatarEl = document.createElement("img");
  avatarEl.className = "comment-avatar";
  avatarEl.src = effectiveAvatar;
  avatarEl.alt = `${username}'s avatar`;
  avatarEl.loading = "lazy";

  const contentEl = document.createElement("div");
  contentEl.className = "comment-content";

  const headerEl = document.createElement("div");
  headerEl.className = "comment-header";

  const metaGroup = document.createElement("div");
  metaGroup.className = "comment-meta-group";

  const identityWrapper = document.createElement("div");
  identityWrapper.className = "comment-identity-wrapper";

  const usernameBtn = document.createElement("button");
  usernameBtn.type = "button";
  usernameBtn.className = "comment-identity";
  usernameBtn.textContent = username || "Anonymous";
  usernameBtn.setAttribute("aria-haspopup", "menu");
  usernameBtn.setAttribute("aria-expanded", "false");
  usernameBtn.setAttribute(
    "aria-label",
    `Show options for ${username || "this user"}`
  );

  const identityButtonId = `comment-identity-button-${commentId}`;
  const identityMenuId = `comment-identity-menu-${commentId}`;
  usernameBtn.id = identityButtonId;
  usernameBtn.setAttribute("aria-controls", identityMenuId);

  const identityMenu = document.createElement("div");
  identityMenu.className = "comment-identity-menu";
  identityMenu.setAttribute("role", "menu");
  identityMenu.id = identityMenuId;
  identityMenu.setAttribute("aria-labelledby", identityButtonId);

  const blockMenuItem = document.createElement("button");
  blockMenuItem.type = "button";
  blockMenuItem.className =
    "comment-identity-menu-item comment-identity-menu-block";
  blockMenuItem.setAttribute("role", "menuitem");

  const isBlockedUser = blockedUsersState.set.has(commentData.userId);
  blockMenuItem.textContent = isBlockedUser ? "Blocked" : "Block user";

  if (!commentData.userId) {
    blockMenuItem.disabled = true;
    blockMenuItem.setAttribute("aria-disabled", "true");
    blockMenuItem.textContent = "Block unavailable";
  } else if (commentData.userId === currentUserId) {
    blockMenuItem.disabled = true;
    blockMenuItem.setAttribute("aria-disabled", "true");
    blockMenuItem.title = "You cannot block yourself";
  } else if (isBlockedUser) {
    blockMenuItem.disabled = true;
    blockMenuItem.setAttribute("aria-disabled", "true");
  } else {
    blockMenuItem.addEventListener("click", (event) => {
      event.stopPropagation();
      closeOpenIdentityMenu();
      blockUser(commentData.userId, commentData.username || "this user");
    });
  }

  identityMenu.appendChild(blockMenuItem);
  identityWrapper.appendChild(usernameBtn);
  identityWrapper.appendChild(identityMenu);

  usernameBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    if (openIdentityMenu && openIdentityMenu !== identityWrapper) {
      closeOpenIdentityMenu();
    }

    const willOpen = !identityWrapper.classList.contains(
      "comment-identity-wrapper--open"
    );

    if (willOpen) {
      identityWrapper.classList.add("comment-identity-wrapper--open");
      usernameBtn.setAttribute("aria-expanded", "true");
      openIdentityMenu = identityWrapper;
    } else {
      identityWrapper.classList.remove("comment-identity-wrapper--open");
      usernameBtn.setAttribute("aria-expanded", "false");
      openIdentityMenu = null;
    }
  });

  identityWrapper.addEventListener("focusout", (event) => {
    const nextFocusTarget = event.relatedTarget;
    if (nextFocusTarget && identityWrapper.contains(nextFocusTarget)) {
      return;
    }
    if (openIdentityMenu === identityWrapper) {
      closeOpenIdentityMenu();
    }
  });

  identityMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const timestampEl = document.createElement("span");
  timestampEl.className = "comment-timestamp";
  const hasEditedMarker =
    Boolean(commentData.isEdited) && Boolean(commentData.editedAt);
  const editedSuffix = hasEditedMarker ? " (edited)" : "";
  timestampEl.textContent = `${timeLabel}${editedSuffix}`;

  metaGroup.appendChild(identityWrapper);
  metaGroup.appendChild(timestampEl);
  headerEl.appendChild(metaGroup);

  const actionsEl = document.createElement("div");
  actionsEl.className = "comment-actions";

  const handleEditComment = () =>
    openCommentEditor(card, commentId, commentData);

  const handleRemoveComment = () => {
    if (!currentBuildId) return;
    closeOpenActionsMenu();
    const confirmed = window.confirm(
      "Remove this comment? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    deleteComment(currentBuildId, commentId, commentData);
  };

  const canEdit = Boolean(isOwner);
  const canRemove = Boolean(allowDelete);

  if (canEdit || canRemove) {
    const actionsMenu = createCommentActionsMenu({
      canEdit,
      canRemove,
      onEdit: handleEditComment,
      onRemove: handleRemoveComment,
    });

    if (actionsMenu) {
      actionsEl.appendChild(actionsMenu);
    }
  }

  if (actionsEl.childElementCount > 0) {
    headerEl.appendChild(actionsEl);
  }

  const textEl = document.createElement("div");
  textEl.className = "comment-text";
  textEl.innerHTML = safeHtml;

  contentEl.appendChild(headerEl);
  contentEl.appendChild(textEl);

  const footerEl = createCommentFooter(card, commentId, commentData, depth);
  if (footerEl) {
    contentEl.appendChild(footerEl);
  }

  card.appendChild(avatarEl);
  card.appendChild(contentEl);

  return card;
}

function createCommentThreadElement(commentId, depth) {
  const wrapper = document.createElement("div");
  wrapper.className = "comment-thread";
  wrapper.dataset.commentId = commentId;
  wrapper.dataset.depth = String(depth);
  wrapper.classList.add(
    `comment-thread--depth-${Math.min(depth + 1, MAX_THREAD_DEPTH)}`
  );

  if (depth > 0) {
    wrapper.classList.add("comment-thread--child");
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "thread-content";

  const card = createCommentCard(commentId, depth);
  if (card) {
    contentWrapper.appendChild(card);

    const repliesContainer = document.createElement("div");
    repliesContainer.className = "comment-replies";
    repliesContainer.dataset.commentId = commentId;
    repliesContainer.dataset.depth = String(depth + 1);
    const isExpanded = commentThreadState.replyVisibility.get(commentId) || false;
    const visibleChildren = getVisibleReplyIds(commentId);

    if (visibleChildren.length) {
      renderRepliesContainer(repliesContainer, commentId, depth + 1);
    }

    repliesContainer.dataset.loaded = visibleChildren.length ? "true" : "false";
    repliesContainer.dataset.expanded = isExpanded ? "true" : "false";
    if (isExpanded) {
      repliesContainer.style.height = "auto";
    } else {
      repliesContainer.style.height = "0px";
    }

    contentWrapper.appendChild(repliesContainer);
  }

  wrapper.appendChild(contentWrapper);
  return wrapper;
}

function renderCommentThread() {
  const { commentsList } = ensureCommentSectionStructure() || {};
  if (!commentsList) {
    pendingCommentRender = true;
    return;
  }

  closeOpenIdentityMenu();

  ensureCommentShellVisible();

  resetCommentThreadData();
  hydrateCommentThreadState();

  const roots = commentThreadState.roots || [];
  updateCommentCount(roots.length);

  if (!roots.length) {
    setCommentsListContent(
      '<p class="comment-empty">No comments yet. Be the first to share your strategy!</p>'
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  roots.forEach((rootId) => {
    const threadEl = createCommentThreadElement(rootId, 0);
    if (threadEl) fragment.appendChild(threadEl);
  });

  commentsList.innerHTML = "";
  commentsList.appendChild(fragment);
  pendingCommentRender = false;
  pendingCommentsListHtml = null;
  hasPendingCommentsListHtml = false;

  requestAnimationFrame(() => {
    applyExpandedStates();
    commentThreadState.replyCounts.forEach((_, commentId) => {
      updateReplyToggleLabel(commentId);
    });
  });
}

async function toggleReplies(commentId) {
  if (!commentId) return;

  const threadEl = document.querySelector(
    `.comment-thread[data-comment-id="${commentId}"]`
  );
  if (!threadEl) return;

  const container = threadEl.querySelector(
    ":scope > .thread-content > .comment-replies"
  );
  if (!container) return;

  const isExpanded = container.dataset.expanded === "true";

  if (isExpanded) {
    commentThreadState.replyVisibility.delete(commentId);
    animateReplies(container, false);
    updateReplyToggleLabel(commentId);
    return;
  }

  commentThreadState.replyVisibility.set(commentId, true);
  updateReplyToggleLabel(commentId);

  const depth = Number(threadEl.dataset.depth || 0) + 1;

  if (container.dataset.loaded !== "true") {
    container.dataset.loading = "true";
    try {
      await loadRepliesForComment(commentId, depth, {
        container,
        reset: true,
      });
    } catch (error) {
      console.error("❌ Failed to load replies:", error);
      showToast("❌ Unable to load replies right now.", "error");
      commentThreadState.replyVisibility.delete(commentId);
      container.dataset.loading = "false";
      updateReplyToggleLabel(commentId);
      return;
    }
    container.dataset.loading = "false";
  } else {
    renderRepliesContainer(container, commentId, depth);
  }

  requestAnimationFrame(() => {
    animateReplies(container, true);
  });
}

function applyExpandedStates() {
  commentThreadState.replyVisibility.forEach((isExpanded, commentId) => {
    const container = document.querySelector(
      `.comment-replies[data-comment-id="${commentId}"]`
    );
    if (!container) return;
    container.dataset.expanded = isExpanded ? "true" : "false";
    if (isExpanded) {
      container.style.height = "auto";
    } else {
      container.style.height = "0px";
    }
    updateReplyToggleLabel(commentId);
  });
}

function toggleReplyForm(commentCard, commentId) {
  if (!commentCard || !commentId) return;

  const user = auth.currentUser;
  if (!user) {
    showToast("⚠️ Please sign in to reply.", "warning");
    const elements = ensureCommentSectionStructure();
    elements?.signInButton?.focus();
    return;
  }

  const threadContent = commentCard.closest(".thread-content");
  if (!threadContent) return;

  const existingForm = threadContent.querySelector(
    `.comment-reply-form[data-parent-id="${commentId}"]`
  );
  if (existingForm) {
    existingForm.remove();
    return;
  }

  const repliesContainer = threadContent.querySelector(
    `.comment-replies[data-comment-id="${commentId}"]`
  );

  const formWrapper = document.createElement("div");
  formWrapper.className = "comment-reply-form";
  formWrapper.dataset.parentId = commentId;

  const textarea = document.createElement("textarea");
  textarea.className = "comment-reply-input";
  textarea.placeholder = "Write a reply...";
  textarea.rows = 3;

  const actions = document.createElement("div");
  actions.className = "comment-reply-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "comment-reply-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => formWrapper.remove());

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "comment-reply-submit";
  submitBtn.textContent = "Post reply";
  submitBtn.addEventListener("click", async () =>
    handleReplySubmit(commentId, textarea, submitBtn, formWrapper)
  );

  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitBtn.click();
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);

  formWrapper.appendChild(textarea);
  formWrapper.appendChild(actions);

  if (repliesContainer) {
    threadContent.insertBefore(formWrapper, repliesContainer);
  } else {
    threadContent.appendChild(formWrapper);
  }

  textarea.focus();
}

async function handleReplySubmit(commentId, textarea, submitBtn, formWrapper) {
  if (!currentBuildId) return;
  const user = auth.currentUser;
  if (!user) {
    showToast("⚠️ Please sign in to reply.", "warning");
    return;
  }

  const filtered = prepareCommentText(textarea.value || "");
  if (!filtered) return;

  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Posting...";

  try {
    const success = await submitCommentToFirestore(
      currentBuildId,
      user,
      filtered,
      commentId
    );
    if (success) {
      textarea.value = "";
      formWrapper?.remove();
      commentThreadState.replyVisibility.set(commentId, true);
    }
  } catch (error) {
    console.error("❌ Failed to post reply:", error);
    showToast("❌ Failed to post reply. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel || "Post reply";
  }
}

async function blockUser(targetUserId, targetName = "this user") {
  const user = auth.currentUser;
  if (!user) {
    showToast("⚠️ Please sign in to block users.", "warning");
    return;
  }

  if (!targetUserId) {
    showToast("⚠️ Unable to block this user.", "warning");
    return;
  }

  if (user.uid === targetUserId) {
    showToast("⚠️ You cannot block yourself.", "warning");
    return;
  }

  if (blockedUsersState.set.has(targetUserId)) {
    showToast("ℹ️ User already blocked.", "info");
    return;
  }

  const confirmed = window.confirm(
    `Block ${targetName || "this user"}? Their comments and replies will be hidden.`
  );
  if (!confirmed) return;

  try {
    const blockRef = doc(db, `users/${user.uid}/blockedUsers`, targetUserId);
    await setDoc(blockRef, { blockedAt: serverTimestamp() });
    blockedUsersState.set.add(targetUserId);
    showToast(`🚫 Blocked ${targetName || "user"}.`, "success");
    renderCommentThread();
  } catch (error) {
    console.error("❌ Failed to block user:", error);
    showToast("❌ Failed to block user. Please try again.", "error");
  }
}

function listenToBlockedUsers(userId) {
  if (blockedUsersState.unsubscribe) {
    blockedUsersState.unsubscribe();
    blockedUsersState.unsubscribe = null;
  }

  blockedUsersState.set.clear();
  commentThreadState.replyVisibility = new Map();

  if (!userId) {
    renderCommentThread();
    return;
  }

  try {
    const blockedRef = collection(db, `users/${userId}/blockedUsers`);
    blockedUsersState.unsubscribe = onSnapshot(
      blockedRef,
      (snapshot) => {
        blockedUsersState.set.clear();
        snapshot.forEach((docSnap) => blockedUsersState.set.add(docSnap.id));
        renderCommentThread();
      },
      (error) => {
        console.error("❌ Failed to listen to blocked users:", error);
      }
    );
  } catch (error) {
    console.error("❌ Error initializing blocked users listener:", error);
  }
}

function renderComments() {
  renderCommentThread();
}

async function updateExistingComment(
  buildId,
  commentId,
  newContent,
  commentData
) {
  if (!buildId || !commentId) return false;

  const user = auth.currentUser;
  if (!user) {
    showToast("⚠️ Please sign in to edit comments.", "warning");
    return false;
  }

  if (!commentData || commentData.userId !== user.uid) {
    showToast("⚠️ You can only edit your own comments.", "warning");
    return false;
  }

  const trimmed = (newContent || "").trim();
  if (trimmed.length < 2) {
    showToast("⚠️ Comment must be at least 2 characters.", "warning");
    return false;
  }

  if (trimmed.length > 1200) {
    showToast(
      "⚠️ Comment is too long. Please keep it under 1200 characters.",
      "warning"
    );
    return false;
  }

  const sanitized = sanitizePlainText(trimmed);
  if (!sanitized || sanitized.length < 2) {
    showToast("⚠️ Please enter a valid comment.", "warning");
    return false;
  }

  const filtered = filterBannedWords(sanitized);
  const normalizedNew = normalizeCommentText(filtered);
  const normalizedExisting = normalizeCommentText(commentData?.text || "");

  if (normalizedNew === normalizedExisting) {
    showToast("ℹ️ No changes to save.", "warning");
    return false;
  }

  try {
    const commentRef = doc(
      db,
      `publishedBuilds/${buildId}/comments`,
      commentId
    );
    await updateDoc(commentRef, {
      text: filtered,
      isEdited: true,
      editedAt: serverTimestamp(),
    });

    let updatedData = null;
    latestComments = latestComments.map((entry) => {
      if (entry.id !== commentId) return entry;
      updatedData = {
        ...entry.data,
        text: filtered,
        displayText: filterBannedWords(filtered),
        isEdited: true,
        editedAt: new Date(),
      };
      return { ...entry, data: updatedData };
    });

    if (updatedData) {
      commentCache.set(commentId, updatedData);
      if (commentThreadState.nodesById.has(commentId)) {
        commentThreadState.nodesById.set(commentId, {
          id: commentId,
          data: updatedData,
        });
      }
    }

    showToast("💬 Comment updated.", "success");
    renderComments();
    return true;
  } catch (error) {
    console.error("❌ Failed to update comment:", error);
    showToast("❌ Failed to update comment. Please try again.", "error");
    return false;
  }
}

function openCommentEditor(commentCard, commentId, commentData) {
  if (!commentCard || commentCard.dataset.editing === "true") return;
  if (!commentData || !currentBuildId) return;

  const textContainer = commentCard.querySelector(".comment-text");
  if (!textContainer) return;

  const actionsContainer = commentCard.querySelector(".comment-actions");
  const originalHtml = textContainer.innerHTML;
  const originalText = commentData.text || "";

  commentCard.dataset.editing = "true";
  commentCard.classList.add("comment-card--editing");

  const textarea = document.createElement("textarea");
  textarea.className = "comment-edit-textarea";
  textarea.value = originalText;

  const controls = document.createElement("div");
  controls.className = "comment-edit-controls";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "comment-cancel-btn";
  cancelBtn.textContent = "Cancel";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "comment-save-btn";
  saveBtn.textContent = "Save";

  controls.appendChild(cancelBtn);
  controls.appendChild(saveBtn);

  textContainer.innerHTML = "";
  textContainer.appendChild(textarea);
  textContainer.appendChild(controls);

  const setDisabled = (state) => {
    if (saveBtn) saveBtn.disabled = state;
    if (cancelBtn) cancelBtn.disabled = state;
    if (textarea) textarea.disabled = state;
    if (actionsContainer) {
      actionsContainer.querySelectorAll("button").forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          button.disabled = state;
        }
      });
    }
  };

  cancelBtn.addEventListener("click", () => {
    setDisabled(false);
    commentCard.dataset.editing = "false";
    commentCard.classList.remove("comment-card--editing");
    textContainer.innerHTML = originalHtml;
  });

  saveBtn.addEventListener("click", async () => {
    setDisabled(true);
    const success = await updateExistingComment(
      currentBuildId,
      commentId,
      textarea.value || "",
      commentData
    );
    if (!success && commentCard.isConnected) {
      setDisabled(false);
    }
  });

  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveBtn.click();
    }
  });

  textarea.focus();
  const { value } = textarea;
  textarea.setSelectionRange(value.length, value.length);
}

window.addEventListener("user-avatar-updated", (event) => {
  const newUrl = sanitizeAvatarUrl(event?.detail?.avatarUrl || "");
  if (!newUrl) return;

  const user = auth.currentUser;
  if (!user?.uid) return;

  if (cachedUserProfile?.uid === user.uid) {
    cachedUserProfile = {
      ...cachedUserProfile,
      photoURL: newUrl,
    };
  }

  const existingProfile = userProfileCache.get(user.uid) || {};
  userProfileCache.set(user.uid, {
    ...existingProfile,
    photoURL: newUrl,
    username:
      existingProfile.username ||
      cachedUserProfile?.username ||
      sanitizePlainText(user.displayName || "Anonymous"),
  });

  let shouldRerender = false;
  latestComments = latestComments.map((entry) => {
    if (entry?.data?.userId === user.uid) {
      shouldRerender = true;
      const updatedData = {
        ...entry.data,
        photoURL: newUrl,
      };
      commentCache.set(entry.id, updatedData);
      if (commentThreadState.nodesById.has(entry.id)) {
        commentThreadState.nodesById.set(entry.id, {
          id: entry.id,
          data: updatedData,
        });
      }
      return {
        ...entry,
        data: updatedData,
      };
    }
    return entry;
  });

  document
    .querySelectorAll(
      `.comment-card[data-user-id="${user.uid}"] .comment-avatar`
    )
    .forEach((img) => {
      if (img instanceof HTMLImageElement) {
        img.src = newUrl;
      }
    });

  if (shouldRerender) {
    renderComments();
  }
});

async function loadCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) {
    cachedUserProfile = null;
    return null;
  }

  if (cachedUserProfile?.uid === user.uid) {
    return cachedUserProfile;
  }

  try {
    const userDocRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userDocRef);
    const userData = userSnapshot.exists() ? userSnapshot.data() : {};
    const username = sanitizePlainText(
      userData.username || user.displayName || "Anonymous"
    );

    const avatarFromProfile =
      userData?.avatarUrl || userData?.profile?.avatarUrl || DEFAULT_AVATAR_URL;

    cachedUserProfile = {
      uid: user.uid,
      username,
      photoURL: sanitizeAvatarUrl(avatarFromProfile),
      email: user.email || "",
    };
    userProfileCache.set(user.uid, {
      username: cachedUserProfile.username,
      photoURL: cachedUserProfile.photoURL,
    });
  } catch (error) {
    console.warn("?? Failed to load user profile for comments", error);
    cachedUserProfile = {
      uid: user.uid,
      username: sanitizePlainText(user.displayName || "Anonymous"),
      photoURL: sanitizeAvatarUrl(DEFAULT_AVATAR_URL),
      email: user.email || "",
    };
    userProfileCache.set(user.uid, {
      username: cachedUserProfile.username,
      photoURL: cachedUserProfile.photoURL,
    });
  }

  return cachedUserProfile;
}

function updateCommentFormState(user) {
  const commentElements = ensureCommentSectionStructure();
  const commentSection = commentElements?.section;
  if (!commentSection) {
    pendingCommentUser = user;
    hasPendingCommentUser = true;
    return;
  }

  ensureCommentShellVisible();

  const commentForm = commentElements?.commentForm;
  const signInPrompt = commentElements?.signInPrompt;
  const signInBtn = commentElements?.signInButton;

  if (user) {
    if (commentForm) commentForm.style.display = "flex";
    if (signInPrompt) signInPrompt.style.display = "none";
    if (signInBtn) signInBtn.style.display = "none";
    loadCurrentUserProfile();
  } else {
    if (commentForm) commentForm.style.display = "none";
    if (signInPrompt) signInPrompt.style.display = "block";
    if (signInBtn) signInBtn.style.display = "inline-flex";
    cachedUserProfile = null;
  }

  hasPendingCommentUser = false;
  pendingCommentUser = null;

  if (hasPendingCommentsListHtml) {
    setCommentsListContent(pendingCommentsListHtml);
  }

  renderComments();
}

async function resolveUserProfile(userId, fallbackData = {}) {
  if (!userId) return null;

  if (userProfileCache.has(userId)) {
    return userProfileCache.get(userId);
  }

  try {
    const userDocRef = doc(db, "users", userId);
    const userSnapshot = await getDoc(userDocRef);
    if (userSnapshot.exists()) {
      const profileData = userSnapshot.data() || {};
      const username = sanitizePlainText(
        profileData.username || fallbackData.username || "Anonymous"
      );
      const avatarSource =
        profileData?.avatarUrl ||
        profileData?.profile?.avatarUrl ||
        DEFAULT_AVATAR_URL;

      const profile = {
        username,
        photoURL: sanitizeAvatarUrl(avatarSource),
      };
      userProfileCache.set(userId, profile);
      return profile;
    }
  } catch (error) {
    console.warn("⚠️ Failed to fetch user profile for comments", error);
  }

  if (fallbackData) {
    const profile = {
      username: sanitizePlainText(fallbackData.username || "Anonymous"),
      photoURL: sanitizeAvatarUrl(fallbackData.photoURL || DEFAULT_AVATAR_URL),
    };
    userProfileCache.set(userId, profile);
    return profile;
  }

  return null;
}

async function enrichCommentEntry(entry) {
  const baseData = entry?.data || {};
  const sanitizedText = sanitizePlainText(baseData.text || "");
  const filteredText = filterBannedWords(sanitizedText);
  const parentId =
    typeof baseData.parentId === "string" && baseData.parentId.trim().length > 0
      ? baseData.parentId.trim()
      : null;

  let timestampDate = null;
  try {
    if (baseData.timestamp?.toDate) {
      timestampDate = baseData.timestamp.toDate();
    } else if (baseData.timestamp instanceof Date) {
      timestampDate = baseData.timestamp;
    } else if (baseData.timestamp) {
      const parsed = new Date(baseData.timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        timestampDate = parsed;
      }
    }
  } catch (err) {
    timestampDate = null;
  }

  const resolvedTimestamp = timestampDate || new Date();
  const resolvedTimestampMs = resolvedTimestamp.getTime();

  let username = sanitizePlainText(baseData.username || "Anonymous");
  let photoURL = sanitizeAvatarUrl(baseData.photoURL || DEFAULT_AVATAR_URL);

  if (baseData.userId) {
    const profile = await resolveUserProfile(baseData.userId, {
      username,
      photoURL,
    });
    if (profile) {
      username = sanitizePlainText(profile.username || username);
      photoURL = sanitizeAvatarUrl(profile.photoURL || photoURL);
    }
  }

  return {
    id: entry.id,
    data: {
      ...baseData,
      username,
      photoURL,
      text: sanitizedText,
      displayText: filteredText,
      parentId,
      resolvedTimestamp,
      resolvedTimestampMs,
    },
  };
}

function loadComments(buildId) {
  if (!buildId) {
    setCommentsListContent(
      '<p class="comment-error">Unable to load comments for this build.</p>'
    );
    updateCommentCount(0);
    return;
  }

  if (currentBuildId === buildId && commentsUnsubscribe) {
    renderComments();
    return;
  }

  if (commentsUnsubscribe) {
    commentsUnsubscribe();
    commentsUnsubscribe = null;
  }

  currentBuildId = buildId;
  latestComments = [];
  commentCache.clear();
  commentThreadState.replyVisibility = new Map();
  commentThreadState.visibleReplies = new Map();
  commentThreadState.replyPagination = new Map();
  commentThreadState.totalReplyCounts = new Map();
  setCommentsListContent('<p class="comment-loading">Loading comments...</p>');
  updateCommentCount(0);

  try {
    const commentsRef = collection(db, `publishedBuilds/${buildId}/comments`);
    const commentsQuery = query(
      commentsRef,
      orderBy("timestamp", "desc"),
      limit(MAX_COMMENTS_TO_DISPLAY)
    );

    commentsUnsubscribe = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        try {
          const commentEntries = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            data: docSnap.data(),
          }));

          const enrichedComments = await Promise.all(
            commentEntries.map((entry) => enrichCommentEntry(entry))
          );

          latestComments = enrichedComments;
          commentCache.clear();
          enrichedComments.forEach((entry) => {
            if (entry?.id && entry?.data) {
              commentCache.set(entry.id, entry.data);
            }
          });
          renderComments();
        } catch (err) {
          console.error("❌ Failed to process comments:", err);
          setCommentsListContent(
            '<p class="comment-error">Unable to load comments right now.</p>'
          );
        }
      },
      (error) => {
        console.error("❌ Failed to load comments:", error);
        setCommentsListContent(
          '<p class="comment-error">Unable to load comments right now.</p>'
        );
      }
    );
  } catch (error) {
    console.error("❌ Error initializing comments listener:", error);
    setCommentsListContent(
      '<p class="comment-error">Unable to load comments right now.</p>'
    );
  }
}

async function postComment(buildId) {
  const commentElements = ensureCommentSectionStructure();
  const textarea =
    commentElements?.textarea || document.getElementById("newCommentInput");
  const postButton =
    commentElements?.postButton || document.getElementById("postCommentBtn");

  if (!textarea || !postButton) return;

  const user = auth.currentUser;
  if (!user) {
    showToast("⚠️ Please sign in to post a comment.", "warning");
    return;
  }

  const filtered = prepareCommentText(textarea.value || "");
  if (!filtered) return;

  postButton.disabled = true;
  const previousLabel = postButton.textContent;
  postButton.textContent = "Posting...";

  try {
    const success = await submitCommentToFirestore(
      buildId,
      user,
      filtered,
      null
    );
    if (success) {
      textarea.value = "";
    }
  } catch (error) {
    console.error("❌ Failed to post comment:", error);
    showToast("❌ Failed to post comment. Please try again.", "error");
  } finally {
    postButton.disabled = false;
    postButton.textContent = previousLabel || "Post";
  }
}

async function deleteComment(buildId, commentId, commentData) {
  const user = auth.currentUser;
  if (!user) {
    showToast("⚠️ Please sign in to delete comments.", "warning");
    return;
  }

  const currentEmail = user.email ? user.email.toLowerCase() : "";
  const isOwner = commentData?.userId === user.uid;
  const isAdminUser = currentEmail ? adminEmails.includes(currentEmail) : false;

  if (!isOwner && !isAdminUser) {
    showToast("⚠️ You can only delete your own comments.", "warning");
    return;
  }

  try {
    const commentRef = doc(
      db,
      `publishedBuilds/${buildId}/comments`,
      commentId
    );
    await deleteDoc(commentRef);
    showToast("🗑️ Comment deleted.", "success");
  } catch (error) {
    console.error("❌ Failed to delete comment:", error);
    showToast("❌ Failed to delete comment. Please try again.", "error");
  }
}

function adjustRatingPosition() {
  if (!ratingItem || !infoGrid) return;

  if (window.innerWidth <= 768) {
    if (mobileInfoItem && mobileInfoItem.nextElementSibling !== ratingItem) {
      mobileInfoItem.insertAdjacentElement("afterend", ratingItem);
    } else if (
      !mobileInfoItem &&
      buildOrderContainer &&
      buildOrderContainer.previousElementSibling !== ratingItem
    ) {
      buildOrderContainer.insertAdjacentElement("beforebegin", ratingItem);
    }
  } else if (!infoGrid.contains(ratingItem)) {
    infoGrid.appendChild(ratingItem);
  }
}

function openFocusModal() {
  if (!focusModal || !focusContent) return;
  const buildOrder = document.getElementById("buildOrder");
  if (buildOrder) {
    focusContent.innerHTML = buildOrder.innerHTML;
    const btn = focusContent.querySelector("#openFocusModal");
    if (btn) btn.remove();
    focusContent.style.fontSize = `${focusFontSize}rem`;
  }
  document.body.classList.add("modal-open");
  focusModal.style.display = "block";
}

function closeFocusModal() {
  if (focusModal) focusModal.style.display = "none";
  document.body.classList.remove("modal-open");
}

function increaseFont() {
  focusFontSize = Math.min(3, focusFontSize + 0.1);
  if (focusContent) focusContent.style.fontSize = `${focusFontSize}rem`;
}

function decreaseFont() {
  focusFontSize = Math.max(0.5, focusFontSize - 0.1);
  if (focusContent) focusContent.style.fontSize = `${focusFontSize}rem`;
}

function handleBackClick(e) {
  e.preventDefault();

  localStorage.setItem("restoreCommunityModal", "true");

  // Save search input
  const searchInput = document.getElementById("communitySearchBar");
  if (searchInput && searchInput.value.trim()) {
    localStorage.setItem("communitySearchQuery", searchInput.value.trim());
  } else {
    localStorage.removeItem("communitySearchQuery");
  }

  // Save active filter
  const activeCategory = document
    .querySelector("#communityModal .filter-category.active")
    ?.getAttribute("data-category");

  const activeSubcategory = document
    .querySelector("#communityModal .subcategory.active")
    ?.getAttribute("data-subcategory");

  if (activeSubcategory) {
    localStorage.setItem("communityFilterType", "subcategory");
    localStorage.setItem("communityFilterValue", activeSubcategory);
  } else if (activeCategory && activeCategory !== "all") {
    localStorage.setItem("communityFilterType", "category");
    localStorage.setItem("communityFilterValue", activeCategory);
  } else {
    localStorage.removeItem("communityFilterType");
    localStorage.removeItem("communityFilterValue");
  }

  window.location.href = "/";
}

if (backButton) {
  backButton.addEventListener("click", handleBackClick);
}

if (pageBackButton) {
  pageBackButton.addEventListener("click", handleBackClick);
}

async function incrementBuildViews(buildId) {
  try {
    const buildRef = doc(db, "publishedBuilds", buildId);
    await updateDoc(buildRef, { views: increment(1) });
    console.log(`👀 View count updated for Build ID: ${buildId}`);
  } catch (error) {
    console.error("❌ Error updating view count:", error);
  }
}

function getBuildId() {
  const path = window.location.pathname;
  const prettyMatch = path.match(/\/build\/[^/]+\/[^/]+\/([^/]+)/);
  if (prettyMatch?.[1]) {
    return decodeURIComponent(prettyMatch[1]);
  }

  const shortMatch = path.match(/\/build\/([^/]+)/);
  if (shortMatch?.[1]) {
    return decodeURIComponent(shortMatch[1]);
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryId = searchParams.get("id");
  return queryId ? decodeURIComponent(queryId) : "";
}

async function loadBuild() {
  const buildId = getBuildId();

  if (!buildId) {
    document.getElementById("buildTitle").innerText = "Build not found.";
    console.error("❌ Error: No build ID in URL.");
    return;
  }

  console.log("🔍 Loading build with ID:", buildId);

  loadComments(buildId);

  // Clear existing map annotations and image before loading new build
  const existingMapImage = document.getElementById("map-preview-image");
  const existingAnnotations = document.getElementById("map-annotations");
  if (existingMapImage) existingMapImage.removeAttribute("src");
  if (existingAnnotations) existingAnnotations.innerHTML = "";

  const buildRef = doc(db, "publishedBuilds", buildId);
  const buildSnapshot = await getDoc(buildRef);

  if (buildSnapshot.exists()) {
    const build = buildSnapshot.data();
    await incrementBuildViews(buildId);
    console.log("✅ Build Loaded:", build);

    // Set basic build info
    document.getElementById("buildTitle").innerText =
      build.title || "Untitled Build";
    const matchupText =
      build.subcategory && build.subcategory.length === 3
        ? build.subcategory.charAt(0).toUpperCase() +
          build.subcategory.charAt(1) +
          build.subcategory.charAt(2).toUpperCase()
        : build.subcategory || "Unknown";
    const publisherText = build.username || "Anonymous";
    let dateText = "Unknown";
    try {
      let ts = build.datePublished;
      if (ts && typeof ts.toMillis === "function") ts = ts.toMillis();
      if (typeof ts === "number" || typeof ts === "string") {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          dateText = formatShortDate(d);
        }
      }
    } catch (err) {
      console.warn("Failed to parse datePublished:", build.datePublished);
    }

    let clanInfo = build.publisherClan || null;
    if (!clanInfo && build.publisherId) {
      clanInfo = await getPublisherClanInfo(build.publisherId);
    }
    const iconEl = document.getElementById("buildPublisherIcon");
    if (iconEl && clanInfo?.logoUrl) iconEl.src = clanInfo.logoUrl;
    const iconElMob = document.getElementById("buildPublisherIconMobile");
    if (iconElMob && clanInfo?.logoUrl) iconElMob.src = clanInfo.logoUrl;

    document.getElementById("buildMatchup").innerText = matchupText;
    document.getElementById("buildPublisher").innerText = publisherText;
    document.getElementById("buildDate").innerText = dateText;

    const mobileMatch = document.getElementById("buildMatchupMobile");
    if (mobileMatch) mobileMatch.innerText = matchupText;
    const mobilePub = document.getElementById("buildPublisherMobile");
    if (mobilePub) mobilePub.innerText = publisherText;
    const mobileDate = document.getElementById("buildDateMobile");
    if (mobileDate) mobileDate.innerText = dateText;

    // Set build order
    const buildOrderContainer = document.getElementById("buildOrder");
    if (!buildOrderContainer) {
      console.error("❌ Error: 'buildOrder' container not found!");
      return;
    }

    buildOrderContainer.innerHTML = "";

    if (Array.isArray(build.buildOrder) && build.buildOrder.length > 0) {
      build.buildOrder.forEach((step) => {
        if (typeof step === "string") {
          buildOrderContainer.innerHTML += `<p>${formatActionText(step)}</p>`;
        } else if (
          typeof step === "object" &&
          step.action &&
          step.action.trim() !== ""
        ) {
          const bracket = step.workersOrTimestamp
            ? `<strong>${formatWorkersOrTimestampText(
                step.workersOrTimestamp
              )}</strong> `
            : "";
          buildOrderContainer.innerHTML += `<p>${bracket}${formatActionText(
            step.action
          )}</p>`;
        }
      });
    } else {
      buildOrderContainer.innerHTML = "<p>No build order available.</p>";
    }

    // Set replay link
    const replayWrapper = document.getElementById("replayViewWrapper");
    const replayHeader = document.getElementById("replayHeader");
    const replayBtn = document.getElementById("replayDownloadBtn");
    if (replayWrapper && replayHeader && replayBtn) {
      if (build.replayUrl && build.replayUrl.trim() !== "") {
        replayBtn.href = build.replayUrl;
        replayWrapper.style.display = "block";
        replayHeader.style.display = "block";
      } else {
        replayWrapper.style.display = "none";
        replayHeader.style.display = "none";
      }
    }

    // Set description (supports legacy comment markup)
    const legacyDescEl = document.getElementById("buildComment");
    const legacyHeader = document.getElementById("commentHeader");
    let descEl =
      document.getElementById("buildDescription") || legacyDescEl || null;
    let descHeader =
      document.getElementById("descriptionHeader") || legacyHeader || null;

    if (descEl && descEl.id === "buildComment") {
      descEl.id = "buildDescription";
      descEl.classList.add("description-display");
      descEl.classList.remove("comment-display");
      descEl.style.display = "block";
      descEl = document.getElementById("buildDescription");
    }

    if (descHeader && descHeader.id === "commentHeader") {
      descHeader.id = "descriptionHeader";
      descHeader.textContent = "Description";
      descHeader.classList.add("toggle-title");
      descHeader.style.display = "block";
      descHeader = document.getElementById("descriptionHeader");
    }

    const descContainer =
      descEl?.closest(".build-description-container") ||
      descEl?.parentElement ||
      null;

    if (
      descContainer &&
      !descContainer.classList.contains("build-description-container")
    ) {
      descContainer.classList.add("build-description-container");
    }

    if (descContainer) {
      descContainer.style.display = "block";
    }

    if (descHeader) {
      descHeader.style.display = "block";
    }

    if (descEl) {
      const clean = DOMPurify.sanitize(
        build.description || "No description provided."
      );
      descEl.innerHTML = clean.replace(/\n/g, "<br>");
      descEl.style.display = "block";
    }

    // Set YouTube link
    const youtubeEmbed = document.getElementById("videoIframe");
    const videoHeader = document.getElementById("videoHeader");
    if (youtubeEmbed && videoHeader) {
      const link = build.videoLink || build.youtube;
      if (link && link.trim() !== "") {
        updateYouTubeEmbed(link);
        videoHeader.style.display = "block";
      } else {
        clearYouTubeEmbed();
        videoHeader.style.display = "none";
      }
    }
    // Set map image
    const mapImage = document.getElementById("map-preview-image");
    const selectedMapText = document.getElementById("selected-map-text");

    const mapName = (build.map || "").trim();
    const isValidMap =
      mapName &&
      mapName.toLowerCase() !== "index" &&
      mapName.toLowerCase() !== "no map selected";

    let mapExists = false;
    // Map display for view-only
    if (mapImage) {
      if (isValidMap) {
        let mapPath = "";
        try {
          const response = await fetch("/data/maps.json");
          const maps = await response.json();

          const entry = maps.find(
            (m) => m.name.toLowerCase() === mapName.toLowerCase()
          );

          if (entry) {
            mapPath = `img/maps/${entry.folder}/${entry.file}`;
          }
        } catch (err) {
          console.warn("⚠️ Could not load maps.json");
        }

        if (mapPath) {
          mapImage.setAttribute("src", mapPath);
          mapExists = true;
        } else {
          mapImage.removeAttribute("src");
        }
        mapImage.removeAttribute("data-src");
      } else {
        mapImage.removeAttribute("src");
      }
    }

    if (selectedMapText) {
      selectedMapText.innerText = isValidMap && mapExists ? mapName : "";
    }

    const mapContainerWrapper = document.getElementById("map-container");
    if (mapContainerWrapper) {
      mapContainerWrapper.style.display = mapExists ? "block" : "none";
    }

    // Ensure additional section is visible before rendering annotations
    if (mapExists) {
      const secondRow = document.getElementById("secondRow");
      const secondRowHeader = document.querySelector(
        '[data-section="secondRow"]'
      );
      if (secondRow) {
        secondRow.classList.remove("hidden");
        secondRow.classList.add("visible");
      }
      if (secondRowHeader) {
        const arrowIcon = secondRowHeader.querySelector(".arrow");
        if (arrowIcon) arrowIcon.classList.add("open");
      }
    }

    // Setup map and annotations
    const mapContainer = document.getElementById("map-preview-image");
    const annotationsContainer = document.getElementById("map-annotations");

    if (mapContainer && annotationsContainer) {
      const viewMapAnnotations = new MapAnnotations(
        "map-preview-image",
        "map-annotations"
      );

      // 🔥 Disable all user interactions
      viewMapAnnotations.mapContainer.removeEventListener(
        "mousedown",
        viewMapAnnotations.handleMouseDown
      );
      viewMapAnnotations.mapContainer.removeEventListener(
        "mouseup",
        viewMapAnnotations.handleMouseUp
      );
      viewMapAnnotations.mapContainer.removeEventListener(
        "mousemove",
        viewMapAnnotations.handleMouseMove
      );
      viewMapAnnotations.mapContainer.removeEventListener(
        "mouseleave",
        viewMapAnnotations.handleMouseLeave
      );

      const renderAnnotations = () => {
        // 🔥 Load saved circles
        if (
          build.interactiveMap &&
          Array.isArray(build.interactiveMap.circles)
        ) {
          build.interactiveMap.circles.forEach((circle) => {
            if (circle.x !== undefined && circle.y !== undefined) {
              viewMapAnnotations.createCircle(circle.x, circle.y);
            }
          });

          // 🛡 Disable click delete by replacing circles
          viewMapAnnotations.circles.forEach((circleData, index) => {
            const cleanClone = circleData.element.cloneNode(true);
            circleData.element.parentNode.replaceChild(
              cleanClone,
              circleData.element
            );
            viewMapAnnotations.circles[index].element = cleanClone;
          });
        }

        // 🔥 Load saved arrows
        if (
          build.interactiveMap &&
          Array.isArray(build.interactiveMap.arrows)
        ) {
          build.interactiveMap.arrows.forEach((arrow) => {
            if (
              arrow.startX !== undefined &&
              arrow.startY !== undefined &&
              arrow.endX !== undefined &&
              arrow.endY !== undefined
            ) {
              viewMapAnnotations.createArrow(
                arrow.startX,
                arrow.startY,
                arrow.endX,
                arrow.endY
              );
              const last =
                viewMapAnnotations.arrows[viewMapAnnotations.arrows.length - 1];
              if (last && last.element) {
                const clone = last.element.cloneNode(true);
                last.element.parentNode.replaceChild(clone, last.element);
                last.element = clone;
              }
            }
          });
        }

        annotationsContainer.style.pointerEvents = "none";
      };

      if (mapImage.complete && mapImage.naturalWidth > 0) {
        renderAnnotations();
      } else {
        mapImage.addEventListener("load", renderAnnotations, { once: true });
      }
    }
    const additionalHeader = document.getElementById(
      "additionalSettingsHeader"
    );
    const mainLayout = document.querySelector(".main-layout");
    if (additionalHeader || mainLayout) {
      const videoVisible =
        youtubeEmbed && youtubeEmbed.style.display !== "none";
      const mapVisible =
        mapContainerWrapper && mapContainerWrapper.style.display !== "none";
      const replayVisible =
        replayWrapper && replayWrapper.style.display !== "none";

      const anyVisible = videoVisible || mapVisible || replayVisible;

      const secondRow = document.getElementById("secondRow");
      const secondRowHeader = document.querySelector(
        '[data-section="secondRow"]'
      );
      if (secondRow) {
        if (anyVisible) {
          secondRow.classList.remove("hidden");
          secondRow.classList.add("visible");
        } else {
          secondRow.classList.add("hidden");
          secondRow.classList.remove("visible");
        }
      }
      if (secondRowHeader) {
        const arrowIcon = secondRowHeader.querySelector(".arrow");
        if (arrowIcon) {
          if (anyVisible) {
            arrowIcon.classList.add("open");
          } else {
            arrowIcon.classList.remove("open");
          }
        }
      }

      if (additionalHeader) {
        additionalHeader.style.display = anyVisible ? "block" : "none";
      }
      if (mainLayout) {
        mainLayout.style.display = anyVisible ? "block" : "none";
      }
    }
    injectSchemaMarkup(build);
    injectMetaTags(buildId, build);
  } else {
    console.error("❌ Build not found in Firestore:", buildId);
    document.getElementById("buildTitle").innerText = "Build not found.";
  }

  // ✅ Setup voting buttons (unchanged)
  const votingButtons = document.querySelectorAll(".vote-button");
  votingButtons.forEach((btn) => {
    btn.setAttribute("data-id", buildId);
    btn.addEventListener("click", async () => {
      const isUpvote = btn.classList.contains("vote-up");
      try {
        await handleVote(buildId, isUpvote ? "up" : "down");
        updateVoteButtonIcons(buildId);
      } catch (err) {
        console.error("❌ Vote error:", err);
      }
    });
  });

  // ✅ Wait for auth state to initialize THEN show correct vote state
  onAuthStateChanged(auth, () => {
    updateVoteButtonIcons(buildId);
  });
}

async function handleVote(buildId, voteType) {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be signed in to vote.");
    return;
  }

  const userId = user.uid;
  const buildRef = doc(db, "publishedBuilds", buildId);

  try {
    const buildDoc = await getDoc(buildRef);
    if (!buildDoc.exists()) {
      console.error("❌ Error: Build not found.");
      return;
    }

    const buildData = buildDoc.data();
    const userVotes = buildData.userVotes || {};
    let upvotes = buildData.upvotes || 0;
    let downvotes = buildData.downvotes || 0;

    const previousVote = userVotes[userId];

    if (previousVote === voteType) {
      // Toggle off: remove vote if user clicks the same button again
      if (voteType === "up") upvotes--;
      else if (voteType === "down") downvotes--;
      delete userVotes[userId];
    } else {
      // If switching vote, first remove the previous vote if any
      if (previousVote === "up") {
        upvotes--;
      } else if (previousVote === "down") {
        downvotes--;
      }

      // Now add the new vote
      if (voteType === "up") {
        upvotes++;
      } else if (voteType === "down") {
        downvotes++;
      }
      userVotes[userId] = voteType;
    }

    // Update Firestore with the new vote counts and userVotes
    await updateDoc(buildRef, { upvotes, downvotes, userVotes });

    // Update UI accordingly
    updateVoteUI(buildId, upvotes, downvotes, userVotes[userId] || null);
  } catch (error) {
    console.error("❌ Error updating vote:", error);
  }
}

// ✅ Update Vote Button Icons After Voting
function updateVoteButtonIcons(buildId) {
  const upvoteButton = document.querySelector(`.vote-up[data-id="${buildId}"]`);
  const downvoteButton = document.querySelector(
    `.vote-down[data-id="${buildId}"]`
  );

  if (!upvoteButton || !downvoteButton) return;

  getDoc(doc(db, "publishedBuilds", buildId)).then((buildDoc) => {
    if (buildDoc.exists()) {
      const buildData = buildDoc.data();
      const user = auth.currentUser;
      const userVote = user ? buildData.userVotes?.[user.uid] : null;

      // ✅ This must exist to update the percentage & vote count
      updateVoteUI(
        buildId,
        buildData.upvotes || 0,
        buildData.downvotes || 0,
        userVote
      );

      // ✅ Set the icons
      upvoteButton.querySelector("img").src =
        userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";
      downvoteButton.querySelector("img").src =
        userVote === "down"
          ? "./img/SVG/voted-down.svg"
          : "./img/SVG/vote-down.svg";
    }
  });
}

function updateVoteUI(buildId, upvotes, downvotes, userVote) {
  const upvoteButton = document.querySelector(`.vote-up[data-id="${buildId}"]`);
  const downvoteButton = document.querySelector(
    `.vote-down[data-id="${buildId}"]`
  );
  const votePercentage = document.getElementById("vote-percentage-text");
  const voteCount = document.getElementById("vote-count-text");

  if (!upvoteButton || !downvoteButton || !votePercentage) return;

  // Update SVG icons
  upvoteButton.querySelector("img").src =
    userVote === "up" ? "./img/SVG/voted-up.svg" : "./img/SVG/vote-up.svg";
  downvoteButton.querySelector("img").src =
    userVote === "down"
      ? "./img/SVG/voted-down.svg"
      : "./img/SVG/vote-down.svg";

  // Highlight selected vote
  upvoteButton.classList.toggle("voted-up", userVote === "up");
  downvoteButton.classList.toggle("voted-down", userVote === "down");

  // Calculate vote percentage
  const totalVotes = upvotes + downvotes;
  const percentage =
    totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 0;
  votePercentage.textContent = `${percentage}%`;

  // Update vote count text
  if (voteCount) {
    voteCount.textContent = `${totalVotes} votes`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const viewBuildContainer = document.querySelector(".view-build-container");
  if (!viewBuildContainer) return;

  const commentElements = ensureCommentSectionStructure();
  ensureCommentShellVisible();

  const postCommentBtn = commentElements?.postButton;
  if (postCommentBtn && !postCommentBtn.dataset.listenerBound) {
    postCommentBtn.addEventListener("click", async () => {
      const buildId = getBuildId();
      if (buildId) await postComment(buildId);
    });
    postCommentBtn.dataset.listenerBound = "true";
  }

  const commentInput = commentElements?.textarea;
  if (commentInput && !commentInput.dataset.submitBound) {
    commentInput.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        const buildId = getBuildId();
        if (buildId) await postComment(buildId);
      }
    });
    commentInput.dataset.submitBound = "true";
  }

  const commentSignInBtn = commentElements?.signInButton;
  if (commentSignInBtn && !commentSignInBtn.dataset.listenerBound) {
    commentSignInBtn.addEventListener("click", () => {
      if (typeof window.handleSignIn === "function") {
        window.handleSignIn();
      }
    });
    commentSignInBtn.dataset.listenerBound = "true";
  }

  adjustRatingPosition();
  window.addEventListener("resize", adjustRatingPosition);

  focusBtn = document.getElementById("openFocusModal");
  focusModal = document.getElementById("focusModal");
  closeFocusBtn = document.getElementById("closeFocusModal");
  increaseFontBtn = document.getElementById("increaseFontBtn");
  decreaseFontBtn = document.getElementById("decreaseFontBtn");
  focusContent = document.getElementById("focusContent");

  if (focusBtn) focusBtn.addEventListener("click", openFocusModal);
  if (closeFocusBtn) closeFocusBtn.addEventListener("click", closeFocusModal);
  if (increaseFontBtn) increaseFontBtn.addEventListener("click", increaseFont);
  if (decreaseFontBtn) decreaseFontBtn.addEventListener("click", decreaseFont);
  if (focusModal)
    window.addEventListener("click", (e) => {
      if (e.target === focusModal) closeFocusModal();
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFocusModal();
  });

  const importBtn = document.getElementById("importBuildButton");

  if (importBtn) {
    onAuthStateChanged(auth, async (user) => {
      const importBtn = document.getElementById("importBuildButton");
      if (!importBtn) return;

      if (!user) {
        importBtn.style.display = "none";
        return;
      }

      // Don't show the button until we know the status
      importBtn.style.display = "none";

      const buildId = getBuildId();
      if (!buildId) return;

      const buildRef = doc(db, "publishedBuilds", buildId);
      const buildSnap = await getDoc(buildRef);
      if (!buildSnap.exists()) return;

      const userBuildDocRef = doc(db, `users/${user.uid}/builds/${buildId}`);
      const userBuildSnap = await getDoc(userBuildDocRef);

      if (userBuildSnap.exists()) {
        importBtn.disabled = true;
        importBtn.textContent = "Imported";
        importBtn.classList.add("imported");
      } else {
        importBtn.disabled = false;
        importBtn.textContent = "Import";
      }
      importBtn.style.display = "inline-block";
    });
  } else {
    console.warn("⚠️ Import button not found.");
  }

  // ✅ Load build data after DOM ready
  await loadBuild();

  // Redirect to community builds when clicking publisher name
  document.querySelectorAll(".publisher-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const name =
        document.getElementById("buildPublisher")?.innerText ||
        document.getElementById("buildPublisherMobile")?.innerText ||
        "";
      if (!name) return;
      localStorage.setItem("restoreCommunityModal", "true");
      localStorage.removeItem("communityFilterType");
      localStorage.removeItem("communityFilterValue");
      localStorage.setItem("communitySearchQuery", name);
      window.location.href = "index.html";
    });
  });

  // Update vote UI when auth state changes (e.g., after sign-in)
  onAuthStateChanged(auth, (user) => {
    updateCommentFormState(user);
    listenToBlockedUsers(user?.uid || null);

    const buildId = getBuildId();
    if (buildId) {
      updateVoteButtonIcons(buildId);
      if (!commentsUnsubscribe || currentBuildId !== buildId) {
        loadComments(buildId);
      } else {
        renderComments();
      }
    }
  });

  if (hasPendingCommentsListHtml) {
    setCommentsListContent(pendingCommentsListHtml);
  } else if (pendingCommentRender) {
    renderComments();
  }

  if (hasPendingCommentUser) {
    const userToApply = pendingCommentUser;
    hasPendingCommentUser = false;
    pendingCommentUser = null;
    updateCommentFormState(userToApply);
  } else {
    updateCommentFormState(auth.currentUser);
  }

  // ✅ Initialize MapAnnotations readonly
  const mapContainer = document.getElementById("map-preview-image");
  const annotationsContainer = document.getElementById("map-annotations");

  if (mapContainer && annotationsContainer) {
    const viewMapAnnotations = new MapAnnotations(
      "map-preview-image",
      "map-annotations"
    );
    annotationsContainer.style.pointerEvents = "none"; // 🔥 Disable interaction
  }
});

function injectSchemaMarkup(build) {
  const steps = (build.buildOrder || []).map((step) => {
    const bracket = step.workersOrTimestamp
      ? `[${step.workersOrTimestamp}]`
      : "";
    const action = typeof step === "string" ? step : step.action || "";
    return {
      "@type": "HowToStep",
      text: `${bracket} ${action}`.trim(),
    };
  });

  let publishedDate = new Date();
  try {
    let ts = build.datePublished;
    if (ts && typeof ts.toMillis === "function") ts = ts.toMillis();
    if (typeof ts === "number" || typeof ts === "string") {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        publishedDate = d;
      }
    }
  } catch (err) {
    console.warn(
      "Failed to parse datePublished for schema:",
      build.datePublished
    );
  }

  const schema = {
    "@context": "https://schema.org/",
    "@type": "HowTo",
    name: build.title || "StarCraft 2 Build Order",
    author: {
      "@type": "Person",
      name: build.username || "Unknown",
    },
    datePublished: publishedDate.toISOString().split("T")[0],
    description: `StarCraft 2 build order for ${
      build.subcategory || "Unknown"
    } matchup.`,
    step: steps,
  };

  // Remove existing schema if present
  const oldSchema = document.querySelector(
    'script[type="application/ld+json"]'
  );
  if (oldSchema) oldSchema.remove();

  // Inject new schema
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema, null, 2);
  document.head.appendChild(script);
}

function injectMetaTags(buildId, build) {
  const title = `${build.title || "StarCraft 2 Build"} - Z-Build Order`;
  const description = `StarCraft 2 build order for ${
    build.subcategory || "Unknown"
  } matchup.`;
  const matchup = (build.subcategory || "unknown").toLowerCase();
  const slug = build.title
    ? build.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "")
    : "untitled";

  const url = `https://zbuildorder.com/build/${matchup}/${slug}/${buildId}`;

  const ogImage = "https://zbuildorder.com/img/og-image.webp"; // <-- You can customize this!

  // Update <title>
  document.title = title;

  // Helper to set or create meta tag
  function setMeta(property, content) {
    let tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("property", property);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }

  setMeta("og:title", title);
  setMeta("og:description", description);
  setMeta("og:url", url);
  setMeta("og:image", ogImage);

  // Optional: canonical tag
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", url);
}

document.addEventListener("click", (event) => {
  if (openIdentityMenu && !event.target.closest(".comment-identity-wrapper")) {
    closeOpenIdentityMenu();
  }

  if (openActionsMenu && !event.target.closest(".comment-actions-menu")) {
    closeOpenActionsMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (openIdentityMenu) {
      closeOpenIdentityMenu({ focusTrigger: true });
      return;
    }

    if (openActionsMenu) {
      closeOpenActionsMenu({ focusTrigger: true });
    }
  }
});

window.addEventListener("popstate", () => {
  loadBuild();
});
