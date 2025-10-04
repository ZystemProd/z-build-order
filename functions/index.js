// functions/index.js
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const path = require("path");
const fs = require("fs/promises");

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

const SPA_INDEX_PATH = path.resolve(__dirname, "../dist/viewBuild.html");
let cachedSpaIndex = null;

const SPA_REMOTE_URL = sanitizeUrl(
  process.env.SPA_FALLBACK_URL || SITE_URL,
  "https://z-build-order.web.app/viewBuild.html"
);

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

function sanitizeUrl(value, fallback) {
  const sanitized = sanitizeText(value, "");
  if (sanitized) {
    return sanitized;
  }
  return sanitizeText(fallback, fallback);
}

async function loadSpaIndex() {
  if (!cachedSpaIndex) {
    try {
      cachedSpaIndex = await fs.readFile(SPA_INDEX_PATH, "utf8");
    } catch (error) {
      console.warn(
        "⚠️ Failed to read SPA index from filesystem:",
        error.message
      );

      try {
        const response = await fetch(SPA_REMOTE_URL, {
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(
            `Unexpected status ${response.status} when fetching SPA fallback.`
          );
        }

        cachedSpaIndex = await response.text();
      } catch (fetchError) {
        console.error("❌ Failed to download SPA index fallback:", fetchError);
        throw fetchError;
      }
    }
  }
  return cachedSpaIndex;
}

async function sendSpaIndex(res, statusCode = 200) {
  const spaHtml = await loadSpaIndex();
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "public, max-age=0, s-maxage=600");
  res.status(statusCode).send(spaHtml);
}

