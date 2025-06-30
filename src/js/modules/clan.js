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
  deleteDoc,
  deleteField,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
  ref as storageRef,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { createNotificationDot } from "./uiHandlers.js";
import { showToast } from "./toastHandler.js";
import { db } from "../../app.js";
import { checkForJoinRequestNotifications } from "./utils/notificationHelpers.js";
import DOMPurify from "dompurify";
import { logAnalyticsEvent } from "./analyticsHelper.js";

const storage = getStorage();

let currentClanView = null;

export const auth = getAuth();

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
  const storage = getStorage();
  const filePath = `clanLogos/${clanId}/logo.webp`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file, { contentType: "image/webp" });

  // ✅ Get real download URL
  const url = await getDownloadURL(storageRef);
  return url;
}

export async function createClan({
  name,
  logoFile,
  abbreviation,
  description,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const clansCol = collection(db, "clans");
  const clanDoc = doc(clansCol); // New doc ref

  // Step 1: Create initial doc without logo
  const payload = {
    name,
    abbreviation: abbreviation || "",
    description: description || "",
    logoUrl: "https://zbuildorder.com/img/clan/logo.webp",
    adminUid: user.uid,
    members: [user.uid],
    joinRequests: [],
    created: Date.now(),
  };

  await setDoc(clanDoc, payload); // ✅ First create the doc

  // Step 2: Optional logo upload with validation
  if (logoFile) {
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    const maxSize = 2 * 1024 * 1024;

    if (!validTypes.includes(logoFile.type)) {
      throw new Error("Only PNG, JPG, or WEBP files are allowed.");
    }
    if (logoFile.size > maxSize) {
      throw new Error("Image is too large. Max 2MB.");
    }

    // Upload and update the logoUrl
    const logoUrl = await uploadClanLogo(logoFile, clanDoc.id);
    await updateDoc(clanDoc, { logoUrl });
  }

  logAnalyticsEvent("clan_created", { name });

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

export async function getUserClans(uid) {
  const snap = await getDocs(collection(db, "clans"));
  const clans = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.members?.includes(uid)) {
      clans.push({ id: d.id, name: data.name, logoUrl: data.logoUrl });
    }
  });
  return clans;
}

export async function getClanInfo(clanId) {
  const snap = await getDoc(doc(db, "clans", clanId));
  return snap.exists() ? { id: clanId, ...snap.data() } : null;
}

export async function getUserMainClanInfo(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  const mainClanId = userSnap.exists()
    ? userSnap.data().settings?.mainClanId
    : null;
  if (mainClanId) {
    return await getClanInfo(mainClanId);
  }
  return null;
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
      if (view === "manage") renderChooseManageClanUI();
      if (view === "find") renderFindClanUI();
    });
  });
}

