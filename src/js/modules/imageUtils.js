export function validateImageFile(file, { maxBytes = 0, allowedTypes = null } = {}) {
  if (!file) return "No file selected.";
  if (!file.type || !file.type.startsWith("image/")) {
    return "File must be an image.";
  }
  if (Array.isArray(allowedTypes) && allowedTypes.length) {
    if (!allowedTypes.includes(file.type)) {
      return "Only PNG, JPG, or WEBP files are allowed.";
    }
  }
  if (maxBytes && file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `Image is too large. Max ${mb}MB.`;
  }
  return "";
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function prepareImageForUpload(file, {
  targetWidth,
  targetHeight,
  quality = 0.82,
  outputType = "image/webp",
  fallbackType = "image/jpeg",
} = {}) {
  if (!targetWidth || !targetHeight) {
    throw new Error("Missing target size for image processing.");
  }
  const img = await loadImageFromFile(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const width = Math.min(targetWidth, srcW);
  const height = Math.min(targetHeight, srcH);

  const scale = Math.max(width / srcW, height / srcH);
  const cropW = width / scale;
  const cropH = height / scale;
  const cropX = Math.max(0, (srcW - cropW) / 2);
  const cropY = Math.max(0, (srcH - cropH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, width, height);

  const primary = await canvasToBlob(canvas, outputType, quality);
  if (primary) {
    return { blob: primary, contentType: outputType, width, height };
  }
  const fallback = await canvasToBlob(canvas, fallbackType, quality);
  if (fallback) {
    return { blob: fallback, contentType: fallbackType, width, height };
  }
  throw new Error("Image conversion failed.");
}
