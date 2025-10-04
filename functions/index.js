// functions/index.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer");

admin.initializeApp();
const bucket = admin.storage().bucket();

// Your site URL
const SITE_URL =
  process.env.SITE_URL || "https://z-build-order.web.app/viewBuild.html"; // absolute path

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
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

// Firestore trigger: pre-render builds on create or update
exports.renderNewBuild = onDocumentWritten(
  {
    document: "publishedBuilds/{buildId}",
    region: "us-central1",
    memory: "1GiB", // 👈 bump memory
    timeoutSeconds: 120, // 👈 optional: allow longer Puppeteer runs
  },
  async (event) => {
    const buildId = event.params.buildId;
    const buildData = event.data.after?.data();

    if (!buildData) {
      console.warn(
        "❌ No build data available (deleted?), skipping prerender for",
        buildId
      );
      return null;
    }

    console.log("🚀 Pre-rendering build:", buildId);

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();

    const url = `${SITE_URL}?id=${buildId}`;
    await page.goto(url, { waitUntil: "networkidle0" });

    const waitForSelectorWithWarning = async (selector, timeout = 10000) => {
      try {
        await page.waitForSelector(selector, { timeout });
      } catch (err) {
        console.warn(
          `⚠️ Selector ${selector} not found within ${timeout}ms for build ${buildId}:`,
          err.message
        );
      }
    };

    // Wait for SPA to populate the main build data
    await waitForSelectorWithWarning("#buildTitle");
    await waitForSelectorWithWarning("#buildPublisher");
    await waitForSelectorWithWarning("#buildOrder");

    try {
      await page.addScriptTag({
        url: "https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.3/purify.min.js",
      });
    } catch (err) {
      console.warn(
        "⚠️ Failed to load DOMPurify for sanitization:",
        err.message
      );
    }

    // Inject SEO meta tags dynamically
    await page.evaluate((data) => {
      const head = document.querySelector("head");
      if (!head || typeof DOMPurify === "undefined") {
        console.warn("⚠️ DOMPurify not available or head element missing");
        return;
      }

      const sanitizedTitle = DOMPurify.sanitize(data.title || "Untitled build");
      const sanitizedPublisher = DOMPurify.sanitize(
        data.publisher || "Anonymous"
      );
      const sanitizedSubcategory = DOMPurify.sanitize(
        data.subcategory || "Unknown"
      );

      // Title
      const titleTag = document.createElement("title");
      titleTag.textContent = `Z-Build Order – ${sanitizedTitle}`;
      head.appendChild(titleTag);

      // Meta description
      const descTag = document.createElement("meta");
      descTag.name = "description";
      descTag.content = `StarCraft 2 build order by ${sanitizedPublisher}, matchup: ${sanitizedSubcategory}`;
      head.appendChild(descTag);

      // Open Graph tags
      const ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      ogTitle.content = `Z-Build Order – ${sanitizedTitle}`;
      head.appendChild(ogTitle);

      const ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      ogDesc.content = `Build order for ${sanitizedSubcategory}`;
      head.appendChild(ogDesc);

      const ogPublisher = document.createElement("meta");
      ogPublisher.setAttribute("property", "og:site_name");
      ogPublisher.content = sanitizedPublisher;
      head.appendChild(ogPublisher);
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
    res.redirect(302, `/viewBuild.html?id=${buildId}`);
    return;
  }

  try {
    const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
    const [exists] = await file.exists();

    if (!exists) {
      res.redirect(302, `/viewBuild.html?id=${buildId}`);
      return;
    }

    const [contents] = await file.download();
    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");

    res.status(200).send(contents.toString("utf-8"));
  } catch (err) {
    console.error("Error serving pre-rendered build:", err);
    res.status(500).send("Internal Server Error");
  }
});
