import { initAnalytics } from "./analyticsHelper.js";

export function initCookieConsent(app) {
  const banner = document.getElementById("cookieBanner");
  const acceptBtn = document.getElementById("cookieAccept");
  const declineBtn = document.getElementById("cookieDecline");

  const consent = localStorage.getItem("analyticsConsent");

  if (consent === "accepted") {
    import("firebase/analytics").then(({ getAnalytics }) => {
      getAnalytics(app);
      initAnalytics(app);
    });
    if (banner) banner.style.display = "none";
    return;
  }

  if (consent === "declined") {
    if (banner) banner.style.display = "none";
    return;
  }

  if (!banner) return;

  banner.style.display = "block";
  if (acceptBtn) {
    acceptBtn.addEventListener("click", async () => {
      localStorage.setItem("analyticsConsent", "accepted");
      banner.style.display = "none";
      try {
        const { getAnalytics } = await import("firebase/analytics");
        getAnalytics(app);
        initAnalytics(app);
      } catch (_) {
        // ignore analytics load errors
      }
    });
  }
  if (declineBtn) {
    declineBtn.addEventListener("click", () => {
      localStorage.setItem("analyticsConsent", "declined");
      banner.style.display = "none";
    });
  }
}