export async function renderClanPageView(clanId) {
  const container = document.getElementById("findClanView");
  container.replaceChildren();

  const docSnap = await getDoc(doc(db, "clans", clanId));
  const clan = docSnap.exists() ? docSnap.data() : null;
  if (!clan) {
    container.textContent = "Clan not found.";
    return;
  }

  // -- Breadcrumb Navigation --
  const breadcrumb = document.createElement("div");
  breadcrumb.className = "clan-breadcrumb";

  const findLink = document.createElement("span");
  findLink.textContent = "Find a Clan";
  findLink.className = "breadcrumb-link";
  findLink.onclick = () => renderFindClanUI();

  const divider = document.createElement("span");
  divider.className = "breadcrumb-divider";

  const current = document.createElement("span");
  current.textContent = clan.name;
  current.className = "breadcrumb-current";

  breadcrumb.append(findLink, divider, current);
  container.appendChild(breadcrumb);

  // -- Outer card --
  const wrapper = document.createElement("div");
  wrapper.className = "clan-info-card";

  // -- Banner with 3 columns: logo, text, info --
  const banner = document.createElement("div");
  banner.className = "clan-banner-wrapper";

  // Column 1: Logo
  const logo = document.createElement("img");
  logo.src = clan.logoUrl || "img/logo.webp";
  logo.alt = `${clan.name} logo`;
  logo.className = "clan-banner-logo";

  // Column 2: Title + Description
  const textWrap = document.createElement("div");
  textWrap.className = "clan-banner-text";

  const title = document.createElement("h3");
  title.textContent = clan.name;
  title.className = "clan-banner-title";

  const desc = document.createElement("p");
  desc.textContent = clan.description || "No description provided.";
  desc.className = "clan-banner-description";

  textWrap.append(title, desc);

  // Column 3: Info (Created + Members)
  const infoWrap = document.createElement("div");
  infoWrap.className = "clan-banner-info";

  const created = document.createElement("p");
  const dateStr = clan.created
    ? new Date(clan.created).toLocaleDateString()
    : "Unknown";
  created.innerHTML = `<strong>Clan Created:</strong> ${dateStr}`;

  const memberCount = document.createElement("p");
  memberCount.innerHTML = `<strong>Members:</strong> ${clan.members.length}`;

  infoWrap.append(created, memberCount);

  // Join button
  const joinBtn = document.createElement("button");
  joinBtn.className = "clan-join-button";
  joinBtn.style.position = "absolute";
  joinBtn.style.top = "12px";
  joinBtn.style.right = "12px";

  const user = auth.currentUser;
  const isMember = clan.members?.includes(user?.uid);
  const isRequested = clan.joinRequests?.includes(user?.uid);

  if (isMember) {
    joinBtn.textContent = "Joined";
    joinBtn.disabled = true;
    joinBtn.classList.add("btn-disabled");
  } else if (isRequested) {
    joinBtn.textContent = "Requested";
    joinBtn.disabled = true;
    joinBtn.classList.add("btn-disabled");
  } else {
    joinBtn.textContent = "Join";
    joinBtn.onclick = async () => {
      try {
        await requestToJoin(clanId);
        showToast("Join request sent!", "success");
        joinBtn.textContent = "Requested";
        joinBtn.disabled = true;
        joinBtn.classList.add("btn-disabled");
      } catch (err) {
        showToast(err.message, "error");
      }
    };
  }

  banner.append(logo, textWrap, infoWrap, joinBtn);
  wrapper.appendChild(banner);

  // -- Member table --
  const table = document.createElement("table");
  table.className = "clan-member-table";
  table.innerHTML = "<tr><th>Name</th><th>Role</th></tr>";

  for (const uid of clan.members) {
    const name = await getUsernameFromUid(uid);
    const info = clan.memberInfo?.[uid] || {};
    const role = info.role || (uid === clan.adminUid ? "Captain" : "Player");

    const row = document.createElement("tr");
    row.innerHTML = `<td>${DOMPurify.sanitize(name)}</td><td>${role}</td>`;
    table.appendChild(row);
  }

  wrapper.appendChild(table);
  container.appendChild(wrapper);
}

export async function renderCreateClanUI() {
  const container = document.getElementById("createClanView");
  container.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "clan-info-card";

  const title = document.createElement("h3");
  title.textContent = "Create a Clan";
  title.style.marginBottom = "16px";
  wrapper.appendChild(title);

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
  nameInput.placeholder = "Clan Name";

  const abbrInput = document.createElement("input");
  abbrInput.placeholder = "Abbreviation";

  const descInput = document.createElement("textarea");
  descInput.placeholder = "Description";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  const previewWrapper = document.createElement("div");
  previewWrapper.style.display = "flex";
  previewWrapper.style.alignItems = "center";
  previewWrapper.style.gap = "12px";
  previewWrapper.style.marginTop = "6px";

  const currentLogoLabel = document.createElement("span");
  currentLogoLabel.textContent = "Preview:";

  const logoPreview = document.createElement("img");
  logoPreview.src = "img/clan/logo.webp";
  logoPreview.alt = "Logo preview";
  logoPreview.style.width = "200px";
  logoPreview.style.height = "200px";
  logoPreview.style.objectFit = "cover";
  logoPreview.style.border = "1px solid #333";
  logoPreview.style.borderRadius = "8px";

  previewWrapper.append(currentLogoLabel, logoPreview);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      logoPreview.src = URL.createObjectURL(file);
    } else {
      logoPreview.src = "img/clan/logo.webp";
    }
  });

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Create Clan";

  saveBtn.onclick = async () => {
    try {
      saveBtn.disabled = true;
      const name = nameInput.value.trim();
      const abbr = abbrInput.value.trim();
      const desc = descInput.value.trim();
      const file = fileInput?.files?.[0]; // ✅ now called inside the click handler

      if (!name) {
        showToast("Clan name is required.", "error");
        saveBtn.disabled = false;
        return;
      }

      const clanId = await createClan({
        name,
        logoFile: file,
        abbreviation: abbr,
        description: desc,
      });

      showToast("Clan created!", "success");
      document.querySelector('[data-view="manage"]')?.click();
    } catch (e) {
      showToast(e.message, "error");
      saveBtn.disabled = false;
    }
  };

  form.append(
    createField("Clan Name", nameInput),
    createField("Abbreviation", abbrInput),
    createField("Description", descInput),
    createField("Clan Logo", fileInput),

    previewWrapper,
    saveBtn
  );

  wrapper.appendChild(form);
  container.appendChild(wrapper);
}

