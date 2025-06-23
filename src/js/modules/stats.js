import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { auth, db } from "../../app.js";
import { showToast } from "./toastHandler.js";

export async function fetchUserStats() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // Personal builds
    const buildsSnap = await getDocs(collection(db, `users/${user.uid}/builds`));
    const totalBuilds = buildsSnap.size;
    let totalImported = 0;
    buildsSnap.forEach((d) => {
      if (d.data().imported) totalImported++;
    });

    // Published builds
    const pubQuery = query(
      collection(db, "publishedBuilds"),
      where("publisherUid", "==", user.uid)
    );
    const pubSnap = await getDocs(pubQuery);

    let totalPublished = 0;
    let totalViews = 0;
    let totalUpvotes = 0;
    let mostPopularTitle = null;
    let bestScore = -1;
    pubSnap.forEach((doc) => {
      totalPublished++;
      const data = doc.data();
      const views = data.views || 0;
      const upvotes = data.upvotes || 0;
      totalViews += views;
      totalUpvotes += upvotes;
      const score = views + upvotes;
      if (score > bestScore) {
        bestScore = score;
        mostPopularTitle = data.title || "Untitled Build";
      }
    });

    return {
      totalBuilds,
      totalPublished,
      totalImported,
      totalViews,
      totalUpvotes,
      mostPopularTitle,
    };
  } catch (err) {
    console.error("Failed to fetch user stats", err);
    showToast("Error loading stats", "error");
    return null;
  }
}

export async function showUserStats() {
  const modal = document.getElementById("userStatsModal");
  const contentEl = document.getElementById("userStatsContent");
  if (!modal || !contentEl) return;

  modal.style.display = "block";
  contentEl.textContent = "Loading...";

  const stats = await fetchUserStats();
  if (!stats) return;

  const makeLine = (label, value) => {
    const dots = ".".repeat(Math.max(1, 45 - label.length));
    return `${label} ${dots} (${value})`;
  };

  contentEl.innerHTML = `
    <ul class="stats-list">
      <li>${makeLine("Total Builds Created", stats.totalBuilds)}</li>
      <li>${makeLine("Total Published Builds", stats.totalPublished)}</li>
      <li>${makeLine("Total Imported Builds", stats.totalImported)}</li>
      <li>${makeLine("Total Views on Published Builds", stats.totalViews)}</li>
      <li>${makeLine("Total Upvotes on Published Builds", stats.totalUpvotes)}</li>
      <li>${makeLine("Most Popular Build", stats.mostPopularTitle || "N/A")}</li>
    </ul>
  `;
}

export function closeUserStats() {
  const modal = document.getElementById("userStatsModal");
  if (modal) modal.style.display = "none";
}
