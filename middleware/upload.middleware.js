import path from "path";
import multer from "multer";
import { ensureUploadFolders } from "../utils/ensureUploadFolders.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const { jsonDir: JSON_DIR, pdfDir: PDF_DIR } = ensureUploadFolders();

const cleanPart = (value) =>
  String(value || "upload")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "upload";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "json_file") {
      return cb(null, JSON_DIR);
    }

    if (file.fieldname === "pdf_file") {
      return cb(null, PDF_DIR);
    }

    return cb(new Error("Invalid file field."));
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const pfNo = cleanPart(req.body.pf_no);
    cb(null, `${pfNo}_${Date.now()}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "json_file" && extension === ".json") {
    return cb(null, true);
  }

  if (file.fieldname === "pdf_file" && extension === ".pdf") {
    return cb(null, true);
  }

  return cb(new Error("Both pdf_file (.pdf) and json_file (.json) uploads are required."));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2
  }
});

export const registrationUpload = (req, res, next) => {
  upload.fields([
    { name: "pdf_file", maxCount: 1 },
    { name: "json_file", maxCount: 1 }
  ])(req, res, (error) => {
    if (!error) {
      return next();
    }

    return res.status(400).json({ error: error.message });
  });
};

export { JSON_DIR, PDF_DIR };
