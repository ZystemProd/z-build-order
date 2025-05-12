import { units } from "../data/units.js";
import { structures } from "../data/structures.js";
import { upgrades } from "../data/upgrades.js";
import { analyzeBuildOrder } from "./uiHandlers.js";
import DOMPurify from "dompurify";

// Function to position the autocomplete popup below the caret
function positionPopupAtCaret(inputField, popup) {
  const { selectionStart, selectionEnd, scrollTop, scrollLeft } = inputField;

  // If there's no caret or selection range, don't position the popup
  if (
    selectionStart === null ||
    selectionEnd === null ||
    selectionStart !== selectionEnd
  ) {
    popup.style.visibility = "hidden";
    return;
  }

  // Create a temporary div element to calculate caret position
  const tempDiv = document.createElement("div");
  const styles = window.getComputedStyle(inputField);

  // Copy styles from the textarea to the temporary div
  Array.from(styles).forEach((key) => {
    tempDiv.style[key] = styles[key];
  });

  // Mimic the `textarea` behavior in the temporary div
  tempDiv.style.position = "absolute";
  tempDiv.style.whiteSpace = "pre-wrap";
  tempDiv.style.visibility = "hidden";
  tempDiv.style.top = `${inputField.offsetTop}px`;
  tempDiv.style.left = `${inputField.offsetLeft}px`;
  tempDiv.style.width = `${inputField.offsetWidth}px`;

  // Adjust the content up to the caret position
  const textBeforeCaret = inputField.value.slice(0, selectionStart);
  tempDiv.textContent = textBeforeCaret;

  // Add a marker span at the caret position
  const markerSpan = document.createElement("span");
  markerSpan.textContent = "|"; // Placeholder character for caret
  tempDiv.appendChild(markerSpan);

  // Append the temporary div to the document
  document.body.appendChild(tempDiv);

  // Get the marker's position relative to the `textarea`
  const markerRect = markerSpan.getBoundingClientRect();
  const textareaRect = inputField.getBoundingClientRect();

  // Calculate the position of the popup, including scroll adjustments
  const popupTop =
    markerRect.top - textareaRect.top + inputField.offsetTop - scrollTop;
  const popupLeft =
    markerRect.left - textareaRect.left + inputField.offsetLeft - scrollLeft;

  // Set the popup position
  popup.style.top = `${popupTop + markerRect.height + window.scrollY}px`;
  popup.style.left = `${popupLeft + window.scrollX}px`;

  // Remove the temporary div from the document
  document.body.removeChild(tempDiv);
}

