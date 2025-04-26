// viewBuild.js (final fixed)

import { auth, db } from "../../app.js"; // ✅ Reuse existing Firebase app
import {
  doc,
  getDoc,
  collection,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { formatActionText } from "../modules/textFormatters.js";

async function loadBuild() {
  const urlParams = new URLSearchParams(window.location.search);
  const buildId = urlParams.get("id");

  if (!buildId) {
    document.getElementById("buildTitle").innerText = "Build not found.";
    console.error("❌ Error: No build ID in URL.");
    return;
  }

  console.log("🔍 Loading build with ID:", buildId);

  const buildRef = doc(db, "communityBuilds", buildId);
  const buildSnapshot = await getDoc(buildRef);

  if (buildSnapshot.exists()) {
    const build = buildSnapshot.data();
    console.log("✅ Build Loaded:", build);

    document.getElementById("buildTitle").innerText =
      build.title || "Untitled Build";
    document.getElementById("buildCategory").innerText =
      build.category || "Unknown";
    document.getElementById("buildMatchup").innerText =
      build.subcategory || "Unknown";
    document.getElementById("buildPublisher").innerText =
      build.username || "Anonymous";
    document.getElementById("buildDate").innerText = new Date(
      build.datePublished
    ).toLocaleDateString();

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
            ? `<strong>[${step.workersOrTimestamp}]</strong> `
            : "";
          buildOrderContainer.innerHTML += `<p>${bracket}${formatActionText(
            step.action
          )}</p>`;
        }
      });
    } else {
      buildOrderContainer.innerHTML = "<p>No build order available.</p>";
    }
  } else {
    console.error("❌ Build not found in Firestore:", buildId);
    document.getElementById("buildTitle").innerText = "Build not found.";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.includes("viewBuild.html")) return;

  const importBtn = document.getElementById("importBuildButton");
  const buildId = new URLSearchParams(window.location.search).get("id");

  if (!importBtn) {
    console.warn("⚠️ Import button not found.");
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      importBtn.style.display = "inline-block";
    } else {
      importBtn.style.display = "none";
    }
  });

  importBtn.addEventListener("click", async () => {
    try {
      const communitySnap = await getDoc(doc(db, "communityBuilds", buildId));
      if (!communitySnap.exists()) throw new Error("Build not found");

      const data = communitySnap.data();
      const userBuildRef = doc(
        collection(db, `users/${auth.currentUser.uid}/builds`),
        buildId
      );
      await setDoc(userBuildRef, {
        ...data,
        imported: true,
        timestamp: Date.now(),
      });

      alert("✅ Build imported to your library!");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to import build.");
    }
  });
});

document.addEventListener("DOMContentLoaded", loadBuild);

window.addEventListener("popstate", () => {
  loadBuild();
});
