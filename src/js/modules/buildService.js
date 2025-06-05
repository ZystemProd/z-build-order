import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { capitalize } from "./helpers/sharedEventUtils.js";

export async function loadBuilds({
  type = "my",
  filter = "all",
  batchSize = 20,
  startAfter: startDoc = null,
}) {
  const db = getFirestore();
  const user = getAuth().currentUser;
  if (!user) return { builds: [], lastDoc: null };

  const baseRef =
    type === "published"
      ? collection(db, "publishedBuilds")
      : collection(db, `users/${user.uid}/builds`);

  const conditions = [];

  if (type === "published") {
    conditions.push(where("publisherId", "==", user.uid));
  }

  if (filter !== "all") {
    const lower = filter.toLowerCase();

    if (/^[zpt]v[zpt]$/.test(lower)) {
      conditions.push(where("subcategoryLowercase", "==", lower));
    } else if (["zerg", "protoss", "terran"].includes(lower)) {
      conditions.push(where("category", "==", capitalize(lower)));
    } else {
      conditions.push(where("category", "==", capitalize(lower)));
    }
  }

  let q = query(baseRef, ...conditions, orderBy("timestamp", "desc"));

  if (startDoc) {
    q = query(q, startAfter(startDoc));
  }

  q = query(q, limit(batchSize));

  const snap = await getDocs(q);
  let builds = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (type === "my") {
    const publishedRef = collection(db, "publishedBuilds");
    const publishedSnap = await getDocs(
      query(publishedRef, where("publisherId", "==", user.uid))
    );
    const publishedIds = new Set(publishedSnap.docs.map((d) => d.id));
    builds = builds.map((b) => ({
      ...b,
      isPublished: b.isPublished || publishedIds.has(b.id),
    }));
  }

  return {
    builds,
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}
