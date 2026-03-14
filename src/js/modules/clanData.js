import { collection, getDocs } from "firebase/firestore";

import { db } from "../../app.js";

export async function listPublicClans() {
  const snap = await getDocs(collection(db, "clans"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
