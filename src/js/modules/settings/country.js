import { deleteField, doc, setDoc } from "firebase/firestore";
import countries from "../../data/countries.json" assert { type: "json" };
import { auth, db } from "../firebase.js";
import { showToast } from "../toastHandler.js";
import { updateSettingsHelperText } from "./helpers.js";

const ISO_COUNTRIES = Array.isArray(countries) ? countries : [];
let countrySelectInitialized = false;

function setCountryStatus(message, tone = "muted") {
  updateSettingsHelperText("settingsCountryStatus", message, tone);
}

function setCountrySelectValue(value) {
  const select = document.getElementById("settingsCountrySelect");
  if (!select) return;
  if (!select.querySelector(`option[value="${value}"]`)) {
    // Options not loaded yet; store for later.
    if (value) {
      select.dataset.pendingValue = value;
    } else {
      delete select.dataset.pendingValue;
    }
    select.value = "";
    return;
  }
  select.value = value || "";
}

function populateCountrySelectOptions() {
  const select = document.getElementById("settingsCountrySelect");
  if (!select || select.dataset.filled === "true") return;
  const sortedCountries = [...ISO_COUNTRIES].sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), "en", {
      sensitivity: "base",
    })
  );
  const options = ['<option value="">Prefer not to say</option>']
    .concat(
      sortedCountries.map(
        (country) => `<option value="${country.code}">${country.name}</option>`
      )
    )
    .join("");
  select.innerHTML = options;
  select.dataset.filled = "true";
  const pending = select.dataset.pendingValue;
  if (pending) {
    delete select.dataset.pendingValue;
    setCountrySelectValue(pending);
  }
}

function setupCountrySelector() {
  if (countrySelectInitialized) return;
  const select = document.getElementById("settingsCountrySelect");
  if (!select) return;
  populateCountrySelectOptions();
  select.addEventListener("change", handleCountrySelection);
  countrySelectInitialized = true;
}

async function handleCountrySelection(event) {
  const select =
    event?.target || document.getElementById("settingsCountrySelect");
  if (!select) return;
  const code = select.value;
  const user = auth.currentUser;
  if (!user) {
    setCountryStatus("Sign in to set your country.", "error");
    showToast("? Please sign in to set your country.", "error");
    return;
  }
  const payload = code ? { country: code } : { country: deleteField() };
  try {
    await setDoc(doc(db, "users", user.uid), payload, { merge: true });
    setCountryStatus(
      code ? "Country saved." : "Country cleared.",
      code ? "success" : "muted"
    );
    showToast("? Country updated.", "success");
  } catch (err) {
    console.error("Failed to save country", err);
    setCountryStatus("Failed to save country.", "error");
    showToast("? Failed to save country.", "error");
  }
}

export {
  setCountrySelectValue,
  setCountryStatus,
  setupCountrySelector,
};
