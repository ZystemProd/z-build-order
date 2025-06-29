const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

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
  buildsSnapshot.forEach((doc) => {
    const data = doc.data();
    const lastmod = data.datePublished
      ? new Date(data.datePublished).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    urls.push(`
      <url>
        <loc>https://zbuildorder.com/build/${doc.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <priority>0.8</priority>
      </url>
    `);
  });

  const sitemapXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls.join("\n")}
    </urlset>
  `.trim();

  res.set("Content-Type", "application/xml");
  res.status(200).send(sitemapXml);
});
