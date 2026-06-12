import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCANNER_FILENAME = process.env.SCRIPT_NAME || "ITC_System_Scanner_V2.exe";

export const downloadScanner = (req, res) => {
  const scannerPath = path.join(__dirname, "..", "SCRIPT_FILE", SCANNER_FILENAME);

  if (!fs.existsSync(scannerPath)) {
    return res.status(404).json({ error: "Scanner file not available." });
  }

  res.setHeader("Content-Disposition", `attachment; filename="${SCANNER_FILENAME}"`);
  return res.download(scannerPath, SCANNER_FILENAME);
};
