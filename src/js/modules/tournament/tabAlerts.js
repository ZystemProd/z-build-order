const PREF_MATCH_READY_KEY = "zboNotifyMatchReady";
const PREF_UNREAD_CHAT_KEY = "zboNotifyUnreadChat";
const PREF_MATCH_READY_SOUND_KEY = "zboNotifyMatchReadySound";

let baseTitle = "";
let unreadChatCount = 0;
let notifiedReadyMatches = new Set();
let pendingReadyMatches = new Map();
let pendingReadyCount = 0;
let notificationRequestAttempted = false;
let lastUnreadPopupAt = 0;
let lastReadySoundAt = 0;
let hasUserGesture = false;
let pendingReadySound = false;

const UNREAD_POPUP_COOLDOWN_MS = 20_000;
const READY_SOUND_COOLDOWN_MS = 5_000;

function readBoolPref(key, fallback = true) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch (_) {
    return fallback;
  }
}

function updateDocumentTitle() {
  const title = baseTitle || document.title || "Tournament";
  const readyBadgeCount = pendingReadyCount + notifiedReadyMatches.size;
  const badgeCount = readyBadgeCount + unreadChatCount;
  if (badgeCount > 0) {
    document.title = `(${badgeCount}) ${title}`;
  } else {
    document.title = title;
  }
}

function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function ensureNotificationPermission() {
  if (!canUseBrowserNotifications()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  if (!hasUserGesture) return false;
  if (notificationRequestAttempted) return false;
  notificationRequestAttempted = true;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch (_) {
    return false;
  }
}

async function showBrowserNotification(title, body) {
  if (!document.hidden) return false;
  const allowed = await ensureNotificationPermission();
  if (!allowed) return false;
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          tag: "zbo-tournament-alert",
          renotify: false,
        });
        return true;
      }
    }

    const note = new Notification(title, { body });
    setTimeout(() => {
      try {
        note.close();
      } catch (_) {
        // ignore
      }
    }, 7000);
    return true;
  } catch (_) {
    return false;
  }
}

function playMatchReadySound() {
  if (!readBoolPref(PREF_MATCH_READY_SOUND_KEY, true)) return;
  if (!hasUserGesture) {
    pendingReadySound = true;
    return;
  }
  const now = Date.now();
  if (now - lastReadySoundAt < READY_SOUND_COOLDOWN_MS) return;

  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || window.webkitAudioContext
      : null;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const start = ctx.currentTime + 0.01;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.05);
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, start);
    filter.Q.value = 1.2;
    filter.connect(master);

    const notes = [
      { hz: 523.25, t: 0.0, d: 0.22 }, // C5
      { hz: 659.25, t: 0.18, d: 0.24 }, // E5
      { hz: 783.99, t: 0.36, d: 0.52 }, // G5
    ];

    for (const note of notes) {
      const noteStart = start + note.t;
      const noteEnd = noteStart + note.d;

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(0.9, noteStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      noteGain.connect(filter);

      // Brass body
      const body = ctx.createOscillator();
      body.type = "sawtooth";
      body.frequency.setValueAtTime(note.hz, noteStart);
      body.frequency.linearRampToValueAtTime(note.hz * 1.01, noteStart + 0.05);
      body.connect(noteGain);
      body.start(noteStart);
      body.stop(noteEnd);

      // Bright overtone for trumpet bite
      const bite = ctx.createOscillator();
      bite.type = "square";
      bite.frequency.setValueAtTime(note.hz * 2, noteStart);
      bite.connect(noteGain);
      bite.start(noteStart);
      bite.stop(noteEnd - 0.03);
    }

    setTimeout(() => {
      try {
        void ctx.close();
      } catch (_) {
        // ignore
      }
    }, 1500);
    lastReadySoundAt = now;
    pendingReadySound = false;
  } catch (_) {
    pendingReadySound = true;
  }
}

export function initTabAlerts() {
  if (typeof document === "undefined") return;
  baseTitle = document.title || "Tournament";
  unreadChatCount = 0;
  updateDocumentTitle();
  if (typeof window !== "undefined") {
    const markUserGesture = () => {
      hasUserGesture = true;
      if (pendingReadySound) {
        playMatchReadySound();
      }
      const permission = canUseBrowserNotifications()
        ? window.Notification.permission
        : "denied";
      const hasPendingAlerts =
        pendingReadyMatches.size > 0 || unreadChatCount > 0;
      if (!hasPendingAlerts) return;
      if (permission === "default") {
        void ensureNotificationPermission().then(() => {
          if (document.hidden) {
            void flushPendingReadyNotifications();
          }
        });
        return;
      }
      if (document.hidden) {
        void flushPendingReadyNotifications();
      }
    };
    document.addEventListener("pointerdown", markUserGesture, {
      passive: true,
      capture: true,
    });
    document.addEventListener("keydown", markUserGesture, { capture: true });

    window.addEventListener("beforeunload", () => {
      updateDocumentTitle();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        void flushPendingReadyNotifications();
      }
    });
  }
}

export function setTabAlertsBaseTitle(nextTitle) {
  if (!nextTitle) return;
  baseTitle = String(nextTitle).trim() || baseTitle;
  updateDocumentTitle();
}

export function setUnreadChatCount(count) {
  unreadChatCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  updateDocumentTitle();
}

export function handleUnreadChatEvent(event) {
  const count = Number(event?.detail?.count) || 0;
  setUnreadChatCount(count);
  if (!document.hidden) return;
  if (!readBoolPref(PREF_UNREAD_CHAT_KEY, true)) return;
  if (count <= 0) return;
  const now = Date.now();
  if (now - lastUnreadPopupAt < UNREAD_POPUP_COOLDOWN_MS) return;
  lastUnreadPopupAt = now;
  void showBrowserNotification("Unread match chat", `You have ${count} unread message(s).`);
}

export function notifyMatchReadyAlert({
  matchId,
  opponentName = "Opponent",
  tournamentName = "Tournament",
} = {}) {
  if (!matchId) return;
  if (notifiedReadyMatches.has(matchId) || pendingReadyMatches.has(matchId)) return;
  pendingReadyMatches.set(matchId, { opponentName, tournamentName });
  playMatchReadySound();
  pendingReadyCount = pendingReadyMatches.size;
  updateDocumentTitle();
  void flushPendingReadyNotifications();
}

export function clearNotifiedReadyMatch(matchId) {
  if (!matchId) return;
  notifiedReadyMatches.delete(matchId);
  pendingReadyMatches.delete(matchId);
  pendingReadyCount = pendingReadyMatches.size;
  updateDocumentTitle();
}

async function flushPendingReadyNotifications() {
  if (!document.hidden) return;
  if (!readBoolPref(PREF_MATCH_READY_KEY, true)) return;
  if (!pendingReadyMatches.size) return;
  for (const [matchId, meta] of Array.from(pendingReadyMatches.entries())) {
    const shown = await showBrowserNotification(
      "Match ready",
      `${meta?.opponentName || "Opponent"} is ready in ${
        meta?.tournamentName || "Tournament"
      }.`,
    );
    if (!shown) continue;
    notifiedReadyMatches.add(matchId);
    pendingReadyMatches.delete(matchId);
  }
  pendingReadyCount = pendingReadyMatches.size;
  updateDocumentTitle();
}