export async function renderFindClanUI() {
  const container = document.getElementById("findClanView");
  container.replaceChildren();

  // --- Header with search bar ---
  const header = document.createElement("div");
  header.className = "template-header";

  const title = document.createElement("h3");
  title.textContent = "Find a Clan";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search clans...";
  searchInput.className = "clan-search-input";

  header.append(title, searchInput);
  container.appendChild(header);

  // --- Grid container for clan cards ---
  const list = document.createElement("div");
  list.className = "clan-grid-manage";

  // --- No results message ---
  const noResults = document.createElement("p");
  noResults.textContent = "No clans found.";
  noResults.style.display = "none";
  noResults.style.color = "#aaa";
  noResults.style.textAlign = "center";
  noResults.style.marginTop = "20px";

  // --- Load all clans and set up batching ---
  const allClans = await listPublicClans();
  allClans.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));

  let currentIndex = 0;
  const batchSize = 20;
  let loading = false;

  function renderNextBatch() {
    if (loading) return;
    loading = true;

    const next = allClans.slice(currentIndex, currentIndex + batchSize);
    next.forEach((clan) => {
      const card = document.createElement("div");
      card.className = "clan-card-manage";
      card.dataset.name = clan.name.toLowerCase();
      card.dataset.abbr = (clan.abbreviation || "").toLowerCase();

      card.onclick = () => renderClanPageView(clan.id);

      const logo = document.createElement("img");
      logo.src = clan.logoUrl || "img/clan/logo.webp";
      logo.alt = `${clan.name} Logo`;
      logo.className = "clan-card-logo";

      const title = document.createElement("div");
      title.className = "clan-card-title";
      title.textContent = clan.name;

      card.append(logo, title);
      list.appendChild(card);
    });

    currentIndex += batchSize;
    loading = false;
  }

  // --- Scroll handler for infinite loading ---
  function handleScroll() {
    const bottomReached =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
    if (bottomReached && currentIndex < allClans.length) {
      renderNextBatch();
    }
  }

  window.addEventListener("scroll", handleScroll);

  // --- Initial render ---
  renderNextBatch();

  container.appendChild(list);
  container.appendChild(noResults);

  // --- Filter logic ---
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    let matchCount = 0;

    list.querySelectorAll(".clan-card-manage").forEach((card) => {
      const name = card.dataset.name || "";
      const abbr = card.dataset.abbr || "";
      const matches = name.includes(query) || abbr.includes(query);
      card.style.display = matches ? "block" : "none";
      if (matches) matchCount++;
    });

    noResults.style.display = matchCount === 0 ? "block" : "none";
  });
}

