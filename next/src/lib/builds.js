import { cache } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
  return {
    raw: date.toISOString(),
    formatted: new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
  };
}

function serializeBuild(docSnapshot) {
  if (!docSnapshot?.exists()) return null;
  const data = docSnapshot.data();
  const createdAt = formatTimestamp(data.createdAt);

  return {
    id: docSnapshot.id,
    title: data.title || "Untitled Build",
    matchup: data.matchup || "Custom",
    author: data.authorName || data.ownerName || "Anonymous",
    summaryHtml: data.summaryHtml || data.summary || "",
    stepsHtml: data.stepsHtml || "",
    createdAt: createdAt?.raw ?? null,
    createdAtFormatted: createdAt?.formatted ?? "",
    slug: data.slug || docSnapshot.id,
    isPublished: Boolean(data.isPublished ?? true),
  };
}

export const getPublishedBuild = cache(async (id) => {
  if (!id) return null;
  const ref = doc(db, "builds", id);
  const snapshot = await getDoc(ref);
  return serializeBuild(snapshot);
});

export const getRecentCommunityBuilds = cache(async ({ limit = 5 } = {}) => {
  const buildsRef = collection(db, "builds");
  const q = query(
    buildsRef,
    where("isPublished", "==", true),
    orderBy("createdAt", "desc"),
    limitQuery(limit),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => serializeBuild(docSnap)).filter(Boolean);
});

export async function getUserBuilds({ userId, filter = "all", limit = 20, cursor = null }) {
  if (!userId) throw new Error("Missing userId for getUserBuilds");
  const buildsRef = collection(db, "builds");

  const constraints = [where("ownerId", "==", userId), orderBy("createdAt", "desc"), limitQuery(limit)];
  if (filter && filter !== "all") {
    constraints.splice(1, 0, where("matchup", "==", filter.toLowerCase()));
  }
  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(buildsRef, ...constraints);
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((docSnap) => serializeBuild(docSnap)).filter(Boolean);
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;

  return {
    items,
    cursor: lastDoc,
  };
}
