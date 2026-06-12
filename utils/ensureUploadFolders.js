import fs from "fs";
import path from "path";

export const ensureUploadFolders = () => {
  const baseDir = path.join(process.cwd(), "IP_INFO_FILE");
  const pdfDir = path.join(baseDir, "PDF_FILE");
  const jsonDir = path.join(baseDir, "JSON_FILE");

  [baseDir, pdfDir, jsonDir].forEach((folderPath) => {
    fs.mkdirSync(folderPath, { recursive: true });
  });

  return {
    baseDir,
    pdfDir,
    jsonDir
  };
};
