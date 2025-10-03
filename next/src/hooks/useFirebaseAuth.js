"use client";

import { useEffect, useState } from "react";
import { auth, listenToAuthChanges } from "@/lib/firebase";

export function useFirebaseAuth() {
  const [user, setUser] = useState(() => auth.currentUser);
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => {
    const unsubscribe = listenToAuthChanges((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