export async function renderManageClanUI(clanId) {
  const container = document.getElementById("manageClanView");
  container.replaceChildren();

  const docSnap = await getDoc(doc(db, "clans", clanId));
  const clan = docSnap.exists() ? docSnap.data() : null;
  if (!clan) {
    container.textContent = "Clan not found.";
    return;
  }
  clan.id = clanId; // manually attach the id

  const userId = auth.currentUser?.uid;
  const myRole =
    clan.memberInfo?.[userId]?.role ||
    (userId === clan.adminUid ? "Captain" : "Player");

  // --- Breadcrumb navigation ---
  const breadcrumb = document.createElement("div");
  breadcrumb.className = "clan-breadcrumb";

  const backLink = document.createElement("span");
  backLink.textContent = "Choose a Clan";
  backLink.className = "breadcrumb-link";
  backLink.onclick = () => renderChooseManageClanUI();

  const divider = document.createElement("span");
  divider.className = "breadcrumb-divider";
  divider.textContent = "";

  const current = document.createElement("span");
  current.textContent = "Manage";
  current.className = "breadcrumb-current";

  breadcrumb.append(backLink, divider, current);
  container.appendChild(breadcrumb);

  // --- Tabs ---
  const tabs = document.createElement("div");
  tabs.className = "clan-tabs";

  const membersBtn = document.createElement("button");
  membersBtn.className = "clan-tab-button";
  membersBtn.dataset.tab = "members";
  membersBtn.textContent = "Members";
  tabs.appendChild(membersBtn);

  if (myRole === "Captain" || myRole === "Co-Captain") {
    const requestsBtn = document.createElement("button");
    requestsBtn.className = "clan-tab-button";
    requestsBtn.dataset.tab = "requests";
    requestsBtn.textContent = "Requests";
    tabs.appendChild(requestsBtn);

    if (clan.joinRequests?.length > 0) {
      requestsBtn.style.position = "relative";
      requestsBtn.appendChild(createNotificationDot());
    }
  }

  const settingsBtn = document.createElement("button");
  settingsBtn.className = "clan-tab-button";
  settingsBtn.dataset.tab = "settings";
  settingsBtn.textContent = "Settings";
  tabs.appendChild(settingsBtn);

  container.appendChild(tabs);

  // --- Tab content holders ---
  const membersTab = document.createElement("div");
  membersTab.id = "clan-members-tab";
  membersTab.className = "clan-tab-content";
  container.appendChild(membersTab);

  const requestsTab = document.createElement("div");
  requestsTab.id = "clan-requests-tab";
  requestsTab.className = "clan-tab-content";
  requestsTab.style.display = "none";
  container.appendChild(requestsTab);

  const settingsTab = document.createElement("div");
  settingsTab.id = "clan-settings-tab";
  settingsTab.className = "clan-tab-content";
  settingsTab.style.display = "none";
  container.appendChild(settingsTab);

  container.querySelectorAll(".clan-tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

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
        activeTab.replaceChildren();
        renderManageTab(target, clan);
      }
    });
  });

  membersBtn.click();
}

