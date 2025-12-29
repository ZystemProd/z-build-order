import { auth, db } from "../../../app.js";
import { listPublicClans } from "../clan.js";
import { createNotificationDot } from "../notificationDot.js";

export async function checkForJoinRequestNotifications() {
  const clans = await listPublicClans();
  const user = auth.currentUser;
  if (!user) return;

  const hasPending = clans.some((c) => {
    const isCaptain =
      c.adminUid === user.uid ||
      c.memberInfo?.[user.uid]?.role === "Co-Captain";
    return isCaptain && c.joinRequests?.length > 0;
  });

  const btn = document.getElementById("showClanModalButton");
  if (!btn) return;

  const existingDot = btn.querySelector(".notification-dot");
  if (existingDot) {
    existingDot.classList.add("removing");
    setTimeout(() => existingDot.remove(), 300);
  }

  if (hasPending) {
    const dot = createNotificationDot();
    dot.classList.add("notification-dot");
    btn.style.position = "relative";
    btn.appendChild(dot);
  }
}
