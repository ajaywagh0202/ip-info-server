const express = require("express");
const { downloadScanner } = require("../controllers/download.controller");

const router = express.Router();

router.get("/download/scanner", downloadScanner);

module.exports = router;
