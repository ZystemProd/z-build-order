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
  process.env.SITE_URL || "https://zbuildorder.com/viewBuild.html";

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
const MAX_PRERENDER_ATTEMPTS = 3;
const REQUIRED_STATIC_SELECTORS = [
  "#buildTitle",
  "#buildPublisher",
  "#buildOrder",
];

const SPA_INDEX_PATH = path.resolve(__dirname, "../dist/viewBuild.html");
let cachedSpaIndex = null;
let cachedStaticTemplate = null;

const SPA_REMOTE_URL = sanitizeUrl(
  process.env.SPA_FALLBACK_URL || SITE_URL,
  "https://zbuildorder.com/viewBuild.html"
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

async function loadStaticPrerenderTemplate() {
  if (cachedStaticTemplate) {
    return cachedStaticTemplate;
  }

  const baseHtml = await loadSpaIndex();

  try {
    const dom = new JSDOM(baseHtml);
    const { document } = dom.window;

    document.querySelectorAll("script").forEach((node) => node.remove());
    document
      .querySelectorAll('link[rel="modulepreload"], link[rel="preload"]')
      .forEach((node) => node.remove());

    cachedStaticTemplate = dom.serialize();
  } catch (error) {
    console.warn(
      "⚠️ Failed to sanitize SPA template for prerender:",
      error.message
    );
    cachedStaticTemplate = baseHtml;
  }

  return cachedStaticTemplate;
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

function formatMatchupText(subcategory) {
  const sanitized = sanitizeText(subcategory, "");
  if (!sanitized) {
    return "Unknown matchup";
  }

  if (sanitized.length === 3) {
    return (
      sanitized.charAt(0).toUpperCase() +
      sanitized.charAt(1) +
      sanitized.charAt(2).toUpperCase()
    );
  }

  return sanitized;
}

function formatPublishedDate(dateValue) {
  let raw = dateValue;
  if (raw?.toMillis) {
    raw = raw.toMillis();
  }

  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      raw = parsed;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}-${year}`;
}

function createBuildOrderHtml(buildOrder) {
  if (!Array.isArray(buildOrder) || buildOrder.length === 0) {
    return "<p>No build order available.</p>";
  }

  const rows = [];

  for (const step of buildOrder) {
    if (typeof step === "string") {
      const action = sanitizeText(step, "");
      if (action) {
        rows.push(`<p>${action}</p>`);
      }
      continue;
    }

    if (step && typeof step === "object") {
      const action = sanitizeText(step.action, "");
      if (!action) {
        continue;
      }

      const prefix = sanitizeText(step.workersOrTimestamp, "");
      const prefixHtml = prefix ? `<strong>${prefix}</strong> ` : "";
      rows.push(`<p>${prefixHtml}${action}</p>`);
    }
  }

  if (rows.length === 0) {
    return "<p>No build order available.</p>";
  }

  return rows.join("");
}

function buildMetaStrings(buildData) {
  const sanitizedTitle = sanitizeText(buildData.title, "Untitled build");
  const sanitizedPublisher = sanitizeText(
    buildData.publisher || buildData.username,
    "Anonymous"
  );
  const sanitizedSubcategory = sanitizeText(buildData.subcategory, "Unknown");
  const sanitizedComment = sanitizeText(buildData.comment, "");
  const formattedMatchup = formatMatchupText(sanitizedSubcategory);

  const defaultDescription = sanitizeText(
    `StarCraft 2 build order by ${sanitizedPublisher}, matchup: ${formattedMatchup}`,
    "StarCraft 2 build order"
  );
  const defaultOgDescription = sanitizeText(
    `Build order for ${formattedMatchup} by ${sanitizedPublisher}.`,
    "StarCraft 2 build order"
  );
  const description = sanitizedComment || defaultDescription;
  const ogDescription = sanitizedComment || defaultOgDescription;

  return {
    pageTitle: sanitizeText(
      `Z-Build Order – ${sanitizedTitle}`,
      "Z-Build Order"
    ),
    description,
    ogTitle: sanitizeText(`Z-Build Order – ${sanitizedTitle}`, "Z-Build Order"),
    ogDescription,
    ogSiteName: sanitizedPublisher,
  };
}

function buildPrerenderPayload(buildData) {
  const title = sanitizeText(buildData.title, "Untitled Build");
  const publisher = sanitizeText(
    buildData.username || buildData.publisher || buildData.publisherName,
    "Anonymous"
  );
  const category = sanitizeText(buildData.category, "Unknown");
  const matchup = formatMatchupText(buildData.subcategory);
  const comment = sanitizeText(buildData.comment, "");

  const buildOrderHtml = createBuildOrderHtml(buildData.buildOrder);
  const buildOrderStepCount = Array.isArray(buildData.buildOrder)
    ? buildData.buildOrder.length
    : 0;

  const datePublished = formatPublishedDate(
    buildData.datePublished ||
      buildData.timestamp ||
      buildData.updatedAt ||
      buildData.createdAt
  );

  const replayUrl = sanitizeUrl(buildData.replayUrl || "", "");
  const videoUrl = sanitizeUrl(
    buildData.videoLink || buildData.youtube || "",
    ""
  );

  const meta = buildMetaStrings({
    title,
    publisher,
    username: publisher,
    subcategory: matchup,
    comment,
  });

  return {
    title,
    publisher,
    category,
    matchup,
    comment,
    hasComment: Boolean(comment),
    datePublished,
    buildOrderHtml,
    buildOrderStepCount,
    replayUrl,
    videoUrl,
    meta,
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

function analyzeHtmlForPlaceholders(html, buildId = "unknown") {
  if (!html) {
    return {
      ready: false,
      fields: {
        title: "",
        publisher: "",
        matchup: "",
        buildOrder: "",
      },
      missing: ["html"],
    };
  }

  try {
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const textContent = (selector) =>
      document.querySelector(selector)?.textContent?.trim() || "";

    const normalize = (value) =>
      (value || "")
        .replace(/\u2026/g, "...")
        .replace(/\s+/g, " ")
        .trim();

    const isPlaceholder = (value) => {
      const normalized = normalize(value);
      if (!normalized) return true;
      const lower = normalized.toLowerCase();
      if (lower === "loading" || lower === "loading..." || lower === "loading..") {
        return true;
      }
      return lower.startsWith("loading") && normalized.length <= 30;
    };

    const buildOrderContainer = document.querySelector("#buildOrder");
    const buildOrderText = normalize(buildOrderContainer?.textContent || "");

    const fields = {
      title: normalize(textContent("#buildTitle")),
      publisher: normalize(textContent("#buildPublisher")),
      matchup: normalize(textContent("#buildMatchup")),
      buildOrder: buildOrderText,
    };

    const buildOrderHasContent =
      !!buildOrderContainer &&
      !isPlaceholder(buildOrderText) &&
      buildOrderText.length > 0;

    const ready =
      !isPlaceholder(fields.title) &&
      !isPlaceholder(fields.publisher) &&
      !isPlaceholder(fields.matchup) &&
      buildOrderHasContent;

    const missing = [];
    if (isPlaceholder(fields.title)) missing.push("title");
    if (isPlaceholder(fields.publisher)) missing.push("publisher");
    if (isPlaceholder(fields.matchup)) missing.push("matchup");
    if (!buildOrderHasContent) missing.push("build order");

    if (!ready) {
      console.warn(
        `⚠️ Cached HTML for build ${buildId} is missing data:`,
        missing,
        fields
      );
    }

    return { ready, fields, missing };
  } catch (error) {
    console.warn(
      `⚠️ Failed to analyze prerendered HTML for build ${buildId}:`,
      error
    );
    return {
      ready: false,
      fields: {
        title: "",
        publisher: "",
        matchup: "",
        buildOrder: "",
      },
      missing: ["parse"],
    };
  }
}

async function captureBuildHtml(buildId, buildDataFromEvent) {
  const buildData = buildDataFromEvent || (await fetchBuildData(buildId));
  if (!buildData) {
    throw new Error(`No build data found for ${buildId}`);
  }

  const payload = buildPrerenderPayload(buildData);
  const staticTemplate = await loadStaticPrerenderTemplate();
  console.log(`📦 Loaded Firestore data for build ${buildId}.`, {
    title: payload.title,
    publisher: payload.publisher,
    matchup: payload.matchup,
    category: payload.category,
    steps: payload.buildOrderStepCount,
    hasComment: payload.hasComment,
  });
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
        if (["image", "media", "font", "script"].includes(resourceType)) {
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

    await page.setContent(staticTemplate, {
      waitUntil: "domcontentloaded",
    });

    const missingSelectors = await page.evaluate(
      (selectors) =>
        selectors.filter((selector) => !document.querySelector(selector)),
      REQUIRED_STATIC_SELECTORS
    );

    if (missingSelectors.length > 0) {
      throw new Error(
        `Static template missing required selectors: ${missingSelectors.join(", ")}`
      );
    }

    console.log(`🧩 Injecting Firestore data into DOM for build ${buildId}.`, {
      title: payload.title,
      publisher: payload.publisher,
      matchup: payload.matchup,
      category: payload.category,
      steps: payload.buildOrderStepCount,
      hasComment: payload.hasComment,
    });

    await page.evaluate(({ data }) => {
      const doc = document;
      const head = doc.head || doc.querySelector("head");

      const setTextContent = (selector, value) => {
        const element = doc.querySelector(selector);
        if (element && typeof value === "string") {
          element.textContent = value;
        }
      };

      const setInnerHtml = (selector, value) => {
        const element = doc.querySelector(selector);
        if (element && typeof value === "string") {
          element.innerHTML = value;
        }
      };

      const toggleDisplay = (selector, shouldShow) => {
        const element = doc.querySelector(selector);
        if (element) {
          element.style.display = shouldShow ? "block" : "none";
        }
      };

      setTextContent("#buildTitle", data.title);
      setTextContent("#buildPublisher", data.publisher);
      setTextContent("#buildPublisherMobile", data.publisher);
      setTextContent("#buildCategory", data.category);
      setTextContent("#buildCategoryMobile", data.category);
      setTextContent("#buildMatchup", data.matchup);
      setTextContent("#buildMatchupMobile", data.matchup);
      setTextContent("#buildDate", data.datePublished);
      setTextContent("#buildDateMobile", data.datePublished);

      setInnerHtml("#buildOrder", data.buildOrderHtml);

      if (data.hasComment) {
        setTextContent("#buildComment", data.comment);
        toggleDisplay("#buildComment", true);
        toggleDisplay("#commentHeader", true);
      } else {
        setTextContent("#buildComment", "");
        toggleDisplay("#buildComment", false);
        toggleDisplay("#commentHeader", false);
      }

      const replayWrapper = doc.querySelector("#replayViewWrapper");
      const replayHeader = doc.querySelector("#replayHeader");
      const replayBtn = doc.querySelector("#replayDownloadBtn");
      if (replayWrapper && replayHeader && replayBtn) {
        if (data.replayUrl) {
          replayBtn.href = data.replayUrl;
          replayWrapper.style.display = "block";
          replayHeader.style.display = "block";
        } else {
          replayBtn.removeAttribute("href");
          replayWrapper.style.display = "none";
          replayHeader.style.display = "none";
        }
      }

      if (head && data.meta) {
        const removeIfExists = (selector) => {
          const existing = head.querySelector(selector);
          if (existing) existing.remove();
        };

        doc.title = data.meta.pageTitle;

        removeIfExists('meta[name="description"]');
        const metaDesc = doc.createElement("meta");
        metaDesc.name = "description";
        metaDesc.content = data.meta.description;
        head.appendChild(metaDesc);

        removeIfExists('meta[property="og:title"]');
        const ogTitleTag = doc.createElement("meta");
        ogTitleTag.setAttribute("property", "og:title");
        ogTitleTag.content = data.meta.ogTitle;
        head.appendChild(ogTitleTag);

        removeIfExists('meta[property="og:description"]');
        const ogDescTag = doc.createElement("meta");
        ogDescTag.setAttribute("property", "og:description");
        ogDescTag.content = data.meta.ogDescription;
        head.appendChild(ogDescTag);

        removeIfExists('meta[property="og:site_name"]');
        const ogSiteTag = doc.createElement("meta");
        ogSiteTag.setAttribute("property", "og:site_name");
        ogSiteTag.content = data.meta.ogSiteName;
        head.appendChild(ogSiteTag);

        removeIfExists('meta[property="og:image"]');
        const ogImageTag = doc.createElement("meta");
        ogImageTag.setAttribute("property", "og:image");
        ogImageTag.content = "https://zbuildorder.com/img/og-image.webp";
        head.appendChild(ogImageTag);

        removeIfExists('link[rel="canonical"]');
        const canonical = doc.createElement("link");
        canonical.setAttribute("rel", "canonical");
        const path = window.location.pathname.replace(/^\/+/, "");
        canonical.setAttribute("href", `https://zbuildorder.com/${path}`);
        head.appendChild(canonical);

        removeIfExists('meta[name="robots"]');
        const robotsTag = doc.createElement("meta");
        robotsTag.setAttribute("name", "robots");
        robotsTag.content = "index,follow";
        head.appendChild(robotsTag);
      }
    }, { data: payload });

    console.log(`✅ DOM updated using Firestore data for build ${buildId}.`);

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

