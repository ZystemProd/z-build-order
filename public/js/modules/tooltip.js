export function initializeTooltips() {
  // Select all elements with a data-tooltip attribute
  const tooltipElements = document.querySelectorAll("[data-tooltip]");

  tooltipElements.forEach((element) => {
    const tooltipText = element.getAttribute("data-tooltip");

    // Create a tooltip element
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.innerText = tooltipText;

    // Append the tooltip to the document body
    document.body.appendChild(tooltip);

    // Position the tooltip on hover
    element.addEventListener("mouseenter", (event) => {
      const rect = element.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;

      // Position tooltip slightly above the element, centered horizontally
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltipWidth / 2}px`;
      tooltip.style.top = `${rect.top + window.scrollY + rect.height + 5}px`; // Add 5px spacing below
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    });

    // Hide the tooltip when not hovering
    element.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    });
  });
}
