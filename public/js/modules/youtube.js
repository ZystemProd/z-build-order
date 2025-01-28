export function updateYouTubeEmbed(videoLink) {
  const iframe = document.getElementById("videoIframe");
  if (iframe) {
    console.log("videoLink input:", videoLink); // Debug input for verification

    if (
      !videoLink ||
      typeof videoLink !== "string" ||
      videoLink.trim() === ""
    ) {
      console.warn("Empty or invalid video link. Clearing YouTube embed.");
      clearYouTubeEmbed();
      return;
    }

    const videoId = extractYouTubeVideoId(videoLink); // Helper function to get video ID
    if (videoId) {
      const sanitizedVideoId = DOMPurify.sanitize(videoId);
      iframe.src = `https://www.youtube.com/embed/${sanitizedVideoId}`;
      iframe.style.display = "block"; // Show the iframe
    } else {
      console.warn("Failed to extract video ID from the provided link.");
      clearYouTubeEmbed(); // Hide the iframe if the link is invalid
    }
  } else {
    console.warn("videoIframe element not found. Cannot update YouTube embed.");
  }
}

// Helper function to extract YouTube video ID from a link
function extractYouTubeVideoId(link) {
  if (typeof link !== "string") {
    console.error("Invalid video link provided. Expected a string.");
    return null;
  }

  console.log("Extracting video ID from link:", link); // Debug input
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = link.match(regex);

  if (match) {
    console.log("Extracted video ID:", match[1]); // Debug extracted ID
  } else {
    console.warn("No video ID found in link.");
  }

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
