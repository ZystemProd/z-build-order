const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

exports.sitemap = require("./sitemap").sitemap;
