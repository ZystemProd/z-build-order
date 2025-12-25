import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { bannedWords } from "../../data/bannedWords.js";
import { showToast } from "../toastHandler.js";
import { updateSettingsHelperText } from "./helpers.js";
import { getCurrentUsername, setCurrentUsername } from "./state.js";

const normalizedBannedWords = bannedWords.map((word) =>
  (word || "").toLowerCase()
);

let usernameFormInitialized = false;

function containsBannedUsernameWord(username) {
  const lower = (username || "").toLowerCase();
  return normalizedBannedWords.some((badWord) => lower.includes(badWord));
}

function validateUsernameValue(rawInput) {
  const trimmed = typeof rawInput === "string" ? rawInput.trim() : "";
  if (!trimmed) {
    return { valid: false, message: "Username cannot be empty." };
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
    return {
      valid: false,
      message: "Username must be 3-20 characters, only letters, numbers, or _",
    };
  }
  if (containsBannedUsernameWord(trimmed)) {
    return {
      valid: false,
      message: "Username contains inappropriate words or reserved terms.",
    };
  }
  return { valid: true, cleaned: trimmed, message: "" };
}

function setSettingsUsernameStatus(message, tone = "muted") {
  updateSettingsHelperText("settingsUsernameStatus", message, tone);
}

function setSettingsUsernameValue(value) {
  const input = document.getElementById("settingsUsernameInput");
  if (input) input.value = value || "";
}

function setSettingsUsernameDisabled(isDisabled) {
  const input = document.getElementById("settingsUsernameInput");
  const saveBtn = document.getElementById("saveUsernameButton");
  if (input) input.disabled = isDisabled;
  if (saveBtn) saveBtn.disabled = isDisabled;
}

function setupUsernameSettingsSection() {
  if (usernameFormInitialized) return;
  const input = document.getElementById("settingsUsernameInput");
  const saveBtn = document.getElementById("saveUsernameButton");
  if (!input || !saveBtn) return;

  input.addEventListener("input", () => {
    const value = input.value || "";
    if (!value.trim()) {
      input.classList.remove("username-valid", "username-invalid");
      setSettingsUsernameStatus(
        "Use 3-20 letters, numbers, or underscores.",
        "muted"
      );
      return;
    }

    const validation = validateUsernameValue(value);
    if (validation.valid) {
      input.classList.add("username-valid");
      input.classList.remove("username-invalid");
      setSettingsUsernameStatus(
        "Looks good. Availability is checked when you save.",
        "info"
      );
    } else {
      input.classList.remove("username-valid");
      input.classList.add("username-invalid");
      setSettingsUsernameStatus(validation.message, "error");
    }
  });

  saveBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await handleUsernameUpdate();
  });

  usernameFormInitialized = true;
}

async function writeInBatches(docSnaps, updater) {
  if (!Array.isArray(docSnaps) || docSnaps.length === 0) return;

  let batch = writeBatch(db);
  const commits = [];
  let opCount = 0;

  for (const snap of docSnaps) {
    updater(batch, snap);
    opCount += 1;
    if (opCount >= 450) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);
}

async function updateUserBuildUsernames(userId, newUsername) {
  const buildsRef = collection(db, `users/${userId}/builds`);
  const snap = await getDocs(buildsRef);
  if (snap.empty) return;

  await writeInBatches(snap.docs, (batch, docSnap) => {
    batch.set(
      docSnap.ref,
      { publisher: newUsername, username: newUsername },
      { merge: true }
    );
  });
}

async function updatePublishedBuildUsernames(userId, newUsername) {
  const publishedRef = collection(db, "publishedBuilds");
  const publishedSnap = await getDocs(
    query(publishedRef, where("publisherId", "==", userId))
  );
  if (publishedSnap.empty) return;

  await writeInBatches(publishedSnap.docs, (batch, docSnap) => {
    batch.set(
      docSnap.ref,
      { username: newUsername, publisher: newUsername },
      { merge: true }
    );
  });
}

async function updateUserCommentsUsername(userId, newUsername) {
  const commentsSnap = await getDocs(
    query(collectionGroup(db, "comments"), where("userId", "==", userId))
  );
  if (commentsSnap.empty) return;

  await writeInBatches(commentsSnap.docs, (batch, docSnap) => {
    batch.update(docSnap.ref, { username: newUsername });
  });
}

async function propagateUsernameChange(userId, newUsername) {
  let hadError = false;
  const tasks = [
    updateUserBuildUsernames(userId, newUsername).catch((err) => {
      console.error(
        "? Failed to update personal builds with new username",
        err
      );
      hadError = true;
    }),
    updatePublishedBuildUsernames(userId, newUsername).catch((err) => {
      console.error(
        "? Failed to update published builds with new username",
        err
      );
      hadError = true;
    }),
    updateUserCommentsUsername(userId, newUsername).catch((err) => {
      console.error("? Failed to update comments with new username", err);
      hadError = true;
    }),
  ];

  await Promise.all(tasks);
  return !hadError;
}

function applyUsernameToDom(newUsername) {
  const displayName = newUsername || "Guest";

  const userName = document.getElementById("userName");
  if (userName) userName.innerText = displayName;
  const userNameMenu = document.getElementById("userNameMenu");
  if (userNameMenu) userNameMenu.innerText = displayName;

  const buildPublisher = document.getElementById("buildPublisher");
  if (buildPublisher) buildPublisher.innerText = displayName;
  const buildPublisherMobile = document.getElementById("buildPublisherMobile");
  if (buildPublisherMobile) buildPublisherMobile.innerText = displayName;

  const currentUserId = auth.currentUser?.uid;
  if (currentUserId) {
    document
      .querySelectorAll(
        `.comment-card[data-user-id="${currentUserId}"] .comment-identity`
      )
      .forEach((btn) => {
        btn.textContent = displayName;
      });
  }

  setSettingsUsernameValue(displayName);
  setSettingsUsernameDisabled(!auth.currentUser);
}

