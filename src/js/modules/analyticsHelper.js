import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";

let analyticsInstance = null;

export function initAnalytics(app) {
  if (!analyticsInstance) {
    analyticsInstance = getAnalytics(app);
  }
}

export function logAnalyticsEvent(eventName, params = {}) {
  if (!analyticsInstance) return;
  try {
    logEvent(analyticsInstance, eventName, params);
  } catch (err) {
    console.error("Analytics log failed", err);
  }
}
