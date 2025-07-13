/**
 * functions/index.js
 */

// ✅ Import V2 HTTP Functions if needed
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require("firebase-functions");

const admin = require("./admin.js");

// ✅ Export your sitemap function
exports.sitemap = require("./sitemap").sitemap;

// ✅ Export your SSR build page function
exports.ssrBuildPage = functions.https.onRequest(async (req, res) => {
  // Your SSR code here...
  try {
    const pathSegments = req.path.split("/");
    const buildId = pathSegments.pop() || pathSegments.pop();

    if (!buildId) {
      res.status(400).send("Bad request: missing build ID");
      return;
    }

    const doc = await admin
      .firestore()
      .collection("communityBuilds")
      .doc(buildId)
      .get();

    if (!doc.exists) {
      res.status(404).send("Build not found.");
      return;
    }

    const build = doc.data();

    const sanitize = (str) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>${sanitize(build.title)}</title>
        <meta charset="UTF-8" />
        <meta name="description" content="${sanitize(build.comment)}" />
      </head>
      <body>
        <h1>${sanitize(build.title)}</h1>
        <p><strong>Matchup:</strong> ${sanitize(build.subcategory)}</p>
        <p><strong>Publisher:</strong> ${sanitize(build.username)}</p>
        <h3>Build Order</h3>
        ${
          Array.isArray(build.buildOrder)
            ? build.buildOrder
                .map(
                  (step) =>
                    `<p>[${sanitize(step.workersOrTimestamp)}] ${sanitize(
                      step.action
                    )}</p>`
                )
                .join("")
            : "<p>No build order available.</p>"
        }
      </body>
      </html>
    `;

    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.status(200).send(html);
  } catch (err) {
    logger.error("SSR error:", err);
    res.status(500).send("Internal server error.");
  }
});
