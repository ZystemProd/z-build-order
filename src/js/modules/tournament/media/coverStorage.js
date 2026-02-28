import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";

export function createTournamentCoverStorage({
  storage,
  loadTournamentRegistry,
  prepareImageForUpload,
  validateTournamentImage,
  coverTargetWidth,
  coverTargetHeight,
  coverCardWidth,
  coverCardHeight,
  sponsorLogoSize,
  coverQuality,
}) {
  function isFirebaseStorageUrl(url) {
    return /^gs:\/\//.test(url) || url.includes("firebasestorage.googleapis.com");
  }

  function isCoverUrlInSlugFolder(url, slug) {
    if (!url || !slug) return false;
    const encodedSlug = encodeURIComponent(slug);
    return (
      url.includes(`tournamentCovers/${slug}/`) ||
      url.includes(`tournamentCovers%2F${encodedSlug}%2F`)
    );
  }

  async function isCoverUrlUsedElsewhere(coverImageUrl, excludeSlug) {
    const trimmed = String(coverImageUrl || "").trim();
    if (!trimmed) return false;
    try {
      const registry = await loadTournamentRegistry(true);
      return (registry || []).some((item) => {
        if (!item || item.slug === excludeSlug) return false;
        return (
          String(item.coverImageUrl || "").trim() === trimmed ||
          String(item.coverImageUrlSmall || "").trim() === trimmed
        );
      });
    } catch (err) {
      console.warn("Failed to verify cover image usage", err);
      return true;
    }
  }

  async function isCoverFolderUsedElsewhere(slug, excludeSlug) {
    if (!slug) return false;
    try {
      const registry = await loadTournamentRegistry(true);
      return (registry || []).some((item) => {
        if (!item || item.slug === excludeSlug) return false;
        return (
          isCoverUrlInSlugFolder(String(item.coverImageUrl || "").trim(), slug) ||
          isCoverUrlInSlugFolder(
            String(item.coverImageUrlSmall || "").trim(),
            slug,
          )
        );
      });
    } catch (err) {
      console.warn("Failed to verify cover folder usage", err);
      return true;
    }
  }

  async function deleteTournamentCoverByUrl(coverImageUrl, slug) {
    const trimmed = String(coverImageUrl || "").trim();
    if (!trimmed || !isFirebaseStorageUrl(trimmed)) return;
    if (slug && !isCoverUrlInSlugFolder(trimmed, slug)) return;
    const usedElsewhere = await isCoverUrlUsedElsewhere(trimmed, slug);
    if (usedElsewhere) return;
    try {
      const coverRef = storageRef(storage, trimmed);
      await deleteObject(coverRef);
    } catch (err) {
      console.warn("Failed to delete tournament cover image", err);
    }
  }

  async function deleteTournamentCoverFolder(slug) {
    if (!slug) return;
    const usedElsewhere = await isCoverFolderUsedElsewhere(slug, slug);
    if (usedElsewhere) return;
    try {
      const folderRef = storageRef(storage, `tournamentCovers/${slug}`);
      const list = await listAll(folderRef);
      await Promise.all(list.items.map((item) => deleteObject(item)));
    } catch (err) {
      console.warn("Failed to delete tournament cover folder", err);
    }
  }

  async function deleteTournamentSponsorFolder(slug) {
    if (!slug) return;
    try {
      const folderRef = storageRef(storage, `tournamentSponsors/${slug}`);
      const list = await listAll(folderRef);
      await Promise.all(list.items.map((item) => deleteObject(item)));
    } catch (err) {
      console.warn("Failed to delete tournament sponsor folder", err);
    }
  }

  async function uploadTournamentCover(file, slug) {
    const error = validateTournamentImage(file);
    if (error) throw new Error(error);
    if (!slug) throw new Error("Missing tournament slug.");
    const processedLarge = await prepareImageForUpload(file, {
      targetWidth: coverTargetWidth,
      targetHeight: coverTargetHeight,
      quality: coverQuality,
      outputType: "image/webp",
      fallbackType: "image/jpeg",
    });
    const processedSmall = await prepareImageForUpload(file, {
      targetWidth: coverCardWidth,
      targetHeight: coverCardHeight,
      quality: coverQuality,
      outputType: "image/webp",
      fallbackType: "image/jpeg",
    });
    const stamp = Date.now();
    const largePath = `tournamentCovers/${slug}/cover-${stamp}-1200.webp`;
    const smallPath = `tournamentCovers/${slug}/cover-${stamp}-320.webp`;
    const largeRef = storageRef(storage, largePath);
    const smallRef = storageRef(storage, smallPath);
    await Promise.all([
      uploadBytes(largeRef, processedLarge.blob, {
        contentType: processedLarge.contentType,
      }),
      uploadBytes(smallRef, processedSmall.blob, {
        contentType: processedSmall.contentType,
      }),
    ]);
    const [coverImageUrl, coverImageUrlSmall] = await Promise.all([
      getDownloadURL(largeRef),
      getDownloadURL(smallRef),
    ]);
    return { coverImageUrl, coverImageUrlSmall };
  }

  async function uploadSponsorLogo(file, slug) {
    const error = validateTournamentImage(file);
    if (error) throw new Error(error);
    if (!slug) throw new Error("Missing tournament slug.");
    const processed = await prepareImageForUpload(file, {
      targetWidth: sponsorLogoSize,
      targetHeight: sponsorLogoSize,
      quality: coverQuality,
      outputType: "image/webp",
      fallbackType: "image/jpeg",
    });
    const path = `tournamentSponsors/${slug}/logo-${Date.now()}.webp`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, processed.blob, {
      contentType: processed.contentType,
    });
    return getDownloadURL(ref);
  }

  return {
    deleteTournamentCoverByUrl,
    deleteTournamentCoverFolder,
    deleteTournamentSponsorFolder,
    uploadTournamentCover,
    uploadSponsorLogo,
  };
}
