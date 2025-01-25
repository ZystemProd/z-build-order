export function updateYouTubeEmbed(videoLink) {
  const iframe = document.getElementById("videoIframe");
  if (iframe) {
    const videoId = extractYouTubeVideoId(videoLink); // Helper function to get video ID
    if (videoId) {
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.style.display = "block"; // Show the iframe
    } else {
      console.error("Invalid YouTube link.");
      clearYouTubeEmbed(); // Hide the iframe if the link is invalid
    }
  } else {
    console.warn("videoIframe element not found. Cannot update YouTube embed.");
  }
}

// Helper function to extract YouTube video ID from a link
function extractYouTubeVideoId(link) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = link.match(regex);
  return match ? match[1] : null;
}

export function clearYouTubeEmbed() {
  const iframe = document.getElementById("videoIframe");
  if (iframe) {
    iframe.style.display = "none"; // Hide the iframe
    iframe.src = ""; // Clear the video source
  } else {
    console.warn("videoIframe element not found. Cannot clear YouTube embed.");
  }
}
