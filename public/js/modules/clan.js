/* js/modules/clan.js */
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { bannedWords } from "../data/bannedWords.js";
import { showToast } from "./uiHandlers.js";

export const db = getFirestore();
export const auth = getAuth();

const storage = getStorage(undefined, "gs://z-build-order.firebasestorage.app");

export async function convertImageToWebP(file, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const targetSize = 120;
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");

      const scale = Math.max(targetSize / img.width, targetSize / img.height);

      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const x = (targetSize - drawWidth) / 2;
      const y = (targetSize - drawHeight) / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        x,
        y,
        drawWidth,
        drawHeight
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("WebP conversion failed."));
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => reject(new Error("Image load failed."));
    const url = URL.createObjectURL(file);
    img.src = url;

    // Optional cleanup
    img.onloadend = () => URL.revokeObjectURL(url);
  });
}

/*** Upload logo (optional) – returns downloadURL ***/
export async function uploadClanLogo(file, clanId) {
  if (!file) return "";

  // Step 1: convert original to resized WebP
  const webpBlob = await convertImageToWebP(file, 0.8);

  // ✅ Step 2: enforce size limit after compression
  if (webpBlob.size > 250 * 1024) {
    throw new Error("Compressed logo is too large. Try a simpler image.");
  }

  // Step 3: upload to Firebase
  const filePath = `clanLogos/${clanId}/logo.webp`;
  const fileRef = ref(storage, filePath);

  await uploadBytes(fileRef, webpBlob, { contentType: "image/webp" });
  const downloadURL = await getDownloadURL(fileRef);
  return downloadURL;
}

/*** CREATE ***/
export async function createClan({ name, logoFile }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const sanitizedName = DOMPurify.sanitize(name);
  if (!sanitizedName) throw new Error("Clan name required");

  const clansCol = collection(db, "clans");
  const clanDoc = doc(clansCol);

  let logoUrl = "";
  if (logoFile) logoUrl = await uploadClanLogo(logoFile, clanDoc.id);

  const payload = {
    name: sanitizedName,
    logoUrl,
    adminUid: user.uid,
    members: [user.uid],
    joinRequests: [],
    created: Date.now(),
  };
  await setDoc(clanDoc, payload);
  return clanDoc.id;
}

/*** READ ***/
export async function listPublicClans() {
  const snap = await getDocs(collection(db, "clans"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/*** JOIN ***/
export async function requestToJoin(clanId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const ref = doc(db, "clans", clanId);
  await updateDoc(ref, { joinRequests: arrayUnion(user.uid) });
}

/*** ACCEPT REQUEST ***/
export async function acceptRequest(clanId, requestUid) {
  const user = auth.currentUser;
  const ref = doc(db, "clans", clanId);
  const snap = await getDoc(ref);
  const clan = snap.data();
  if (clan.adminUid !== user.uid) throw new Error("Not your clan");

  await updateDoc(ref, {
    members: arrayUnion(requestUid),
    joinRequests: arrayRemove(requestUid),
  });
}

/*** UI RENDERING FUNCTIONS ***/
export async function renderCreateClanUI(container) {
  container.replaceChildren();
  const frag = document.createDocumentFragment();

  const modalTitle = document.querySelector("#clanModal .template-header h3");
  if (modalTitle) modalTitle.textContent = "Clan – Create Clan";

  const nameInput = document.createElement("input");
  nameInput.id = "clanNameInput";
  nameInput.placeholder = "Clan name";
  nameInput.maxLength = 30;

  const fileInput = document.createElement("input");
  fileInput.id = "clanLogoInput";
  fileInput.type = "file";
  fileInput.accept = "image/*"; // keep this

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (file) {
      const validTypes = ["image/png", "image/jpeg", "image/webp"];
      const maxSize = 5 * 1024 * 1024; // 5 MB

      if (!validTypes.includes(file.type)) {
        showToast("Only PNG, JPG, or WEBP images are allowed.", "error");
        fileInput.value = ""; // reset input
        return;
      }

      if (file.size > maxSize) {
        showToast("Logo must be under 5 MB.", "error");
        fileInput.value = "";
        return;
      }

      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "block";
    } else {
      previewImg.style.display = "none";
      previewImg.src = "";
    }
  });

  const previewImg = document.createElement("img");
  previewImg.id = "clanLogoPreview";
  previewImg.style.width = "100px";
  previewImg.style.height = "100px";
  previewImg.style.objectFit = "cover";
  previewImg.style.border = "1px solid #444";
  previewImg.style.marginTop = "10px";
  previewImg.style.display = "none";

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "block";
    } else {
      previewImg.style.display = "none";
      previewImg.src = "";
    }
  });

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.disabled = true;

  nameInput.addEventListener("input", () => {
    saveBtn.disabled = nameInput.value.trim() === "";
  });

  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const validNameRegex = /^[a-zA-Z0-9\- ]+$/;

    if (!name) {
      showToast("Clan name cannot be empty.", "error");
      return;
    }

    if (!validNameRegex.test(name)) {
      showToast(
        "Clan name can only use letters, numbers, spaces, and dashes.",
        "error"
      );
      return;
    }

    const lowerName = name.toLowerCase();
    const containsBanned = bannedWords.some((word) => lowerName.includes(word));
    if (containsBanned) {
      showToast("Clan name contains inappropriate words.", "error");
      return;
    }

    const existing = await listPublicClans();
    const duplicate = existing.find((c) => c.name.toLowerCase() === lowerName);
    if (duplicate) {
      showToast("A clan with that name already exists.", "error");
      return;
    }

    try {
      const file = fileInput.files?.[0] || null; // ✅ DECLARED HERE SAFELY
      await createClan({ name, logoFile: file });
      showToast("Clan created!", "success");
      renderFindClanUI(container);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  const formWrapper = document.createElement("div");
  formWrapper.style.display = "flex";
  formWrapper.style.flexDirection = "column";
  formWrapper.style.gap = "12px";
  formWrapper.style.padding = "10px";
  formWrapper.style.maxWidth = "400px";

  const label = document.createElement("label");
  label.htmlFor = "clanNameInput";
  label.textContent = "Clan Name";
  label.style.fontWeight = "bold";
  label.style.color = "#ccc";

  const nameGroup = document.createElement("div");
  nameGroup.append(label, nameInput);

  const fileGroup = document.createElement("div");
  fileGroup.style.display = "flex";
  fileGroup.style.alignItems = "center";
  fileGroup.style.gap = "12px";
  fileGroup.append(fileInput, previewImg);

  formWrapper.append(nameGroup, fileGroup, saveBtn);
  frag.appendChild(formWrapper);
  container.appendChild(frag);
}