function extractBuildIdFromRequest(req) {
  if (!req) return "";

  const queryId = req.query?.id;
  if (queryId) {
    return decodeURIComponent(String(queryId));
  }

  const pathToInspect = req.path || req.originalUrl || "";
  const prettyMatch = pathToInspect.match(/\/build\/[^/]+\/[^/]+\/([^/?#]+)/i);
  if (prettyMatch?.[1]) {
    return decodeURIComponent(prettyMatch[1]);
  }

  const shortMatch = pathToInspect.match(/\/build\/([^/?#]+)/i);
  if (shortMatch?.[1]) {
    return decodeURIComponent(shortMatch[1]);
  }

  return "";
}

function buildCanonicalUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = sanitizeUrl(forwardedProto, "https");
  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
  const host = sanitizeUrl(forwardedHost, "zbuildorder.com");
  const pathPortion = sanitizeUrl(req.path || "/", "/");

  return `${protocol}://${host}${pathPortion}`;
}

function addCanonicalLink(html, canonicalUrl) {
  if (!html || !canonicalUrl) {
    return html;
  }

  try {
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const head = document.head || document.createElement("head");

    const sanitizedCanonical = sanitizeUrl(canonicalUrl, canonicalUrl);

    const existing = head.querySelector('link[rel="canonical"]');
    if (existing) {
      existing.setAttribute("href", sanitizedCanonical);
    } else {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", sanitizedCanonical);
      head.appendChild(link);
    }

    return dom.serialize();
  } catch (error) {
    console.warn("⚠️ Failed to inject canonical link:", error.message);
    return html;
  }
}

function buildMetaStrings(buildData) {
  const sanitizedTitle = sanitizeText(buildData.title, "Untitled build");
  const sanitizedPublisher = sanitizeText(buildData.publisher, "Anonymous");
  const sanitizedSubcategory = sanitizeText(buildData.subcategory, "Unknown");

  return {
    pageTitle: sanitizeText(
      `Z-Build Order – ${sanitizedTitle}`,
      "Z-Build Order"
    ),
    description: sanitizeText(
      `StarCraft 2 build order by ${sanitizedPublisher}, matchup: ${sanitizedSubcategory}`,
      "StarCraft 2 build order"
    ),
    ogTitle: sanitizeText(`Z-Build Order – ${sanitizedTitle}`, "Z-Build Order"),
    ogDescription: sanitizeText(
      `Build order for ${sanitizedSubcategory}`,
      "StarCraft 2 build order"
    ),
    ogSiteName: sanitizedPublisher,
  };
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

async function waitForFirestoreContent(
  page,
  buildId,
  {
    timeoutMs = 30_000,
    pollMs = 500,
  } = {}
) {
  console.log(
    `⏳ Waiting for Firestore data to load for build ${buildId} (timeout ${timeoutMs}ms)...`
  );

  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const status = await page.evaluate(() => {
      const textContent = (selector) =>
        document.querySelector(selector)?.textContent?.trim() || "";
      const innerText = (selector) =>
        document.querySelector(selector)?.innerText?.trim() || "";

      const fields = {
        title: textContent("#buildTitle"),
        publisher: textContent("#buildPublisher"),
        matchup: textContent("#buildMatchup"),
        buildOrder: innerText("#buildOrder"),
      };

      const hasContent = (value) =>
        value && value !== "Loading..." && value.length > 0;

      const buildOrderReady =
        hasContent(fields.buildOrder) && !fields.buildOrder.includes("Loading...");

      const ready =
        hasContent(fields.title) &&
        hasContent(fields.publisher) &&
        hasContent(fields.matchup) &&
        buildOrderReady;

      const missing = [];
      if (!hasContent(fields.title)) missing.push("title");
      if (!hasContent(fields.publisher)) missing.push("publisher");
      if (!hasContent(fields.matchup)) missing.push("matchup");
      if (!buildOrderReady) missing.push("build order");

      return { ready, fields, missing };
    });

    if (status.ready) {
      console.log(
        `✅ Firestore content loaded for build ${buildId} after ${Date.now() -
          startedAt}ms.`,
        status.fields
      );
      return status.fields;
    }

    attempt += 1;
    console.log(
      `⏳ Waiting for content attempt ${attempt} for build ${buildId}. Missing: ${
        status.missing.length ? status.missing.join(", ") : "unknown"
      }. Current values:`,
      status.fields
    );

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for Firestore content for build ${buildId}.`
  );
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

    // Intercept requests to reduce bandwidth usage
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
          `⚠️ Request interception failed for ${
            request.url?.() || "unknown URL"
          }:`,
          err.message
        );
      }
    });

    const targetUrl = `${SITE_URL}?id=${encodeURIComponent(buildId)}`;
    await page.goto(targetUrl, {
      waitUntil: "networkidle0",
      timeout: PRERENDER_TIMEOUT_MS,
    });

    // ✅ Wait for main elements to load
    await Promise.all([
      waitForSelectorWithWarning(page, "#buildTitle", buildId),
      waitForSelectorWithWarning(page, "#buildPublisher", buildId),
      waitForSelectorWithWarning(page, "#buildOrder", buildId),
    ]);

    const firestoreContent = await waitForFirestoreContent(page, buildId);

    console.log(
      `✅ Build data fully loaded for prerender: ${buildId}`,
      firestoreContent
    );

    try {
      await page.waitForFunction(
        () => {
          const comment =
            document.querySelector("#buildComment")?.textContent?.trim() ||
            document.querySelector("#commentInput")?.value?.trim() ||
            "";
          return comment.length > 0;
        },
        { timeout: 5_000 }
      );
      console.log(`✅ Comment loaded successfully for build ${buildId}.`);
    } catch {
      console.warn(`⚠️ Comment not found or still empty for build ${buildId}.`);
    }

    // ✅ Inject SEO-friendly meta tags dynamically
    await page.evaluate(() => {
      const head = document.head || document.querySelector("head");
      if (!head) return;

      const removeIfExists = (selector) => {
        const existing = head.querySelector(selector);
        if (existing) existing.remove();
      };

      // Extract live data from DOM
      const title =
        document.querySelector("#buildTitle")?.textContent?.trim() ||
        "Untitled Build";
      const publisher =
        document.querySelector("#buildPublisher")?.textContent?.trim() ||
        "Anonymous";
      const matchup =
        document.querySelector("#buildMatchup")?.textContent?.trim() ||
        "Unknown matchup";
      const comment =
        document.querySelector("#buildComment")?.textContent?.trim() ||
        document.querySelector("#commentInput")?.value?.trim() ||
        "";

      const pageTitle = `Z-Build Order – ${title}`;
      const description =
        comment || `StarCraft 2 build order by ${publisher} (${matchup}).`;
      const ogTitle = pageTitle;
      const ogDescription =
        comment || `Build order for ${matchup} by ${publisher}.`;
      const ogSiteName = publisher;

      document.title = pageTitle;

      removeIfExists('meta[name="description"]');
      const metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      metaDesc.content = description;
      head.appendChild(metaDesc);

      removeIfExists('meta[property="og:title"]');
      const ogTitleTag = document.createElement("meta");
      ogTitleTag.setAttribute("property", "og:title");
      ogTitleTag.content = ogTitle;
      head.appendChild(ogTitleTag);

      removeIfExists('meta[property="og:description"]');
      const ogDescTag = document.createElement("meta");
      ogDescTag.setAttribute("property", "og:description");
      ogDescTag.content = ogDescription;
      head.appendChild(ogDescTag);

      removeIfExists('meta[property="og:site_name"]');
      const ogSiteTag = document.createElement("meta");
      ogSiteTag.setAttribute("property", "og:site_name");
      ogSiteTag.content = ogSiteName;
      head.appendChild(ogSiteTag);

      removeIfExists('link[rel="canonical"]');
      const canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      const path = window.location.pathname.replace(/^\/+/, "");
      canonical.setAttribute("href", `https://zbuildorder.com/${path}`);
      head.appendChild(canonical);
    });

    const metaSummary = await page.evaluate(() => {
      const textContent = (selector) =>
        document.querySelector(selector)?.textContent?.trim() || "";
      const getMetaContent = (selector) =>
        document.querySelector(selector)?.getAttribute("content") || "";

      return {
        title: document.title,
        publisher: textContent("#buildPublisher"),
        matchup: textContent("#buildMatchup"),
        description: getMetaContent('meta[name="description"]'),
        ogTitle: getMetaContent('meta[property="og:title"]'),
        ogDescription: getMetaContent('meta[property="og:description"]'),
      };
    });

    console.log(`✅ Final metadata for build ${buildId}:`, metaSummary);

    // ✅ Return final prerendered HTML
    const html = await page.content();
    return html;
  } catch (error) {
    console.error(`❌ Error during prerender for build ${buildId}:`, error);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await browser.close().catch(() => {});

    // Cleanup Chrome temp files to avoid EFAULT
    try {
      //await fs.rm("/tmp", { recursive: true, force: true });
    } catch (err) {
      console.warn("⚠️ Failed to clean /tmp:", err.message);
    }
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

async function getPrerenderedHtml(buildId) {
  const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
  const [exists] = await file.exists();

  if (exists) {
    const [contents] = await file.download();
    return contents.toString("utf-8");
  }

  return renderAndStoreBuild(buildId);
}

exports.renderNewBuild = onDocumentWritten(
  {
    document: "publishedBuilds/{buildId}",
    region: "us-central1",
    memory: "2GiB", // ⬅️ Increase from 1GiB
    timeoutSeconds: 180,
    concurrency: 1, // Optional safeguard
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
    const buildId = extractBuildIdFromRequest(req);

    if (!buildId) {
      res.status(400).send("Build ID missing.");
      return;
    }

    res.set("Vary", "User-Agent");

    const userAgent = req.headers["user-agent"] || "";
    const canonicalUrl = buildCanonicalUrl(req);

    if (!isBot(userAgent)) {
      try {
        await sendSpaIndex(res);
      } catch (error) {
        console.error("❌ Failed to serve SPA fallback:", error);
        res.status(500).send("Application unavailable.");
      }
      return;
    }

    try {
      let html = await getPrerenderedHtml(buildId);
      html = addCanonicalLink(html, canonicalUrl);

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300, s-maxage=600");

      res.status(200).send(html);
    } catch (error) {
      console.error("❌ Error serving pre-rendered build:", error);
      try {
        await sendSpaIndex(res);
      } catch (spaError) {
        console.error("❌ Failed to fallback to SPA index:", spaError);
        res.status(500).send("Application unavailable.");
      }
    }
  }
);
