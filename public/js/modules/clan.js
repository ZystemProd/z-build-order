// clan.js
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  ref as storageRef,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
import { showToast } from "./uiHandlers.js";

let currentClanView = null;

export const db = getFirestore();
export const auth = getAuth();
const storage = getStorage();

export async function listPublicClans() {
  const snap = await getDocs(collection(db, "clans"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUsernameFromUid(uid) {
  const usernamesCol = collection(db, "usernames");
  const snap = await getDocs(usernamesCol);
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.userId === uid) return docSnap.id;
  }
  return null;
}

export async function uploadClanLogo(file, clanId) {
  if (!file) return "";
  const filePath = `clanLogos/${clanId}/logo.webp`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, file, { contentType: "image/webp" });
  return await getDownloadURL(fileRef);
}

export async function createClan({ name, logoFile }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const clansCol = collection(db, "clans");
  const clanDoc = doc(clansCol);

  let logoUrl = "";
  if (logoFile) logoUrl = await uploadClanLogo(logoFile, clanDoc.id);

  const payload = {
    name,
    logoUrl,
    adminUid: user.uid,
    members: [user.uid],
    joinRequests: [],
    created: Date.now(),
  };
  await setDoc(clanDoc, payload);
  return clanDoc.id;
}

export async function requestToJoin(clanId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const ref = doc(db, "clans", clanId);

  await updateDoc(ref, {
    joinRequests: arrayUnion(user.uid),
    [`memberInfo.${user.uid}.requestedAt`]: Date.now(), // 🆕 Track when user requested to join
  });
}

export async function acceptRequest(clanId, requestUid) {
  const ref = doc(db, "clans", clanId);
  const clanSnap = await getDoc(ref);
  const clan = clanSnap.data();

  if (auth.currentUser?.uid !== clan.adminUid) {
    throw new Error("Only admins can accept requests");
  }

  await updateDoc(ref, {
    members: arrayUnion(requestUid),
    joinRequests: arrayRemove(requestUid),
    [`memberInfo.${requestUid}`]: {
      joined: Date.now(),
      role: "Player",
    },
  });
}

export function setupClanViewSwitching() {
  const views = {
    create: document.getElementById("createClanView"),
    manage: document.getElementById("manageClanView"),
    find: document.getElementById("findClanView"),
  };

  document.querySelectorAll(".clan-main-tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (currentClanView === view) return; // 👈 already active? do nothing

      currentClanView = view;

      // hide all subviews
      document.querySelectorAll(".clan-subview").forEach((v) => {
        v.style.display = "none";
      });

      const activeView = document.getElementById(`${view}ClanView`);
      if (activeView) activeView.style.display = "block";

      if (view === "create") renderCreateClanUI();
      if (view === "manage") renderManageClanUI();
      if (view === "find") renderFindClanUI();
    });
  });
}

