// scripts/migrateCommentsToDescriptions.js
import admin from "firebase-admin";
import fs from "fs";

// 🔑 Load your service account key
const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./serviceAccountKey.json", import.meta.url))
);

// 🧩 Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateCommentsToDescriptions() {
  const snapshot = await db.collection("publishedBuilds").get();
  console.log(
    `📦 Found ${snapshot.size} documents in "publishedBuilds". Starting migration...`
  );

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const newDescription = data.comment || data.description || "";

    try {
      await doc.ref.update({
        description: newDescription,
        comment: admin.firestore.FieldValue.delete(),
      });

      console.log(
        `✅ Updated: ${doc.id} (${
          newDescription ? "migrated comment" : "empty description"
        })`
      );
    } catch (err) {
      console.error(`❌ Error updating ${doc.id}:`, err);
    }
  }

  console.log("🎉 Migration complete for publishedBuilds!");
}

migrateCommentsToDescriptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
