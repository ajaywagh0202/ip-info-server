const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const SCANNER_FILENAME = process.env.SCRIPT_NAME || "ITC_System_Scanner_V2.exe";

const downloadScanner = (req, res) => {
  const scannerPath = path.join(__dirname, "..", "SCRIPT_FILE", SCANNER_FILENAME);

  if (!fs.existsSync(scannerPath)) {
    return res.status(404).json({ error: "Scanner file not available." });
  }

  res.setHeader("Content-Disposition", `attachment; filename="${SCANNER_FILENAME}"`);
  return res.download(scannerPath, SCANNER_FILENAME);
};

module.exports = {
  downloadScanner
};
