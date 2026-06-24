import express from "express";
import { saveDeviceScan } from "../controllers/register.controller.js";
import { deviceScanUpload } from "../middleware/upload.middleware.js";

const router = express.Router();

// Official scan upload endpoint.
router.post("/device-scan", deviceScanUpload, saveDeviceScan);
// Retain the original production endpoint while consumers migrate.
router.post("/register", deviceScanUpload, saveDeviceScan);

export default router;
