let catHelpShown = false;
let catIsActive = true; // <- new flag

export function setupCatActivationOnInput() {
  const input = document.getElementById("buildOrderInput");
  const cat = document.querySelector(".cat");
  const bubble = document.getElementById("catTipBubble");

  if (!input || !cat || !bubble) return;

  let animationTimeout;

  bubble.classList.remove("visible");
  cat.classList.remove("alert-pose", "tail-wiggle");

  input.addEventListener("click", () => {
    if (!catIsActive || catHelpShown) return;
    catHelpShown = true;

    clearTimeout(animationTimeout);
    cat.classList.remove("reset", "tail-wiggle");

    cat.classList.add("alert-pose");
    bubble.textContent =
      "Tip: Write supply inside [brackets] and the action after";
    bubble.classList.add("visible");

    animationTimeout = setTimeout(() => {
      cat.classList.add("tail-wiggle");
    }, 1000);
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !cat.contains(e.target)) {
      clearTimeout(animationTimeout);
      cat.classList.remove("alert-pose", "tail-wiggle");
      bubble.classList.remove("visible");
      catHelpShown = false;
    }
  });

  cat.addEventListener("click", () => {
    catIsActive = !catIsActive;

    if (!catIsActive) {
      clearTimeout(animationTimeout);
      cat.classList.remove("alert-pose", "tail-wiggle");
      bubble.classList.remove("visible");
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
