// functions/admin.js
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

module.exports = admin;
