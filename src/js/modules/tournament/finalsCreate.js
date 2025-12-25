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
      const coverImageUrl = await uploadTournamentCover(finalImageFile, finalSlug);
      await setDoc(
        doc(collection(db, tournamentCollection), finalSlug),
        { coverImageUrl },
        { merge: true }
      );
    } catch (err) {
      showToast?.(err?.message || "Failed to upload final cover image.", "error");
    }
  }

  await setDoc(
    doc(collection(db, circuitCollection), circuitSlug),
    { tournaments: arrayUnion(finalSlug), finalTournamentSlug: finalSlug },
    { merge: true }
  );

  return { created: true };
}