export async function renderManageClanUI(container) {
  container.replaceChildren();

  const clans = await listPublicClans();
  const mine = clans.find((c) => c.adminUid === auth.currentUser?.uid);

  if (!mine) {
    container.textContent = "You don't own a clan.";
    return;
  }

  const modalTitle = document.querySelector("#clanModal .template-header h3");
  if (modalTitle) modalTitle.textContent = "Clan – Manage Clan";

  const list = document.createElement("ul");

  if (!mine.joinRequests.length) {
    const li = document.createElement("li");
    li.textContent = "No pending requests";
    list.appendChild(li);
  } else {
    for (const uid of mine.joinRequests) {
      const li = document.createElement("li");
      let username = "Unknown User";

      try {
        const found = await getUsernameFromUid(uid);
        if (found) {
          username = found;
        }
      } catch {
        // still fallback to "Unknown User"
      }

      li.innerHTML = `
          Username: ${DOMPurify.sanitize(username)}
          <button class="acceptBtn">Accept</button>
          <button class="denyBtn">Deny</button>
        `;

      // Accept handler
      li.querySelector(".acceptBtn").addEventListener("click", async () => {
        await acceptRequest(mine.id, uid);
        showToast("Member added", "success");
        renderManageClanUI(container);
      });

      // Deny handler
      li.querySelector(".denyBtn").addEventListener("click", async () => {
        const ref = doc(db, "clans", mine.id);
        await updateDoc(ref, {
          joinRequests: arrayRemove(uid),
        });
        showToast("Request denied", "info");
        renderManageClanUI(container);
      });

      list.appendChild(li);
    }
  }

  container.appendChild(list);
}

export async function renderFindClanUI(container) {
  const clans = await listPublicClans();
  container.replaceChildren();

  const modalTitle = document.querySelector("#clanModal .template-header h3");
  if (modalTitle) modalTitle.textContent = "Clan – Find a Clan";

  const listDiv = document.createElement("div");
  listDiv.className = "template-list";

  clans.forEach((clan) => {
    const card = document.createElement("div");
    card.className = "template-card";
    card.style.border = "1px solid #444";
    card.style.borderRadius = "8px";
    card.style.overflow = "hidden";
    card.style.backgroundColor = "#1a1a1a";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.justifyContent = "flex-start";
    card.style.alignItems = "stretch";

    // Banner with logo background
    const banner = document.createElement("div");
    banner.style.height = "120px";
    banner.style.backgroundImage = `url('${DOMPurify.sanitize(
      clan.logoUrl || "img/default-clan.webp"
    )}')`;
    banner.style.backgroundSize = "contain";
    banner.style.backgroundRepeat = "no-repeat";
    banner.style.backgroundPosition = "center";
    banner.style.backgroundColor = "#111";
    banner.style.borderBottom = "1px solid #333";
    banner.style.borderRadius = "8px 8px 0 0";

    // Content wrapper below banner
    const contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "column";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.gap = "8px";
    contentWrapper.style.padding = "12px";

    const title = document.createElement("div");
    title.className = "template-card-title";
    title.textContent = clan.name;
    title.style.fontWeight = "bold";
    title.style.textAlign = "center";

    const btn = document.createElement("button");
    btn.textContent = "Join";
    btn.className = "btn";
    btn.style.marginTop = "4px";
    btn.addEventListener("click", async () => {
      await requestToJoin(clan.id);
      showToast("Join request sent!", "success");
    });

    contentWrapper.append(title, btn);
    card.append(banner, contentWrapper);
    listDiv.appendChild(card);
  });

  container.appendChild(listDiv);
}

export async function getUsernameFromUid(uid) {
  const usernamesCol = collection(db, "usernames");
  const snap = await getDocs(usernamesCol);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.userId === uid) {
      return docSnap.id; // the username is the doc ID
    }
  }

  return null;
}
