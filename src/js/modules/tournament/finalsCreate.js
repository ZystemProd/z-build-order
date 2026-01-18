export async function createFinalTournamentForCircuit({
  db,
  doc,
  collection,
  setDoc,
  arrayUnion,
  uploadTournamentCover,
  showToast,
  tournamentCollection,
  circuitCollection,
  circuitSlug,
  finalSlug,
  finalPayload,
  finalImageFile,
  finalCoverUrl,
} = {}) {
  if (!db || !doc || !collection || !setDoc) {
    throw new Error("Missing database helpers for final tournament creation.");
  }
  if (!circuitSlug || !finalSlug || !finalPayload) {
    throw new Error("Missing required final tournament data.");
  }

  await setDoc(
    doc(collection(db, tournamentCollection), finalSlug),
    finalPayload,
    { merge: true }
  );

  if (finalImageFile) {
    try {
      const uploaded = await uploadTournamentCover(finalImageFile, finalSlug);
      await setDoc(
        doc(collection(db, tournamentCollection), finalSlug),
        {
          coverImageUrl: uploaded.coverImageUrl,
          coverImageUrlSmall: uploaded.coverImageUrlSmall,
        },
        { merge: true }
      );
    } catch (err) {
      showToast?.(err?.message || "Failed to upload final cover image.", "error");
    }
  } else if (finalCoverUrl) {
    await setDoc(
      doc(collection(db, tournamentCollection), finalSlug),
      { coverImageUrl: finalCoverUrl, coverImageUrlSmall: "" },
      { merge: true }
    );
  }

  await setDoc(
    doc(collection(db, circuitCollection), circuitSlug),
    { tournaments: arrayUnion(finalSlug), finalTournamentSlug: finalSlug },
    { merge: true }
  );

  return { created: true };
}
