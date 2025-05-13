import DOMPurify from "dompurify";

export function initializeTooltips() {
  document.querySelectorAll(".tooltip").forEach((tooltip) => tooltip.remove()); // Remove existing tooltips to prevent duplication

  // Select all elements with a data-tooltip attribute
  const tooltipElements = document.querySelectorAll("[data-tooltip]");

  tooltipElements.forEach((element) => {
    const tooltipText = DOMPurify.sanitize(
      element.getAttribute("data-tooltip")
    );

    // Create a tooltip element
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.innerText = tooltipText;
    document.body.appendChild(tooltip); // Append tooltip to body

    function positionTooltip() {
      const rect = element.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;

      // Position tooltip slightly above the element, centered horizontally
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltipWidth / 2}px`;
      tooltip.style.top = `${rect.top + window.scrollY + rect.height + 5}px`; // Add 5px spacing
    }

    element.addEventListener("mouseenter", () => {
      positionTooltip();
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    });

    element.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    });

    // Update tooltip position on scroll and window resize
    window.addEventListener("scroll", positionTooltip);
    window.addEventListener("resize", positionTooltip);
  });
}

// ✅ Call this function again after dynamically adding elements
export function updateTooltips() {
  initializeTooltips();
}
