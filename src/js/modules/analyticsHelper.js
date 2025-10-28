let analyticsInstance = null;

export async function initAnalytics(app) {
  if (analyticsInstance) return;
  try {
    const { getAnalytics } = await import("firebase/analytics");
    analyticsInstance = getAnalytics(app);
  } catch (_) {
    // ignore errors; analytics remains disabled
  }
}

export async function logAnalyticsEvent(eventName, params = {}) {
  if (!analyticsInstance) return;
  try {
    const { logEvent } = await import("firebase/analytics");
    logEvent(analyticsInstance, eventName, params);
  } catch (err) {
    console.error("Analytics log failed", err);
  }
}
