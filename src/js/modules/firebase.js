import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getDatabase } from "firebase/database";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBLnneYwLDfIp-Oep2MvExGnVk_EvDQoo",
  authDomain: "z-build-order.firebaseapp.com",
  databaseURL: "https://z-build-order-default-rtdb.firebaseio.com",
  projectId: "z-build-order",
  storageBucket: "z-build-order.firebasestorage.app",
  messagingSenderId: "22023941178",
  appId: "1:22023941178:web:ba417e9a52332a8e055903",
  measurementId: "G-LBDMKMG1W9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const rtdb = getDatabase(app);
const db = initializeFirestore(app, {
  localCache:
    typeof window === "undefined"
      ? memoryLocalCache()
      : persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
});

const provider = new GoogleAuthProvider();
const switchAccountProvider = new GoogleAuthProvider();
switchAccountProvider.setCustomParameters({ prompt: "select_account" });

let appCheck;
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const disableAppCheck =
    params.has("noappcheck") || localStorage.getItem("disableAppCheck") === "1";
  appCheck = window.__appCheckInstance;
  if (!appCheck && !disableAppCheck) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(
          "6LcBBWsrAAAAALLmBNIhl-zKPa8KRj8mXMldoKbN"
        ),
        isTokenAutoRefreshEnabled: true,
      });
      window.__appCheckInstance = appCheck;
    } catch (err) {
      console.warn("App Check init failed; continuing without it.", err);
    }
  }
} else {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      "6LcBBWsrAAAAALLmBNIhl-zKPa8KRj8mXMldoKbN"
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

export { app, auth, db, functions, rtdb, provider, switchAccountProvider };
