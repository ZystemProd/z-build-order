import { deleteUser } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { showToast } from "../toastHandler.js";

function initDeleteAccountFlow({ closeUserMenu } = {}) {
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  const deleteAccountModal = document.getElementById("deleteAccountModal");
  const confirmDeleteAccountButton = document.getElementById(
    "confirmDeleteAccountButton"
  );
  const cancelDeleteAccountButton = document.getElementById(
    "cancelDeleteAccountButton"
  );

  if (!deleteAccountModal || !deleteAccountBtn) return;

  deleteAccountBtn.addEventListener("click", () => {
    deleteAccountModal.style.display = "block";
  });

  if (cancelDeleteAccountButton) {
    cancelDeleteAccountButton.addEventListener("click", () => {
      deleteAccountModal.style.display = "none";
    });
  }

  if (!confirmDeleteAccountButton) return;

  confirmDeleteAccountButton.addEventListener("click", async () => {
    const deleteCommunityBuilds = document.getElementById(
      "deleteCommunityBuildsCheckbox"
    ).checked;

    const user = auth.currentUser;
    if (!user) {
      showToast("❌ Failed to delete account. Please sign in again.", "error");
      return;
    }
    const userId = user.uid;

    try {
      // 1. Get the username first
      const userRef = doc(db, "users", userId);
      const userSnapshot = await getDoc(userRef);

      let usernameToDelete = null;
      if (userSnapshot.exists()) {
        usernameToDelete = userSnapshot.data().username || null;
      }

      // 2. Delete user document
      await deleteDoc(userRef);

      // 3. Delete username mapping
      if (usernameToDelete) {
        const usernameDoc = doc(db, "usernames", usernameToDelete);
        await deleteDoc(usernameDoc);
        console.log(`✅ Deleted username mapping: ${usernameToDelete}`);
      }

      // 4. Delete all user's personal builds
      const buildsRef = collection(db, `users/${userId}/builds`);
      const buildSnapshots = await getDocs(buildsRef);
      const deletePersonalBuilds = buildSnapshots.docs.map((docSnap) =>
        deleteDoc(docSnap.ref)
      );
      await Promise.all(deletePersonalBuilds);
      console.log("✅ Deleted all personal builds");

      // 5. Optionally delete community builds by this user
      if (deleteCommunityBuilds && usernameToDelete) {
        const publishedRef = collection(db, "publishedBuilds");
        const querySnapshot = await getDocs(publishedRef);
        const toDelete = querySnapshot.docs.filter(
          (docSnap) =>
            docSnap.data().username === usernameToDelete ||
            docSnap.data().publisher === usernameToDelete
        );
        const deleteCommunity = toDelete.map((docSnap) =>
          deleteDoc(docSnap.ref)
        );
        await Promise.all(deleteCommunity);
        console.log(`✅ Deleted ${toDelete.length} community builds`);
      }

      // 6. Delete Firebase Auth account
      await deleteUser(user);
      if (typeof closeUserMenu === "function") closeUserMenu();
      showToast("✅ Account deleted successfully.", "success");

      deleteAccountModal.style.display = "none";
      setTimeout(() => (window.location.href = "/"), 2000);
    } catch (error) {
      console.error("❌ Error deleting account:", error);
      showToast(
        "❌ Failed to delete account. Try re-logging in first.",
        "error"
      );
    }
  });
}

export { initDeleteAccountFlow };