export async function renderCreateClanUI() {
  const container = document.getElementById("createClanView");
  container.replaceChildren();
  const input = document.createElement("input");
  input.placeholder = "Clan Name";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Create Clan";
  saveBtn.onclick = async () => {
    try {
      const name = input.value.trim();
      const file = fileInput.files[0];
      await createClan({ name, logoFile: file });
      showToast("Clan created!", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  container.append(input, fileInput, saveBtn);
}

export async function renderFindClanUI() {
  const container = document.getElementById("findClanView");
  container.replaceChildren();
  const clans = await listPublicClans();
  const list = document.createElement("div");
  list.className = "template-list";

  clans.forEach((clan) => {
    const card = document.createElement("div");
    card.className = "template-card";
    const banner = document.createElement("div");
    banner.className = "clan-card-banner";
    banner.style.backgroundImage = `url('${DOMPurify.sanitize(
      clan.logoUrl || "img/default-clan.webp"
    )}')`;

    const content = document.createElement("div");
    content.className = "clan-card-content";
    const name = document.createElement("div");
    name.textContent = clan.name;
    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join";
    joinBtn.onclick = async () => {
      await requestToJoin(clan.id);
      showToast("Join request sent!", "success");
    };

    content.append(name, joinBtn);
    card.append(banner, content);
    list.appendChild(card);
  });

  container.appendChild(list);
}

export async function renderManageClanUI() {
  const container = document.getElementById("manageClanView");

  // Get current user's clan to determine their role
  const clans = await listPublicClans();
  const clan = clans.find(
    (c) =>
      c.adminUid === auth.currentUser?.uid ||
      c.members.includes(auth.currentUser?.uid)
  );

  if (!clan) {
    container.innerHTML = "<p>You don't have a clan.</p>";
    return;
  }

  const userId = auth.currentUser?.uid;
  const myRole =
    clan.memberInfo?.[userId]?.role ||
    (userId === clan.adminUid ? "Captain" : "Player");

  // Hide Settings tab if user is not the Captain
  const settingsBtn = container.querySelector(
    '.clan-tab-button[data-tab="settings"]'
  );
  if (myRole !== "Captain" && settingsBtn) {
    settingsBtn.style.display = "none";
  }

  // Only bind once
  if (!container.dataset.initialized) {
    container.querySelectorAll(".clan-tab-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;

        if (btn.classList.contains("active")) return;

        container
          .querySelectorAll(".clan-tab-button")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        container
          .querySelectorAll(".clan-tab-content")
          .forEach((c) => (c.style.display = "none"));
        const activeTab = container.querySelector(`#clan-${target}-tab`);
        if (activeTab) {
          activeTab.style.display = "block";
          activeTab.replaceChildren(); // 🧹 clear content immediately
        }

        renderManageTab(target);
      });
    });

    container.dataset.initialized = "true";
  }

  // Show default tab (members)
  const defaultBtn = container.querySelector(
    '.clan-tab-button[data-tab="members"]'
  );
  if (defaultBtn) defaultBtn.click();
}

