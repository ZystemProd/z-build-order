const admin = require("firebase-admin");

const TOURNAMENT_COLLECTION = "tournaments";
const COVER_PREFIX = "tournamentCovers/";

function getProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  const cfg = process.env.FIREBASE_CONFIG;
  if (cfg) {
    try {
      return JSON.parse(cfg).projectId || null;
    } catch (_) {
      return null;
    }
  }
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credsPath) {
    try {
      const raw = require("fs").readFileSync(credsPath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed.project_id || null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function initAdmin() {
  const projectId = getProjectId();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : null);
  if (!admin.apps.length) {
    admin.initializeApp(
      bucketName ? { storageBucket: bucketName } : undefined
    );
  }
  const bucket = admin.storage().bucket(bucketName || undefined);
  if (!bucket.name) {
    throw new Error("Storage bucket not configured.");
  }
  return { db: admin.firestore(), bucket };
}

function extractStoragePath(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  if (raw.startsWith("gs://")) {
    const without = raw.slice("gs://".length);
    const slash = without.indexOf("/");
    if (slash === -1) return null;
    return without.slice(slash + 1);
  }

  if (raw.startsWith("https://firebasestorage.googleapis.com/")) {
    try {
      const parsed = new URL(raw);
      const idx = parsed.pathname.indexOf("/o/");
      if (idx === -1) return null;
      const encoded = parsed.pathname.slice(idx + 3);
      return decodeURIComponent(encoded);
    } catch (_) {
      return null;
    }
  }

  if (raw.startsWith("https://storage.googleapis.com/")) {
    try {
      const parsed = new URL(raw);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      return parts.slice(1).join("/");
    } catch (_) {
      return null;
    }
  }

  if (raw.startsWith(COVER_PREFIX)) return raw;
  if (raw.startsWith("/" + COVER_PREFIX)) return raw.slice(1);

  return null;
}

async function listUsedCoverPaths(db) {
  const used = new Set();
  const snap = await db
    .collection(TOURNAMENT_COLLECTION)
    .select("coverImageUrl", "coverImageUrlSmall")
    .get();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const paths = [
      extractStoragePath(data.coverImageUrl),
      extractStoragePath(data.coverImageUrlSmall),
    ].filter(Boolean);
    paths.forEach((p) => used.add(p));
  });
  return used;
}

async function listCoverFiles(bucket) {
  const [files] = await bucket.getFiles({ prefix: COVER_PREFIX });
  return files || [];
}

async function deleteInBatches(files, batchSize = 20) {
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map((file) =>
        file.delete().catch((err) => {
          console.warn(`Failed to delete ${file.name}`, err);
        })
      )
    );
  }
}

async function promptConfirm(message) {
  return new Promise((resolve) => {
    process.stdout.write(message);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      const answer = String(data || "").trim().toLowerCase();
      process.stdin.pause();
      resolve(answer === "y" || answer === "yes");
    });
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { db, bucket } = initAdmin();

  const used = await listUsedCoverPaths(db);
  const files = await listCoverFiles(bucket);
  const orphaned = files.filter((file) => !used.has(file.name));

  console.log(`Bucket: ${bucket.name}`);
  console.log(`Used cover files: ${used.size}`);
  console.log(`Total cover files: ${files.length}`);
  console.log(`Orphaned cover files: ${orphaned.length}`);

  if (!orphaned.length) return;
  console.log("Sample orphaned files:");
  orphaned.slice(0, 20).forEach((file) => console.log(`- ${file.name}`));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete.");
    return;
  }
  const ok = await promptConfirm(
    `Delete ${orphaned.length} orphaned cover files? (y/N): `
  );
  if (!ok) {
    console.log("Aborted.");
    return;
  }

  await deleteInBatches(orphaned);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
