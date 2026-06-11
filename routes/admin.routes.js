const express = require("express");
const {
  login,
  getRecords,
  getRecord,
  downloadRecordPdf,
  downloadRecordJson
} = require("../controllers/admin.controller");
const { requireAdminAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.get("/records", requireAdminAuth, getRecords);
router.get("/records/:id", requireAdminAuth, getRecord);
router.get("/records/:id/pdf", requireAdminAuth, downloadRecordPdf);
router.get("/records/:id/json", requireAdminAuth, downloadRecordJson);

module.exports = router;
