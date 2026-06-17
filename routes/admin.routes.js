import express from "express";
import {
  login,
  getRecords,
  getRecord,
  downloadRecordPdf,
  downloadRecordJson
} from "../controllers/admin.controller.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/records", requireAdminAuth, getRecords);
router.get("/records/:id", requireAdminAuth, getRecord);
router.get("/records/:id/pdf", requireAdminAuth, downloadRecordPdf);
router.get("/records/:id/json", requireAdminAuth, downloadRecordJson);

export default router;