// Function to initialize the autocomplete feature
export function initializeAutoCorrect() {
  const inputField = document.getElementById("buildOrderInput");
  const popup = document.getElementById("autocomplete-popup");

  // Flatten data into a single list for suggestions
  const suggestions = [
    ...units.zerg.map((name) => ({ category: "Units", name, type: "unit" })),
    ...units.protoss.map((name) => ({ category: "Units", name, type: "unit" })),
    ...units.terran.map((name) => ({ category: "Units", name, type: "unit" })),
    ...structures.map((name) => ({
      category: "Structures",
      name,
      type: "structure",
    })),
    ...upgrades.map((name) => ({
      category: "Upgrades",
      name,
      type: "upgrade",
    })),
  ];

  let activeIndex = 0; // Index of the currently active suggestion

  function updateActiveSuggestion(index) {
    const allSuggestions = popup.querySelectorAll(".suggestion");
    allSuggestions.forEach((suggestion, i) => {
      suggestion.classList.toggle("active", i === index);
    });

    // Scroll the active suggestion into view
    const activeSuggestion = allSuggestions[index];
    if (activeSuggestion) {
      activeSuggestion.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }

  function applySuggestion() {
    const activeSuggestion = popup.querySelector(".suggestion.active");
    if (activeSuggestion) {
      const currentWordRegex = /\b(\w+)$/; // Match the last word before the caret
      const cursorPosition = inputField.selectionStart;
      const textBeforeCaret = inputField.value.substring(0, cursorPosition);
      const textAfterCaret = inputField.value.substring(cursorPosition);

      inputField.value =
        textBeforeCaret.replace(
          currentWordRegex,
          activeSuggestion.textContent
        ) + textAfterCaret;

      popup.style.visibility = "hidden";
      inputField.focus();
      activeIndex = 0; // Reset active index

      // Call analyzeBuildOrder to update the buildOrderTable
      analyzeBuildOrder(inputField.value);
    }
  }

  function insertNewRow(event) {
    const cursorPosition = inputField.selectionStart;
    const text = inputField.value;
    const textBeforeCaret = text.substring(0, cursorPosition);
    const textAfterCaret = text.substring(cursorPosition);

    // 1️⃣ Check if cursor is inside brackets like `[13|]`, `[4:00|]`, `[100 gas|]`, or `[100 minerals|]`
    const insideBracketsMatch = textBeforeCaret.match(
      /\[([\d/:]*\s*(gas|minerals)?)$/
    );

    if (insideBracketsMatch) {
      // ✅ Move cursor **right after `]`**
      event.preventDefault();
      inputField.value = textBeforeCaret + textAfterCaret + " "; // Add space after `]`
      inputField.selectionStart = inputField.selectionEnd = cursorPosition + 2; // Move cursor after `]`
      return;
    }

    // 2️⃣ Check if cursor is **right after** brackets like `[13]|`, `[4:00]|`, `[100 gas]|`, or `[100 minerals]|`
    const afterBracketsMatch = textBeforeCaret.match(
      /\[[\d/:]*\s*(gas|minerals)?\]$/
    );

    if (afterBracketsMatch) {
      // ✅ Create a **new row** and move cursor inside `[|]`
      event.preventDefault();
      inputField.value = textBeforeCaret + "\n[]" + textAfterCaret; // No extra space inside brackets

      // Move cursor **inside** the new brackets `[|]`
      inputField.selectionStart = inputField.selectionEnd = cursorPosition + 2;

      // Scroll to ensure visibility
      inputField.scrollTop = inputField.scrollHeight;

      // Update build order
      analyzeBuildOrder(inputField.value);
      return;
    }

    // 3️⃣ Default behavior: Create new row and move cursor inside `[|]`
    event.preventDefault();
    inputField.value = textBeforeCaret + "\n[]" + textAfterCaret; // No extra space inside brackets

    // Move cursor inside the new brackets `[|]`
    inputField.selectionStart = inputField.selectionEnd = cursorPosition + 2;

    // Scroll to ensure cursor visibility
    inputField.scrollTop = inputField.scrollHeight;

    // Update build order
    analyzeBuildOrder(inputField.value);
  }

  inputField.addEventListener("input", () => {
    const text = inputField.value;
    const cursorPosition = inputField.selectionStart;
    const wordBoundaryRegex = /\b(\w+)$/; // Match the last word before the cursor

    // Get the current word being typed
    const match = text.substring(0, cursorPosition).match(wordBoundaryRegex);
    if (!match) {
      popup.style.visibility = "hidden";
      return;
    }

    const currentWord = match[1].toLowerCase();
    const matches = suggestions.filter(
      (item) => item.name.toLowerCase().includes(currentWord) // Check if the suggestion contains the word
    );

    if (matches.length === 0) {
      popup.style.visibility = "hidden";
      return;
    }

    // Populate popup with matches
    popup.innerHTML = "";
    matches.forEach((match, index) => {
      const suggestion = document.createElement("div");
      suggestion.classList.add("suggestion");

      if (index === 0) suggestion.classList.add("active"); // Mark first suggestion as active

      const img = document.createElement("img");
      img.src = `img/${DOMPurify.sanitize(match.type)}/${DOMPurify.sanitize(
        match.name.toLowerCase().replace(/ /g, "_")
      )}.webp`;
      img.alt = DOMPurify.sanitize(match.name);

      const text = document.createElement("span");
      text.textContent = DOMPurify.sanitize(match.name);

      suggestion.appendChild(img);
      suggestion.appendChild(text);

      suggestion.addEventListener("click", () => {
        const start = inputField.value
          .substring(0, cursorPosition)
          .replace(wordBoundaryRegex, match.name);
        const end = inputField.value.substring(cursorPosition);
        inputField.value = start + end;

        popup.style.visibility = "hidden";
        inputField.focus(); // Refocus the input field

        // Call analyzeBuildOrder to update the buildOrderTable
        analyzeBuildOrder(inputField.value);
      });

      popup.appendChild(suggestion);
    });

    activeIndex = 0; // Reset active index
    positionPopupAtCaret(inputField, popup);
    popup.style.visibility = "visible";
  });

  inputField.addEventListener("keydown", (event) => {
    const allSuggestions = popup.querySelectorAll(".suggestion");

    if (!popup.style.visibility || popup.style.visibility === "hidden") {
      if (event.key === "Enter") {
        event.preventDefault(); // Prevent default new-line behavior
        insertNewRow(event); // Pass event to the function
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        activeIndex = (activeIndex + 1) % allSuggestions.length;
        updateActiveSuggestion(activeIndex);
        break;
      case "ArrowUp":
        event.preventDefault();
        activeIndex =
          (activeIndex - 1 + allSuggestions.length) % allSuggestions.length;
        updateActiveSuggestion(activeIndex);
        break;
      case "Enter":
        event.preventDefault(); // Prevent moving to the next line
        applySuggestion();
        break;
      case "Escape":
        popup.style.visibility = "hidden";
        break;
    }
  });

  inputField.addEventListener("blur", () => {
    setTimeout(() => {
      popup.style.visibility = "hidden";
    }, 100);
  });
}
