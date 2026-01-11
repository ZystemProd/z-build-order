import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db, getCurrentUsername } from "../../../../app.js";
import { currentSlug, currentTournamentMeta, isAdmin, state } from "../state.js";

const MATCH_CHAT_COLLECTION = "tournamentChats";
const MATCH_CHAT_LIMIT = 50;
const MATCH_CHAT_MAX_LENGTH = 500;
const chatParticipantCache = new Map();
let chatUnsub = null;
let chatContext = null;
let chatUnreadEl = null;
let chatIsOpen = false;
let lastSeenAtMs = 0;
let unreadCount = 0;
let hasInitialized = false;
let chatStorageKey = "";
let chatMatchId = "";
let chatUid = "";

export function setupMatchChatUi({
  matchId,
  leftPlayer,
  rightPlayer,
  isParticipant,
  uid,
}) {
  const section = document.getElementById("matchChatSection");
  const toggle = document.getElementById("matchChatToggle");
  const panel = document.getElementById("matchChatPanel");
  const historyEl = document.getElementById("matchChatHistory");
  const form = document.getElementById("matchChatForm");
  const input = document.getElementById("matchChatInput");
  const sendBtn = document.getElementById("matchChatSendBtn");
  const status = document.getElementById("matchChatStatus");
  const labelEl = document.getElementById("matchChatLabel");
  chatUnreadEl = document.getElementById("matchChatUnread");

  if (
    !section ||
    !toggle ||
    !panel ||
    !historyEl ||
    !form ||
    !input ||
    !sendBtn ||
    !status ||
    !labelEl
  ) {
    return;
  }

  const nextMatchId = matchId || "";
  const nextUid = uid || "";
  const nextStorageKey = getChatStorageKey(nextMatchId, nextUid);
  const sameMatch = nextMatchId === chatMatchId;
  const sameContext =
    sameMatch &&
    nextUid === chatUid &&
    nextStorageKey === chatStorageKey;
  const needsFullReset = !section.dataset.chatBound || !sameMatch;

  const canView = Boolean(uid && (isAdmin || isParticipant));
  if (!canView || !currentSlug || !matchId) {
    if (sameMatch && section.dataset.chatBound === "true") {
      stopMatchChat();
      input.value = "";
      panel.style.display = chatIsOpen ? "grid" : "none";
      toggle.setAttribute("aria-expanded", chatIsOpen ? "true" : "false");
      labelEl.textContent = chatIsOpen ? "Hide chat" : "Match chat";
      status.textContent = uid
        ? "Only match players can send messages."
        : "Sign in to chat.";
      setFormState(false);
      return;
    }
    stopMatchChat();
    historyEl.replaceChildren();
    input.value = "";
    panel.style.display = "none";
    toggle.setAttribute("aria-expanded", "false");
    labelEl.textContent = "Match chat";
    status.textContent = "";
    chatIsOpen = false;
    lastSeenAtMs = 0;
    unreadCount = 0;
    hasInitialized = false;
    chatMatchId = "";
    chatUid = "";
    chatStorageKey = "";
    delete section.dataset.chatBound;
    section.style.display = "none";
    updateUnreadIndicator(0);
    return;
  }

  section.style.display = "grid";
  const uidLookup = buildPlayerUidLookup(state?.players || []);

  if (needsFullReset) {
    stopMatchChat();
    historyEl.replaceChildren();
    input.value = "";
    panel.style.display = "grid";
    toggle.setAttribute("aria-expanded", "true");
    labelEl.textContent = "Hide chat";
    status.textContent = "";
    chatIsOpen = true;
    lastSeenAtMs = 0;
    unreadCount = 0;
    hasInitialized = false;
    chatMatchId = nextMatchId;
    chatUid = nextUid;
    chatStorageKey = nextStorageKey;
    lastSeenAtMs = loadLastSeenAtMs(chatStorageKey);
    updateUnreadIndicator(0);
    section.dataset.chatBound = "true";
  } else {
    panel.style.display = chatIsOpen ? "grid" : "none";
    toggle.setAttribute("aria-expanded", chatIsOpen ? "true" : "false");
    labelEl.textContent = chatIsOpen ? "Hide chat" : "Match chat";
    if (!sameContext) {
      chatUid = nextUid;
      chatStorageKey = nextStorageKey;
      lastSeenAtMs = loadLastSeenAtMs(chatStorageKey);
    }
  }

  const adminUids = getTournamentAdminUids(currentTournamentMeta);
  const leftUid = resolvePlayerUid(leftPlayer, uidLookup);
  const rightUid = resolvePlayerUid(rightPlayer, uidLookup);
  const participantUids = uniqueUids([
    leftUid,
    rightUid,
    ...adminUids,
    uid,
  ]);
  const canSend = Boolean(participantUids.includes(uid));
  const displayName = getChatDisplayName();
  if (chatContext) {
    chatContext.canSend = canSend;
    chatContext.displayName = displayName;
  }
  if (!sameContext || !chatUnsub) {
    void startMatchChat({
      matchId,
      participantUids,
      canSend,
      uid,
      displayName,
    });
  }

  const setFormState = (enabled) => {
    input.disabled = !enabled;
    sendBtn.disabled = !enabled;
  };

  const openChat = () => {
    panel.style.display = "grid";
    toggle.setAttribute("aria-expanded", "true");
    labelEl.textContent = "Hide chat";
    chatIsOpen = true;
    unreadCount = 0;
    updateUnreadIndicator(0);
    setFormState(canSend);
    status.textContent = canSend ? "" : "Only match players can send messages.";
  };

  if (chatIsOpen) {
    setFormState(canSend);
    status.textContent = canSend ? "" : "Only match players can send messages.";
  } else {
    setFormState(false);
    status.textContent = "";
  }

  const closeChat = () => {
    panel.style.display = "none";
    toggle.setAttribute("aria-expanded", "false");
    labelEl.textContent = "Match chat";
    chatIsOpen = false;
  };

  toggle.onclick = () => {
    const isOpen = panel.style.display !== "none";
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!chatContext?.messagesRef) return;
    if (!uid) {
      status.textContent = "Sign in to chat.";
      return;
    }
    if (!chatContext.canSend) {
      status.textContent = "Only match players can send messages.";
      return;
    }
    const raw = input.value || "";
    const text = raw.trim().slice(0, MATCH_CHAT_MAX_LENGTH);
    if (!text) return;
    try {
      await addDoc(chatContext.messagesRef, {
        text,
        uid,
        name: chatContext.displayName,
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now(),
      });
      input.value = "";
      status.textContent = "";
    } catch (err) {
      console.error("Failed to send chat message", err);
      status.textContent = "Message failed to send.";
    }
  };
}

