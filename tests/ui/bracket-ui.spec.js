import { test, expect } from "@playwright/test";

const FORMATS = ["Single Elimination", "Double Elimination"];

async function renderBracket(page, playerCount, format) {
  const result = await page.evaluate(
    ({ playerCount, format }) => window.renderBracketTest(playerCount, format),
    { playerCount, format }
  );
  await page.waitForFunction(
    (expected) =>
      document.querySelectorAll(".match-card").length === expected,
    result.matchCount
  );
  return result.matchCount;
}

async function assertCardsVisible(page) {
  const issues = await page.evaluate(() => {
    const grid = document.getElementById("bracketGrid");
    if (!grid) return ["Missing bracket grid"];
    const gridRect = grid.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll(".match-card"));
    const errors = [];
    cards.forEach((card) => {
      const style = window.getComputedStyle(card);
      if (style.display === "none" || style.visibility === "hidden") {
        errors.push(`Card ${card.dataset.matchId || "unknown"} hidden`);
        return;
      }
      card.scrollIntoView({ block: "center", inline: "center" });
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        errors.push(`Card ${card.dataset.matchId || "unknown"} has no size`);
        return;
      }
      if (
        rect.right < gridRect.left ||
        rect.left > gridRect.right ||
        rect.bottom < gridRect.top ||
        rect.top > gridRect.bottom
      ) {
        errors.push(
          `Card ${card.dataset.matchId || "unknown"} not reachable in grid`
        );
      }
    });
    return errors;
  });
  expect(issues).toEqual([]);
}

test.describe("Bracket UI visibility", () => {
  for (const format of FORMATS) {
    test(`renders all matches for ${format} up to 32 players`, async ({
      page,
    }) => {
      await page.goto("/bracket-test.html", { waitUntil: "networkidle" });
      for (let count = 2; count <= 32; count += 1) {
        await renderBracket(page, count, format);
        await assertCardsVisible(page);
      }
    });
  }
});