export async function renderChooseManageClanUI() {
  const container = document.getElementById("manageClanView");
  container.replaceChildren();

  const clans = await listPublicClans();
  const myClans = clans
    .filter(
      (c) =>
        c.adminUid === auth.currentUser?.uid ||
        c.members.includes(auth.currentUser?.uid)
    )
    .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));

  const heading = document.createElement("h3");
  heading.textContent = "Select a Clan to Manage";
  heading.style.marginBottom = "16px";
  container.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "clan-grid-manage"; // new class for card layout

  myClans.forEach((clan) => {
    const card = document.createElement("div");
    card.className = "clan-card-manage";
    card.addEventListener("click", () => renderManageClanUI(clan.id));

    const logo = document.createElement("img");
    logo.src = clan.logoUrl || "img/logo.webp";
    logo.alt = `${clan.name} Logo`;
    logo.className = "clan-card-logo";

    const title = document.createElement("div");
    title.className = "clan-card-title";
    title.textContent = clan.name;

    const isCaptain =
      clan.adminUid === auth.currentUser?.uid ||
      clan.memberInfo?.[auth.currentUser?.uid]?.role === "Co-Captain";

    if (clan.joinRequests?.length > 0 && isCaptain) {
      const dot = createNotificationDot();
      dot.style.position = "absolute";
      dot.style.top = "6px";
      dot.style.right = "6px";
      card.appendChild(dot);
    }

    card.appendChild(logo);
    card.appendChild(title);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

async function renderManageTab(tab, clan) {
  const membersTab = document.getElementById("clan-members-tab");
  const requestsTab = document.getElementById("clan-requests-tab");
  const settingsTab = document.getElementById("clan-settings-tab");

  // Show "Loading..." immediately for selected tab
  if (tab === "members" && membersTab) membersTab.textContent = "Loading...";
  if (tab === "requests" && requestsTab) requestsTab.textContent = "Loading...";
  if (tab === "settings" && settingsTab) settingsTab.textContent = "Loading...";

  // ✅ Use passed-in clan directly, or fallback to global if needed
  if (!clan && window.currentManagedClanId) {
    const docRef = doc(db, "clans", window.currentManagedClanId);
    const docSnap = await getDoc(docRef);
    clan = docSnap.exists() ? docSnap.data() : null;
    if (!clan) return;
    clan.id = window.currentManagedClanId;
  } else if (!clan) {
    return;
  }

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

    const membersWithRoles = await Promise.all(
      clan.members.map(async (uid) => {
        const username = await getUsernameFromUid(uid);
        const info = clan.memberInfo?.[uid] || {};
        const role =
          info.role || (uid === clan.adminUid ? "Captain" : "Player");
        const joined = info.joined
          ? new Date(info.joined).toLocaleDateString()
          : "N/A";
        return { uid, username, role, joined };
      })
    );

    // Sort: Captain first, then Co-Captains, then Players
    const rolePriority = { Captain: 1, "Co-Captain": 2, Player: 3 };
    membersWithRoles.sort(
      (a, b) => rolePriority[a.role] - rolePriority[b.role]
    );

    for (const member of membersWithRoles) {
      const row = document.createElement("tr");
      if (member.role === "Captain") {
        row.classList.add("highlight-captain");
      } else if (member.role === "Co-Captain") {
        row.classList.add("highlight-co-captain");
      }

      const nameCell = document.createElement("td");
      nameCell.textContent = member.username;

      const roleCell = document.createElement("td");
      const roleWrapper = document.createElement("div");
      roleWrapper.className = "role-wrapper";

      const roleText = document.createElement("span");
      roleText.textContent = member.role;
      roleText.className = "role-text";

      const gearIcon = document.createElement("img");
      gearIcon.src = "img/SVG/settings.svg";
      gearIcon.alt = "Change Role";
      gearIcon.className = "role-gear-icon";

      const roleSelect = document.createElement("select");
      roleSelect.className = "role-select";
      roleSelect.style.display = "none";

      ["Player", "Co-Captain", "Captain"].forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (opt === member.role) option.selected = true;
        roleSelect.appendChild(option);
      });

      const isSelf = member.uid === auth.currentUser?.uid;
      const isTargetCaptain =
        member.role === "Captain" || member.uid === clan.adminUid;

      const canChangeRole =
        (myRole === "Captain" && !isSelf) ||
        (myRole === "Co-Captain" && !isSelf && !isTargetCaptain);

      if (!canChangeRole) {
        roleWrapper.appendChild(roleText);
      } else {
        roleWrapper.append(roleText, gearIcon, roleSelect);

        roleSelect.onchange = async () => {
          const newRole = roleSelect.value;

          if (newRole === "Captain" && auth.currentUser?.uid !== clan.adminUid) {
            showToast("Only the admin can assign Captain role.", "error");
            roleSelect.value = member.role;
            return;
          }

          if (newRole === "Captain") {
            const confirmChange = confirm(
              "Are you sure you want to assign a new Captain? The current Captain will become a Co-Captain."
            );
            if (!confirmChange) {
              roleSelect.value = member.role;
              return;
            }

            const updates = {
              [`memberInfo.${member.uid}.role`]: "Captain",
            };

            for (const other of membersWithRoles) {
              if (
                other.uid !== member.uid &&
                (other.role === "Captain" || other.uid === clan.adminUid)
              ) {
                updates[`memberInfo.${other.uid}.role`] = "Co-Captain";
              }
            }

            await updateDoc(doc(db, "clans", clan.id), updates);
            showToast("Captain reassigned", "success");
            await renderManageClanUI(clan.id);
            document
              .querySelector('.clan-tab-button[data-tab="members"]')
              ?.click();
            return;
          }

          await updateDoc(doc(db, "clans", clan.id), {
            [`memberInfo.${member.uid}.role`]: newRole,
          });
          showToast("Role updated", "success");
          await renderManageClanUI(clan.id);
          document
            .querySelector('.clan-tab-button[data-tab="members"]')
            ?.click();
        };

        roleSelect.addEventListener("blur", () => {
          setTimeout(() => {
            if (roleSelect.style.display !== "none") {
              roleSelect.style.display = "none";
              roleText.style.display = "";
              gearIcon.style.display = "";
            }
          }, 100);
        });

        gearIcon.addEventListener("click", () => {
          roleText.style.display = "none";
          gearIcon.style.display = "none";
          roleSelect.style.display = "inline-block";
          roleSelect.focus();
        });
      }

      roleCell.appendChild(roleWrapper);

      const joinedCell = document.createElement("td");
      joinedCell.textContent = member.joined;

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

        await renderManageClanUI(clan.id);

        // Stay on "requests" tab after re-render
        const requestsBtn = document.querySelector(
          '.clan-tab-button[data-tab="requests"]'
        );
        requestsBtn?.click();

        await checkForJoinRequestNotifications();
      };

      denyBtn.onclick = async () => {
        await updateDoc(doc(db, "clans", clan.id), {
          joinRequests: arrayRemove(uid),
        });
        showToast("Denied", "info");

        await renderManageClanUI(clan.id);
        document
          .querySelector('.clan-tab-button[data-tab="requests"]')
          ?.click();

        await checkForJoinRequestNotifications();
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
    logo.src = clan.logoUrl || "img/clan/logo.webp";
    logo.alt = `${clan.name} logo`;
    logo.className = "clan-banner-logo";

    const name = document.createElement("h3");
    name.textContent = clan.name;

    banner.append(logo, name);
    settingsTab.appendChild(banner);

    if (myRole === "Player") {
      const leaveBtn = document.createElement("button");
      leaveBtn.textContent = "Leave Clan";
      leaveBtn.style.backgroundColor = "#444";
      leaveBtn.style.marginTop = "12px";
      leaveBtn.style.alignSelf = "flex-start";

      leaveBtn.onclick = async () => {
        const uid = auth.currentUser?.uid;
        const isCaptain = myRole === "Captain";
        const onlyMember = clan.members.length === 1;

        try {
          if (isCaptain && onlyMember) {
            const confirmed = confirm(
              "You are the last Captain and the only member. Leaving will delete the entire clan. Are you sure?"
            );
            if (!confirmed) return;

            await deleteDoc(doc(db, "clans", clan.id));

            if (clan.logoUrl?.includes("clanLogos")) {
              const logoPath = `clanLogos/${clan.id}/logo.webp`;
              const logoRef = ref(storage, logoPath);
              await deleteObject(logoRef).catch(() => {});
            }

            showToast("Clan disbanded.", "success");
            renderChooseManageClanUI();
            return;
          }

          if (isCaptain) {
            alert("⚠️ You must assign a new Captain before leaving.");
            return;
          }

          const confirmed = confirm("Are you sure you want to leave this clan?");
          if (!confirmed) return;

          await updateDoc(doc(db, "clans", clan.id), {
            members: arrayRemove(uid),
            [`memberInfo.${uid}`]: deleteField(),
          });

          showToast("You have left the clan.", "success");
          renderChooseManageClanUI();
        } catch (err) {
          showToast("Error leaving clan: " + err.message, "error");
        }
      };

      settingsTab.appendChild(leaveBtn);
      return;
    }

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
    logoPreview.src = clan.logoUrl || "img/clan/logo.webp";
    logoPreview.alt = "Logo preview";
    logoPreview.style.width = "200px";
    logoPreview.style.height = "200px";
    logoPreview.style.objectFit = "cover";
    logoPreview.style.border = "1px solid #333";
    logoPreview.style.borderRadius = "8px";

    previewWrapper.append(currentLogoLabel, logoPreview);

    logoInput.addEventListener("change", () => {
      const file = logoInput.files[0];
      if (file) {
        logoPreview.src = URL.createObjectURL(file);
      } else {
        logoPreview.src = clan.logoUrl || "img/clan/logo.webp";
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

        const file = logoInput.files[0]; // ✅ corrected here

        if (file) {
          const validTypes = ["image/png", "image/jpeg", "image/webp"];
          const maxSize = 2 * 1024 * 1024; // 2MB

          if (!validTypes.includes(file.type)) {
            throw new Error("Only PNG, JPG, or WEBP files are allowed.");
          }

          if (file.size > maxSize) {
            throw new Error("Image is too large. Max 2MB.");
          }

          const logoUrl = await uploadClanLogo(file, clan.id);
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
      const myRole =
        clan.memberInfo?.[auth.currentUser?.uid]?.role ||
        (auth.currentUser?.uid === clan.adminUid ? "Captain" : "Player");
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

        // Clean up any related notifications
        const notifQuery = query(
          collection(db, "notifications"),
          where("clanId", "==", clan.id)
        );
        try {
          const notifSnap = await getDocs(notifQuery);
          notifSnap.forEach(async (docSnap) => {
            await deleteDoc(docSnap.ref).catch(() => {});
          });
        } catch (err) {
          console.warn("Skipping notification cleanup:", err.message);
        }

        // Clean up storage if a logo was uploaded
        if (clan.logoUrl && clan.logoUrl.includes("clanLogos")) {
          const logoPath = `clanLogos/${clan.id}/logo.webp`;
          const logoRef = ref(storage, logoPath);
          await deleteObject(logoRef).catch(() => {
            // Ignore if file doesn't exist
          });
        }

        showToast("Clan deleted.", "success");
        renderChooseManageClanUI(); // or close modal / redirect
      } catch (err) {
        showToast("Error deleting clan: " + err.message, "error");
        console.error(err);
      }
    };

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave Clan";
    leaveBtn.style.backgroundColor = "#444";
    leaveBtn.style.marginTop = "12px";
    leaveBtn.style.alignSelf = "flex-start";

    leaveBtn.onclick = async () => {
      const uid = auth.currentUser?.uid;
      const myRole =
        clan.memberInfo?.[uid]?.role ||
        (uid === clan.adminUid ? "Captain" : "Player");

      const isCaptain = myRole === "Captain";
      const onlyMember = clan.members.length === 1;

      try {
        // ✅ If user is Captain AND the only member — delete the clan entirely
        if (isCaptain && onlyMember) {
          const confirmed = confirm(
            "You are the last Captain and the only member. Leaving will delete the entire clan. Are you sure?"
          );
          if (!confirmed) return;

          await deleteDoc(doc(db, "clans", clan.id));

          // Optional: delete logo from storage
          if (clan.logoUrl?.includes("clanLogos")) {
            const logoPath = `clanLogos/${clan.id}/logo.webp`;
            const logoRef = ref(storage, logoPath);
            await deleteObject(logoRef).catch(() => {}); // ignore if not found
          }

          showToast("Clan disbanded.", "success");
          renderChooseManageClanUI();
          return;
        }

        // ❌ Captains with other members must reassign first
        if (isCaptain) {
          alert("⚠️ You must assign a new Captain before leaving.");
          return;
        }

        // ✅ Normal member or co-captain can leave
        const confirmed = confirm("Are you sure you want to leave this clan?");
        if (!confirmed) return;

        await updateDoc(doc(db, "clans", clan.id), {
          members: arrayRemove(uid),
          [`memberInfo.${uid}`]: deleteField(),
        });

        showToast("You have left the clan.", "success");
        renderChooseManageClanUI();
      } catch (err) {
        showToast("Error leaving clan: " + err.message, "error");
      }
    };

    form.append(
      createField("Clan Name", nameInput),
      createField("Abbreviation", abbrInput),
      createField("Description", descInput),
      createField("Clan Logo", logoInput),
      previewWrapper,
      save,
      deleteBtn,
      leaveBtn
    );

    const scrollWrapper = document.createElement("div");
    scrollWrapper.className = "settings-scroll-wrapper";
    scrollWrapper.appendChild(form);
    settingsTab.appendChild(scrollWrapper);
  }
}

function createClanBanner(clan) {
  const bannerWrapper = document.createElement("div");
  bannerWrapper.className = "clan-banner-wrapper";

  const logo = document.createElement("img");
  logo.src = clan.logoUrl || "img/clan/logo.webp";
  logo.alt = `${clan.name} logo`;
  logo.className = "clan-banner-logo";

  const name = document.createElement("h3");
  name.textContent = clan.name;
  name.className = "clan-banner-title";

  bannerWrapper.append(logo, name);
  return bannerWrapper;
}
