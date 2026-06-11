const express = require("express");

const router = express.Router();

router.post("/upload", (req, res) => {
  res.status(410).json({ error: "Use POST /api/register with pdf_file and json_file." });
});

module.exports = router;
