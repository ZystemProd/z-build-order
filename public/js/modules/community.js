// community_modal.js

// Function to populate the community builds table
export async function populateCommunityBuilds() {
    const tableBody = document.getElementById("communityBuildsTableBody");
  
    // Clear existing rows
    tableBody.innerHTML = "";
  
    // Fetch community builds (replace with actual API or database call)
    const builds = await fetchCommunityBuilds();
  
    // Populate rows
    builds.forEach((build) => {
      const row = document.createElement("tr");
  
      row.innerHTML = `
      <td>${build.title}</td>
      <td>${build.matchup}</td>
      <td>${build.publisher}</td>
      <td>${new Date(build.datePublished).toLocaleDateString()}</td>
      <td>
         <button class="vote-button thumbs-up" data-id="${build.id}">👍</button>
         <button class="vote-button thumbs-down" data-id="${build.id}">👎</button>
         <span class="vote-percentage" data-id="${build.id}">0%</span>
      </td>
      <td><button class="import-button" data-id="${build.id}">Import</button></td>
   `;
  
      tableBody.appendChild(row);
    });
  
    // Add event listeners for rate and import buttons
    initializeCommunityBuildEvents();
  }
  
  // Fetch community builds (mock function; replace with actual API call)
  async function fetchCommunityBuilds() {
    return [
      {
        id: 1,
        title: "ZvP Roach Rush",
        matchup: "ZvP",
        publisher: "User123",
        datePublished: "2025-01-15T10:00:00Z",
        score: 4.5,
      },
      {
        id: 2,
        title: "Terran Bio Opener",
        matchup: "TvZ",
        publisher: "ProPlayer",
        datePublished: "2025-01-20T12:00:00Z",
        score: 4.8,
      },
      {
        id: 3,
        title: "ZvP Roach Rush",
        matchup: "ZvP",
        publisher: "User123",
        datePublished: "2025-01-15T10:00:00Z",
        score: 4.5,
      },
      {
        id: 4,
        title: "Terran Bio Opener",
        matchup: "TvZ",
        publisher: "ProPlayer",
        datePublished: "2025-01-20T12:00:00Z",
        score: 4.8,
      },
      {
        id: 5,
        title: "ZvP Roach Rush",
        matchup: "ZvP",
        publisher: "User123",
        datePublished: "2025-01-15T10:00:00Z",
        score: 4.5,
      },
      {
        id: 6,
        title: "Terran Bio Opener",
        matchup: "TvZ",
        publisher: "ProPlayer",
        datePublished: "2025-01-20T12:00:00Z",
        score: 4.8,
      },
    ];
  }
  
  // Initialize event listeners for buttons
  function initializeCommunityBuildEvents() {
    document.querySelectorAll(".rate-button").forEach((button) => {
      button.addEventListener("click", handleRateBuild);
    });
  
    document.querySelectorAll(".import-button").forEach((button) => {
      button.addEventListener("click", handleImportBuild);
    });
  }

  // Example data structure to track votes
const votes = {};

// Function to initialize voting buttons
function initializeVoting() {
  document.querySelectorAll(".thumbs-up").forEach((button) => {
    button.addEventListener("click", () => handleVote(button, 1));
  });

  document.querySelectorAll(".thumbs-down").forEach((button) => {
    button.addEventListener("click", () => handleVote(button, -1));
  });
}

// Handle vote action
function handleVote(button, voteValue) {
  const buildId = button.dataset.id;

  // Initialize votes if not already set
  if (!votes[buildId]) {
    votes[buildId] = { up: 0, down: 0 };
  }

  // Update votes
  if (voteValue === 1) {
    votes[buildId].up += 1;
  } else if (voteValue === -1) {
    votes[buildId].down += 1;
  }

  // Update percentage display
  updateVotePercentage(buildId);
}

// Calculate and update vote percentage
function updateVotePercentage(buildId) {
  const voteData = votes[buildId];
  const totalVotes = voteData.up + voteData.down;

  let percentage = 0;
  if (totalVotes > 0) {
    percentage = Math.round((voteData.up / totalVotes) * 100);
  }

  const percentageSpan = document.querySelector(`.vote-percentage[data-id="${buildId}"]`);
  percentageSpan.textContent = `${percentage}%`;
}

// Call the voting initialization inside the community modal setup
function initializeCommunityBuildEvents() {
    document.querySelectorAll(".import-button").forEach((button) => {
       button.addEventListener("click", handleImportBuild);
    });
    initializeVoting(); // Attach voting buttons
 }

  
  // Handle importing a build
  function handleImportBuild(event) {
    const buildId = event.target.dataset.id;
  
    console.log(`Build ${buildId} imported`);
    // Fetch build details and save to user's library
  }
  
  // Export all functions for modular use
  export default {
    populateCommunityBuilds,
  };
  