function buildPlayerUidLookup(players = []) {
  const byId = new Map();
  const byName = new Map();
  players.forEach((player) => {
    const playerUid = String(player?.uid || "").trim();
    if (!playerUid) return;
    if (player?.id) {
      byId.set(player.id, playerUid);
    }
    const name = String(player?.name || "").trim().toLowerCase();
    if (!name) return;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(playerUid);
  });
  return { byId, byName };
}

function resolvePlayerUid(player, lookup) {
  if (!player || !lookup) return "";
  const directUid = String(player?.uid || "").trim();
  if (directUid) return directUid;
  if (player?.id && lookup.byId.has(player.id)) {
    return lookup.byId.get(player.id) || "";
  }
  const name = String(player?.name || "").trim().toLowerCase();
  if (name && lookup.byName.has(name)) {
    const candidates = lookup.byName.get(name) || [];
    if (candidates.length === 1) return candidates[0] || "";
  }
  return "";
}

export function teardownMatchChatUi() {
  stopMatchChat();
  const panel = document.getElementById("matchChatPanel");
  const section = document.getElementById("matchChatSection");
  const toggle = document.getElementById("matchChatToggle");
  const labelEl = document.getElementById("matchChatLabel");
  const historyEl = document.getElementById("matchChatHistory");
  const input = document.getElementById("matchChatInput");
  const status = document.getElementById("matchChatStatus");
  if (panel) panel.style.display = "none";
  if (section) section.style.display = "none";
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    if (labelEl) labelEl.textContent = "Match chat";
  }
  if (historyEl) historyEl.replaceChildren();
  if (input) input.value = "";
  if (status) status.textContent = "";
  chatIsOpen = false;
  lastSeenAtMs = 0;
  unreadCount = 0;
  hasInitialized = false;
  chatStorageKey = "";
  chatMatchId = "";
  chatUid = "";
  updateUnreadIndicator(0);
}

function getChatDisplayName() {
  return (
    (getCurrentUsername?.() || "").trim() ||
    auth?.currentUser?.displayName ||
    "Player"
  );
}

function getTournamentAdminUids(meta) {
  const uids = [];
  if (meta?.createdBy) {
    uids.push(meta.createdBy);
  }
  const admins = Array.isArray(meta?.admins) ? meta.admins : [];
  admins.forEach((entry) => {
    if (entry?.uid) uids.push(entry.uid);
  });
  return uids;
}

function uniqueUids(list = []) {
  const seen = new Set();
  return list
    .filter((uid) => typeof uid === "string" && uid.trim())
    .map((uid) => uid.trim())
    .filter((uid) => {
      if (seen.has(uid)) return false;
      seen.add(uid);
      return true;
    });
}

