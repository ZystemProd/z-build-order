import { formatActionText } from "../textFormatters.js";

let catHelpShown = false;
let catIsActive = true; // <- new flag

export function setupCatActivationOnInput() {
  const input = document.getElementById("buildOrderInput");
  const cat = document.querySelector(".cat");
  const bubble = document.getElementById("catTipBubble");
  const textElement = document.getElementById("catTipBubbleText"); // NEW

  if (!input || !cat || !bubble || !textElement) return;

  let animationTimeout;
  let tipInterval;
  let currentTipIndex = 0;

  const tips = [
    "Tip: Write supply inside [brackets] and the action after",
    "Tip: Write 'Swap' swap to indicate swapping Terran addons",
    "Tip: Write '-> Hatchery' to indicate a planned transition or next step. ->",
    {
      text: "Tip: Add 100% or @100% to mark when something is done — it shows a green check.",
      literal: true,
    },
    {
      text: "Tip: Write 50% or @50% to show progress — it gets an orange underline.",
      literal: true,
    },
  ];

  textElement.innerHTML = formatActionText(tips[0]);

  // Show/hide bubble based on input focus
  input.addEventListener("focus", () => {
    if (catIsActive) {
      bubble.classList.add("visible");
    }
  });

  input.addEventListener("blur", () => {
    bubble.classList.remove("visible");
  });

  cat.classList.remove("alert-pose", "tail-wiggle");

  input.addEventListener("click", () => {
    if (!catIsActive || catHelpShown) return;
    catHelpShown = true;

    clearTimeout(animationTimeout);
    clearInterval(tipInterval);

    cat.classList.remove("reset", "tail-wiggle");
    cat.classList.add("alert-pose");

    // Start with first tip
    textElement.textContent = tips[0];

    animationTimeout = setTimeout(() => {
      cat.classList.add("tail-wiggle");
    }, 1000);

    // Start interval rotation (every 30s)
    tipInterval = setInterval(() => {
      // Fade out text
      textElement.style.opacity = 0;

      setTimeout(() => {
        currentTipIndex = (currentTipIndex + 1) % tips.length;
        const tip = tips[currentTipIndex];

        const text = typeof tip === "string" ? tip : tip.text;

        if (typeof tip === "object" && tip.literal) {
          textElement.textContent = text; // no formatting
        } else {
          textElement.innerHTML = formatActionText(text); // apply formatting
        }

        textElement.style.opacity = 1;
      }, 500); // match transition duration
    }, 10000);
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !cat.contains(e.target)) {
      clearTimeout(animationTimeout);
      clearInterval(tipInterval);
      cat.classList.remove("alert-pose", "tail-wiggle");
      catHelpShown = false;
    }
  });

  cat.addEventListener("click", () => {
    catIsActive = !catIsActive;

    if (!catIsActive) {
      clearTimeout(animationTimeout);
      clearInterval(tipInterval);
      cat.classList.remove("alert-pose", "tail-wiggle");
      catHelpShown = false;
      cat.classList.add("inactive");
    } else {
      cat.classList.remove("inactive");

      // ✅ Only reactivate if input is focused
      if (document.activeElement === input) {
        input.click();
      }
    }
  });
}
