import { loadGameData } from "../data/getGameData.js";

let units,
  structures,
  upgrades,
  unitImages,
  structureImages,
  upgradeImages;
import { analyzeBuildOrder } from "./uiHandlers.js";
import { isBracketInputEnabled } from "./settings.js";
import DOMPurify from "dompurify";

// Function to position the autocomplete popup below the caret
function positionPopupAtCaret(inputField, popup) {
  const { selectionStart, selectionEnd } = inputField;

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
  const rect = inputField.getBoundingClientRect();
  tempDiv.style.top = `${rect.top}px`;
  tempDiv.style.left = `${rect.left}px`;
  tempDiv.style.width = `${rect.width}px`;

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

  // Set the popup position relative to the viewport
  popup.style.top = `${markerRect.bottom}px`;
  popup.style.left = `${markerRect.left}px`;

  // Remove the temporary div from the document
  document.body.removeChild(tempDiv);
}

// Function to initialize the autocomplete feature
export async function initializeAutoCorrect() {
  ({
    units,
    structures,
    upgrades,
    unitImages,
    structureImages,
    upgradeImages,
  } = await loadGameData());
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

  function insertTextRange(text, start, end) {
    inputField.focus();
    if (typeof inputField.setRangeText === "function") {
      inputField.setRangeText(text, start, end, "end");
    } else {
      inputField.setSelectionRange(start, end);
      document.execCommand("insertText", false, text);
    }
  }

  function replaceCurrentWordWith(text) {
    const wordBoundaryRegex = /\b(\w+)$/;
    const cursorPosition = inputField.selectionStart;
    const textBeforeCaret = inputField.value.substring(0, cursorPosition);
    const match = textBeforeCaret.match(wordBoundaryRegex);
    if (!match) return;

    const start = cursorPosition - match[1].length;
    insertTextRange(text, start, cursorPosition);

    popup.style.visibility = "hidden";
    activeIndex = 0;
    analyzeBuildOrder(inputField.value);
  }

  function applySuggestion() {
    const activeSuggestion = popup.querySelector(".suggestion.active");
    if (activeSuggestion) {
      replaceCurrentWordWith(activeSuggestion.textContent);
    }
  }

  function insertNewRow(event) {
    const cursorPosition = inputField.selectionStart;
    const text = inputField.value;
    const textBeforeCaret = text.substring(0, cursorPosition);
    const textAfterCaret = text.substring(cursorPosition);

    const trimmedAfterCaret = textAfterCaret.trimStart();

    if (trimmedAfterCaret.startsWith("[")) {
      event.preventDefault();
      inputField.focus();
      insertTextRange(
        "\n[] ",
        inputField.selectionStart,
        inputField.selectionEnd
      );

      // Place caret inside the new brackets `[|]`
      inputField.selectionStart = inputField.selectionEnd = cursorPosition + 2;
      inputField.scrollTop = inputField.scrollHeight;
      analyzeBuildOrder(inputField.value);
      return;
    }

    if (!isBracketInputEnabled()) {
      event.preventDefault();
      inputField.focus();
      insertTextRange("\n", inputField.selectionStart, inputField.selectionEnd);
      inputField.scrollTop = inputField.scrollHeight;
      analyzeBuildOrder(inputField.value);
      return;
    }

    // ✅ Fix: Move cursor outside bracket if inside [anything|]
    const bracketStart = textBeforeCaret.lastIndexOf("[");
    const bracketEnd = textBeforeCaret.length + textAfterCaret.indexOf("]");

    if (
      bracketStart !== -1 &&
      bracketEnd !== -1 &&
      cursorPosition > bracketStart &&
      cursorPosition <= bracketEnd
    ) {
      event.preventDefault();

      // If there's no space after ], insert one and record in undo stack
      if (inputField.value[bracketEnd + 1] !== " ") {
        inputField.setSelectionRange(bracketEnd + 1, bracketEnd + 1);
        inputField.focus();
        insertTextRange(" ", bracketEnd + 1, bracketEnd + 1);
      }

      // Move cursor right after the inserted space
      inputField.selectionStart = inputField.selectionEnd = bracketEnd + 2;
      return;
    }

    // 2️⃣ Check if cursor is **right after** brackets like `[13]|`, `[4:00]|`, `[100 gas]|`, or `[100 minerals]|`
    const afterBracketsMatch = textBeforeCaret.match(
      /\[[\d/:]*\s*(gas|minerals)?\]$/
    );

    if (afterBracketsMatch) {
      // ✅ Create a **new row** and move cursor inside `[|]`
      event.preventDefault();
      inputField.focus();
      insertTextRange(
        "\n[] ",
        inputField.selectionStart,
        inputField.selectionEnd
      );

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
    inputField.focus();
    insertTextRange(
      "\n[] ",
      inputField.selectionStart,
      inputField.selectionEnd
    );

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

    // 🚫 Disable autocomplete if inside brackets like [|]
    const bracketStart = text.lastIndexOf("[", cursorPosition - 1);
    const bracketEnd = text.indexOf("]", cursorPosition);
    const lastNewline = text.lastIndexOf("\n", cursorPosition - 1);
    const nextNewlineIndex = text.indexOf("\n", cursorPosition);
    const isSameLine =
      bracketStart > lastNewline &&
      (nextNewlineIndex === -1 || bracketEnd < nextNewlineIndex);

    if (
      bracketStart !== -1 &&
      bracketEnd !== -1 &&
      isSameLine &&
      bracketStart < cursorPosition &&
      cursorPosition <= bracketEnd
    ) {
      popup.style.visibility = "hidden";
      return;
    }

    const wordBoundaryRegex = /\b(\w+)$/; // Match the last word before the cursor

    // Get the current word being typed
    const match = text.substring(0, cursorPosition).match(wordBoundaryRegex);
    if (!match) {
      popup.style.visibility = "hidden";
      return;
    }

    const currentWord = match[1].toLowerCase();
    const matches = suggestions.filter((item) =>
      item.name.toLowerCase().includes(currentWord)
    );

    // Hide the popup if the word exactly matches a suggestion
    const isExactMatch = suggestions.some(
      (item) => item.name.toLowerCase() === currentWord
    );
    if (isExactMatch) {
      popup.style.visibility = "hidden";
      return;
    }

    if (matches.length === 0) {
      popup.style.visibility = "hidden";
      return;
    }

    // Populate popup with matches
    popup.innerHTML = "";
    matches.forEach((match, index) => {
      const suggestion = document.createElement("div");
      suggestion.classList.add("suggestion");

      if (index === 0) suggestion.classList.add("active");

      const img = document.createElement("img");

      const key = match.name.toLowerCase().replace(/ /g, "_");

      let imagePath = "";

      if (match.type === "unit") {
        imagePath = unitImages[key];
      } else if (match.type === "structure") {
        imagePath = structureImages[key];
      } else if (match.type === "upgrade") {
        imagePath = upgradeImages[key];
      }

      img.src = DOMPurify.sanitize(imagePath || "img/missing.webp");

      img.alt = DOMPurify.sanitize(match.name);

      const textEl = document.createElement("span");
      textEl.textContent = DOMPurify.sanitize(match.name);

      suggestion.appendChild(img);
      suggestion.appendChild(textEl);

      suggestion.addEventListener("click", () => {
        inputField.selectionStart = inputField.selectionEnd = cursorPosition;
        replaceCurrentWordWith(match.name);
      });

      popup.appendChild(suggestion);
    });

    activeIndex = 0;
    positionPopupAtCaret(inputField, popup);
    popup.style.visibility = "visible";
  });

  inputField.addEventListener("click", () => {
    popup.style.visibility = "hidden";
  });

  inputField.addEventListener("keydown", (event) => {
    const allSuggestions = popup.querySelectorAll(".suggestion");

    if (popup.style.visibility && popup.style.visibility !== "hidden") {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        popup.style.visibility = "hidden";
        return;
      }
    }

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
      if (!popup.matches(":hover")) {
        popup.style.visibility = "hidden";
      }
    }, 200);
  });
}
