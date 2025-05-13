export function updateYouTubeEmbed(videoLink) {
  const iframe = document.getElementById("videoIframe");
  if (!iframe) {
    console.error("YouTube iframe not found!");
    return;
  }

  const videoId = extractYouTubeVideoId(videoLink);
  if (videoId) {
    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.style.display = "block"; // 🔥 Make iframe visible
  } else {
    console.warn("Empty or invalid video link. Clearing YouTube embed.");
    iframe.src = "";
    iframe.style.display = "none"; // 🔥 Hide if invalid
  }
}

// Helper function to extract YouTube video ID from a link
export function extractYouTubeVideoId(link) {
  if (!link) return null;

  try {
    const url = new URL(link);

    // Handle standard YouTube watch URLs
    if (url.hostname.includes("youtube.com") && url.searchParams.has("v")) {
      return url.searchParams.get("v");
    }

    // Handle youtu.be short links
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1); // Remove leading "/"
    }

    // Handle embed links
    if (url.pathname.includes("/embed/")) {
      return url.pathname.split("/embed/")[1];
    }

    // Default fallback
    return null;
  } catch (err) {
    console.error("Invalid URL passed to extractYouTubeVideoId:", link);
    return null;
  }
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
