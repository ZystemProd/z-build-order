// One-time migration script to copy legacy "comment" fields to the new "description" field.
// Run this in a Firebase Console or Node.js environment that has initialized Firestore.
export async function migrateCommentsToDescriptions(db, firebase) {
  const snapshot = await db.collection("communityBuilds").get();
  snapshot.forEach(async (doc) => {
    const data = doc.data();
    if (data.comment) {
      await doc.ref.update({
        description: data.comment,
        comment: firebase.firestore.FieldValue.delete(),
      });
    }
  });
}
