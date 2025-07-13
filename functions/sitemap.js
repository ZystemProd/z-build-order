const { onRequest } = require("firebase-functions/v2/https");
const admin = require("./admin.js");

exports.sitemap = onRequest(async (req, res) => {
  const db = admin.firestore();
  const buildsSnapshot = await db.collection("publishedBuilds").get();

  const urls = [];

  // Add homepage
  urls.push(`
  <url>
    <loc>https://zbuildorder.com/</loc>
    <priority>1.0</priority>
  </url>
  `);

  // Add published builds
  const slugify = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  buildsSnapshot.forEach((doc) => {
    const data = doc.data();

    // ✅ Safe fallback for lastmod
    let lastmod = new Date();
    if (data.datePublished) {
      try {
        lastmod = new Date(data.datePublished);
        if (isNaN(lastmod.getTime())) {
          lastmod = new Date(); // fallback if invalid
        }
      } catch (err) {
        lastmod = new Date(); // fallback if error
      }
    }
    const lastmodStr = lastmod.toISOString().split("T")[0];

    const matchup = (data.subcategory || "unknown").toLowerCase();
    const slug = slugify(data.title || "untitled");

    urls.push(`
  <url>
    <loc>https://zbuildorder.com/build/${matchup}/${slug}/${doc.id}</loc>
    <lastmod>${lastmodStr}</lastmod>
    <priority>0.8</priority>
  </url>
  `);
  });

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join("\n")}
</urlset>`.trim();

  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(sitemapXml);
});