async function handleUsernameUpdate() {
  const input = document.getElementById("settingsUsernameInput");
  const saveBtn = document.getElementById("saveUsernameButton");
  if (!input || !saveBtn) return;

  const user = auth.currentUser;
  if (!user) {
    setSettingsUsernameStatus(
      "Please sign in to change your username.",
      "error"
    );
    showToast("? Please sign in to change your username.", "error");
    return;
  }

  const validation = validateUsernameValue(input.value || "");
  if (!validation.valid) {
    setSettingsUsernameStatus(validation.message, "error");
    showToast(validation.message, "error");
    return;
  }

  const desiredUsername = validation.cleaned;
  const currentUsername = getCurrentUsername();
  if (
    currentUsername &&
    currentUsername.toLowerCase() === desiredUsername.toLowerCase()
  ) {
    setSettingsUsernameStatus("You're already using that username.", "info");
    showToast("You're already using that username.", "info");
    return;
  }

  setSettingsUsernameDisabled(true);
  setSettingsUsernameStatus("Checking availability...", "info");

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await transaction.get(userRef);
      const existingUsername = userSnap.exists()
        ? userSnap.data().username || null
        : null;

      if (
        existingUsername &&
        existingUsername.toLowerCase() === desiredUsername.toLowerCase()
      ) {
        throw new Error("username_same");
      }

      const usernameRef = doc(db, "usernames", desiredUsername);
      const usernameSnap = await transaction.get(usernameRef);
      const usernameData = usernameSnap.exists() ? usernameSnap.data() : null;

      if (usernameData && usernameData.userId !== user.uid) {
        throw new Error("username_taken");
      }

      transaction.set(
        userRef,
        { username: desiredUsername, userId: user.uid },
        { merge: true }
      );
      transaction.set(usernameRef, { userId: user.uid });

      if (existingUsername && existingUsername !== desiredUsername) {
        transaction.delete(doc(db, "usernames", existingUsername));
      }
    });

    const propagated = await propagateUsernameChange(user.uid, desiredUsername);
    setCurrentUsername(desiredUsername);
    applyUsernameToDom(desiredUsername);

    setSettingsUsernameStatus(
      propagated
        ? `Username updated to ${desiredUsername}.`
        : "Username updated. Some content may take a moment to refresh.",
      propagated ? "success" : "info"
    );
    showToast(
      propagated
        ? `? Username updated to ${desiredUsername}`
        : "Username updated. Some content may take a moment to refresh.",
      propagated ? "success" : "info"
    );
  } catch (error) {
    let message = "? Failed to update username. Please try again.";
    if (error.message === "username_taken") {
      message = "? That username is already taken.";
    } else if (error.message === "username_same") {
      message = "You're already using that username.";
    }
    console.error("Username update failed:", error);
    setSettingsUsernameStatus(message.replace("?", "").trim(), "error");
    showToast(message, "error");
  } finally {
    setSettingsUsernameDisabled(false);
  }
}

async function checkAndSetUsername(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists() || !userSnapshot.data().username) {
    const usernameModal = document.getElementById("usernameModal");
    const usernameInput = document.getElementById("usernameInput");

    usernameModal.style.display = "block";

    usernameInput.addEventListener("input", async () => {
      const validation = validateUsernameValue(usernameInput.value || "");
      const hasValue = (usernameInput.value || "").trim().length > 0;

      if (!hasValue) {
        usernameInput.classList.remove("username-valid", "username-invalid");
        return;
      }

      if (!validation.valid) {
        usernameInput.classList.remove("username-valid");
        usernameInput.classList.add("username-invalid");
        return;
      }

      const usernameDoc = doc(db, "usernames", validation.cleaned);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        usernameInput.classList.remove("username-valid");
        usernameInput.classList.add("username-invalid");
      } else {
        usernameInput.classList.remove("username-invalid");
        usernameInput.classList.add("username-valid");
      }
    });

    document.getElementById("confirmUsernameButton").onclick = async () => {
      const validation = validateUsernameValue(usernameInput.value || "");
      if (!validation.valid) {
        showToast(validation.message, "error");
        return;
      }

      const username = validation.cleaned;
      const usernameDoc = doc(db, "usernames", username);
      const usernameSnap = await getDoc(usernameDoc);

      if (usernameSnap.exists()) {
        showToast("? That username is already taken.", "error");
      } else {
        await setDoc(userRef, { username, userId: user.uid }, { merge: true });
        await setDoc(usernameDoc, { userId: user.uid });

        showToast("? Username set as: " + username, "success");

        document.getElementById("userName").innerText = username;
        document.getElementById("userNameMenu").innerText = username;
        document.getElementById("userNameMenu").style.display = "inline-block";
        document.getElementById("userName").style.display = "inline-block";
        document.getElementById("userPhoto").style.display = "inline-block";
        usernameModal.style.display = "none";
      }
    };
  }
}

export {
  checkAndSetUsername,
  setSettingsUsernameDisabled,
  setSettingsUsernameStatus,
  setSettingsUsernameValue,
  setupUsernameSettingsSection,
};
