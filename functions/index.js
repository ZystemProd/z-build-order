// functions/index.js
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");

admin.initializeApp();
const bucket = admin.storage().bucket();
const firestore = admin.firestore();

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const SITE_URL =
  process.env.SITE_URL || "https://z-build-order.web.app/viewBuild.html";

const BOT_USER_AGENTS = [
  /googlebot/i,
  /bingbot/i,
  /yahoo/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
];

const PRERENDER_TIMEOUT_MS = 60_000;
const SELECTORS_TO_WAIT = ["#buildTitle", "#buildPublisher", "#buildOrder"];

const CHROMIUM_ARGS = [
  ...chromium.args,
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
];

function isBot(userAgent = "") {
  return BOT_USER_AGENTS.some((regex) => regex.test(userAgent));
}

function sanitizeText(value, fallback) {
  const base = value == null ? "" : String(value);
  const sanitized = DOMPurify.sanitize(base, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
  return sanitized || fallback;
}

function buildMetaStrings(buildData) {
  const sanitizedTitle = sanitizeText(buildData.title, "Untitled build");
  const sanitizedPublisher = sanitizeText(
    buildData.publisher,
    "Anonymous"
  );
  const sanitizedSubcategory = sanitizeText(
    buildData.subcategory,
    "Unknown"
  );

  return {
    pageTitle: sanitizeText(
      `Z-Build Order – ${sanitizedTitle}`,
      "Z-Build Order"
    ),
    description: sanitizeText(
      `StarCraft 2 build order by ${sanitizedPublisher}, matchup: ${sanitizedSubcategory}`,
      "StarCraft 2 build order"
    ),
    ogTitle: sanitizeText(
      `Z-Build Order – ${sanitizedTitle}`,
      "Z-Build Order"
    ),
    ogDescription: sanitizeText(
      `Build order for ${sanitizedSubcategory}`,
      "StarCraft 2 build order"
    ),
    ogSiteName: sanitizedPublisher,
  };
}

async function waitForSelectorWithWarning(page, selector, buildId) {
  try {
    await page.waitForSelector(selector, { timeout: 10_000 });
  } catch (err) {
    console.warn(
      `⚠️ Selector ${selector} not found within timeout for build ${buildId}:`,
      err.message
    );
  }
}

async function launchBrowser() {
  return puppeteer.launch({
    args: CHROMIUM_ARGS,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
}

async function fetchBuildData(buildId) {
  const snapshot = await firestore
    .collection("publishedBuilds")
    .doc(buildId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data();
}

async function captureBuildHtml(buildId, buildDataFromEvent) {
  const buildData = buildDataFromEvent || (await fetchBuildData(buildId));

  if (!buildData) {
    throw new Error(`No build data found for ${buildId}`);
  }

  const meta = buildMetaStrings(buildData);
  const browser = await launchBrowser();
  let page;

  try {
    page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setDefaultNavigationTimeout(PRERENDER_TIMEOUT_MS);
    await page.setDefaultTimeout(PRERENDER_TIMEOUT_MS / 4);

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      try {
        const resourceType = request.resourceType();
        if (["image", "media", "font"].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      } catch (err) {
        console.warn(
          `⚠️ Request interception failed for ${request.url?.() || "unknown URL"}:`,
          err.message
        );
      }
    });

    const targetUrl = `${SITE_URL}?id=${encodeURIComponent(buildId)}`;
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: PRERENDER_TIMEOUT_MS });

    for (const selector of SELECTORS_TO_WAIT) {
      await waitForSelectorWithWarning(page, selector, buildId);
    }

    await page.evaluate((metaInfo) => {
      const head = document.head || document.querySelector("head");
      if (!head) {
        return;
      }

      const removeIfExists = (selector) => {
        const existing = head.querySelector(selector);
        if (existing) {
          existing.remove();
        }
      };

      document.title = metaInfo.pageTitle;

      removeIfExists('meta[name="description"]');
      const description = document.createElement("meta");
      description.name = "description";
      description.content = metaInfo.description;
      head.appendChild(description);

      removeIfExists('meta[property="og:title"]');
      const ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      ogTitle.content = metaInfo.ogTitle;
      head.appendChild(ogTitle);

      removeIfExists('meta[property="og:description"]');
      const ogDescription = document.createElement("meta");
      ogDescription.setAttribute("property", "og:description");
      ogDescription.content = metaInfo.ogDescription;
      head.appendChild(ogDescription);

      removeIfExists('meta[property="og:site_name"]');
      const ogSiteName = document.createElement("meta");
      ogSiteName.setAttribute("property", "og:site_name");
      ogSiteName.content = metaInfo.ogSiteName;
      head.appendChild(ogSiteName);
    }, meta);

    const html = await page.content();
    return html;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

async function saveHtmlToStorage(buildId, html) {
  const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
  await file.save(html, {
    contentType: "text/html",
    metadata: {
      cacheControl: "public, max-age=86400",
    },
  });
  return file;
}

async function renderAndStoreBuild(buildId, buildDataFromEvent) {
  const html = await captureBuildHtml(buildId, buildDataFromEvent);
  await saveHtmlToStorage(buildId, html);
  return html;
}

exports.renderNewBuild = onDocumentWritten(
  {
    document: "publishedBuilds/{buildId}",
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const buildId = event.params.buildId;
    const buildData = event.data.after?.data();

    if (!buildData) {
      console.warn(
        `❌ No build data available (deleted?), skipping prerender for ${buildId}`
      );
      return null;
    }

    console.log("🚀 Pre-rendering build:", buildId);

    try {
      await renderAndStoreBuild(buildId, buildData);
      console.log("✅ Pre-rendered HTML saved for build:", buildId);
    } catch (error) {
      console.error(`❌ Failed to pre-render build ${buildId}:`, error);
    }

    return null;
  }
);

exports.servePreRenderedBuild = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    let buildId = req.query.id;

    if (!buildId && req.path) {
      const parts = req.path.split("/").filter(Boolean);
      buildId = parts[parts.length - 1];
    }

    if (!buildId) {
      res.status(400).send("Build ID missing.");
      return;
    }

    const userAgent = req.headers["user-agent"] || "";

    if (!isBot(userAgent)) {
      res.redirect(302, `/viewBuild.html?id=${encodeURIComponent(buildId)}`);
      return;
    }

    res.set("Vary", "User-Agent");

    try {
      const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
      const [exists] = await file.exists();

      let html;

      if (exists) {
        const [contents] = await file.download();
        html = contents.toString("utf-8");
      } else {
        html = await renderAndStoreBuild(buildId);
      }

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300, s-maxage=600");

      res.status(200).send(html);
    } catch (error) {
      console.error("Error serving pre-rendered build:", error);
      res.redirect(302, `/viewBuild.html?id=${encodeURIComponent(buildId)}`);
    }
  }
);