async function startMatchChat({
  matchId,
  participantUids = [],
  canSend,
  uid,
  displayName,
  retryCount = 0,
}) {
  stopMatchChat();
  const historyEl = document.getElementById("matchChatHistory");
  const status = document.getElementById("matchChatStatus");
  if (!currentSlug || !matchId || !historyEl) return;

  const docRef = doc(db, MATCH_CHAT_COLLECTION, currentSlug, "matches", matchId);
  const cachedParticipants = chatParticipantCache.get(matchId) || [];
  const safeParticipants = uniqueUids([...cachedParticipants, ...participantUids]);
  try {
    if (safeParticipants.length && safeParticipants.length <= 25) {
      await setDoc(
        docRef,
        {
          participants: safeParticipants,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      chatParticipantCache.set(matchId, safeParticipants);
    } else if (safeParticipants.length > 25) {
      console.warn("Match chat participants exceeded limit, skipping sync.");
    }
  } catch (err) {
    console.warn("Failed to sync match chat participants", err);
    if (status && err?.code !== "permission-denied") {
      status.textContent = "Chat is unavailable right now.";
    }
  }

  const messagesRef = collection(
    db,
    MATCH_CHAT_COLLECTION,
    currentSlug,
    "matches",
    matchId,
    "messages"
  );
  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    limit(MATCH_CHAT_LIMIT)
  );
  chatContext = { messagesRef, canSend, uid, displayName };
  chatUnsub = onSnapshot(
    messagesQuery,
    (snap) => {
      const messages = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() || {}),
      }));
      renderMatchChatMessages(messages, uid);
    },
    (err) => {
      console.warn("Match chat listener error", err);
      if (err?.code === "permission-denied" && retryCount < 1) {
        if (status) status.textContent = "Chat reconnecting...";
        setTimeout(() => {
          startMatchChat({
            matchId,
            participantUids,
            canSend,
            uid,
            displayName,
            retryCount: retryCount + 1,
          });
        }, 600);
        return;
      }
      if (status) status.textContent = "Chat disconnected.";
    }
  );
}

function renderMatchChatMessages(messages = [], uid = null) {
  const historyEl = document.getElementById("matchChatHistory");
  if (!historyEl) return;
  historyEl.replaceChildren();

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "helper";
    empty.textContent = "No messages yet.";
    historyEl.appendChild(empty);
    if (!hasInitialized) {
      hasInitialized = true;
    }
    updateUnreadIndicator(0);
    return;
  }

  const frag = document.createDocumentFragment();
  messages.forEach((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "match-chat-message";
    if (uid && entry.uid === uid) {
      wrapper.classList.add("is-own");
    }
    const meta = document.createElement("div");
    meta.className = "match-chat-meta";
    const name = document.createElement("span");
    name.textContent = entry.name || "Player";
    const time = document.createElement("span");
    time.textContent = formatChatTime(entry);
    meta.append(name, time);
    const text = document.createElement("div");
    text.className = "match-chat-text";
    text.textContent = entry.text || "";
    wrapper.append(meta, text);
    frag.appendChild(wrapper);
  });
  historyEl.appendChild(frag);
  historyEl.scrollTop = historyEl.scrollHeight;

  const latest = messages[messages.length - 1];
  const latestTs = getMessageTimestamp(latest);
  if (!hasInitialized) {
    hasInitialized = true;
  }
  if (chatIsOpen) {
    if (latestTs > lastSeenAtMs) lastSeenAtMs = latestTs;
    unreadCount = 0;
    persistLastSeenAtMs(chatStorageKey, lastSeenAtMs);
    updateUnreadIndicator(0);
    return;
  }
  unreadCount = messages.filter((entry) => {
    const ts = getMessageTimestamp(entry);
    return ts > lastSeenAtMs && entry?.uid !== uid;
  }).length;
  updateUnreadIndicator(unreadCount);
}

function formatChatTime(entry = {}) {
  const raw = entry.createdAt;
  const ts = raw?.toMillis ? raw.toMillis() : Number(raw) || entry.clientCreatedAt;
  if (!ts) return "";
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getMessageTimestamp(entry = {}) {
  const raw = entry.createdAt;
  return raw?.toMillis ? raw.toMillis() : Number(raw) || entry.clientCreatedAt || 0;
}

function stopMatchChat() {
  if (chatUnsub) {
    try {
      chatUnsub();
    } catch (_) {
      // ignore
    }
  }
  chatUnsub = null;
  chatContext = null;
}

function updateUnreadIndicator(count) {
  if (!chatUnreadEl) return;
  const safeCount = Number.isFinite(count) ? count : 0;
  chatUnreadEl.textContent = safeCount > 0 ? String(safeCount) : "";
  chatUnreadEl.classList.toggle("is-visible", safeCount > 0);
}

function getChatStorageKey(matchId, uid) {
  if (!matchId || !uid || !currentSlug) return "";
  return `matchChatSeen:${currentSlug}:${matchId}:${uid}`;
}

function loadLastSeenAtMs(key) {
  if (!key) return 0;
  try {
    const raw = window.localStorage.getItem(key);
    return Number(raw) || 0;
  } catch (_) {
    return 0;
  }
}

function persistLastSeenAtMs(key, value) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, String(value || 0));
  } catch (_) {
    // ignore storage issues
  }
}
