import DOMPurify from "dompurify";
import { auth, db, initializeAuthUI } from "../../app.js"; // ✅ Reuse Firebase app
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
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
let currentBuildId = "";
let cachedUserProfile = null;
let pendingCommentUser = null;
let hasPendingCommentUser = false;
let pendingCommentRender = false;
let pendingCommentsListHtml = null;
let hasPendingCommentsListHtml = false;
let commentShellInitialized = false;
const userProfileCache = new Map();

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

function renderComments() {
  const { commentsList } = ensureCommentSectionStructure() || {};
  if (!commentsList) {
    pendingCommentRender = true;
    return;
  }

  ensureCommentShellVisible();

  if (!latestComments.length) {
    setCommentsListContent(
      '<p class="comment-empty">No comments yet. Be the first to share your strategy!</p>'
    );
    updateCommentCount(0);
    return;
  }

  const fragment = document.createDocumentFragment();
  const currentUserId = auth.currentUser?.uid || "";
  const currentUserEmail = auth.currentUser?.email
    ? auth.currentUser.email.toLowerCase()
    : "";
  const isAdminUser = currentUserEmail
    ? adminEmails.includes(currentUserEmail)
    : false;

  latestComments.forEach(({ id, data }) => {
    const commentData = data ? { ...data } : {};
    const username = sanitizePlainText(commentData.username || "Anonymous");
    const displayText =
      typeof commentData.displayText === "string"
        ? commentData.displayText
        : sanitizeAndFilterComment(commentData.text || "");
    commentData.displayText = displayText;
    commentData.text =
      typeof commentData.text === "string"
        ? commentData.text
        : sanitizePlainText(displayText || "");

    let timestampDate = null;
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

    const timeLabel = formatRelativeTime(timestampDate || new Date());
    const isOwner = commentData.userId === currentUserId;
    const allowDelete = isOwner || isAdminUser;
    const avatarSource =
      commentData.photoURL || cachedUserProfile?.photoURL || DEFAULT_AVATAR_URL;

    const effectiveAvatar = sanitizeAvatarUrl(avatarSource);

    const commentCard = document.createElement("div");
    commentCard.className = "comment-card";
    commentCard.dataset.userId = commentData.userId || "";
    commentCard.dataset.commentId = id;

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

    const usernameEl = document.createElement("span");
    usernameEl.className = "comment-identity";
    usernameEl.textContent = username || "Anonymous";

    const timestampEl = document.createElement("span");
    timestampEl.className = "comment-timestamp";
    const editedSuffix = commentData.isEdited ? " (edited)" : "";
    timestampEl.textContent = `• ${timeLabel}${editedSuffix}`;

    metaGroup.appendChild(usernameEl);
    metaGroup.appendChild(timestampEl);

    headerEl.appendChild(metaGroup);

    const actionsEl = document.createElement("div");
    actionsEl.className = "comment-actions";
    let hasActions = false;

    if (isOwner) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "comment-edit-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        openCommentEditor(commentCard, id, commentData);
      });
      actionsEl.appendChild(editBtn);
      hasActions = true;
    }

    if (allowDelete) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "comment-delete-btn";
      deleteBtn.setAttribute("aria-label", "Delete comment");
      deleteBtn.innerHTML =
        '<img src="img/SVG/trash.svg" alt="" aria-hidden="true" />';
      deleteBtn.addEventListener("click", () => {
        if (!currentBuildId) return;
        deleteComment(currentBuildId, id, commentData);
      });
      actionsEl.appendChild(deleteBtn);
      hasActions = true;
    }

    if (hasActions) {
      headerEl.appendChild(actionsEl);
    }

    const textEl = document.createElement("div");
    textEl.className = "comment-text";
    textEl.innerHTML = displayText.replace(/\n/g, "<br>");

    contentEl.appendChild(headerEl);
    contentEl.appendChild(textEl);

    commentCard.appendChild(avatarEl);
    commentCard.appendChild(contentEl);

    fragment.appendChild(commentCard);
  });

  commentsList.innerHTML = "";
  commentsList.appendChild(fragment);
  pendingCommentRender = false;
  pendingCommentsListHtml = null;
  hasPendingCommentsListHtml = false;
  updateCommentCount(latestComments.length);
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
  if (filtered === (commentData?.text || "")) {
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

    latestComments = latestComments.map((entry) => {
      if (entry.id !== commentId) return entry;
      const updatedData = {
        ...entry.data,
        text: filtered,
        displayText: filterBannedWords(filtered),
        isEdited: true,
        editedAt: new Date(),
      };
      return { ...entry, data: updatedData };
    });

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
      return {
        ...entry,
        data: {
          ...entry.data,
          photoURL: newUrl,
        },
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

  const rawInput = textarea.value || "";
  const trimmed = rawInput.trim();

  if (trimmed.length < 2) {
    showToast("⚠️ Comment must be at least 2 characters.", "warning");
    return;
  }

  if (trimmed.length > 1200) {
    showToast(
      "⚠️ Comment is too long. Please keep it under 1200 characters.",
      "warning"
    );
    return;
  }

  const sanitized = sanitizePlainText(trimmed);
  if (!sanitized || sanitized.length < 2) {
    showToast("⚠️ Please enter a valid comment.", "warning");
    return;
  }

  const filtered = filterBannedWords(sanitized);
  if (!filtered || filtered.length < 2) {
    showToast("⚠️ Please enter a valid comment.", "warning");
    return;
  }

  postButton.disabled = true;
  const previousLabel = postButton.textContent;
  postButton.textContent = "Posting...";

  try {
    const profile = await loadCurrentUserProfile();
    const username = profile?.username || "Anonymous";
    const photoURL = sanitizeAvatarUrl(profile?.photoURL || "");

    await addDoc(collection(db, `publishedBuilds/${buildId}/comments`), {
      userId: user.uid,
      username,
      photoURL,
      text: filtered,
      isEdited: false,
      timestamp: serverTimestamp(),
    });

    textarea.value = "";
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
  if (!ratingItem || !infoGrid || !mainLayout) return;
  if (window.innerWidth <= 768) {
    if (ratingItem.parentElement !== mainLayout.parentNode) {
      mainLayout.insertAdjacentElement("afterend", ratingItem);
    }
  } else {
    if (!infoGrid.contains(ratingItem)) {
      infoGrid.appendChild(ratingItem);
    }
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
    const categoryText = build.category || "Unknown";
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

    document.getElementById("buildCategory").innerText = categoryText;
    document.getElementById("buildMatchup").innerText = matchupText;
    document.getElementById("buildPublisher").innerText = publisherText;
    document.getElementById("buildDate").innerText = dateText;

    const mobileCat = document.getElementById("buildCategoryMobile");
    if (mobileCat) mobileCat.innerText = categoryText;
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

window.addEventListener("popstate", () => {
  loadBuild();
});
