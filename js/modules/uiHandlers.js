import { getSavedBuilds } from "./buildStorage.js";

export function updateYouTubeEmbed() {
  const videoInput = document.getElementById("videoInput");
  const videoIframe = document.getElementById("videoIframe");

  const videoURL = videoInput.value.trim();
  const videoID = getYouTubeVideoID(videoURL);

  if (videoID) {
    // Show iframe with the video
    videoIframe.src = `https://www.youtube.com/embed/${videoID}`;
    videoIframe.style.display = "block";
  } else {
    // Hide iframe if the URL is invalid
    videoIframe.style.display = "none";
    videoIframe.src = "";
  }
}

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Function to toggle the title input field
export function toggleTitleInput(showInput) {
  const titleText = document.getElementById("buildOrderTitleText");
  const titleInput = document.getElementById("buildOrderTitleInput");

  if (showInput) {
    titleText.style.display = "none";
    titleInput.style.display = "inline-block";
    titleInput.value = titleText.classList.contains("dimmed")
      ? ""
      : titleText.textContent;
    titleInput.focus();
    titleText.classList.remove("dimmed");
  } else {
    const titleValue = titleInput.value.trim();
    titleText.textContent = titleValue || "Enter build order title here...";
    titleInput.style.display = "none";
    titleText.style.display = "inline-block";

    if (!titleValue) {
      titleText.classList.add("dimmed");
    }
  }
}

window.toggleTitleInput = toggleTitleInput;

// Function to filter builds by category or subcategory
export function filterBuilds(category) {
  const buildList = document.getElementById("modalBuildsContainer");
  const modalTitle = document.querySelector(".modal-content h3");

  // Clear existing cards
  buildList.innerHTML = "";

  // Fetch saved builds
  const savedBuilds = getSavedBuilds();

  // Filter builds by category
  const filteredBuilds =
    category === "all"
      ? savedBuilds
      : savedBuilds.filter((build) => build.category === category);

  // Sort by timestamp (newest first)
  const sortedBuilds = filteredBuilds.sort((a, b) => b.timestamp - a.timestamp);

  // Update the modal title
  const categoryTitles = {
    all: "All Builds",
    zerg: "Zerg Builds",
    protoss: "Protoss Builds",
    terran: "Terran Builds",
    zvp: "ZvP Builds",
    zvt: "ZvT Builds",
    zvz: "ZvZ Builds",
    pvp: "PvP Builds",
    pvz: "PvZ Builds",
    pvt: "PvT Builds",
    tvp: "TvP Builds",
    tvt: "TvT Builds",
    tvz: "TvZ Builds",
  };
  modalTitle.textContent = categoryTitles[category] || "Builds";

  // Render filtered builds
  sortedBuilds.forEach((build, index) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");

    buildCard.innerHTML = `
        <div class="delete-icon" onclick="deleteBuild(${index})">×</div>
        <h4 class="build-card-title">${build.title}</h4>
        <button onclick="viewBuild(${index})">View</button>
      `;

    buildList.appendChild(buildCard);
  });
}

// Function to toggle visibility of a section using data-section attribute
export function toggleSection(header) {
  const sectionId = header.getAttribute("data-section");
  const section = document.getElementById(sectionId);
  const arrow = header.querySelector(".arrow");

  if (section.style.display === "none" || !section.style.display) {
    section.style.display = "block";
    arrow.classList.add("open"); // Rotate arrow down
  } else {
    section.style.display = "none";
    arrow.classList.remove("open"); // Rotate arrow right
  }
}

// Add event listeners to headers with the class "toggle-title"
export function initializeSectionToggles() {
  document.querySelectorAll(".toggle-title").forEach((header) => {
    header.addEventListener("click", () => toggleSection(header));
  });
}

export function populateBuildDetails(build = {}) {
  const commentInput = document.getElementById("commentInput");
  const videoInput = document.getElementById("videoInput");

  // Assign safe defaults
  commentInput.value = build.comment || "";
  videoInput.value = build.videoLink || "";

  // Update video embed
  updateYouTubeEmbed();
}
