import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../app.js";
import { lockBodyScroll, unlockBodyScroll } from "./modalLock.js";

export function initTournamentNotifications() {
  const container = document.getElementById("tournamentNotifications");
  if (!container || container.dataset.bound === "true") return;
  container.dataset.bound = "true";

  const trigger = document.getElementById("notificationTrigger");
  const dropdown = document.getElementById("notificationDropdown");
  const list = document.getElementById("notificationList");
  const count = document.getElementById("notificationCount");
  const viewAll = document.getElementById("notificationViewAll");
  const modal = document.getElementById("notificationModal");
  const closeModalBtn = document.getElementById("closeNotificationModal");
  const sidebar = document.getElementById("notificationSidebarList");
  const detailTitle = document.getElementById("notificationDetailTitle");
  const detailMeta = document.getElementById("notificationDetailMeta");
  const detailBody = document.getElementById("notificationDetailBody");
  const detailActions = document.getElementById("notificationDetailActions");

  if (!trigger || !dropdown || !list || !modal || !sidebar || !detailTitle || !detailMeta || !detailBody || !detailActions) {
    return;
  }

  let activeId = "";
  let notifications = [];
  let unsubscribe = null;
  const readPending = new Set();
  const actionPending = new Set();
  let racePromptId = "";
  let selectedRace = "";

  const normalizeStatus = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "pending" || normalized === "accepted" || normalized === "denied") return normalized;
    return "pending";
  };

  const formatTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const mapNotification = (docSnap) => {
    const data = docSnap.data() || {};
    const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
    const type = data.type || "generic";
    const rawStatus = data.status || "";
    const status = type === "tournament-invite" ? normalizeStatus(rawStatus) : rawStatus;
    const tournamentName = data.tournamentName || data.tournamentSlug || "Tournament";
    const slugFromName =
      tournamentName && /^[a-z0-9-]+$/i.test(tournamentName) ? tournamentName : "";
    const tournamentSlug =
      data.tournamentSlug || data.tournamentId || data.slug || slugFromName;
    const tournamentUrl = data.tournamentUrl || "";
    const circuitSlug = data.circuitSlug || "";
    const senderName = data.senderUsername || data.senderName || "Tournament admin";
    const readAt = data.readAt?.toMillis ? data.readAt.toMillis() : data.readAt;
    let title = data.title || "Notification";
    let preview = data.preview || data.message || "";
    let body = data.body || data.message || "";
    let typeLabel = data.typeLabel || "Update";
    if (type === "tournament-invite") {
      title = `Invite to ${tournamentName}`;
      preview = `${senderName} invited you to ${tournamentName}.`;
      body = `${senderName} invited you to ${tournamentName}.\n\nAccept to join the tournament.`;
      typeLabel = "Invite";
    } else if (type === "caster-invite") {
      title = `Caster invite: ${tournamentName}`;
      preview = `${senderName} invited you to cast ${tournamentName}.`;
      body = `${senderName} invited you to register as a caster for ${tournamentName}.`;
      typeLabel = "Caster invite";
    } else if (type === "tournament-checkin") {
      title = `Check-in for ${tournamentName}`;
      preview = `Check-in is open for ${tournamentName}.`;
      body = `Check-in is open for ${tournamentName}.`;
      typeLabel = "Check-in";
    }
    return {
      id: docSnap.id,
      type,
      status,
      tournamentSlug,
      circuitSlug,
      tournamentUrl,
      tournamentName,
      senderName,
      userId: data.userId || "",
      title,
      preview,
      body,
      typeLabel,
      createdAt,
      readAt,
      time: formatTime(createdAt),
    };
  };

  const markReadById = async (id) => {
    if (!id || readPending.has(id)) return;
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const note = notifications.find((entry) => entry.id === id);
    if (!note || note.readAt) return;
    readPending.add(id);
    try {
      await updateDoc(doc(db, "users", userId, "notifications", id), {
        readAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Failed to mark notification read", err);
    } finally {
      readPending.delete(id);
    }
  };

  const setCount = () => {
    if (!count) return;
    const unreadCount = notifications.filter((note) => !note.readAt).length;
    if (unreadCount > 0) {
      count.textContent = String(unreadCount);
      count.style.display = "block";
    } else {
      count.style.display = "none";
    }
  };

  const renderDropdown = () => {
    if (!list) return;
    list.innerHTML = "";
    if (notifications.length === 0) {
      const empty = document.createElement("li");
      empty.className = "notification-dropdown-empty";
      empty.textContent = auth.currentUser ? "No new notifications." : "Sign in to view notifications.";
      list.appendChild(empty);
      return;
    }
    notifications.forEach((note) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-dropdown-item";
      button.dataset.notificationId = note.id;
      if (!note.readAt) {
        const dot = document.createElement("span");
        dot.className = "notification-unread-dot";
        dot.setAttribute("aria-hidden", "true");
        button.appendChild(dot);
      }
      const preview = document.createElement("span");
      preview.className = "notification-preview";
      preview.textContent = note.preview;
      const time = document.createElement("span");
      time.className = "notification-time";
      time.textContent = note.time;
      button.append(preview, time);
      item.appendChild(button);
      list.appendChild(item);
    });
  };

  const renderSidebar = () => {
    sidebar.innerHTML = "";
    if (notifications.length === 0) {
      const empty = document.createElement("p");
      empty.className = "notification-sidebar-empty";
      empty.textContent = auth.currentUser ? "No notifications yet." : "Sign in to view notifications.";
      sidebar.appendChild(empty);
      return;
    }
    notifications.forEach((note) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-sidebar-item";
      button.dataset.notificationId = note.id;
      if (note.id === activeId) {
        button.classList.add("is-active");
      }
      const title = document.createElement("span");
      title.className = "notification-sidebar-title";
      title.textContent = note.title;
      const preview = document.createElement("span");
      preview.className = "notification-preview";
      preview.textContent = note.preview;
      const time = document.createElement("span");
      time.className = "notification-time";
      time.textContent = note.time;
      button.append(title, preview, time);
      sidebar.appendChild(button);
    });
  };

  const renderDetail = (id) => {
    const note = notifications.find((entry) => entry.id === id) || notifications[0];
    if (!note) return;
    const getTournamentHref = (entry) => {
      if (entry.tournamentUrl) return entry.tournamentUrl;
      if (!entry.tournamentSlug) return "";
      return entry.circuitSlug
        ? `/tournament/${entry.circuitSlug}/${entry.tournamentSlug}`
        : `/tournament/${entry.tournamentSlug}`;
    };
    activeId = note.id;
    detailTitle.textContent = "";
    if (
      (note.type === "tournament-invite" ||
        note.type === "tournament-checkin" ||
        note.type === "caster-invite") &&
      (note.tournamentUrl || note.tournamentSlug)
    ) {
      const titleLink = document.createElement("a");
      titleLink.href = getTournamentHref(note);
      titleLink.textContent = note.title;
      titleLink.className = "notification-title-link";
      titleLink.rel = "noopener";
      titleLink.target = "_blank";
      detailTitle.appendChild(titleLink);
    } else {
      detailTitle.textContent = note.title;
    }
    const statusLabel = note.status ? note.status.charAt(0).toUpperCase() + note.status.slice(1) : "";
    const metaParts = [note.typeLabel || "", note.time || ""].filter(Boolean);
    if (statusLabel) metaParts.push(statusLabel);
    detailMeta.textContent = metaParts.join(" · ");
    detailBody.textContent = "";
    if (note.type === "tournament-invite") {
      const message = document.createElement("p");
      message.className = "notification-message";
      message.append(`${note.senderName} invited you to `);
      const href = getTournamentHref(note);
      if (href) {
        const link = document.createElement("a");
        link.className = "notification-inline-link";
        link.href = href;
        link.textContent = note.tournamentName;
        link.rel = "noopener";
        link.target = "_blank";
        message.appendChild(link);
      } else {
        message.append(note.tournamentName);
      }
      message.append(".");
      const prompt = document.createElement("p");
      prompt.className = "notification-message";
      prompt.textContent = "Accept to join the tournament.";
      detailBody.append(message, prompt);
    } else if (note.type === "caster-invite") {
      const message = document.createElement("p");
      message.className = "notification-message";
      message.append(`${note.senderName} invited you to cast `);
      const href = getTournamentHref(note);
      if (href) {
        const link = document.createElement("a");
        link.className = "notification-inline-link";
        link.href = href;
        link.textContent = note.tournamentName;
        link.rel = "noopener";
        link.target = "_blank";
        message.appendChild(link);
      } else {
        message.append(note.tournamentName);
      }
      message.append(".");
      const prompt = document.createElement("p");
      prompt.className = "notification-message";
      prompt.textContent =
        "Open the tournament page and request caster access.";
      detailBody.append(message, prompt);
    } else if (note.type === "tournament-checkin") {
      const message = document.createElement("p");
      message.className = "notification-message";
      message.append("Check-in is open for ");
      const href = getTournamentHref(note);
      if (href) {
        const link = document.createElement("a");
        link.className = "notification-inline-link";
        link.href = href;
        link.textContent = note.tournamentName;
        link.rel = "noopener";
        link.target = "_blank";
        message.appendChild(link);
      } else {
        message.append(note.tournamentName);
      }
      message.append(".");
      detailBody.append(message);
    } else {
      detailBody.textContent = note.body;
    }
    detailActions.innerHTML = "";
    if (note.type === "tournament-invite") {
      if (note.status === "pending") {
        if (racePromptId === note.id) {
          const divider = document.createElement("div");
          divider.className = "notification-action-divider";
          const prompt = document.createElement("p");
          prompt.className = "notification-race-prompt";
          prompt.textContent = "Choose race you want to register with.";
          const raceRow = document.createElement("div");
          raceRow.className = "notification-race-row";
          ["Zerg", "Protoss", "Terran", "Random"].forEach((race) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "notification-race-option";
            if (selectedRace === race) {
              btn.classList.add("is-selected");
            }
            btn.dataset.notificationRace = race;
            btn.textContent = race;
            raceRow.appendChild(btn);
          });
          const actionsRow = document.createElement("div");
          actionsRow.className = "notification-race-actions";
          const confirmBtn = document.createElement("button");
          confirmBtn.type = "button";
          confirmBtn.className = "notification-action-button accept";
          confirmBtn.dataset.notificationAction = "confirm-accept";
          confirmBtn.dataset.notificationId = note.id;
          confirmBtn.textContent = actionPending.has(note.id) ? "Accepting..." : "Confirm";
          confirmBtn.disabled = !selectedRace || actionPending.has(note.id);
          const cancelBtn = document.createElement("button");
          cancelBtn.type = "button";
          cancelBtn.className = "notification-action-button deny";
          cancelBtn.dataset.notificationAction = "cancel-accept";
          cancelBtn.dataset.notificationId = note.id;
          cancelBtn.textContent = "Cancel";
          if (actionPending.has(note.id)) {
            cancelBtn.disabled = true;
          }
          actionsRow.append(confirmBtn, cancelBtn);
          detailActions.append(divider, prompt, raceRow, actionsRow);
        } else {
          const divider = document.createElement("div");
          divider.className = "notification-action-divider";
          const acceptBtn = document.createElement("button");
          acceptBtn.type = "button";
          acceptBtn.className = "notification-action-button accept";
          acceptBtn.dataset.notificationAction = "accept";
          acceptBtn.dataset.notificationId = note.id;
          acceptBtn.textContent = actionPending.has(note.id) ? "Accepting..." : "Accept";
          const denyBtn = document.createElement("button");
          denyBtn.type = "button";
          denyBtn.className = "notification-action-button deny";
          denyBtn.dataset.notificationAction = "deny";
          denyBtn.dataset.notificationId = note.id;
          denyBtn.textContent = actionPending.has(note.id) ? "Declining..." : "Deny";
          if (actionPending.has(note.id)) {
            acceptBtn.disabled = true;
            denyBtn.disabled = true;
          }
          detailActions.append(divider, acceptBtn, denyBtn);
        }
      } else {
        const statusPill = document.createElement("span");
        statusPill.className = `notification-status-pill ${note.status}`;
        statusPill.textContent = `Invite ${note.status}`;
        detailActions.appendChild(statusPill);
      }
    } else if (note.type === "tournament-checkin") {
      if (note.status === "checked-in") {
        const statusPill = document.createElement("span");
        statusPill.className = "notification-status-pill accepted";
        statusPill.textContent = "Checked in";
        detailActions.appendChild(statusPill);
      } else {
        const divider = document.createElement("div");
        divider.className = "notification-action-divider";
        const checkInBtn = document.createElement("button");
        checkInBtn.type = "button";
        checkInBtn.className = "notification-action-button accept";
        checkInBtn.dataset.notificationAction = "check-in";
        checkInBtn.dataset.notificationId = note.id;
        checkInBtn.textContent = actionPending.has(note.id) ? "Checking in..." : "Check in";
        if (actionPending.has(note.id)) {
          checkInBtn.disabled = true;
        }
        detailActions.append(divider, checkInBtn);
      }
    }
    renderSidebar();
  };

  const setDropdownOpen = (open) => {
    dropdown.style.display = open ? "block" : "none";
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const openModal = (id = activeId) => {
    renderDetail(id);
    modal.style.display = "flex";
    lockBodyScroll();
    markReadById(id);
  };

  const closeModal = () => {
    modal.style.display = "none";
    unlockBodyScroll();
  };

  trigger.addEventListener("click", () => {
    const isOpen = dropdown.style.display !== "none";
    setDropdownOpen(!isOpen);
  });

  detailActions.addEventListener("click", (event) => {
    const raceButton = event.target.closest("[data-notification-race]");
    if (raceButton) {
      selectedRace = raceButton.dataset.notificationRace || "";
      renderDetail(activeId);
      return;
    }
    const button = event.target.closest("[data-notification-action]");
    if (!button) return;
    const action = button.dataset.notificationAction;
    const id = button.dataset.notificationId;
    if (!action || !id || actionPending.has(id)) return;
    const note = notifications.find((entry) => entry.id === id);
    if (!note) return;
    if (action === "accept") {
      racePromptId = id;
      selectedRace = "";
      renderDetail(id);
      return;
    }
    if (action === "cancel-accept") {
      if (racePromptId === id) {
        racePromptId = "";
        selectedRace = "";
        renderDetail(id);
      }
      return;
    }
    const resolvedAction = action === "confirm-accept" ? "accept" : action;
    if (resolvedAction === "accept" && !selectedRace) {
      return;
    }
    actionPending.add(id);
    renderDetail(id);
    document.dispatchEvent(
      new CustomEvent("tournament:notification-action", {
        detail: { notification: note, action: resolvedAction, race: selectedRace },
      })
    );
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-notification-id]");
    if (!button) return;
    const id = button.dataset.notificationId;
    setDropdownOpen(false);
    openModal(id);
  });

  sidebar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-notification-id]");
    if (!button) return;
    const id = button.dataset.notificationId;
    renderDetail(id);
    markReadById(id);
  });

  viewAll?.addEventListener("click", () => {
    setDropdownOpen(false);
    openModal(activeId);
  });

  closeModalBtn?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) {
      setDropdownOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setDropdownOpen(false);
    if (modal.style.display !== "none") {
      closeModal();
    }
  });

  document.addEventListener("tournament:notification-action-complete", (event) => {
    const id = event.detail?.id;
    if (!id) return;
    actionPending.delete(id);
    if (racePromptId === id) {
      racePromptId = "";
      selectedRace = "";
    }
    if (id === activeId) {
      renderDetail(id);
    }
  });

  let retryTimer = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const TOKEN_REFRESH_COOLDOWN_MS = 60000;
  let lastTokenRefreshAt = 0;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const resetListenerState = (message) => {
    notifications = [];
    activeId = "";
    setCount();
    renderDropdown();
    renderSidebar();
    detailTitle.textContent = "Notifications";
    detailMeta.textContent = "";
    detailBody.textContent = message;
    detailActions.innerHTML = "";
  };

  const subscribeToNotifications = (user) => {
    unsubscribe = onSnapshot(
      collection(db, "users", user.uid, "notifications"),
      (snap) => {
        retryCount = 0;
        clearRetry();
        notifications = snap.docs
          .map(mapNotification)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (!activeId && notifications.length) {
          activeId = notifications[0].id;
        } else if (activeId && !notifications.find((note) => note.id === activeId)) {
          activeId = notifications[0]?.id || "";
        }
        actionPending.forEach((id) => {
          if (!notifications.find((note) => note.id === id)) {
            actionPending.delete(id);
          }
        });
        setCount();
        renderDropdown();
        if (activeId) {
          renderDetail(activeId);
        } else {
          detailTitle.textContent = "Notifications";
          detailMeta.textContent = "";
          detailBody.textContent = "No notifications yet.";
          detailActions.innerHTML = "";
          renderSidebar();
        }
      },
      async (err) => {
        if (err?.code === "permission-denied" && retryCount < MAX_RETRIES) {
          retryCount += 1;
          try {
            unsubscribe?.();
          } catch (_) {
            // ignore
          }
          unsubscribe = null;
          resetListenerState("Unable to load notifications (retrying...)");
          clearRetry();
          retryTimer = setTimeout(async () => {
            const now = Date.now();
            if (now - lastTokenRefreshAt >= TOKEN_REFRESH_COOLDOWN_MS) {
              lastTokenRefreshAt = now;
              try {
                await user.getIdToken(true);
              } catch (_) {
                // ignore token refresh errors; we'll still retry subscribe
              }
            }
            if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
            subscribeToNotifications(user);
          }, 750 * retryCount);
          return;
        }
        if (err?.code === "permission-denied") {
          // Keep UI visible (so the trigger is still reachable), but stop listening.
          try {
            unsubscribe?.();
          } catch (_) {
            // ignore
          }
          unsubscribe = null;
          clearRetry();
          resetListenerState("Unable to load notifications.");
          return;
        }

        console.warn("Notifications listener error", err);
        setCount();
        renderDropdown();
        renderSidebar();
        if (!notifications.length) {
          activeId = "";
          detailTitle.textContent = "Notifications";
          detailMeta.textContent = "";
          detailBody.textContent = "Unable to load notifications.";
          detailActions.innerHTML = "";
        }
      }
    );
  };

  onAuthStateChanged(auth, async (user) => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    clearRetry();
    if (!user) {
      container.style.display = "none";
      resetListenerState("Sign in to view notifications.");
      return;
    }
    container.style.display = "";
    resetListenerState("Loading notifications...");
    try {
      await user.getIdToken();
    } catch (_) {
      // ignore; listener will still try
    }
    subscribeToNotifications(user);
  });
}
