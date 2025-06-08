export const firebaseConfig = {
  apiKey: "AIzaSyBBLnneYwLDfIp-Oep2MvExGnVk_EvDQoo",
  authDomain: "z-build-order.firebaseapp.com",
  projectId: "z-build-order",
  storageBucket: "z-build-order.firebasestorage.app",
  messagingSenderId: "22023941178",
  appId: "1:22023941178:web:ba417e9a52332a8e055903",
  measurementId: "G-LBDMKMG1W9",
};

let app;
let auth;
let db;
let provider;
let perf;

export async function getFirebase() {
  if (!app) {
    const [{ initializeApp }, authMod, fsMod, { getPerformance }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
      import('firebase/performance'),
    ]);
    app = initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);
    provider = new authMod.GoogleAuthProvider();
    perf = getPerformance(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
  }
  return { app, auth, db, provider, perf };
}
export async function loadAuth() {
  return await import('firebase/auth');
}

export async function loadFirestore() {
  return await import('firebase/firestore');
}

export async function loadStorage() {
  return await import('firebase/storage');
}