async function renderManageTab(tab) {
  const membersTab = document.getElementById("clan-members-tab");
  const requestsTab = document.getElementById("clan-requests-tab");
  const settingsTab = document.getElementById("clan-settings-tab");

  // Show "Loading..." immediately for selected tab
  if (tab === "members" && membersTab) membersTab.textContent = "Loading...";
  if (tab === "requests" && requestsTab) requestsTab.textContent = "Loading...";
  if (tab === "settings" && settingsTab) settingsTab.textContent = "Loading...";

  const clans = await listPublicClans();
  const clan = clans.find((c) => c.members.includes(auth.currentUser?.uid));
  if (!clan) return;

  const myUid = auth.currentUser?.uid;
  const myRole =
    clan.memberInfo?.[myUid]?.role ||
    (myUid === clan.adminUid ? "Captain" : "Player");

  if (tab === "members") {
    membersTab.replaceChildren();

    const card = document.createElement("div");
    card.className = "clan-info-card"; // new wrapper div

    card.appendChild(createClanBanner(clan)); // logo + name

    const table = document.createElement("table");
    table.className = "clan-member-table";
    table.innerHTML = "<tr><th>Name</th><th>Role</th><th>Added</th></tr>";

    for (const uid of clan.members) {
      const name = await getUsernameFromUid(uid);
      const info = clan.memberInfo?.[uid] || {};
      const role = info.role || (uid === clan.adminUid ? "Captain" : "Player");
      const joined = info.joined
        ? new Date(info.joined).toLocaleDateString()
        : "N/A";

      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = name;

      const roleCell = document.createElement("td");
      const roleSelect = document.createElement("select");

      // Allowed roles
      ["Player", "Co-Captain", "Captain"].forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (opt === role) option.selected = true;
        roleSelect.appendChild(option);
      });

      const isSelf = uid === auth.currentUser?.uid;
      const targetIsCaptain = info.role === "Captain" || uid === clan.adminUid;

      if (
        myRole !== "Captain" ||
        isSelf ||
        (myRole === "Co-Captain" && targetIsCaptain)
      ) {
        roleSelect.disabled = true;
        roleSelect.title = "You cannot change this user's role.";
      }

      roleSelect.onchange = async () => {
        const newRole = roleSelect.value;

        // Prevent non-admins from assigning Captain role
        if (newRole === "Captain" && auth.currentUser?.uid !== clan.adminUid) {
          showToast("Only the admin can assign Captain role.", "error");
          roleSelect.value = role; // revert
          return;
        }

        await updateDoc(doc(db, "clans", clan.id), {
          [`memberInfo.${uid}.role`]: newRole,
        });
        showToast("Role updated", "success");
      };
      roleCell.appendChild(roleSelect);

      const joinedCell = document.createElement("td");
      joinedCell.textContent = joined;

      row.append(nameCell, roleCell, joinedCell);
      table.appendChild(row);
    }

    card.appendChild(table);
    membersTab.appendChild(card);
  } else if (tab === "requests") {
    requestsTab.replaceChildren();
    requestsTab.appendChild(createClanBanner(clan));

    if (!clan.joinRequests.length) {
      requestsTab.textContent = "No pending requests";
      return;
    }

    const table = document.createElement("table");
    table.className = "clan-member-table";
    table.innerHTML = "<tr><th>Name</th><th>Date</th><th>Actions</th></tr>";

    for (const uid of clan.joinRequests) {
      const username = (await getUsernameFromUid(uid)) || "Unknown";
      const joined = clan.memberInfo?.[uid]?.requestedAt
        ? new Date(clan.memberInfo[uid].requestedAt).toLocaleDateString()
        : "Unknown";

      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = username;

      const dateCell = document.createElement("td");
      dateCell.textContent = joined;

      const actionCell = document.createElement("td");

      const acceptBtn = document.createElement("button");
      acceptBtn.textContent = "Accept";
      acceptBtn.className = "btn-accept";

      const denyBtn = document.createElement("button");
      denyBtn.textContent = "Deny";
      denyBtn.className = "btn-deny";

      acceptBtn.onclick = async () => {
        await acceptRequest(clan.id, uid);
        showToast("Accepted", "success");
        renderManageTab("requests");
      };

      denyBtn.onclick = async () => {
        await updateDoc(doc(db, "clans", clan.id), {
          joinRequests: arrayRemove(uid),
        });
        showToast("Denied", "info");
        renderManageTab("requests");
      };

      actionCell.append(acceptBtn, denyBtn);
      row.append(nameCell, dateCell, actionCell);
      table.appendChild(row);
    }

    requestsTab.appendChild(table);
  } else if (tab === "settings") {
    settingsTab.replaceChildren();

    // --- Banner section with logo and name ---
    const banner = document.createElement("div");
    banner.className = "clan-banner-wrapper";

    const logo = document.createElement("img");
    logo.src = clan.logoUrl || "img/default-clan.webp";
    logo.alt = `${clan.name} logo`;
    logo.className = "clan-banner-logo";

    const name = document.createElement("h3");
    name.textContent = clan.name;

    banner.append(logo, name);
    settingsTab.appendChild(banner);

    // --- Settings form ---
    const form = document.createElement("div");
    form.className = "clan-settings-form";

    const createField = (labelText, inputElement) => {
      const group = document.createElement("div");
      group.className = "clan-settings-field";

      const label = document.createElement("label");
      label.textContent = labelText;

      group.appendChild(label);
      group.appendChild(inputElement);
      return group;
    };

    const nameInput = document.createElement("input");
    nameInput.value = clan.name;

    const abbrInput = document.createElement("input");
    abbrInput.placeholder = "Abbreviation";
    abbrInput.value = clan.abbreviation || "";

    const descInput = document.createElement("textarea");
    descInput.placeholder = "Description";
    descInput.value = clan.description || "";

    // --- Logo upload + preview ---
    const logoInput = document.createElement("input");
    logoInput.type = "file";
    logoInput.accept = "image/*";

    const previewWrapper = document.createElement("div");
    previewWrapper.style.display = "flex";
    previewWrapper.style.alignItems = "center";
    previewWrapper.style.gap = "12px";
    previewWrapper.style.marginTop = "6px";

    const currentLogoLabel = document.createElement("span");
    currentLogoLabel.textContent = "Preview:";

    const logoPreview = document.createElement("img");
    logoPreview.src = clan.logoUrl || "img/default-clan.webp";
    logoPreview.alt = "Logo preview";
    logoPreview.style.width = "120px";
    logoPreview.style.height = "120px";
    logoPreview.style.objectFit = "cover";
    logoPreview.style.border = "1px solid #333";
    logoPreview.style.borderRadius = "8px";

    previewWrapper.append(currentLogoLabel, logoPreview);

    logoInput.addEventListener("change", () => {
      const file = logoInput.files[0];
      if (file) {
        logoPreview.src = URL.createObjectURL(file);
      } else {
        logoPreview.src = clan.logoUrl || "img/default-clan.webp";
      }
    });

    const save = document.createElement("button");
    save.textContent = "Save";
    save.onclick = async () => {
      try {
        save.disabled = true;
        save.textContent = "Saving...";

        const updates = {
          name: DOMPurify.sanitize(nameInput.value.trim()),
          abbreviation: DOMPurify.sanitize(abbrInput.value.trim()),
          description: DOMPurify.sanitize(descInput.value.trim()),
        };

        const file = logoInput.files[0];

        if (file) {
          const validTypes = ["image/png", "image/jpeg", "image/webp"];
          const maxSize = 2 * 1024 * 1024; // 2MB

          if (!validTypes.includes(file.type)) {
            throw new Error("Only PNG, JPG, or WEBP files are allowed.");
          }

          if (file.size > maxSize) {
            throw new Error("Image is too large. Max 2MB.");
          }

          const logoUrl = await uploadClanLogo(file, clan.id); // Uses your existing function
          updates.logoUrl = logoUrl;
        }

        await updateDoc(doc(db, "clans", clan.id), updates);
        showToast("Updated", "success");
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        save.disabled = false;
        save.textContent = "Save";
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete Clan";
    deleteBtn.style.backgroundColor = "#a00";
    deleteBtn.style.marginTop = "16px";
    deleteBtn.style.alignSelf = "flex-start";

    deleteBtn.onclick = async () => {
      const myRole = clan.memberInfo?.[auth.currentUser?.uid]?.role || "Player";
      if (myRole !== "Captain") {
        showToast("Only Captains can delete the clan.", "error");
        return;
      }

      const confirmed = confirm(
        "Are you sure you want to delete this clan? This cannot be undone."
      );
      if (!confirmed) return;

      try {
        // Delete Firestore document
        await deleteDoc(doc(db, "clans", clan.id));

        // Clean up storage if a logo was uploaded
        if (clan.logoUrl && clan.logoUrl.includes("clanLogos")) {
          const logoPath = `clanLogos/${clan.id}/logo.webp`;
          const logoRef = ref(storage, logoPath);
          await deleteObject(logoRef).catch(() => {
            // Ignore if file doesn't exist
          });
        }

        showToast("Clan deleted.", "success");
        renderFindClanUI(); // or close modal / redirect
      } catch (err) {
        showToast("Error deleting clan: " + err.message, "error");
        console.error(err);
      }
    };

    form.append(
      createField("Clan Name", nameInput),
      createField("Abbreviation", abbrInput),
      createField("Description", descInput),
      createField("Clan Logo", logoInput),
      save,
      deleteBtn // 👈 Add here
    );

    settingsTab.appendChild(form);
  }
}

function createClanBanner(clan) {
  const bannerWrapper = document.createElement("div");
  bannerWrapper.className = "clan-banner-wrapper";

  const logo = document.createElement("img");
  logo.src = clan.logoUrl || "img/default-clan.webp";
  logo.alt = `${clan.name} logo`;
  logo.className = "clan-banner-logo";

  const name = document.createElement("h3");
  name.textContent = clan.name;
  name.className = "clan-banner-title";

  bannerWrapper.append(logo, name);
  return bannerWrapper;
}
