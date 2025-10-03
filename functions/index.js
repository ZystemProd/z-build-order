// functions/index.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const puppeteer = require("puppeteer");

admin.initializeApp();
const bucket = admin.storage().bucket();

// Your site URL
const SITE_URL = "/viewBuild.html"; // relative path

// Common crawler user-agents
const BOT_USER_AGENTS = [
  /googlebot/i,
  /bingbot/i,
  /yahoo/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
];

function isBot(userAgent) {
  return BOT_USER_AGENTS.some((regex) => regex.test(userAgent));
}

/**
 * Firestore trigger: pre-render new builds (v6+ modular)
 */
exports.renderNewBuild = onDocumentCreated(
  "publishedBuilds/{buildId}",
  async (event) => {
    const buildData = event.data;
    const buildId = event.params.buildId;

    console.log("🚀 Pre-rendering build:", buildId);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    const url = `${SITE_URL}?id=${buildId}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for SPA to populate the main build data
    // Adjust selectors to match your SPA
    await page.waitForSelector("#buildTitle", { timeout: 10000 });
    await page.waitForSelector("#buildUsername", { timeout: 10000 });
    await page.waitForSelector("#buildSteps", { timeout: 10000 });

    // Inject SEO meta tags dynamically
    await page.evaluate((data) => {
      const head = document.querySelector("head");

      // Title
      const titleTag = document.createElement("title");
      titleTag.textContent = `Z-Build Order – ${data.title}`;
      head.appendChild(titleTag);

      // Meta description
      const descTag = document.createElement("meta");
      descTag.name = "description";
      descTag.content = `StarCraft 2 build order by ${
        data.username || "Anonymous"
      }, matchup: ${data.subcategory || "Unknown"}`;
      head.appendChild(descTag);

      // Open Graph tags
      const ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      ogTitle.content = `Z-Build Order – ${data.title}`;
      head.appendChild(ogTitle);

      const ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      ogDesc.content = `Build order for ${data.subcategory || "Unknown"}`;
      head.appendChild(ogDesc);
    }, buildData);

    const html = await page.content();
    const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
    await file.save(html, { contentType: "text/html" });

    console.log("✅ Pre-rendered HTML saved for build:", buildId);

    await browser.close();
    return null;
  }
);

/**
 * HTTPS function: serve pre-rendered builds to crawlers (v6+)
 */
exports.servePreRenderedBuild = onRequest(async (req, res) => {
  let buildId = req.query.id;

  // If no query param, try extracting from path
  if (!buildId && req.path) {
    const parts = req.path.split("/").filter(Boolean); // remove empty segments
    buildId = parts[parts.length - 1]; // last segment is usually the build ID
  }

  if (!buildId) {
    res.status(400).send("Build ID missing.");
    return;
  }

  const userAgent = req.headers["user-agent"] || "";

  if (!isBot(userAgent)) {
    const host = req.headers.host;
    res.redirect(302, `/viewBuild.html?id=${buildId}`);

    return;
  }

  try {
    const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
    const [exists] = await file.exists();

    if (!exists) {
      res.status(404).send("Pre-rendered build not found.");
      return;
    }

    const [contents] = await file.download();
    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "public, max-age=300"); // 5 min cache

    res.status(200).send(contents.toString("utf-8"));
  } catch (err) {
    console.error("Error serving pre-rendered build:", err);
    res.status(500).send("Internal Server Error");
  }
});
