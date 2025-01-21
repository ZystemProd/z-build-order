export function parseBuildOrder(buildOrderText) {
  return buildOrderText
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(.*?)\]\s*(.*)/);
      return match
        ? { workersOrTimestamp: match[1], action: match[2] }
        : { workersOrTimestamp: "", action: line };
    })
    .filter((step) => step.action.trim() !== ""); // Filter out empty lines
}
