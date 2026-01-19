import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  orderBy,
  where,
  documentId,
} from "firebase/firestore";

const SEARCH_LIMIT = 8;
const SEARCH_FETCH_LIMIT = 50;

export function createAdminPlayerSearch({
  db,
  getIsEnabled,
  getPlayers,
  addPlayer,
  onStatus,
  onResults,
  onError,
  onSuccess,
}) {
  if (!db) {
    throw new Error("Missing Firestore db reference.");
  }
  if (typeof getPlayers !== "function") {
    throw new Error("Missing getPlayers helper.");
  }
  if (typeof addPlayer !== "function") {
    throw new Error("Missing addPlayer helper.");
  }

  let searchTimer = null;
  let searchToken = 0;

  const setStatus = (message) => {
    onStatus?.(message || "");
  };

  const renderResults = (results) => {
    onResults?.(Array.isArray(results) ? results : []);
  };

  const clearResults = () => {
    renderResults([]);
    setStatus("");
  };

  const getFirstCharVariants = (value) => {
    const first = (value || "").trim().charAt(0);
    if (!first) return [];
    return Array.from(new Set([first.toLowerCase(), first.toUpperCase()]));
  };

  const runSearch = async (term) => {
    if (typeof getIsEnabled === "function" && !getIsEnabled()) {
      clearResults();
      return;
    }
    const trimmedRaw = (term || "").trim();
    if (!trimmedRaw) {
      clearResults();
      return;
    }
    if (trimmedRaw.length < 2) {
      setStatus("Type at least 2 characters to search.");
      renderResults([]);
      return;
    }
    const termLower = trimmedRaw.toLowerCase();
    const token = ++searchToken;
    setStatus("Searching...");
    try {
      const terms = getFirstCharVariants(trimmedRaw);
      const resultsMap = new Map();
      for (const term of terms) {
        const q = query(
          collection(db, "usernames"),
          where(documentId(), ">=", term),
          where(documentId(), "<=", `${term}\uf8ff`),
          orderBy(documentId()),
          limit(SEARCH_FETCH_LIMIT)
        );
        const snap = await getDocs(q);
        snap.docs.forEach((docSnap) => {
          resultsMap.set(docSnap.id, {
            username: docSnap.id,
            userId: docSnap.data()?.userId || docSnap.data()?.uid || "",
          });
        });
      }
      if (token !== searchToken) return;
      const results = Array.from(resultsMap.values())
        .filter((entry) => entry.username.toLowerCase().startsWith(termLower))
        .slice(0, SEARCH_LIMIT);
      renderResults(results);
      setStatus(
        results.length ? `Found ${results.length} match(es).` : "No matches found."
      );
    } catch (err) {
      console.error("Failed to search usernames", err);
      setStatus("Search failed. Try again.");
      renderResults([]);
      onError?.(err);
    }
  };

  const debouncedSearch = (term) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(() => {
      runSearch(term);
    }, 250);
  };

  const addByUsername = async (username, userIdOverride = "", options = {}) => {
    if (typeof getIsEnabled === "function" && !getIsEnabled()) {
      onError?.(new Error("Search disabled."));
      return;
    }
    const cleaned = (username || "").trim();
    if (!cleaned) {
      setStatus("Enter a username to add.");
      return;
    }
    let snap = null;
    if (!userIdOverride) {
      const cleanedLower = cleaned.toLowerCase();
      const variants = getFirstCharVariants(cleaned);
      for (const variant of variants) {
        const q = query(
          collection(db, "usernames"),
          where(documentId(), ">=", variant),
          where(documentId(), "<=", `${variant}\uf8ff`),
          orderBy(documentId()),
          limit(SEARCH_FETCH_LIMIT)
        );
        const snapBatch = await getDocs(q);
        const match = snapBatch.docs.find(
          (docSnap) => docSnap.id.toLowerCase() === cleanedLower
        );
        if (match) {
          snap = match;
          break;
        }
      }
    }
    const userId =
      userIdOverride || (snap?.exists() ? snap.data()?.userId || snap.data()?.uid : "");
    if (!userId) {
      setStatus("Username not found.");
      onError?.(new Error("Username not found."));
      return;
    }
    const existing = getPlayers()?.some(
      (player) =>
        (player.uid && player.uid === userId) ||
        (player.name || "").toLowerCase() === cleaned.toLowerCase()
    );
    if (existing) {
      setStatus("Player is already added.");
      return;
    }
    try {
      const userData = {};
      await addPlayer({ userId, username: cleaned, userData, options });
      onSuccess?.(cleaned);
    } catch (err) {
      console.error("Failed to add player from search", err);
      setStatus("Failed to add player.");
      onError?.(err);
    }
  };

  return {
    debouncedSearch,
    runSearch,
    addByUsername,
    clearResults,
    renderResults,
  };
}