async function renderAndStoreBuild(buildId, buildDataFromEvent, attempt = 1) {
  const html = await captureBuildHtml(buildId, buildDataFromEvent);
  const analysis = analyzeHtmlForPlaceholders(html, buildId);

  if (!analysis.ready) {
    if (attempt < MAX_PRERENDER_ATTEMPTS) {
      console.warn(
        `⚠️ Attempt ${attempt} for build ${buildId} returned incomplete data. Retrying...`
      );
      return renderAndStoreBuild(buildId, buildDataFromEvent, attempt + 1);
    }

    throw new Error(
      `Failed to capture complete content for build ${buildId} after ${attempt} attempts.`
    );
  }

  await saveHtmlToStorage(buildId, html);
  return html;
}

async function getPrerenderedHtml(buildId) {
  const file = bucket.file(`preRenderedBuilds/${buildId}.html`);
  const [exists] = await file.exists();

  if (exists) {
    const [contents] = await file.download();
    const html = contents.toString("utf-8");
    const analysis = analyzeHtmlForPlaceholders(html, buildId);

    if (analysis.ready) {
      return html;
    }

    console.warn(
      `⚠️ Re-rendering build ${buildId} because cached HTML is incomplete. Missing: ${analysis.missing.join(", ")}`
    );

    try {
      await file.delete({ ignoreNotFound: true });
      console.log(`🧹 Removed stale prerendered HTML for build ${buildId}.`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to delete stale prerendered HTML for build ${buildId}:`,
        error.message
      );
    }
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
