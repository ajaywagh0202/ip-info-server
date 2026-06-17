const path = require("path");
const multer = require("multer");

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const JSON_DIR = path.join(__dirname, "..", "IP_INFO_FILE", "JSON_FILE");
const PDF_DIR = path.join(__dirname, "..", "IP_INFO_FILE", "PDF_FILE");

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
    const dsrNo = cleanPart(req.body.dsr_no);
    cb(null, `${pfNo}_${dsrNo}_${Date.now()}${extension}`);
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

  return cb(new Error("Only pdf_file (.pdf) and json_file (.json) uploads are allowed."));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2
  }
});

const registrationUpload = (req, res, next) => {
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

module.exports = {
  registrationUpload,
  JSON_DIR,
  PDF_DIR
};
